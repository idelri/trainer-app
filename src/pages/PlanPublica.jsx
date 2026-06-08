import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addWeeks, differenceInWeeks, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronRight, Trophy, Layers } from 'lucide-react'

const CARGAS = {
  baja: { label: 'Baja', color: '#10b981' },
  media: { label: 'Media', color: '#f59e0b' },
  alta: { label: 'Alta', color: '#ef4444' },
  muy_alta: { label: 'Muy alta', color: '#7c3aed' },
}

export default function PlanPublica({ token }) {
  const [plan, setPlan] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [bloques, setBloques] = useState([])
  const [subbloques, setSubbloques] = useState({})
  const [semanas, setSemanas] = useState({})
  const [competiciones, setCompeticiones] = useState([])
  const [vista, setVista] = useState('timeline')
  const [bloqueAbierto, setBloqueAbierto] = useState(null)
  const [expandido, setExpandido] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { cargar() }, [token])

  async function cargar() {
    const { data: planData } = await supabase
      .from('planificaciones').select('*, clientes(id, nombre, semana_tipo, disponibilidad, consideraciones)')
      .eq('token_publico', token).single()

    if (!planData) { setError(true); setLoading(false); return }

    setPlan(planData)
    setCliente(planData.clientes)

    const { data: bls } = await supabase.from('bloques').select('*').eq('planificacion_id', planData.id).order('orden')
    setBloques(bls || [])

    if (bls && bls.length > 0) {
      const { data: subs } = await supabase.from('subbloques').select('*').in('bloque_id', bls.map(b => b.id)).order('semana_inicio')
      const subsMap = {}
      ;(subs || []).forEach(s => {
        if (!subsMap[s.bloque_id]) subsMap[s.bloque_id] = []
        subsMap[s.bloque_id].push(s)
      })
      setSubbloques(subsMap)

      const { data: sems } = await supabase.from('semanas').select('*').in('bloque_id', bls.map(b => b.id)).order('numero')
      const semsMap = {}
      ;(sems || []).forEach(s => {
        if (!semsMap[s.bloque_id]) semsMap[s.bloque_id] = []
        semsMap[s.bloque_id].push(s)
      })
      setSemanas(semsMap)
    }

    const { data: comps } = await supabase.from('competiciones').select('*').eq('cliente_id', planData.clientes?.id || planData.cliente_id).order('fecha')
    setCompeticiones(comps || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#9a9890' }}>Cargando planificación...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#c0392b' }}>Enlace no válido o planificación no encontrada.</p>
    </div>
  )

  const totalSemanas = differenceInWeeks(parseISO(plan.fecha_fin), parseISO(plan.fecha_inicio)) + 1
  const hoy = new Date()
  const inicio = parseISO(plan.fecha_inicio)
  const fin = parseISO(plan.fecha_fin)
  const totalDias = (fin - inicio) / (1000 * 60 * 60 * 24)
  const diasTranscurridos = Math.max(0, Math.min((hoy - inicio) / (1000 * 60 * 60 * 24), totalDias))
  const pct = Math.round((diasTranscurridos / totalDias) * 100)
  const semanaActual = Math.max(1, Math.min(Math.ceil(diasTranscurridos / 7), totalSemanas))
  const enCurso = hoy >= inicio && hoy <= fin

  let bloqueActual = null
  let semanaGlobalActual = 0
  for (const b of bloques) {
    if (semanaActual > semanaGlobalActual && semanaActual <= semanaGlobalActual + b.semanas) {
      bloqueActual = b; break
    }
    semanaGlobalActual += b.semanas
  }

  const subbloqueActual = bloqueActual
    ? (subbloques[bloqueActual.id] || []).find(s => (semanaActual - semanaGlobalActual) >= s.semana_inicio && (semanaActual - semanaGlobalActual) <= s.semana_fin)
    : null

  const VISTAS = ['timeline', 'macro', 'subbloque', 'micro']
  const LABELS = { timeline: 'Resumen', macro: 'Bloque', subbloque: 'Sub bloque', micro: 'Semana' }

  function SemanaTipoCalendario() {
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const ABREV = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DIAS.map((dia, i) => {
          const entrada = (cliente?.semana_tipo || {})[dia]
          const items = !entrada ? [] : Array.isArray(entrada) ? entrada : typeof entrada === 'string' ? (entrada ? [{ texto: entrada, color: '#2d6a4f' }] : []) : (entrada.texto ? [{ texto: entrada.texto, color: entrada.color || '#2d6a4f' }] : [])
          return (
            <div key={dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#9a9890' }}>{ABREV[i]}</div>
              <div style={{ width: '100%', background: '#f5f4f0', border: '1px solid #d8d5cc', borderRadius: 6, padding: '4px', minHeight: 44, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                {items.length === 0
                  ? <span style={{ fontSize: 9, color: '#9a9890', fontStyle: 'italic', textAlign: 'center' }}>—</span>
                  : items.map((item, ii) => (
                    <div key={ii} style={{ background: item.color + '22', border: `1px solid ${item.color}55`, borderRadius: 4, padding: '2px 4px', textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: item.color, lineHeight: 1.3 }}>{item.texto}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: "'Sora', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #d8d5cc', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Planificación</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1916', letterSpacing: '-0.3px' }}>{cliente?.nombre}</div>
          <div style={{ fontSize: 13, color: '#5a5850', marginTop: 1 }}>{plan.nombre}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>
            {format(inicio, 'dd MMM yyyy', { locale: es })} — {format(fin, 'dd MMM yyyy', { locale: es })}
          </div>
          {enCurso && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f', marginTop: 2, fontFamily: 'monospace' }}>
              S{semanaActual} / {totalSemanas}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* Navegación */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {VISTAS.map(v => (
            <button key={v} onClick={() => setVista(v)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d8d5cc', background: vista === v ? '#2d6a4f' : 'white', color: vista === v ? 'white' : '#5a5850', fontSize: 12.5, fontWeight: vista === v ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
              {LABELS[v]}
            </button>
          ))}
        </div>

        {/* ===== RESUMEN ===== */}
        {vista === 'timeline' && (
          <div>
            {/* Bloques + Competiciones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9a9890', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{totalSemanas} semanas · {bloques.length} bloques</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {bloques.map(b => {
                    const fechaFin = format(addWeeks(parseISO(b.fecha_inicio), b.semanas), 'MMM yyyy', { locale: es })
                    const fechaIni = format(parseISO(b.fecha_inicio), 'MMM yyyy', { locale: es })
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 3, height: 32, background: b.color || '#2d6a4f', borderRadius: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: b.color || '#2d6a4f' }}>{b.nombre}</div>
                          <div style={{ fontSize: 10, color: '#9a9890', fontFamily: 'monospace' }}>{b.semanas} sem · {fechaIni}–{fechaFin}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9a9890', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{competiciones.length} competiciones</div>
                {competiciones.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9a9890', fontStyle: 'italic' }}>Sin competiciones</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {competiciones.map(comp => (
                      <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 3, height: 32, background: '#c0392b', borderRadius: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{comp.nombre}</div>
                          <div style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>{format(parseISO(comp.fecha), 'dd MMM yyyy', { locale: es })}{comp.tipo ? ` · ${comp.tipo}` : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, padding: 16, overflowX: 'auto', marginBottom: 16 }}>
              <div style={{ minWidth: Math.max(totalSemanas * 40, 400), position: 'relative' }}>
                {/* Barra de progreso */}
                {enCurso && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#9a9890', textTransform: 'capitalize' }}>{format(inicio, 'dd MMM yyyy', { locale: es })}</span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#2d6a4f', fontWeight: 700 }}>S{semanaActual} / {totalSemanas} — {pct}%</span>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#9a9890', textTransform: 'capitalize' }}>{format(fin, 'dd MMM yyyy', { locale: es })}</span>
                    </div>
                    <div style={{ height: 4, background: '#eceae4', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2d6a4f', borderRadius: 2 }} />
                    </div>
                  </div>
                )}

                {/* Marcador estás aquí */}
                {enCurso && (() => {
                  const dias2 = (hoy - inicio) / (1000 * 60 * 60 * 24)
                  const pct2 = (dias2 / (totalSemanas * 7)) * 100
                  return (
                    <div style={{ position: 'relative', height: 20, marginBottom: 2 }}>
                      <div style={{ position: 'absolute', left: `${pct2}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#2d6a4f', fontWeight: 700, whiteSpace: 'nowrap', background: '#e8f5e9', padding: '1px 6px', borderRadius: 4, border: '1px solid #2d6a4f' }}>▼ Estás aquí</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Bloques */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                  {bloques.map(b => (
                    <div key={b.id} style={{ width: `${(b.semanas / totalSemanas) * 100}%`, minWidth: 40 }}>
                      <div style={{ background: b.color || '#2d6a4f', borderRadius: '4px 4px 0 0', padding: '5px 8px', height: 40, overflow: 'hidden' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.nombre}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{b.semanas}s</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sub bloques */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 3, position: 'relative', height: 24 }}>
                  {bloques.map(b => {
                    const subs = subbloques[b.id] || []
                    const offset = bloques.slice(0, bloques.indexOf(b)).reduce((s, x) => s + (x.semanas / totalSemanas) * 100, 0)
                    return subs.map(sub => {
                      const w = ((sub.semana_fin - sub.semana_inicio + 1) / totalSemanas) * 100
                      const l = offset + ((sub.semana_inicio - 1) / totalSemanas) * 100
                      return (
                        <div key={sub.id} style={{ position: 'absolute', left: `${l}%`, width: `${w}%`, height: 24, background: (b.color || '#2d6a4f') + 'aa', borderRadius: 3, padding: '3px 6px', overflow: 'hidden', border: `1px solid ${b.color || '#2d6a4f'}` }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.nombre}</div>
                        </div>
                      )
                    })
                  })}
                </div>

                {/* Competiciones */}
                {competiciones.length > 0 && (
                  <div style={{ position: 'relative', height: 36, marginBottom: 3 }}>
                    {competiciones.map(comp => {
                      const sw = differenceInWeeks(parseISO(comp.fecha), inicio)
                      const p = (sw / totalSemanas) * 100
                      return (
                        <div key={comp.id} style={{ position: 'absolute', left: `${p}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Trophy size={13} color="#c0392b" />
                          <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#c0392b', whiteSpace: 'nowrap', marginTop: 1 }}>{comp.nombre}</div>
                          <div style={{ fontSize: 8, fontFamily: 'monospace', color: '#c0392b', opacity: 0.8 }}>{format(parseISO(comp.fecha), 'dd MMM', { locale: es })}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Semanas */}
                <div style={{ display: 'flex', borderTop: '1px solid #eceae4', paddingTop: 2 }}>
                  {Array.from({ length: totalSemanas }, (_, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: '#9a9890', fontFamily: 'monospace', borderLeft: i % 4 === 0 ? '1px solid #eceae4' : 'none' }}>{`S${i + 1}`}</div>
                  ))}
                </div>

                {/* Meses */}
                <div style={{ display: 'flex', marginTop: 2 }}>
                  {Array.from({ length: totalSemanas }, (_, i) => {
                    const fecha = addWeeks(inicio, i)
                    const esPrimero = i === 0 || format(fecha, 'MM') !== format(addWeeks(inicio, i - 1), 'MM')
                    return (
                      <div key={i} style={{ flex: 1, position: 'relative', height: 16 }}>
                        {esPrimero && <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 9, fontFamily: 'monospace', color: '#2d6a4f', whiteSpace: 'nowrap', borderLeft: '1px solid #2d6a4f', paddingLeft: 3, fontWeight: 600, textTransform: 'capitalize' }}>{format(fecha, 'MMM yyyy', { locale: es })}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Semana tipo y Consideraciones */}
            {(cliente?.semana_tipo || cliente?.consideraciones) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {cliente?.semana_tipo && Object.keys(cliente.semana_tipo).length > 0 && (
                  <div style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Semana tipo</div>
                    <SemanaTipoCalendario />
                    {cliente?.disponibilidad && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eceae4' }}>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9a9890', textTransform: 'uppercase', marginBottom: 4 }}>Disponibilidad</div>
                        <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{cliente.disponibilidad}</div>
                      </div>
                    )}
                  </div>
                )}
                {cliente?.consideraciones && (
                  <div style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Consideraciones</div>
                    {cliente.consideraciones.split('\n').filter(l => l.trim()).map((linea, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                        <span style={{ fontSize: 13 }}>{linea}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== BLOQUE ===== */}
        {vista === 'macro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bloques.map((b, idx) => (
              <div key={b.id} style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</div>
                    <div style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace', marginTop: 2 }}>
                      {b.semanas} semanas · desde {format(parseISO(b.fecha_inicio), 'dd MMM', { locale: es })}
                    </div>
                  </div>
                  {b.objetivo && (
                    <button onClick={() => setExpandido(e => ({ ...e, [b.id]: !e[b.id] }))}
                      style={{ background: 'none', border: '1px solid #d8d5cc', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#5a5850' }}>
                      {expandido[b.id] ? 'Ocultar' : 'Ver objetivo'}
                    </button>
                  )}
                </div>
                {expandido[b.id] && b.objetivo && (
                  <div style={{ padding: '0 16px 14px', borderTop: '1px solid #eceae4' }}>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 0 6px', display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo</div>
                    {b.objetivo.split('\n').filter(l => l.trim()).map((linea, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                        <span style={{ fontSize: 13 }}>{linea}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===== SUB BLOQUE ===== */}
        {vista === 'subbloque' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bloques.map((b, idx) => {
              const subs = subbloques[b.id] || []
              const abierto = bloqueAbierto === b.id
              return (
                <div key={b.id} style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#f5f4f0' }}
                    onClick={() => setBloqueAbierto(abierto ? null : b.id)}>
                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                    <span style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>{b.semanas} semanas</span>
                  </div>
                  {abierto && (
                    <div style={{ borderTop: '1px solid #eceae4' }}>
                      {subs.map(sub => {
                        const semsBloque = semanas[b.id] || []
                        const semsDelSub = semsBloque.filter(s => s.numero >= sub.semana_inicio && s.numero <= sub.semana_fin)
                        const totalMin = semsDelSub.reduce((s, x) => s + (x.zona1_2_real || 0) + (x.zona3_4_real || 0) + (x.zona5_real || 0), 0)
                        const z1r = semsDelSub.reduce((s, x) => s + (x.zona1_2_real || 0), 0)
                        const z3r = semsDelSub.reduce((s, x) => s + (x.zona3_4_real || 0), 0)
                        const z5r = semsDelSub.reduce((s, x) => s + (x.zona5_real || 0), 0)
                        const kmRealTotal = semsDelSub.reduce((s, x) => s + (x.km_real || 0), 0)
                        const semsConKm = semsDelSub.filter(s => s.km_real)
                        const kmRealMedio = semsConKm.length > 0 ? Math.round(kmRealTotal / semsConKm.length) : 0
                        const kmObjetivoMedio = sub.km_min && sub.km_max ? (sub.km_min + sub.km_max) / 2 : sub.km_max || sub.km_min || null
                        const pctKm = kmObjetivoMedio && kmRealMedio > 0 ? Math.round((kmRealMedio / kmObjetivoMedio) * 100) : null
                        const kmMax = Math.max(sub.km_max || 0, kmRealMedio, 1)
                        const tieneKm = sub.km_min || sub.km_max || kmRealMedio > 0
                        return (
                          <div key={sub.id} style={{ borderBottom: '1px solid #eceae4' }}>
                            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color || '#2d6a4f' }} />
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{sub.nombre}</span>
                              <span style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>S{sub.semana_inicio}–S{sub.semana_fin}</span>
                              <button onClick={() => setExpandido(e => ({ ...e, [sub.id]: !e[sub.id] }))}
                                style={{ marginLeft: 'auto', background: 'none', border: '1px solid #d8d5cc', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: expandido[sub.id] ? b.color || '#2d6a4f' : '#9a9890' }}>
                                <Layers size={11} />
                              </button>
                            </div>
                            {expandido[sub.id] && (
                              <div style={{ padding: '0 16px 12px 30px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {sub.notas && (
                                    <div>
                                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Contenidos</div>
                                      {sub.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                                          <span style={{ fontSize: 13 }}>{linea}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0 || totalMin > 0) && (
                                    <div>
                                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', marginBottom: 10, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Zonas</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {(sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0) && (
                                          <div>
                                            <div style={{ fontSize: 9, color: '#9a9890', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Objetivo</div>
                                            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
                                              {sub.zona1_2 > 0 && <div style={{ width: `${sub.zona1_2}%`, background: '#10b981', opacity: 0.5 }} />}
                                              {sub.zona3_4 > 0 && <div style={{ width: `${sub.zona3_4}%`, background: '#f59e0b', opacity: 0.5 }} />}
                                              {sub.zona5 > 0 && <div style={{ width: `${sub.zona5}%`, background: '#ef4444', opacity: 0.5 }} />}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                              {sub.zona1_2 > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#10b981' }}>Z1-Z2 {sub.zona1_2}%</span>}
                                              {sub.zona3_4 > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#f59e0b' }}>Z3-Z4 {sub.zona3_4}%</span>}
                                              {sub.zona5 > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#ef4444' }}>Z5-Z5+ {sub.zona5}%</span>}
                                            </div>
                                          </div>
                                        )}
                                        {totalMin > 0 && (
                                          <div>
                                            <div style={{ fontSize: 9, color: '#9a9890', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Real acumulado — {totalMin} min</div>
                                            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
                                              {z1r > 0 && <div style={{ width: `${(z1r / totalMin) * 100}%`, background: '#10b981' }} />}
                                              {z3r > 0 && <div style={{ width: `${(z3r / totalMin) * 100}%`, background: '#f59e0b' }} />}
                                              {z5r > 0 && <div style={{ width: `${(z5r / totalMin) * 100}%`, background: '#ef4444' }} />}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                              {z1r > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#10b981' }}>Z1-Z2 {Math.round((z1r / totalMin) * 100)}% ({z1r}min)</span>}
                                              {z3r > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#f59e0b' }}>Z3-Z4 {Math.round((z3r / totalMin) * 100)}% ({z3r}min)</span>}
                                              {z5r > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#ef4444' }}>Z5-Z5+ {Math.round((z5r / totalMin) * 100)}% ({z5r}min)</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {tieneKm && (
                                    <div>
                                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', marginBottom: 10, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Volumen</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {(sub.km_min || sub.km_max) && (
                                          <div>
                                            <div style={{ fontSize: 9, color: '#9a9890', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Objetivo — {sub.km_min && sub.km_max ? `${sub.km_min}–${sub.km_max} km/sem` : sub.km_min ? `${sub.km_min}+ km/sem` : `máx ${sub.km_max} km/sem`}</div>
                                            <div style={{ height: 10, background: '#eceae4', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                                              {sub.km_min && <div style={{ position: 'absolute', left: 0, height: '100%', width: `${Math.min((sub.km_min / kmMax) * 100, 100)}%`, background: '#3b82f6', opacity: 0.25, borderRadius: 5 }} />}
                                              {sub.km_max && <div style={{ position: 'absolute', left: 0, height: '100%', width: `${Math.min((sub.km_max / kmMax) * 100, 100)}%`, background: '#3b82f6', opacity: 0.15, borderRadius: 5 }} />}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                                              {sub.km_min && <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#3b82f6', opacity: 0.7 }}>{sub.km_min} km</span>}
                                              {sub.km_min && sub.km_max && <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#9a9890' }}>–</span>}
                                              {sub.km_max && <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#3b82f6', opacity: 0.7 }}>{sub.km_max} km</span>}
                                            </div>
                                          </div>
                                        )}
                                        {kmRealMedio > 0 && (
                                          <div>
                                            <div style={{ fontSize: 9, color: '#9a9890', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Real medio — {kmRealMedio} km/sem</div>
                                            <div style={{ height: 10, background: '#eceae4', borderRadius: 5, overflow: 'hidden' }}>
                                              <div style={{ height: '100%', width: `${Math.min((kmRealMedio / kmMax) * 100, 100)}%`, background: '#3b82f6', borderRadius: 5 }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#3b82f6' }}>{kmRealMedio} km</span>
                                              {pctKm && <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: kmRealMedio >= (sub.km_min || 0) ? '#10b981' : '#f59e0b' }}>{pctKm}% del objetivo</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {subs.length === 0 && <div style={{ padding: 16, color: '#9a9890', fontSize: 13, fontStyle: 'italic' }}>Sin sub bloques</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ===== SEMANA ===== */}
        {vista === 'micro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bloques.map((b, idx) => {
              const semsBloque = semanas[b.id] || []
              const subsBloque = subbloques[b.id] || []
              const abierto = bloqueAbierto === b.id
              return (
                <div key={b.id} style={{ background: 'white', border: '1px solid #d8d5cc', borderRadius: 10, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#f5f4f0' }}
                    onClick={() => setBloqueAbierto(abierto ? null : b.id)}>
                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                    <span style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>{b.semanas} semanas</span>
                  </div>
                  {abierto && (
                    <div style={{ borderTop: '1px solid #eceae4' }}>
                      {subsBloque.length > 0 ? subsBloque.map(sub => {
                        const semsDelSub = Array.from({ length: sub.semana_fin - sub.semana_inicio + 1 }, (_, i) => sub.semana_inicio + i)
                        const semsDelSubData = semsBloque.filter(s => s.numero >= sub.semana_inicio && s.numero <= sub.semana_fin)
                        return (
                          <div key={sub.id}>
                            <div style={{ padding: '8px 16px', background: '#eceae4', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #d8d5cc' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color || '#2d6a4f' }} />
                              <span style={{ fontWeight: 600, fontSize: 12 }}>{sub.nombre}</span>
                              <span style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>S{sub.semana_inicio}–S{sub.semana_fin}</span>
                            </div>
                            {semsDelSub.map(num => {
                              const sem = semsBloque.find(s => s.numero === num)
                              const fechaSem = format(addWeeks(parseISO(b.fecha_inicio), num - 1), 'dd MMM', { locale: es })
                              const cargaSem = sem?.carga ? CARGAS[sem.carga] : null
                              const fechaSemana = addWeeks(parseISO(b.fecha_inicio), num - 1)
                              const esSemanaActual = hoy >= fechaSemana && hoy < addWeeks(fechaSemana, 1)
                              const compSem = competiciones.filter(c => { const fc = parseISO(c.fecha); return fc >= fechaSemana && fc < addWeeks(fechaSemana, 1) })
                              const total = (sem?.zona1_2_real || 0) + (sem?.zona3_4_real || 0) + (sem?.zona5_real || 0)
                              return (
                                <div key={num} style={{ borderBottom: '1px solid #eceae4', background: esSemanaActual ? '#f0f9f4' : 'transparent' }}>
                                  {compSem.map(comp => (
                                    <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: '#fdecea', borderBottom: '1px solid #c0392b' }}>
                                      <Trophy size={12} color="#c0392b" />
                                      <span style={{ fontSize: 12, fontWeight: 500, color: '#c0392b' }}>{comp.nombre}</span>
                                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#c0392b', opacity: 0.8 }}>{format(parseISO(comp.fecha), 'dd MMM', { locale: es })}</span>
                                    </div>
                                  ))}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: esSemanaActual ? '#2d6a4f' : cargaSem ? cargaSem.color : '#eceae4', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: esSemanaActual ? '0 0 0 2px #2d6a4f' : 'none' }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: esSemanaActual || cargaSem ? 'white' : '#9a9890', fontFamily: 'monospace' }}>S{num}</span>
                                      </div>
                                      {esSemanaActual && (
                                        <div style={{ position: 'absolute', top: -16, left: '60%', transform: 'translateX(-50%) rotate(15deg)', fontSize: 16, whiteSpace: 'nowrap' }}>📍</div>
                                      )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      {sem?.objetivo ? <div style={{ fontSize: 13 }}>{sem.objetivo}</div> : <div style={{ fontSize: 13, color: '#9a9890', fontStyle: 'italic' }}>{sub.nombre}</div>}
                                      {(sem?.km_objetivo || sem?.km_real) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                          {sem?.km_objetivo && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', opacity: 0.7 }}>obj: {sem.km_objetivo}km</span>}
                                          {sem?.km_real && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600 }}>real: {sem.km_real}km</span>}
                                          {sem?.km_objetivo && sem?.km_real && (() => {
                                            const p = Math.round((sem.km_real / sem.km_objetivo) * 100)
                                            const c = p < 40 ? '#ef4444' : p < 80 ? '#f97316' : p < 120 ? '#10b981' : p < 160 ? '#f59e0b' : '#8b5cf6'
                                            return <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: c }}>{p}%</span>
                                          })()}
                                          {total > 0 && (() => {
                                            const zonas = [
                                              { key: 'zona1_2_real', obj: sub.zona1_2, label: 'Z1-Z2' },
                                              { key: 'zona3_4_real', obj: sub.zona3_4, label: 'Z3-Z4' },
                                              { key: 'zona5_real', obj: sub.zona5, label: 'Z5-Z5+' },
                                            ]
                                            return (
                                              <div style={{ display: 'flex', gap: 0 }}>
                                                {zonas.map(z => {
                                                  const real = Math.round(((sem[z.key] || 0) / total) * 100)
                                                  const diff = real - (z.obj || 0)
                                                  const c = Math.abs(diff) <= 8 ? '#10b981' : Math.abs(diff) <= 20 ? '#f59e0b' : '#ef4444'
                                                  return <span key={z.key} style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: c, paddingLeft: 8, paddingRight: 8, borderLeft: '2px solid #d8d5cc' }}>{z.label} {diff > 0 ? '+' : ''}{diff}%</span>
                                                })}
                                              </div>
                                            )
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {sem?.notas && (
                                        <button onClick={() => setExpandido(e => ({ ...e, [`sem-${b.id}-${num}`]: !e[`sem-${b.id}-${num}`] }))}
                                          style={{ background: 'none', border: '1px solid #d8d5cc', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', color: expandido[`sem-${b.id}-${num}`] ? b.color || '#2d6a4f' : '#9a9890' }}>
                                          <Layers size={12} />
                                        </button>
                                      )}
                                      <span style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>{fechaSem}</span>
                                    </div>
                                  </div>
                                  {expandido[`sem-${b.id}-${num}`] && sem?.notas && (
                                    <div style={{ padding: '0 16px 12px 56px' }}>
                                      {sem.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 5 }} />
                                          <span style={{ fontSize: 12, color: '#5a5850' }}>{linea}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      }) : Array.from({ length: b.semanas }, (_, i) => {
                        const num = i + 1
                        const sem = semsBloque.find(s => s.numero === num)
                        const fechaSem = format(addWeeks(parseISO(b.fecha_inicio), i), 'dd MMM', { locale: es })
                        const cargaSem = sem?.carga ? CARGAS[sem.carga] : null
                        const fechaSemana = addWeeks(parseISO(b.fecha_inicio), num - 1)
                        const esSemanaActual = hoy >= fechaSemana && hoy < addWeeks(fechaSemana, 1)
                        const compSem = competiciones.filter(c => { const fc = parseISO(c.fecha); return fc >= fechaSemana && fc < addWeeks(fechaSemana, 1) })
                        const total = (sem?.zona1_2_real || 0) + (sem?.zona3_4_real || 0) + (sem?.zona5_real || 0)
                        return (
                          <div key={num} style={{ borderBottom: '1px solid #eceae4', background: esSemanaActual ? '#f0f9f4' : 'transparent' }}>
                            {compSem.map(comp => (
                              <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: '#fdecea', borderBottom: '1px solid #c0392b' }}>
                                <Trophy size={12} color="#c0392b" />
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#c0392b' }}>{comp.nombre}</span>
                                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#c0392b', opacity: 0.8 }}>{format(parseISO(comp.fecha), 'dd MMM', { locale: es })}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: esSemanaActual ? '#2d6a4f' : cargaSem ? cargaSem.color : '#eceae4', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: esSemanaActual ? '0 0 0 2px #2d6a4f' : 'none' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: esSemanaActual || cargaSem ? 'white' : '#9a9890', fontFamily: 'monospace' }}>S{num}</span>
                                </div>
                                {esSemanaActual && (
                                  <div style={{ position: 'absolute', top: -16, left: '60%', transform: 'translateX(-50%) rotate(15deg)', fontSize: 16, whiteSpace: 'nowrap' }}>📍</div>
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                {sem?.objetivo ? <div style={{ fontSize: 13 }}>{sem.objetivo}</div> : <div style={{ fontSize: 13, color: '#9a9890', fontStyle: 'italic' }}>Sin objetivo definido</div>}
                                {(sem?.km_objetivo || sem?.km_real) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                    {sem?.km_objetivo && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', opacity: 0.7 }}>obj: {sem.km_objetivo}km</span>}
                                    {sem?.km_real && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600 }}>real: {sem.km_real}km</span>}
                                    {sem?.km_objetivo && sem?.km_real && (() => {
                                      const p = Math.round((sem.km_real / sem.km_objetivo) * 100)
                                      const c = p < 40 ? '#ef4444' : p < 80 ? '#f97316' : p < 120 ? '#10b981' : p < 160 ? '#f59e0b' : '#8b5cf6'
                                      return <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: c }}>{p}%</span>
                                    })()}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {sem?.notas && (
                                  <button onClick={() => setExpandido(e => ({ ...e, [`sem-${b.id}-${num}`]: !e[`sem-${b.id}-${num}`] }))}
                                    style={{ background: 'none', border: '1px solid #d8d5cc', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', color: expandido[`sem-${b.id}-${num}`] ? b.color || '#2d6a4f' : '#9a9890' }}>
                                    <Layers size={12} />
                                  </button>
                                )}
                                <span style={{ fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>{fechaSem}</span>
                              </div>
                            </div>
                            {expandido[`sem-${b.id}-${num}`] && sem?.notas && (
                              <div style={{ padding: '0 16px 12px 56px' }}>
                                {sem.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 5 }} />
                                    <span style={{ fontSize: 12, color: '#5a5850' }}>{linea}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#9a9890', fontFamily: 'monospace' }}>
          Planificación generada por Trainer App
        </div>
      </div>
    </div>
  )
}
