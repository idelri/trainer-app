import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, isToday, addMonths, subMonths, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const ICONO = { fuerza: '💪', correr: '🏃', caminar: '🚶', bicicleta: '🚴', nadar: '🏊', movilidad: '🤸', futbol: '⚽', padel: '🎾' }
function iconoSesion(s) {
  const tipos = s?.tipos_actividad?.length > 0 ? s.tipos_actividad : [s?.tipo_actividad || 'fuerza']
  return tipos.map(t => ICONO[t] || '💪').join(' ')
}

const TIPO_CONFIG = {
  nota:        { icono: '📝', label: 'Nota',        bg: '#F1EFE8', color: '#5F5E5A' },
  competicion: { icono: '🏆', label: 'Competición', bg: '#FAEEDA', color: '#633806' },
  control:     { icono: '📊', label: 'Valoración',  bg: '#E6F1FB', color: '#0C447C' },
}

function ItemExtra({ item, compact }) {
  const cfg = TIPO_CONFIG[item._tipo] || TIPO_CONFIG.nota
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '7px 10px' : '9px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>{item.nombre || item.texto}</div>
        {item.objetivo && <div style={{ fontSize: 11, color: cfg.color, opacity: 0.8 }}>{item.objetivo}</div>}
        {item.notas && !item.nombre && <div style={{ fontSize: 11, color: cfg.color, opacity: 0.8 }}>{item.notas}</div>}
      </div>
      {item.fecha && <span style={{ fontSize: 10, color: cfg.color, opacity: 0.7, flexShrink: 0 }}>{format(parseISO(item.fecha), 'd MMM', { locale: es })}</span>}
    </div>
  )
}

function badgeEstado(e) {
  if (e === 'completed') return { label: '✓ Completada', bg: '#E1F5EE', color: '#0F6E56' }
  if (e === 'partial') return { label: '◐ Parcial', bg: '#FAEEDA', color: '#633806' }
  if (e === 'missed') return { label: '✕ No realizada', bg: '#FCEBEB', color: '#A32D2D' }
  return { label: 'Pendiente', bg: '#F1EFE8', color: '#5F5E5A' }
}

function dotColor(e) {
  if (e === 'completed') return '#1D9E75'
  if (e === 'partial') return '#EF9F27'
  if (e === 'missed') return '#E24B4A'
  return '#B4B2A9'
}

function getCurrentWeekRange() {
  const now = new Date()
  const lun = startOfWeek(now, { weekStartsOn: 1 })
  const dom = endOfWeek(now, { weekStartsOn: 1 })
  return { lun, dom }
}

function getWeekStartForSemana(bloqueInicio, numSemana) {
  return addDays(parseISO(bloqueInicio + 'T12:00:00'), (numSemana - 1) * 7)
}

