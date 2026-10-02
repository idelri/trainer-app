import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || 'https://trainer-app-pink-delta.vercel.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { sesionId, sesionTitulo, comentario, clienteEmail } = await req.json()

    if (!clienteEmail || !sesionId || !comentario) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 })
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY no configurada — email no enviado')
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    // Obtener el token_publico de la sesión para el enlace
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: ses } = await supabase
      .from('sesiones')
      .select('token_publico')
      .eq('id', sesionId)
      .single()

    const enlace = ses?.token_publico
      ? `${SITE_URL}/sesion/${ses.token_publico}`
      : SITE_URL

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #a78bfa;">Tu entrenadora</p>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Ha respondido a tu sesión</h1>
          <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.6);">${sesionTitulo}</p>
        </div>
        <div style="background: #f8f7ff; padding: 24px; border-left: 3px solid #7c3aed; margin: 0;">
          <p style="margin: 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${comentario}</p>
        </div>
        <div style="background: white; padding: 20px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
          <a href="${enlace}" style="display: inline-block; background: #7c3aed; color: white; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
            Ver sesión completa
          </a>
          <p style="margin: 16px 0 0; font-size: 11px; color: #9ca3af;">idelri · entrenamiento personal</p>
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Irene del Río <irene@idelri.com>',
        to: [clienteEmail],
        subject: `Mensaje de tu entrenadora: ${sesionTitulo}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
