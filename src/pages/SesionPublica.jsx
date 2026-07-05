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

const RPE_LABELS = ['Nada de esfuerzo','Muy, muy suave','Muy suave','Suave','Moderada','Algo exigente','Exigente','Muy exigente','Muy dura','Extremadamente dura','Máximo esfuerzo']

function FeedbackResumen({ data, onEditar }) {
  const d = data || {}
  const status = d.completion?.status
  const reasons = d.completion?.reasons || []
  const statusCfg = {
    completed: { label: 'Sesión completada al 100%', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
    partial:   { label: 'Sesión parcialmente completada', color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '🔄' },
    missed:    { label: 'Sesión no realizada', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', icon: '❌' },
  }
  const cfg = statusCfg[status] || {}

  function Row({ label, value }) {
    if (!value && value !== 0) return null
    return (
      <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 11.5, color: T.ink3, minWidth: 140, flexShrink: 0, paddingTop: 1 }}>{label}</span>
        <span style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>{value}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cfg.label && (
        <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cfg.icon}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        </div>
      )}
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '0 14px' }}>
        {d.rpe?.value != null && <Row label="Esfuerzo percibido (RPE)" value={`${d.rpe.value} — ${RPE_LABELS[d.rpe.value]}`} />}
        {d.duration?.minutes && <Row label="Duración real" value={`${d.duration.minutes} min`} />}
        {reasons.length > 0 && <Row label={status === 'partial' ? 'Por qué no completó al 100%' : 'Por qué no la realizó'} value={reasons.join(', ')} />}
        {d.completion?.partialDetails && <Row label="Detalle / parte no realizada" value={d.completion.partialDetails} />}
        {d.pain?.mainPainDetails && <Row label="Molestia principal" value={d.pain.mainPainDetails} />}
        {d.pain?.additionalPainLevel && <Row label="Molestia durante sesión" value={d.pain.additionalPainLevel} />}
        {d.pain?.additionalPainDetails && <Row label="Zona / ejercicio" value={d.pain.additionalPainDetails} />}
        {d.technical?.mainTechnicalDetails && <Row label="Dificultad técnica" value={d.technical.mainTechnicalDetails} />}
        {d.technical?.additionalTechnicalDifficulty === true && <Row label="Ejercicio difícil" value={d.technical.additionalTechnicalDetails || 'Sí'} />}
        {d.equipment?.details && <Row label="Material no disponible" value={d.equipment.details} />}
        {d.understanding?.details && <Row label="Ejercicio no entendido" value={d.understanding.details} />}
        {d.generalComments && <Row label="Observaciones generales" value={d.generalComments} />}
      </div>
      {onEditar && (
        <button type="button" onClick={onEditar}
          style={{ alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 500, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.card, color: T.ink2, cursor: 'pointer' }}>
          ✏️ Modificar respuesta
        </button>
      )}
    </div>
  )
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
  const [fases, setFases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [feedbackEnviado, setFeedbackEnviado] = useState(null)
  const [enviandoFeedback, setEnviandoFeedback] = useState(false)
  const [editandoFeedback, setEditandoFeedback] = useState(false)
  // { [ejId]: { series: [bool,...], hecho: bool } }
  const [progreso, setProgreso] = useState({})
  // { [ejId]: { campo: valor } } — valores reales editados por el cliente
  const [valoresReales, setValoresReales] = useState({})
  // fecha (string) si la sesión flexible ya fue guardada como realizada en esta visita
  const [sesionFlexibleGuardada, setSesionFlexibleGuardada] = useState(null)
  const [guardandoSesion, setGuardandoSesion] = useState(false)
  const [sesionFijaGuardada, setSesionFijaGuardada] = useState(false)

  useEffect(() => { cargar() }, [token])

  async function cargar() {
    const { data: s } = await supabase
      .from('sesiones').select('*, clientes(nombre)')
      .eq('token_publico', token).single()
    if (!s) { setError(true); setLoading(false); return }
    setSesion(s); setCliente(s.clientes)

    const { data: fss } = await supabase.from('sesion_fases').select('*').eq('sesion_id', s.id).order('orden')
    setFases(fss || [])
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', s.id).order('orden')
    setBloques(bls || [])
    let ejsList = []
    if (bls && bls.length > 0) {
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').in('bloque_id', bls.map(b => b.id)).order('orden')
      ejsList = ejs || []
      const map = {}
      ejsList.forEach(e => { if (!map[e.bloque_id]) map[e.bloque_id] = []; map[e.bloque_id].push(e) })
      setEjercicios(map)
    }
    const { data: fb } = await supabase.from('sesion_feedback').select('*').eq('sesion_id', s.id).maybeSingle()
    setFeedbackEnviado(fb || null)
    // Restaurar estado de completada si ya fue guardada anteriormente
    if (s.completada_el && !s.fecha) setSesionFlexibleGuardada(s.completada_el)
    if (s.completada_el && s.fecha) setSesionFijaGuardada(true)
    const progInit = {}
    const vrInit = {}
    ejsList.forEach(e => {
      const n = parseInt(e.series) || 1
      const hecho = s.completada_el ? true : false
      progInit[e.id] = { series: Array(n).fill(hecho), hecho }
      vrInit[e.id] = e.valores_reales || {}
    })
    setProgreso(progInit)
    setValoresReales(vrInit)
    setLoading(false)
  }

  async function actualizarValorReal(ejId, campo, valor) {
    setValoresReales(vr => {
      const next = { ...vr, [ejId]: { ...(vr[ejId] || {}), [campo]: valor } }
      supabase.from('sesion_ejercicios').update({ valores_reales: next[ejId] }).eq('id', ejId)
      return next
    })
  }

  function marcarTodas() {
    setProgreso(p => {
      const next = { ...p }
      Object.keys(next).forEach(ejId => {
        const series = next[ejId].series.map(() => true)
        next[ejId] = { series, hecho: true }
      })
      return next
    })
  }

  function marcarEjercicio(ejId, numSeries) {
    setProgreso(p => {
      const prev = p[ejId] || { series: Array(numSeries).fill(false), hecho: false }
      const yaHecho = prev.hecho
      const series = prev.series.map(() => !yaHecho)
      return { ...p, [ejId]: { series, hecho: !yaHecho } }
    })
  }

  function marcarBloque(ejsDelBloque) {
    setProgreso(p => {
      const next = { ...p }
      const yaHechoTodo = ejsDelBloque.every(e => next[e.id]?.hecho)
      ejsDelBloque.forEach(e => {
        const n = next[e.id]?.series.length || parseInt(e.series) || 1
        next[e.id] = { series: Array(n).fill(!yaHechoTodo), hecho: !yaHechoTodo }
      })
      return next
    })
  }

  async function clonarSesionHoy() {
    const hoyStr = format(new Date(), 'yyyy-MM-dd')
    const nuevoToken = crypto.randomUUID()
    const { data: clon, error: clonError } = await supabase.from('sesiones').insert({
      cliente_id: sesion.cliente_id, titulo: sesion.titulo, fecha: hoyStr,
      objetivo: sesion.objetivo, duracion_min: sesion.duracion_min, material: sesion.material,
      indicaciones: sesion.indicaciones, tipo_sesion: 'programada', icono: sesion.icono,
      tipo_editor: sesion.tipo_editor, con_feedback: sesion.con_feedback, token_publico: nuevoToken,
      completada_el: hoyStr,
    }).select().single()
    if (clonError || !clon) return null
    for (const bloque of bloques) {
      const { data: nuevoBloque } = await supabase.from('sesion_bloques').insert({
        sesion_id: clon.id, nombre: bloque.nombre, color: bloque.color, nota: bloque.nota, orden: bloque.orden,
      }).select().single()
      if (nuevoBloque) {
        for (const ej of (ejercicios[bloque.id] || [])) {
          await supabase.from('sesion_ejercicios').insert({
            bloque_id: nuevoBloque.id, nombre: ej.nombre, series: ej.series, reps: ej.reps,
            rpe: ej.rpe, notas: ej.notas, media_tipo: ej.media_tipo, media_url: ej.media_url,
            video_url: ej.video_url, orden: ej.orden, peso: ej.peso, duracion: ej.duracion,
            distancia: ej.distancia, altura: ej.altura, descanso: ej.descanso,
            ejecucion_tipo: ej.ejecucion_tipo, ejecucion_texto: ej.ejecucion_texto,
            variables_activas: ej.variables_activas, peso_der: ej.peso_der, peso_izq: ej.peso_izq,
            reps_por_lado: ej.reps_por_lado, valores_reales: valoresReales[ej.id] || {},
          })
        }
      }
    }
    // Marcar la sesión original como completada (persiste entre recargas)
    await supabase.from('sesiones').update({ completada_el: hoyStr }).eq('id', sesion.id)
    return { clon, hoyStr }
  }

  function toggleSerie(ejId, serieIdx) {
    setProgreso(p => {
      const prev = p[ejId] || { series: [], hecho: false }
      const series = prev.series.map((v, i) => i === serieIdx ? !v : v)
      const hecho = series.every(Boolean)
      return { ...p, [ejId]: { series, hecho } }
    })
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
         <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Ficha de entrenamiento</p>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)', flexShrink: 0, whiteSpace: 'nowrap' }}>{cliente?.nombre}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{sesion.titulo}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.66)' }}>
            {sesion.duracion_min && <><span>{sesion.duracion_min} min</span><span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} /></>}
           {sesion.fecha && <span style={{ textTransform: 'capitalize' }}>{format(parseISO(sesion.fecha), 'dd MMM yyyy', { locale: es })}</span>}
          </div>
          {sesion.objetivo && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.13)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>🎯 Objetivo</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>{sesion.objetivo}</p>
            </div>
          )}
        </header>

        {/* BANNER COMPLETADA (solo cuando ya está guardada) */}
        {(sesionFlexibleGuardada || sesionFijaGuardada) && (
          <div style={{ marginTop: 14, width: '100%', padding: '13px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #16a34a', color: '#15803d', fontSize: 14.5, fontWeight: 700, textAlign: 'center', letterSpacing: '-0.01em' }}>
            ✓ Sesión completada y guardada
          </div>
        )}

        {sesion.material && (
          <div style={{ marginTop: 16, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.ink3, marginBottom: 7 }}>🎒 Material necesario</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T.ink2 }}>{sesion.material}</p>
          </div>
        )}

        {sesion.indicaciones && (
          <div style={{ marginTop: 16, background: T.accent + '10', border: `1px solid ${T.accent}33`, borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, color: T.accent }}>✏️</span>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: T.accentD, fontWeight: 500 }}>{sesion.indicaciones}</p>
          </div>
        )}

        {/* FASES (sesiones de resistencia/carrera) */}
        {fases.length > 0 && (() => {
          const FC_COLORS = ['#10b981','#84cc16','#f59e0b','#ef4444','#7c3aed']
          const FC_LABELS = ['Zona 1 – Muy suave','Zona 2 – Suave','Zona 3 – Moderada','Zona 4 – Dura','Zona 5 – Máxima']
          return fases.map((f, idx) => {
            const zonaColor = f.fc_zona ? FC_COLORS[f.fc_zona - 1] : T.accent
            const zonaLabel = f.fc_zona ? FC_LABELS[f.fc_zona - 1] : null
            const rpeColor = !f.rpe ? 'var(--text3)' : f.rpe <= 4 ? '#10b981' : f.rpe <= 6 ? '#f59e0b' : '#ef4444'
            return (
              <section key={f.id} style={{ marginTop: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 14, background: zonaColor }}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.18, flex: 1 }}>{f.nombre || `Fase ${idx + 1}`}</h2>
                </div>
                {f.descripcion && (
                  <div style={{ background: zonaColor + '12', border: `1px solid ${zonaColor}33`, borderRadius: 11, padding: '11px 14px', marginBottom: 12, fontSize: 13.5, lineHeight: 1.55, color: '#374151' }}>
                    {f.descripcion}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {(f.volumen_min || f.volumen_km) && (
                    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Volumen</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                        {f.volumen_min ? `${f.volumen_min} min` : ''}{f.volumen_min && f.volumen_km ? ' · ' : ''}{f.volumen_km ? `${f.volumen_km} km` : ''}
                      </div>
                    </div>
                  )}
                  {(f.ritmo_inicio || f.ritmo_fin) && (
                    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Ritmo (min/km)</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                        {f.ritmo_inicio || '–'}{f.ritmo_fin ? ` – ${f.ritmo_fin}` : ''}
                      </div>
                    </div>
                  )}
                  {f.fc_zona && (
                    <div style={{ background: zonaColor + '18', border: `1px solid ${zonaColor}44`, borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>FC Zona</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                        {[1,2,3,4,5].map(z => (
                          <div key={z} style={{ width: 16, height: 16, borderRadius: '50%', background: f.fc_zona >= z ? FC_COLORS[z-1] : '#e5e7eb', border: `1.5px solid ${f.fc_zona >= z ? FC_COLORS[z-1] : '#d1d5db'}` }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: zonaColor }}>{zonaLabel}</div>
                    </div>
                  )}
                  {f.rpe && (
                    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>RPE</div>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <div key={n} style={{ width: 18, height: 18, borderRadius: 5, background: n <= f.rpe ? rpeColor : '#e5e7eb', opacity: n <= f.rpe ? 1 : 0.3 }} />
                        ))}
                        <span style={{ marginLeft: 4, fontSize: 14, fontWeight: 700, color: rpeColor }}>{f.rpe}/10</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })
        })()}

        {/* BLOQUES */}
        {bloques.map((b, idx) => (
          <section key={b.id} style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 14, background: b.color || '#E29A2E' }}>
                {String(idx + 1).padStart(2, '0')}
              </div>
              <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.18, flex: 1 }}>{b.nombre}</h2>
              {(() => {
                const ejsBloque = ejercicios[b.id] || []
                if (!ejsBloque.length) return null
                const bloqueHecho = ejsBloque.every(e => progreso[e.id]?.hecho)
                if (sesionFlexibleGuardada || sesionFijaGuardada) {
                  return (
                    <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#f0fdf4', color: '#16a34a', whiteSpace: 'nowrap' }}>
                      ✓ Bloque hecho
                    </span>
                  )
                }
                return (
                  <button onClick={() => marcarBloque(ejsBloque)}
                    style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${bloqueHecho ? '#16a34a' : (b.color || '#E29A2E')}`, background: bloqueHecho ? '#f0fdf4' : 'transparent', color: bloqueHecho ? '#16a34a' : (b.color || '#875708'), cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {bloqueHecho ? '✓ Bloque hecho' : '✓ Todo el bloque'}
                  </button>
                )
              })()}
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
                const thumb = yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : ((e.media_tipo === 'imagen' || e.media_tipo === 'gif') ? e.media_url : null)
                const esVideoArchivo = e.media_tipo === 'video' && e.media_url
                const videoLink = e.media_tipo === 'youtube' ? e.media_url : e.video_url
                const activas = e.variables_activas || []
                const prog = progreso[e.id] || { series: [false], hecho: false }
                const vrEj = valoresReales[e.id] || {}
                const hecho = prog.hecho
                const rirColorMap = { '4+': '#16a34a', '2-3': '#ca8a04', '1-0': '#dc2626' }
                const rirBgMap = { '4+': '#f0fdf4', '2-3': '#fffbeb', '1-0': '#fef2f2' }
                return (
                  <article key={e.id} style={{ position: 'relative', overflow: 'hidden', background: hecho ? '#f0fdf4' : T.card, border: `1px solid ${hecho ? '#bbf7d0' : T.line}`, borderRadius: 14, padding: '14px 14px 14px 18px', boxShadow: '0 1px 2px rgba(20,23,28,0.05), 0 4px 12px rgba(20,23,28,0.03)', transition: 'background 0.2s, border-color 0.2s' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: hecho ? '#16a34a' : (b.color || '#E29A2E') }} />
                    <div>
                        <h3 style={{ margin: '0 0 9px', fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: T.ink, fontWeight: 600, marginRight: 6 }}>{idx + 1}.{eIdx + 1}.</span>
                          {e.nombre}
                        </h3>
                        {(esVideoArchivo || thumb) && (
                          <div style={{ marginBottom: 12 }}>
                            {esVideoArchivo
                              ? <video src={e.media_url} controls muted preload="metadata" style={{ width: '100%', maxHeight: 260, borderRadius: 10, objectFit: 'contain', border: `1px solid ${T.line}`, background: '#000' }} />
                              : <img src={thumb} alt={e.nombre} style={{ width: '100%', maxHeight: 260, borderRadius: 10, objectFit: 'contain', border: `1px solid ${T.line}`, background: T.paper, display: 'block' }} />
                            }
                          </div>
                        )}
                        {videoLink && (
                          <a href={videoLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', padding: '6px 12px', borderRadius: 9, lineHeight: 1, marginBottom: 10 }}>
                            ▶ Vídeo
                          </a>
                        )}
                        {/* Variables */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          {e.series && (
                            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Series</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.series}</span>
                            </span>
                          )}
                          {e.reps && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>{e.reps_por_lado ? 'Reps/lado' : 'Reps'}</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.reps}{e.reps_por_lado ? '/lado' : ''}</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" min="0" step="1" value={vrEj.reps || ''} onChange={ev => actualizarValorReal(e.id, 'reps', ev.target.value)}
                                  placeholder={e.reps_por_lado ? 'reps/lado reales' : 'reps reales'}
                                  style={{ fontSize: 11, border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 8px', outline: 'none', background: '#fff', color: T.ink2, width: 80 }} />
                                <span style={{ fontSize: 11, color: T.ink3 }}>{e.reps_por_lado ? 'reps/lado' : 'reps'}</span>
                              </div>
                            </div>
                          )}
                          {activas.includes('Peso') && e.peso && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Peso</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.peso} kg</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" min="0" step="0.5" value={vrEj.peso || ''} onChange={ev => actualizarValorReal(e.id, 'peso', ev.target.value)}
                                  placeholder="kgs reales"
                                  style={{ fontSize: 11, border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 8px', outline: 'none', background: '#fff', color: T.ink2, width: 80 }} />
                                <span style={{ fontSize: 11, color: T.ink3 }}>kg</span>
                              </div>
                            </div>
                          )}
                          {activas.includes('Peso/lado') && (e.peso_der || e.peso_izq) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Peso/lado</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>D: {e.peso_der || '—'} · I: {e.peso_izq || '—'} kg</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600 }}>D</span>
                                <input type="number" min="0" step="0.5" value={vrEj.peso_der || ''} onChange={ev => actualizarValorReal(e.id, 'peso_der', ev.target.value)}
                                  placeholder={e.peso_der || '—'}
                                  style={{ fontSize: 11, border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 8px', outline: 'none', background: '#fff', color: T.ink2, width: 60 }} />
                                <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600 }}>I</span>
                                <input type="number" min="0" step="0.5" value={vrEj.peso_izq || ''} onChange={ev => actualizarValorReal(e.id, 'peso_izq', ev.target.value)}
                                  placeholder={e.peso_izq || '—'}
                                  style={{ fontSize: 11, border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 8px', outline: 'none', background: '#fff', color: T.ink2, width: 60 }} />
                                <span style={{ fontSize: 11, color: T.ink3 }}>kg</span>
                              </div>
                            </div>
                          )}
                          {activas.includes('Duración') && e.duracion && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Duración</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.duracion} s</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" min="0" step="1" value={vrEj.duracion || ''} onChange={ev => actualizarValorReal(e.id, 'duracion', ev.target.value)}
                                  placeholder="seg reales"
                                  style={{ fontSize: 11, border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 8px', outline: 'none', background: '#fff', color: T.ink2, width: 80 }} />
                                <span style={{ fontSize: 11, color: T.ink3 }}>s</span>
                              </div>
                            </div>
                          )}
                          {activas.includes('RIR') && e.rpe && (
                            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: rirBgMap[e.rpe] || T.paper, borderRadius: 9, padding: '7px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: rirColorMap[e.rpe] || T.ink3 }}>RIR</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: rirColorMap[e.rpe] || T.ink }}>{e.rpe}</span>
                            </span>
                          )}
                          {activas.includes('Distancia') && e.distancia && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Distancia</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.distancia} m</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" min="0" step="0.5" value={vrEj.distancia || ''} onChange={ev => actualizarValorReal(e.id, 'distancia', ev.target.value)}
                                  placeholder="m reales"
                                  style={{ fontSize: 11, border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 8px', outline: 'none', background: '#fff', color: T.ink2, width: 80 }} />
                                <span style={{ fontSize: 11, color: T.ink3 }}>m</span>
                              </div>
                            </div>
                          )}
                          {activas.includes('Altura') && e.altura && (
                            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Altura</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.altura} cm</span>
                            </span>
                          )}
                          {activas.includes('Descanso') && e.descanso && (
                            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Descanso</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.descanso}</span>
                            </span>
                          )}
                          {activas.includes('Forma de ejecución') && e.ejecucion_tipo && (
                            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, background: T.paper, borderRadius: 9, padding: '7px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Ejecución</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                                {e.ejecucion_tipo !== 'Personalizado' ? e.ejecucion_tipo : ''}{e.ejecucion_texto ? (e.ejecucion_tipo !== 'Personalizado' ? ` — ${e.ejecucion_texto}` : e.ejecucion_texto) : ''}
                              </span>
                            </span>
                          )}
                        </div>
                        {/* Marcar ejercicio + checks de series */}
                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {sesionFlexibleGuardada || sesionFijaGuardada ? (
                            <span style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: '1.5px solid #16a34a', background: '#f0fdf4', color: '#16a34a' }}>
                              ✓ Ejercicio completado
                            </span>
                          ) : (
                            <button onClick={() => marcarEjercicio(e.id, prog.series.length)}
                              style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${hecho ? '#16a34a' : T.line}`, background: hecho ? '#f0fdf4' : T.card, color: hecho ? '#16a34a' : T.ink2, cursor: 'pointer' }}>
                              {hecho ? '✓ Ejercicio completado' : '✓ Marcar ejercicio'}
                            </button>
                          )}
                          {prog.series.map((hecha, sIdx) => (
                            <label key={sIdx} onClick={sesionFlexibleGuardada || sesionFijaGuardada ? undefined : () => toggleSerie(e.id, sIdx)}
                              style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: sesionFlexibleGuardada || sesionFijaGuardada ? 'default' : 'pointer', opacity: hecha ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${hecha ? '#16a34a' : T.line}`, background: hecha ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                                {hecha && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 13, color: hecha ? '#16a34a' : T.ink2 }}>Serie {sIdx + 1}</span>
                            </label>
                          ))}
                        </div>
                        {activas.includes('Indicaciones') && e.notas && (
                          <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${T.line}`, fontSize: 12.5, color: T.ink2, lineHeight: 1.45 }}>
                            <span style={{ flexShrink: 0, color: T.ink3 }}>📝</span>
                            <span>{e.notas}</span>
                          </p>
                        )}
                        {!activas.includes('Indicaciones') && e.notas && (
                          <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${T.line}`, fontSize: 12.5, color: T.ink2, lineHeight: 1.45 }}>
                            <span style={{ flexShrink: 0, color: T.ink3 }}>📝</span>
                            <span>{e.notas}</span>
                          </p>
                        )}
                    </div>
                  </article>
                )
              })}
            </div>
         </section>
        ))}

        {/* MARCAR SESIÓN COMPLETA — botón pequeño al final */}
        {!sesionFlexibleGuardada && !sesionFijaGuardada && (() => {
          const todaMarcada = Object.keys(progreso).length > 0 && Object.values(progreso).every(p => p.hecho)
          return (
            <div style={{ marginTop: 20 }}>
              <button onClick={marcarTodas}
                style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${todaMarcada ? '#16a34a' : T.line}`, background: todaMarcada ? '#f0fdf4' : T.card, color: todaMarcada ? '#16a34a' : T.ink2, cursor: 'pointer' }}>
                {todaMarcada ? '✓ Todos los ejercicios y series completados' : '✓ Marcar todos los ejercicios y series como completados'}
              </button>
            </div>
          )
        })()}

        {/* BOTÓN GUARDAR SESIÓN */}
        {!sesionFlexibleGuardada && !sesionFijaGuardada && (
          <div style={{ marginTop: 24 }}>
            <button
              onClick={async () => {
                setGuardandoSesion(true)
                if (!sesion.fecha) {
                  const resultado = await clonarSesionHoy()
                  setGuardandoSesion(false)
                  if (!resultado) { alert('Error al guardar. Inténtalo de nuevo.'); return }
                  setValoresReales({})
                  setSesionFlexibleGuardada(resultado.hoyStr)
                } else {
                  await supabase.from('sesiones').update({ completada_el: sesion.fecha }).eq('id', sesion.id)
                  setGuardandoSesion(false)
                  setSesionFijaGuardada(true)
                }
              }}
              disabled={guardandoSesion}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: `2px solid ${T.accent}`, background: 'transparent', color: T.accent, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}>
              {guardandoSesion ? 'Guardando...' : '↑ Guardar y enviar sesión'}
            </button>
          </div>
        )}
        {(sesionFlexibleGuardada || sesionFijaGuardada) && (
          <div style={{ marginTop: 24, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '13px 18px', textAlign: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>✓ Sesión guardada y enviada</span>
          </div>
        )}

        {/* FEEDBACK POST-SESIÓN */}
        {sesion.con_feedback !== false && <div style={{ marginTop: 24 }}>
          {sesionFlexibleGuardada && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '18px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#15803d' }}>Sesión completada</p>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#166534' }}>Registrada el {format(new Date(sesionFlexibleGuardada + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}.</p>
              <button onClick={async () => {
                // Resetear para nueva realización
                await supabase.from('sesiones').update({ completada_el: null }).eq('id', sesion.id)
                const allEjs = Object.values(ejercicios).flat()
                await Promise.all(allEjs.map(e => supabase.from('sesion_ejercicios').update({ valores_reales: {} }).eq('id', e.id)))
                setSesionFlexibleGuardada(null)
                setSesion(s => ({ ...s, completada_el: null }))
                const progInit = {}
                const vrInit = {}
                allEjs.forEach(e => { const n = parseInt(e.series) || 1; progInit[e.id] = { series: Array(n).fill(false), hecho: false }; vrInit[e.id] = {} })
                setProgreso(progInit)
                setValoresReales(vrInit)
              }} style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid #16a34a', background: 'transparent', color: '#15803d', cursor: 'pointer' }}>
                Realizar de nuevo
              </button>
            </div>
          )}
          {!sesionFlexibleGuardada && feedbackEnviado && !editandoFeedback ? (
            <div style={{ background: '#fff', border: '1px solid #E4E6EB', borderRadius: 16, padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Feedback de la sesión</h2>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>Realizado</span>
              </div>
              <FeedbackResumen
                data={feedbackEnviado.data}
                onEditar={() => setEditandoFeedback(true)}
              />
            </div>
          ) : !sesionFlexibleGuardada ? (
            <div style={{ background: '#fff', border: '1px solid #E4E6EB', borderRadius: 16, padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{editandoFeedback ? 'Modificar feedback' : 'Feedback de la sesión'}</h2>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: T.paper, color: T.ink3, border: `1px solid ${T.line}` }}>No realizado</span>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 12.5, color: '#929BA8' }}>{editandoFeedback ? 'Se guardará la última versión.' : 'Cuéntame cómo te ha ido, lleva menos de un minuto.'}</p>
              <FeedbackForm
                tipoEditor={sesion.tipo_editor}
                initial={editandoFeedback ? feedbackEnviado.data : null}
                submitting={enviandoFeedback}
                submitLabel="Guardar y enviar feedback"
                onSubmit={async (data) => {
                  setEnviandoFeedback(true)
                  if (editandoFeedback) {
                    const { data: act } = await supabase.from('sesion_feedback').update({ data }).eq('id', feedbackEnviado.id).select().single()
                    setEnviandoFeedback(false)
                    setEditandoFeedback(false)
                    if (act) setFeedbackEnviado(act)
                  } else if (!sesion.fecha) {
                    const resultado = await clonarSesionHoy()
                    if (!resultado) {
                      setEnviandoFeedback(false)
                      alert('Error al guardar la sesión. Inténtalo de nuevo.')
                      return
                    }
                    await supabase.from('sesion_feedback').insert({ sesion_id: resultado.clon.id, data })
                    setEnviandoFeedback(false)
                    setValoresReales({})
                    setSesionFlexibleGuardada(resultado.hoyStr)
                  } else {
                    const { data: nuevo } = await supabase.from('sesion_feedback').insert({ sesion_id: sesion.id, data }).select().single()
                    setEnviandoFeedback(false)
                    if (nuevo) setFeedbackEnviado(nuevo)
                  }
                }}
              />
            </div>
          ) : null}
        </div>}

      </div>
    </div>
  )
}
