/**
 * strava-oauth-start — genera el state temporal y devuelve la URL de autorización de Strava.
 *
 * Recibe: POST { portal_token: string }
 * Devuelve: { auth_url: string }
 *
 * El state_token es aleatorio, de un solo uso, con expiración de 10 minutos.
 * Nunca usa el portal_token como state OAuth.
 * verify_jwt: false — llamada desde portal de cliente (sin autenticación Supabase).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
const REDIRECT_URI    = "https://idelri.com/strava/callback"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405)
  }

  let portalToken: string
  try {
    const body = await req.json()
    portalToken = body.portal_token
    if (!portalToken || typeof portalToken !== "string") throw new Error()
  } catch {
    return json({ error: "invalid_body", message: "portal_token requerido." }, 400)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Resolver portal_token → cliente_id mediante la RPC existente
  const { data: clienteRows, error: rpcErr } = await supabase
    .rpc("get_cliente_por_token", { p_token: portalToken })

  if (rpcErr || !clienteRows?.length) {
    return json({ error: "cliente_not_found" }, 404)
  }

  const clienteId: string = clienteRows[0].id

  // Si ya hay una conexión activa, no generamos un nuevo estado
  const { data: existing } = await supabase
    .from("strava_conexiones")
    .select("id, activa")
    .eq("cliente_id", clienteId)
    .maybeSingle()

  if (existing?.activa) {
    return json({ error: "already_connected" }, 409)
  }

  // Generar state aleatorio de un solo uso
  const stateToken = crypto.randomUUID()
  const expiresAt  = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutos

  const { error: insertErr } = await supabase
    .from("strava_oauth_states")
    .insert({ state_token: stateToken, cliente_id: clienteId, expires_at: expiresAt, used: false })

  if (insertErr) {
    console.error("[strava-oauth-start] insert error:", insertErr.message)
    return json({ error: "state_creation_failed" }, 500)
  }

  // Construir URL de autorización de Strava (documentación verificada)
  // https://www.strava.com/oauth/authorize
  const authUrl = new URL(STRAVA_AUTH_URL)
  authUrl.searchParams.set("client_id",       Deno.env.get("STRAVA_CLIENT_ID")!)
  authUrl.searchParams.set("redirect_uri",    REDIRECT_URI)
  authUrl.searchParams.set("response_type",   "code")
  authUrl.searchParams.set("approval_prompt", "force")        // siempre muestra la pantalla de autorización
  authUrl.searchParams.set("scope",           "activity:read_all")
  authUrl.searchParams.set("state",           stateToken)     // nunca el portal_token

  return json({ auth_url: authUrl.toString() })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