export default function ClientePortal({ token }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [plan, setPlan] = useState(null)
  const [bloques, setBloques] = useState([])
  const [subbloques, setSubbloques] = useState([])
  const [semanas, setSemanas] = useState([])
  const [sesiones, setSesiones] = useState([])
  const [notas, setNotas] = useState([])
  const [competiciones, setCompeticiones] = useState([])
  const [controles, setControles] = useState([])
  const [tab, setTab] = useState('hoy')
  const [vista, setVista] = useState(window.innerWidth >= 768 ? 'desktop' : 'movil')
  const [calMes, setCalMes] = useState(new Date())
  const [bloquesAbiertos, setBloquesAbiertos] = useState(new Set())

  useEffect(() => {
    cargar()
  }, [token])

  async function cargar() {
    setLoading(true)
    const { data: cli } = await supabase.from('clientes').select('*').eq('token_cliente', token).maybeSingle()
    if (!cli) { setError('Enlace no válido'); setLoading(false); return }
    setCliente(cli)

    const { data: planes } = await supabase.from('planificaciones').select('*').eq('cliente_id', cli.id).order('fecha_inicio', { ascending: false }).limit(1)
    const planActual = planes?.[0] || null
    setPlan(planActual)

    if (planActual) {
      const { data: bls } = await supabase.from('bloques').select('*').eq('planificacion_id', planActual.id).order('orden')
      setBloques(bls || [])

      if (bls?.length) {
        const ids = bls.map(b => b.id)
        const { data: subs } = await supabase.from('subbloques').select('*').in('bloque_id', ids).order('semana_inicio')
        setSubbloques(subs || [])
        const { data: sems } = await supabase.from('semanas').select('*').in('bloque_id', ids).order('numero')
        setSemanas(sems || [])
        if (bls.length > 0) setBloquesAbiertos(new Set([bls.find(b => esBloqueActivo(b))?.id].filter(Boolean)))
      }
    }

    const { data: ses } = await supabase.from('sesiones').select('*, sesion_feedback(submitted_at)').eq('cliente_id', cli.id).not('fecha', 'is', null).order('fecha')
    setSesiones((ses || []).map(s => ({
      ...s,
      estado_efectivo: s.estado_manual || (s.sesion_feedback?.submitted_at ? 'completed' : null)
    })))
    const { data: nts } = await supabase.from('sesion_notas').select('*').eq('cliente_id', cli.id).eq('visibilidad', 'cliente').not('fecha', 'is', null).order('fecha')
    setNotas(nts || [])
    const { data: comps } = await supabase.from('competiciones').select('*').eq('cliente_id', cli.id).eq('visibilidad', 'cliente').order('fecha')
    setCompeticiones(comps || [])
    const { data: ctrls } = await supabase.from('controles').select('*').eq('cliente_id', cli.id).eq('visibilidad', 'cliente').order('fecha')
    setControles(ctrls || [])
    setLoading(false)
  }

  function esBloqueActivo(bloque) {
    if (!bloque.fecha_inicio) return false
    const inicio = parseISO(bloque.fecha_inicio + 'T12:00:00')
    const fin = addDays(inicio, (bloque.semanas || 0) * 7)
    const hoy = new Date()
    return hoy >= inicio && hoy < fin
  }

  function getBloqueActivo() { return bloques.find(b => esBloqueActivo(b)) || null }

  function getSubbloqueActivo(bloque) {
    if (!bloque?.fecha_inicio) return null
    const hoy = new Date()
    const subs = subbloques.filter(s => s.bloque_id === bloque.id)
    return subs.find(s => {
      const ini = addDays(parseISO(bloque.fecha_inicio + 'T12:00:00'), (s.semana_inicio - 1) * 7)
      const fin = addDays(parseISO(bloque.fecha_inicio + 'T12:00:00'), s.semana_fin * 7)
      return hoy >= ini && hoy < fin
    }) || subs[0] || null
  }

  function getSemanaActual(bloque) {
    if (!bloque?.fecha_inicio) return null
    const hoy = new Date()
    const sems = semanas.filter(s => s.bloque_id === bloque.id)
    return sems.find(s => {
      const ini = addDays(parseISO(bloque.fecha_inicio + 'T12:00:00'), (s.numero - 1) * 7)
      const fin = addDays(ini, 7)
      return hoy >= ini && hoy < fin
    }) || null
  }

  function getSemanaNumGlobal() {
    let total = 0
    for (const b of bloques) {
      if (!b.fecha_inicio) continue
      const ini = parseISO(b.fecha_inicio + 'T12:00:00')
      const fin = addDays(ini, (b.semanas || 0) * 7)
      const hoy = new Date()
      if (hoy >= ini && hoy < fin) {
        const diff = Math.floor((hoy - ini) / (7 * 24 * 3600 * 1000))
        return total + diff + 1
      }
      total += b.semanas || 0
    }
    return total
  }

  function getTotalSemanas() { return bloques.reduce((a, b) => a + (b.semanas || 0), 0) }

  function getItemsSemanaActual() {
    const { lun, dom } = getCurrentWeekRange()
    const enSemana = arr => (arr || []).filter(x => { const f = parseISO(x.fecha); return f >= lun && f <= dom })
    return [
      ...enSemana(notas).map(x => ({ ...x, _tipo: 'nota' })),
      ...enSemana(competiciones).map(x => ({ ...x, _tipo: 'competicion' })),
      ...enSemana(controles).map(x => ({ ...x, _tipo: 'control' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  function getItemsCalMes() {
    const ini = startOfMonth(calMes)
    const fin = endOfMonth(calMes)
    const enMes = arr => (arr || []).filter(x => { if (!x.fecha) return false; const f = parseISO(x.fecha); return f >= ini && f <= fin })
    return [
      ...enMes(notas).map(x => ({ ...x, _tipo: 'nota' })),
      ...enMes(competiciones).map(x => ({ ...x, _tipo: 'competicion' })),
      ...enMes(controles).map(x => ({ ...x, _tipo: 'control' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  function abrirSesion(s) {
    if (s.token_publico) window.location.href = `/sesion/${s.token_publico}`
  }

  function getSesionesSemanaActual() {
    const { lun, dom } = getCurrentWeekRange()
    return sesiones.filter(s => {
      if (!s.fecha) return false
      const f = parseISO(s.fecha)
      return f >= lun && f <= dom
    })
  }

  function getProgresoPlan() {
    const semNum = getSemanaNumGlobal()
    const total = getTotalSemanas()
    if (!total) return 0
    return Math.min(100, Math.round((semNum / total) * 100))
  }

  function getConsistencia() {
    const hace4sem = addDays(new Date(), -28)
    const pasadas = sesiones.filter(s => s.fecha && parseISO(s.fecha) >= hace4sem && parseISO(s.fecha) <= new Date())
    const hechas = pasadas.filter(s => s.estado_efectivo === 'completed' || s.estado_efectivo === 'partial')
    if (!pasadas.length) return null
    return Math.round((hechas.length / pasadas.length) * 100)
  }

  function getSesionesCalMes() {
    const ini = startOfMonth(calMes)
    const fin = endOfMonth(calMes)
    return sesiones.filter(s => {
      if (!s.fecha) return false
      const f = parseISO(s.fecha)
      return f >= ini && f <= fin
    })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
      <p style={{ color: '#888', fontFamily: 'sans-serif' }}>Cargando...</p>
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
      <p style={{ color: '#888', fontFamily: 'sans-serif' }}>{error}</p>
    </div>
  )

  const bloqueActivo = getBloqueActivo()
  const subbloqueActivo = getSubbloqueActivo(bloqueActivo)
  const semanaActual = getSemanaActual(bloqueActivo)
  const semanaNum = getSemanaNumGlobal()
  const totalSem = getTotalSemanas()
  const progreso = getProgresoPlan()
  const sesionesSemana = getSesionesCalMes()
  const sesActuales = getSesionesSemanaActual()
  const consistencia = getConsistencia()

  const isDesktop = vista === 'desktop'

  const S = {
    wrap: { minHeight: '100vh', background: '#f4f3f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1a1a1a' },
    shell: { maxWidth: isDesktop ? 1100 : 480, margin: '0 auto', padding: isDesktop ? '20px 24px' : '0' },

    topbar: { background: '#fff', borderBottom: '1px solid #e8e5e0', padding: isDesktop ? '14px 24px' : '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 },
    avatar: { width: 38, height: 38, borderRadius: '50%', background: '#5DCAA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#04342C', flexShrink: 0 },
    iniciales: (cliente?.nombre || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),

    tabs: { display: 'flex', gap: 2, marginLeft: isDesktop ? 24 : 'auto' },
    tab: (activo) => ({ padding: isDesktop ? '7px 18px' : '6px 12px', borderRadius: 8, fontSize: isDesktop ? 13 : 12, color: activo ? '#1a1a1a' : '#888', cursor: 'pointer', background: activo ? '#f4f3f0' : 'transparent', fontWeight: activo ? 500 : 400, border: activo ? '1px solid #e0ddd8' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: 5 }),

    vistaToggle: { marginLeft: 'auto', display: 'flex', gap: 2, background: '#f4f3f0', borderRadius: 8, padding: 3 },
    vistaBtn: (activo) => ({ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: activo ? '#fff' : 'transparent', color: activo ? '#1a1a1a' : '#888', border: 'none', fontWeight: activo ? 500 : 400 }),

    body: isDesktop ? { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, padding: '20px 0' } : { padding: '0 0 80px' },
    main: isDesktop ? { display: 'flex', flexDirection: 'column', gap: 16 } : { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 },
    side: isDesktop ? { display: 'flex', flexDirection: 'column', gap: 14 } : null,

    card: { background: '#fff', borderRadius: isDesktop ? 12 : 10, border: '1px solid #e8e5e0', overflow: 'hidden' },
    cardPad: { padding: isDesktop ? '16px 18px' : '14px 16px' },
    secLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 8 },
  }

  function TabHoy() {
    return (
      <div style={S.body}>
        <div style={S.main}>
          {plan && (
            <div style={S.card}>
              <div style={S.cardPad}>
                <div style={{ fontSize: isDesktop ? 17 : 15, fontWeight: 600, marginBottom: 2 }}>{plan.nombre}</div>
                {plan.notas && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Objetivo: {plan.notas}</div>}
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Semana {semanaNum} de {totalSem}</div>
                <div style={{ height: 8, background: '#f0ede8', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: progreso + '%', background: '#1D9E75', borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
                  <span>{plan.fecha_inicio ? format(parseISO(plan.fecha_inicio + 'T12:00:00'), 'MMM yyyy', { locale: es }) : ''}</span>
                  <span style={{ color: '#1D9E75', fontWeight: 600 }}>{progreso}%</span>
                  <span>{plan.fecha_fin ? format(parseISO(plan.fecha_fin + 'T12:00:00'), 'MMM yyyy', { locale: es }) : 'Continuo'}</span>
                </div>
              </div>

              {bloques.length > 0 && (
                <div style={{ display: 'flex', borderTop: '1px solid #f0ede8' }}>
                  {bloques.map(b => {
                    const activo = esBloqueActivo(b)
                    return (
                      <div key={b.id} style={{ flex: b.semanas || 1, padding: '7px 6px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: activo ? (b.color || '#1D9E75') + '22' : 'transparent', color: activo ? (b.color || '#1D9E75') : '#aaa', borderRight: '1px solid #f0ede8', outline: activo ? `2px solid ${b.color || '#1D9E75'}` : 'none', outlineOffset: -2, borderRadius: 0 }}>
                        {b.nombre?.split(' ')[0]}
                        <div style={{ fontWeight: 400, marginTop: 1, opacity: 0.75 }}>{b.semanas}s</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {bloqueActivo && (
            <div style={{ ...S.card, border: `1px solid ${bloqueActivo.color || '#1D9E75'}44`, background: (bloqueActivo.color || '#1D9E75') + '0a' }}>
              <div style={S.cardPad}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: bloqueActivo.color || '#1D9E75', marginBottom: 4 }}>Enfoque actual · {bloqueActivo.nombre}</div>
                {subbloqueActivo && <div style={{ fontSize: isDesktop ? 15 : 14, fontWeight: 600, marginBottom: 4 }}>{subbloqueActivo.nombre}</div>}
                {subbloqueActivo?.objetivo && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: subbloqueActivo.objetivo ? 10 : 0 }}>{subbloqueActivo.objetivo}</div>}
                {bloqueActivo.objetivo && (
                  <div style={isDesktop ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 } : { marginTop: 8 }}>
                    {bloqueActivo.objetivo.split('\n').filter(Boolean).map((g, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#444', display: 'flex', alignItems: 'center', gap: 5, marginBottom: isDesktop ? 0 : 3 }}>
                        <span style={{ color: bloqueActivo.color || '#1D9E75', fontSize: 14 }}>✓</span> {g}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={S.card}>
            <div style={S.cardPad}>
              <div style={S.secLabel}>Esta semana · {format(getCurrentWeekRange().lun, 'd MMM', { locale: es })}–{format(getCurrentWeekRange().dom, 'd MMM', { locale: es })}</div>
              {sesActuales.length === 0 ? (
                <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>No hay sesiones esta semana</div>
              ) : (
                isDesktop ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Día', '', 'Sesión', 'Duración', 'Estado'].map((h, i) => (
                          <th key={i} style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa', padding: '0 8px 8px', textAlign: i === 4 ? 'right' : 'left', borderBottom: '1px solid #f0ede8' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sesActuales.map(s => {
                        const bd = badgeEstado(s.estado_efectivo)
                        return (
                          <tr key={s.id} onClick={() => abrirSesion(s)} style={{ cursor: s.token_publico ? 'pointer' : 'default' }}>
                            <td style={{ padding: '9px 8px', borderBottom: '1px solid #f8f7f4' }}>
                              <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: '#f4f3f0', border: '1px solid #e8e5e0', padding: '2px 7px', borderRadius: 5 }}>{format(parseISO(s.fecha), 'EEE d', { locale: es }).toUpperCase()}</span>
                            </td>
                            <td style={{ padding: '9px 8px', borderBottom: '1px solid #f8f7f4' }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f4f3f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{iconoSesion(s)}</div>
                            </td>
                            <td style={{ padding: '9px 8px', borderBottom: '1px solid #f8f7f4' }}>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{s.titulo}</div>
                              {s.objetivo && <div style={{ fontSize: 11, color: '#aaa' }}>{s.objetivo}</div>}
                            </td>
                            <td style={{ padding: '9px 8px', fontSize: 12, color: '#888', borderBottom: '1px solid #f8f7f4' }}>{s.duracion_min ? `${s.duracion_min} min` : '—'}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', borderBottom: '1px solid #f8f7f4' }}>
                              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 500, background: bd.bg, color: bd.color }}>{bd.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sesActuales.map(s => {
                      const bd = badgeEstado(s.estado_efectivo)
                      return (
                        <div key={s.id} onClick={() => abrirSesion(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: '#f8f7f4', border: '1px solid #eee', cursor: s.token_publico ? 'pointer' : 'default' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#aaa', minWidth: 32 }}>{format(parseISO(s.fecha), 'EEE', { locale: es }).toUpperCase()}</span>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{iconoSesion(s)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{s.titulo}</div>
                            {s.duracion_min && <div style={{ fontSize: 11, color: '#aaa' }}>{s.duracion_min} min</div>}
                          </div>
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: bd.bg, color: bd.color, flexShrink: 0 }}>{bd.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          {!isDesktop && (() => {
            const extras = getItemsSemanaActual()
            if (!extras.length) return null
            return (
              <div style={S.card}>
                <div style={S.cardPad}>
                  <div style={S.secLabel}>Esta semana · notas y eventos</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {extras.map(x => <ItemExtra key={x.id} item={x} />)}
                  </div>
                </div>
              </div>
            )
          })()}

          {!isDesktop && semanaActual?.nota_cliente && (
            <div style={{ ...S.card, borderLeft: '3px solid #1D9E75', borderRadius: '0 10px 10px 0' }}>
              <div style={S.cardPad}>
                <div style={S.secLabel}>Nota de tu entrenadora</div>
                <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, fontStyle: 'italic' }}>{semanaActual.nota_cliente}</div>
              </div>
            </div>
          )}
        </div>

        {isDesktop && (
          <div style={S.side}>
            {semanaActual?.nota_cliente && (
              <div style={{ ...S.card, borderLeft: '3px solid #1D9E75', borderRadius: '0 12px 12px 0' }}>
                <div style={S.cardPad}>
                  <div style={S.secLabel}>Nota de tu entrenadora</div>
                  <div style={{ fontSize: 12, color: '#444', lineHeight: 1.65, fontStyle: 'italic' }}>{semanaActual.nota_cliente}</div>
                </div>
              </div>
            )}

            {(() => {
              const extras = getItemsSemanaActual()
              if (!extras.length) return null
              return (
                <div style={S.card}>
                  <div style={S.cardPad}>
                    <div style={S.secLabel}>Notas y eventos esta semana</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {extras.map(x => <ItemExtra key={x.id} item={x} />)}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={S.card}>
              <div style={S.cardPad}>
                <div style={S.secLabel}>Tu progreso esta semana</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const hechas = sesActuales.filter(s => s.estado_efectivo === 'completed' || s.estado_efectivo === 'partial').length
                    const total = sesActuales.length
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span style={{ color: '#555' }}>Sesiones completadas</span>
                          <span style={{ fontWeight: 600, color: '#1D9E75' }}>{hechas} / {total}</span>
                        </div>
                        <div style={{ height: 5, background: '#f0ede8', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: total ? (hechas / total * 100) + '%' : '0%', background: '#1D9E75', borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })()}
                  {consistencia !== null && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#555' }}>Constancia (4 sem)</span>
                        <span style={{ fontWeight: 600, color: '#1D9E75' }}>{consistencia}%</span>
                      </div>
                      <div style={{ height: 5, background: '#f0ede8', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: consistencia + '%', background: '#1D9E75', borderRadius: 3 }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {bloqueActivo && (
              <div style={S.card}>
                <div style={S.cardPad}>
                  <div style={S.secLabel}>Progreso del bloque</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{bloqueActivo.nombre}</div>
                  {(() => {
                    const ini = bloqueActivo.fecha_inicio ? parseISO(bloqueActivo.fecha_inicio + 'T12:00:00') : null
                    const semsTotal = bloqueActivo.semanas || 0
                    if (!ini || !semsTotal) return null
                    const hoy = new Date()
                    const semCurr = Math.min(semsTotal, Math.floor((hoy - ini) / (7 * 24 * 3600 * 1000)) + 1)
                    const pct = Math.round((semCurr / semsTotal) * 100)
                    return (
                      <>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Semana {semCurr} de {semsTotal}</div>
                        <div style={{ height: 5, background: '#f0ede8', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: bloqueActivo.color || '#1D9E75', borderRadius: 3 }} />
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  function TabCalendario() {
    const diasMes = eachDayOfInterval({ start: startOfMonth(calMes), end: endOfMonth(calMes) })
    const primerDia = diasMes[0].getDay()
    const offset = primerDia === 0 ? 6 : primerDia - 1
    const padding = Array(offset).fill(null)
    const sesMes = getSesionesCalMes()

    const proximas = sesiones.filter(s => s.fecha && parseISO(s.fecha) >= new Date()).slice(0, 5)

    return (
      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, padding: '20px 0' } : { padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={S.card}>
            <div style={S.cardPad}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{format(calMes, 'MMMM yyyy', { locale: es })}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setCalMes(m => subMonths(m, 1))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e5e0', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#555' }}>‹</button>
                  <button onClick={() => setCalMes(new Date())} style={{ padding: '0 8px', height: 28, borderRadius: 6, border: '1px solid #e8e5e0', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#555' }}>Hoy</button>
                  <button onClick={() => setCalMes(m => addMonths(m, 1))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e5e0', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#555' }}>›</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
                {['L','M','X','J','V','S','D'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#aaa', padding: '2px 0' }}>{d}</div>)}
                {padding.map((_, i) => <div key={'p'+i} />)}
                {diasMes.map(dia => {
                  const sesDia = sesMes.filter(s => s.fecha && isSameDay(parseISO(s.fecha), dia))
                  const hoy = isToday(dia)
                  return (
                    <div key={dia.toISOString()} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: hoy ? '#1D9E75' : 'transparent', cursor: sesDia.length ? 'pointer' : 'default', position: 'relative' }}>
                      <span style={{ fontSize: 12, color: hoy ? '#fff' : '#333', fontWeight: hoy ? 600 : 400 }}>{format(dia, 'd')}</span>
                      {sesDia.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 3 }}>
                          {sesDia.slice(0, 3).map((s, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: hoy ? 'rgba(255,255,255,0.8)' : dotColor(s.estado_efectivo) }} />)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {[['#1D9E75','Completada'],['#EF9F27','Pendiente'],['#E24B4A','No realizada']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{l}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(() => {
            const extMes = getItemsCalMes()
            if (!extMes.length) return null
            return (
              <div style={{ ...S.card, marginTop: 14 }}>
                <div style={S.cardPad}>
                  <div style={S.secLabel}>Notas y eventos de {format(calMes, 'MMMM', { locale: es })}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {extMes.map(x => <ItemExtra key={x.id} item={x} compact />)}
                  </div>
                </div>
              </div>
            )
          })()}

          {sesMes.length > 0 && (
            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardPad}>
                <div style={S.secLabel}>Sesiones de {format(calMes, 'MMMM', { locale: es })}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {sesMes.map(s => {
                    const bd = badgeEstado(s.estado_efectivo)
                    return (
                      <div key={s.id} onClick={() => abrirSesion(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#f8f7f4', border: '1px solid #eee', cursor: s.token_publico ? 'pointer' : 'default' }}>
                        <div style={{ textAlign: 'center', minWidth: 36, fontSize: 10, color: '#888', lineHeight: 1.3 }}>
                          <strong style={{ display: 'block', fontSize: 14, color: '#333' }}>{format(parseISO(s.fecha), 'd')}</strong>
                          {format(parseISO(s.fecha), 'EEE', { locale: es })}
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{iconoSesion(s)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{s.titulo}</div>
                          {s.duracion_min && <div style={{ fontSize: 11, color: '#aaa' }}>{s.duracion_min} min</div>}
                        </div>
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: bd.bg, color: bd.color, flexShrink: 0 }}>{bd.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {isDesktop && proximas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={S.card}>
              <div style={S.cardPad}>
                <div style={S.secLabel}>Próximas sesiones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {proximas.map(s => {
                    const bd = badgeEstado(s.estado_efectivo)
                    return (
                      <div key={s.id} onClick={() => abrirSesion(s)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#f8f7f4', cursor: s.token_publico ? 'pointer' : 'default' }}>
                        <div style={{ textAlign: 'center', minWidth: 32 }}>
                          <strong style={{ display: 'block', fontSize: 13, color: '#333' }}>{format(parseISO(s.fecha), 'd')}</strong>
                          <span style={{ fontSize: 9, color: '#aaa' }}>{format(parseISO(s.fecha), 'MMM', { locale: es })}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{s.titulo}</div>
                          {s.duracion_min && <div style={{ fontSize: 11, color: '#aaa' }}>{s.duracion_min} min</div>}
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 500, background: bd.bg, color: bd.color, flexShrink: 0 }}>{bd.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function TabPlan() {
    return (
      <div style={isDesktop ? { padding: '20px 0' } : { padding: '14px 16px 80px' }}>
        {plan && (
          <div style={{ ...S.card, marginBottom: 14 }}>
            <div style={S.cardPad}>
              <div style={{ fontSize: isDesktop ? 16 : 14, fontWeight: 600, marginBottom: 2 }}>{plan.nombre}</div>
              {plan.notas && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Objetivo: {plan.notas}</div>}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e5e0' }}>
                {bloques.map(b => {
                  const activo = esBloqueActivo(b)
                  return (
                    <div key={b.id} style={{ flex: b.semanas || 1, padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: activo ? (b.color || '#1D9E75') + '20' : '#f8f7f4', color: activo ? (b.color || '#1D9E75') : '#aaa', borderRight: '1px solid #e8e5e0', outline: activo ? `2px solid ${b.color || '#1D9E75'}` : 'none', outlineOffset: -2 }}>
                      {b.nombre?.split(' ')[0]}
                      <div style={{ fontWeight: 400, marginTop: 1, opacity: 0.75 }}>{b.semanas}s</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bloques.map(b => {
            const activo = esBloqueActivo(b)
            const abierto = bloquesAbiertos.has(b.id)
            const subsBl = subbloques.filter(s => s.bloque_id === b.id)
            return (
              <div key={b.id} style={{ ...S.card, border: activo ? `1px solid ${b.color || '#1D9E75'}55` : '1px solid #e8e5e0' }}>
                <div onClick={() => setBloquesAbiertos(prev => { const s = new Set(prev); s.has(b.id) ? s.delete(b.id) : s.add(b.id); return s })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', background: activo ? (b.color || '#1D9E75') + '10' : 'transparent', userSelect: 'none' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.color || '#1D9E75', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.nombre}</div>
                    {b.fase && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{b.fase} · {b.semanas} semanas</div>}
                  </div>
                  {activo && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: (b.color || '#1D9E75') + '22', color: b.color || '#1D9E75', fontWeight: 600 }}>En curso</span>}
                  <span style={{ color: '#aaa', fontSize: 12 }}>{abierto ? '▲' : '▼'}</span>
                </div>
                {abierto && (
                  <div style={{ borderTop: '1px solid #f0ede8', padding: '12px 16px', background: '#faf9f7' }}>
                    {b.objetivo && <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: subsBl.length ? 12 : 0 }}>{b.objetivo}</p>}
                    {subsBl.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa', marginBottom: 6 }}>Subbloques</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {subsBl.map(s => {
                            const esAct = getSubbloqueActivo(b)?.id === s.id
                            return (
                              <div key={s.id} style={{ fontSize: 12, color: esAct ? (b.color || '#1D9E75') : '#666', display: 'flex', alignItems: 'baseline', gap: 6, padding: '4px 0', borderBottom: '1px solid #f0ede8' }}>
                                <span style={{ color: '#ccc' }}>·</span>
                                <span style={{ fontWeight: esAct ? 500 : 400 }}>{s.nombre}</span>
                                <span style={{ fontSize: 10, color: '#aaa', marginLeft: 'auto' }}>sem {s.semana_inicio}–{s.semana_fin}</span>
                                {esAct && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: (b.color || '#1D9E75') + '20', color: b.color || '#1D9E75', fontWeight: 600 }}>aquí</span>}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={S.topbar}>
        <div style={S.avatar}>{S.iniciales}</div>
        <div>
          <div style={{ fontSize: isDesktop ? 14 : 13, fontWeight: 500 }}>{cliente?.nombre}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{plan?.nombre || 'Sin plan activo'}{semanaNum > 0 ? ` · Semana ${semanaNum}` : ''}</div>
        </div>
        <div style={S.tabs}>
          {[['hoy','🏠','Hoy'],['calendario','📅','Calendario'],['plan','📋','Mi plan']].map(([id, icon, label]) => (
            <div key={id} onClick={() => setTab(id)} style={S.tab(tab === id)}>
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div style={S.vistaToggle}>
          <button onClick={() => setVista('movil')} style={S.vistaBtn(vista === 'movil')} title="Vista móvil">📱</button>
          <button onClick={() => setVista('desktop')} style={S.vistaBtn(vista === 'desktop')} title="Vista escritorio">🖥</button>
        </div>
      </div>

      <div style={{ maxWidth: isDesktop ? 1100 : 480, margin: '0 auto', padding: isDesktop ? '0 24px' : '0' }}>
        {tab === 'hoy' && <TabHoy />}
        {tab === 'calendario' && <TabCalendario />}
        {tab === 'plan' && <TabPlan />}
      </div>
    </div>
  )
}
