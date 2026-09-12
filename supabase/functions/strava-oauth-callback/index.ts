/**
 * strava-oauth-callback — intercambia el code de Strava por tokens y guarda la conexión.
 *
 * Recibe: POST { code: string, state: string }
 * Devuelve: { ok: true, athlete_nombre: string } — NUNCA tokens ni secrets
 *
 * El state se consume atómicamente: si ya fue usado, expiró o no existe → error.
 * El client_secret nunca sale de esta función.
 * verify_jwt: false — llamada desde el callback redirect de Strava (sin autenticación Supabase).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token"

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

  let code: string, state: string
  try {
    const body = await req.json()
    code  = body.code
    state = body.state
    if (!code || !state || typeof code !== "string" || typeof state !== "string") throw new Error()
  } catch {
    return json({ error: "invalid_body", message: "code y state requeridos." }, 400)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // ── Consumir el state atómicamente ──────────────────────────────────────────
  // UPDATE solo actualiza si: state_token coincide + used=false + no expirado.
  // Si returns 0 filas → state inválido, ya usado, o expirado. Rechazar.
  const { data: stateRows, error: stateErr } = await supabase
    .from("strava_oauth_states")
    .update({ used: true })
    .eq("state_token", state)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .select("cliente_id")

  if (stateErr || !stateRows?.length) {
    return json({
      error:   "state_invalid",
      message: "El estado OAuth no es válido, ya fue utilizado o ha expirado.",
    }, 400)
  }

  const clienteId: string = stateRows[0].cliente_id

  // ── Intercambiar code por tokens con Strava (server-side) ────────────────────
  // POST https://www.strava.com/api/v3/oauth/token
  // El STRAVA_CLIENT_SECRET nunca sale de esta Edge Function.
  const tokenRes = await fetch(STRAVA_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      client_id:     Deno.env.get("STRAVA_CLIENT_ID")!,
      client_secret: Deno.env.get("STRAVA_CLIENT_SECRET")!,
      code,
      grant_type:    "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error("[strava-oauth-callback] token exchange failed:", tokenRes.status, errText)
    return json({ error: "token_exchange_failed", message: "Error al canjear el código con Strava." }, 502)
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_at, scope, athlete } = tokenData

  if (!access_token || !refresh_token || !athlete?.id) {
    console.error("[strava-oauth-callback] respuesta de token inesperada:", JSON.stringify(tokenData))
    return json({ error: "invalid_token_response" }, 502)
  }

  // ── Guardar/actualizar conexión en strava_conexiones ─────────────────────────
  // upsert por cliente_id: si el cliente reconecta, actualiza los tokens.
  const { error: upsertErr } = await supabase
    .from("strava_conexiones")
    .upsert(
      {
        cliente_id:    clienteId,
        athlete_id:    athlete.id,   // bigint — ID único del atleta en Strava
        access_token,                // expira en 6h
        refresh_token,               // long-lived, actualizar siempre el más reciente
        expires_at,                  // Unix timestamp
        scope:         scope ?? "",  // puede diferir de lo solicitado si el usuario desmarcó algo
        activa:        true,
        conectada_el:  new Date().toISOString(),
        ultima_sync:   null,
      },
      { onConflict: "cliente_id" }
    )

  if (upsertErr) {
    console.error("[strava-oauth-callback] upsert error:", upsertErr.message)
    return json({ error: "db_error", message: "Error al guardar la conexión." }, 500)
  }

  // Devolver solo confirmación — NUNCA tokens ni secrets al frontend
  return json({
    ok:             true,
    athlete_nombre: `${athlete.firstname ?? ""} ${athlete.lastname ?? ""}`.trim(),
  })
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
