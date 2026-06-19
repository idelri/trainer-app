import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import FeedbackForm from '../components/FeedbackForm'
import { es } from 'date-fns/locale'

const T = {
  ink: '#15171C', ink2: '#5A6270', ink3: '#929BA8',
  paper: '#EEF0F3', card: '#FFFFFF', line: '#E4E6EB',
  accent: '#E0481F', accentD: '#C13A14', hero: '#181B21',
}

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function SesionPublica({ token }) {
  const [sesion, setSesion] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [bloques, setBloques] = useState([])
  const [ejercicios, setEjercicios] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [feedbackEnviado, setFeedbackEnviado] = useState(null)
  const [enviandoFeedback, setEnviandoFeedback] = useState(false)

  useEffect(() => { cargar() }, [token])

  async function cargar() {
    const { data: s } = await supabase
      .from('sesiones').select('*, clientes(nombre)')
      .eq('token_publico', token).single()
    if (!s) { setError(true); setLoading(false); return }
    setSesion(s); setCliente(s.clientes)

    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', s.id).order('orden')
    setBloques(bls || [])
    if (bls && bls.length > 0) {
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').in('bloque_id', bls.map(b => b.id)).order('orden')
      const map = {}
      ;(ejs || []).forEach(e => { if (!map[e.bloque_id]) map[e.bloque_id] = []; map[e.bloque_id].push(e) })
     setEjercicios(map)
    }
    const { data: fb } = await supabase.from('sesion_feedback').select('*').eq('sesion_id', s.id).maybeSingle()
    setFeedbackEnviado(fb || null)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.paper, fontFamily: 'sans-serif' }}>
      <p style={{ color: T.ink3 }}>Cargando sesión...</p>
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.paper, fontFamily: 'sans-serif' }}>
      <p style={{ color: T.accent }}>Enlace no válido o sesión no encontrada.</p>
    </div>
  )

  const COLORES_TINT = c => c + '1f'

  return (
    <div style={{ background: T.paper, color: T.ink, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", minHeight: '100vh', fontSize: 15, lineHeight: 1.45 }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '18px 14px 44px' }}>

        {/* HERO */}
        <header style={{ position: 'relative', overflow: 'hidden', background: T.hero, color: '#fff', borderRadius: 18, padding: '24px 22px 22px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, background: T.accent }} />
          <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Ficha de entrenamiento</p>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{cliente?.nombre}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.66)' }}>
            <span style={{ background: T.accent, color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: '0.02em', padding: '4px 11px', borderRadius: 20 }}>{sesion.titulo}</span>
            {sesion.duracion_min && <><span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} /><span>{sesion.duracion_min} min</span></>}
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
            <span style={{ textTransform: 'capitalize' }}>{format(parseISO(sesion.fecha), 'dd MMM yyyy', { locale: es })}</span>
          </div>
          {sesion.objetivo && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.13)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>🎯 Objetivo</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>{sesion.objetivo}</p>
            </div>
          )}
        </header>

        {/* BLOQUES */}
        {bloques.map((b, idx) => (
          <section key={b.id} style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 14, background: b.color || '#E29A2E' }}>
                {String(idx + 1).padStart(2, '0')}
              </div>
              <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.18 }}>{b.nombre}</h2>
            </div>
            {b.nota && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', borderRadius: 11, padding: '11px 13px', marginBottom: 13, fontSize: 13, lineHeight: 1.45, background: COLORES_TINT(b.color || '#E29A2E'), color: b.color || '#875708' }}>
                <span>📝</span>
                <span>{b.nota}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
             {(ejercicios[b.id] || []).map((e, eIdx) => {
                const yid = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
                const thumb = yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : (e.media_tipo !== 'youtube' ? e.media_url : null)
                const videoLink = e.media_tipo === 'youtube' ? e.media_url : e.video_url
                return (
                  <article key={e.id} style={{ position: 'relative', overflow: 'hidden', background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: '14px 14px 14px 18px', boxShadow: '0 1px 2px rgba(20,23,28,0.05), 0 4px 12px rgba(20,23,28,0.03)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: b.color || '#E29A2E' }} />
                    <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
                      {thumb && <img src={thumb} alt={e.nombre} style={{ width: 78, height: 78, flexShrink: 0, borderRadius: 11, objectFit: 'cover', border: `1px solid ${T.line}`, background: T.paper }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                     <h3 style={{ margin: '0 0 9px', fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
                         <span style={{ fontSize: 11, fontFamily: 'monospace', color: T.ink, fontWeight: 600, marginRight: 6 }}>{idx + 1}.{eIdx + 1}.</span>
                          {e.nombre}
                        </h3>
                        {videoLink && (
                          <a href={videoLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', padding: '6px 12px', borderRadius: 9, lineHeight: 1 }}>
                            ▶ Vídeo
                          </a>
                        )}
                      </div>
                    </div>
                    {(e.series || e.reps || e.rpe) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
                        {e.series && <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Series</span><span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.series}</span></span>}
                        {e.reps && <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Reps</span><span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.reps}</span></span>}
                        {e.rpe && <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>RPE</span><span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.rpe}</span></span>}
                      </div>
                    )}
                    {e.notas && (
                      <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${T.line}`, fontSize: 12.5, color: T.ink2, lineHeight: 1.45 }}>
                        <span style={{ flexShrink: 0, color: T.ink3 }}>📝</span>
                        <span>{e.notas}</span>
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
         </section>
        ))}

        {/* FEEDBACK POST-SESIÓN */}
        <div style={{ marginTop: 36 }}>
          {feedbackEnviado && !editandoFeedback ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '18px 16px' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#15803d', textAlign: 'center' }}>✓ Feedback enviado</p>
              {feedbackEnviado.editado ? (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#166534', textAlign: 'center' }}>Ya has modificado este feedback. Si necesitas otro cambio, escríbeme por WhatsApp.</p>
              ) : (
                <>
                  <p style={{ margin: '6px 0 12px', fontSize: 12.5, color: '#166534', textAlign: 'center' }}>¿Quieres modificar algo?</p>
                  <button type="button" onClick={() => setEditandoFeedback(true)}
                    style={{ display: 'block', margin: '0 auto', padding: '9px 18px', borderRadius: 10, border: '1px solid #15803d', background: '#fff', color: '#15803d', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Sí, quiero modificar mi respuesta
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E4E6EB', borderRadius: 16, padding: '18px 16px' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>Feedback de la sesión</h2>
              <p style={{ margin: '0 0 4px', fontSize: 12.5, color: '#929BA8' }}>Cuéntame cómo te ha ido, lleva menos de un minuto.</p>
              <FeedbackForm
                submitting={enviandoFeedback}
                onSubmit={async (data) => {
                  setEnviandoFeedback(true)
                  const { data: nuevo } = await supabase.from('sesion_feedback').insert({ sesion_id: sesion.id, data }).select().single()
                  setEnviandoFeedback(false)
                  if (nuevo) setFeedbackEnviado(nuevo)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
