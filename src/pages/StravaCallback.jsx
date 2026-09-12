/**
 * StravaCallback — página de retorno del flujo OAuth de Strava.
 *
 * Se renderiza cuando el usuario llega a /strava/callback?code=X&state=Y
 * después de autorizar (o denegar) en strava.com.
 *
 * Llama a la Edge Function strava-oauth-callback con code + state.
 * En éxito: muestra confirmación y ofrece volver al portal.
 * En error:  muestra mensaje descriptivo y ofrece volver al portal.
 *
 * Nunca recibe ni muestra tokens. No tiene acceso a service_role.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const EDGE_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/strava-oauth-callback`

// Tokens de diseño alineados con ClientePortal
const T = {
  bg:      '#f5f4f0',
  surface: '#ffffff',
  border:  '#e0ddd8',
  ink:     '#1a1916',
  ink2:    '#5a5850',
  ink3:    '#9a9890',
  green:   '#2d6a4f',
  greenL:  '#e3efe8',
  red:     '#A32D2D',
  redL:    '#FCEBEB',
  font:    "'Sora', -apple-system, sans-serif",
}

export default function StravaCallback({ params }) {
  const [estado, setEstado] = useState('loading') // 'loading' | 'ok' | 'error' | 'denied'
  const [atletaNombre, setAtletaNombre] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // URL de retorno guardada en sessionStorage antes de redirigir a Strava
  const portalUrl = sessionStorage.getItem('strava_oauth_return') || '/'

  useEffect(() => {
    async function procesarCallback() {
      // El usuario denegó el acceso en Strava
      if (params.error === 'access_denied') {
        setEstado('denied')
        return
      }

      if (!params.code || !params.state) {
        setEstado('error')
        setErrorMsg('Parámetros de callback incompletos.')
        return
      }

      try {
        const res = await fetch(EDGE_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code: params.code, state: params.state }),
        })

        const data = await res.json()

        if (!res.ok || !data.ok) {
          setEstado('error')
          setErrorMsg(data.message || `Error ${res.status}`)
          return
        }

        setAtletaNombre(data.athlete_nombre || '')
        setEstado('ok')
        // Limpiar el state de retorno
        sessionStorage.removeItem('strava_oauth_return')
      } catch (e) {
        setEstado('error')
        setErrorMsg('Error de red al procesar la conexión.')
      }
    }

    procesarCallback()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: T.font, padding: 24,
    }}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: '40px 32px', maxWidth: 400,
        width: '100%', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      }}>
        {/* Logo / icono de Strava */}
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏃</div>

        {estado === 'loading' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
              Conectando con Strava…
            </div>
            <div style={{ fontSize: 13, color: T.ink3 }}>
              Verificando autorización, un momento.
            </div>
          </>
        )}

        {estado === 'ok' && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: T.greenL, color: T.green,
              borderRadius: 20, padding: '4px 14px',
              fontSize: 12, fontWeight: 600, marginBottom: 20,
            }}>
              ✓ Strava conectado
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
              {atletaNombre ? `¡Hola, ${atletaNombre}!` : '¡Conexión completada!'}
            </div>
            <div style={{ fontSize: 13, color: T.ink2, marginBottom: 28, lineHeight: 1.5 }}>
              Tu cuenta de Strava está conectada con IdelRi.<br />
              A partir de ahora tus actividades llegarán automáticamente.
            </div>
            <a href={portalUrl}
              style={{
                display: 'block', background: T.green, color: '#fff',
                borderRadius: 10, padding: '12px 24px',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}>
              Volver a mi portal
            </a>
          </>
        )}

        {estado === 'denied' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
              Autorización cancelada
            </div>
            <div style={{ fontSize: 13, color: T.ink2, marginBottom: 28, lineHeight: 1.5 }}>
              No has concedido acceso a IdelRi en Strava.<br />
              Puedes conectarlo cuando quieras desde tu portal.
            </div>
            <a href={portalUrl}
              style={{
                display: 'block', background: T.surface, color: T.ink,
                border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '12px 24px', fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
              }}>
              Volver a mi portal
            </a>
          </>
        )}

        {estado === 'error' && (
          <>
            <div style={{
              background: T.redL, color: T.red,
              borderRadius: 8, padding: '10px 14px',
              fontSize: 12, marginBottom: 20,
            }}>
              {errorMsg || 'Error desconocido al conectar con Strava.'}
            </div>
            <div style={{ fontSize: 13, color: T.ink2, marginBottom: 28, lineHeight: 1.5 }}>
              Puedes intentarlo de nuevo desde tu portal.
            </div>
            <a href={portalUrl}
              style={{
                display: 'block', background: T.surface, color: T.ink,
                border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '12px 24px', fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
              }}>
              Volver a mi portal
            </a>
          </>
        )}
      </div>
    </div>
  )
}
