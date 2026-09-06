/**
 * strava-health — Edge Function de verificación de infraestructura
 *
 * Propósito: confirmar que el entorno server-side está correctamente
 * configurado antes de implementar la integración real con Strava.
 *
 * Verifica:
 *   - que STRAVA_CLIENT_ID está configurado como Supabase Secret
 *   - que la Edge Function puede conectarse a Supabase con service_role
 *
 * NUNCA devuelve valores de secrets.
 * verify_jwt: false → accesible sin token para facilitar la verificación
 *   (esta función es solo de diagnóstico, no expone datos sensibles)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (_req: Request) => {
  // ── 1. STRAVA_CLIENT_ID configurado? ──────────────────────────
  const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID")
  const stravaConfigured = !!stravaClientId

  // ── 2. Acceso a Supabase con service_role ─────────────────────
  // SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son inyectados
  // automáticamente por Supabase en todas las Edge Functions.
  let supabaseOk = false
  let supabaseError: string | null = null
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    // Consulta mínima: verificar que la tabla strava_conexiones existe y es accesible
    const { error } = await client
      .from("strava_conexiones")
      .select("id")
      .limit(0)
    supabaseOk = !error
    if (error) supabaseError = error.message
  } catch (e) {
    supabaseError = e instanceof Error ? e.message : "unknown error"
  }

  const ok = stravaConfigured && supabaseOk

  return new Response(
    JSON.stringify({
      ok,
      stravaConfigured,
      supabaseOk,
      // Si hay error de Supabase, lo mostramos para diagnóstico (no es un secret)
      ...(supabaseError ? { supabaseError } : {}),
      // NUNCA incluir valores de secrets aquí
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  )
})
