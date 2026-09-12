/**
 * strava-desconectar — revoca el acceso de IdelRi en Strava y limpia las credenciales.
 *
 * Recibe: POST { portal_token: string }
 * Devuelve: { ok: true } | { error: string, message: string }
 *
 * Flujo:
 *  1. Resuelve portal_token → cliente_id via RPC (nunca acepta cliente_id directo)
 *  2. Lee access_token/refresh_token de strava_conexiones (service_role, solo para ese cliente)
 *  3. Revoca en Strava mediante POST /oauth/revoke con Basic Auth (endpoint actual, no deprecated)
 *  4. Tanto si Strava confirma como si el token ya no era válido, procede con la limpieza
 *  5. UPDATE: activa=false, access_token=NULL, refresh_token=NULL, expires_at=NULL
 *  6. Nunca devuelve ni registra tokens
 *
 * verify_jwt: false — llamada desde portal público del cliente.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke"

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

  // ── 1. Resolver portal_token → cliente_id ────────────────────────────────
  const { data: clienteRows, error: rpcErr } = await supabase
    .rpc("get_cliente_por_token", { p_token: portalToken })

  if (rpcErr || !clienteRows?.length) {
    return json({ error: "cliente_not_found" }, 404)
  }

  const clienteId: string = clienteRows[0].id

  // ── 2. Leer tokens — solo para este cliente, solo si activa=true ──────────
  const { data: conexion, error: selectErr } = await supabase
    .from("strava_conexiones")
    .select("id, refresh_token, access_token")
    .eq("cliente_id", clienteId)
    .eq("activa", true)
    .maybeSingle()

  if (selectErr || !conexion) {
    // Sin conexión activa — nada que desconectar, pero no es un error crítico
    return json({ error: "not_connected", message: "No hay conexión activa con Strava." }, 404)
  }

  // ── 3. Revocar en Strava via /oauth/revoke (endpoint actual, no deprecated) ─
  // Revocar el refresh_token invalida también el access_token asociado.
  // Strava siempre responde 200 aunque el token ya no exista.
  const clientId     = Deno.env.get("STRAVA_CLIENT_ID")!
  const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET")!
  const basicAuth    = btoa(`${clientId}:${clientSecret}`)

  // Token a revocar: refresh_token si existe, si no access_token
  const tokenToRevoke = conexion.refresh_token ?? conexion.access_token

  if (tokenToRevoke) {
    try {
      const revokeRes = await fetch(STRAVA_REVOKE_URL, {
        method:  "POST",
        headers: {
          "Authorization":  `Basic ${basicAuth}`,
          "Content-Type":   "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: tokenToRevoke }),
      })
      // Strava devuelve 200 con body vacío tanto si revoca como si el token ya no existe.
      // Si devuelve otro código (e.g. 401 por credenciales incorrectas), lo registramos
      // pero continuamos con la limpieza local — IdelRi no debe conservar credenciales
      // aunque Strava falle.
      if (!revokeRes.ok) {
        console.warn(
          "[strava-desconectar] Strava revoke returned non-200:",
          revokeRes.status,
          await revokeRes.text()
        )
      }
    } catch (err) {
      // Error de red al contactar Strava — continuamos con limpieza local
      console.warn("[strava-desconectar] Error reaching Strava revoke:", err)
    }
  }

  // ── 4. Limpiar credenciales y marcar inactiva ─────────────────────────────
  // access_token y refresh_token → NULL (credenciales revocadas, no conservar)
  // expires_at → NULL (ya no hay token activo)
  // athlete_id, scope, conectada_el → conservados como histórico no sensible
  const { error: updateErr } = await supabase
    .from("strava_conexiones")
    .update({
      activa:        false,
      access_token:  null,
      refresh_token: null,
      expires_at:    null,
    })
    .eq("id", conexion.id)
    .eq("cliente_id", clienteId)  // doble seguro: solo este cliente

  if (updateErr) {
    console.error("[strava-desconectar] update error:", updateErr.message)
    return json({ error: "db_error", message: "Error al actualizar el estado de la conexión." }, 500)
  }

  // Nunca devolvemos tokens ni datos sensibles
  return json({ ok: true })
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
