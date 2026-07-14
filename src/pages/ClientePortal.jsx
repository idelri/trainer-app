import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addDays, isToday, addMonths, subMonths, parseISO, differenceInWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

/* ---------- tokens de diseño ---------- */
const T = {
  bg: '#f5f4f0', bg2: '#eceae4', surface: '#ffffff',
  border: '#e0ddd8', border2: '#d0cdc8',
  ink: '#1a1916', ink2: '#5a5850', ink3: '#9a9890',
  green: '#2d6a4f', greenL: '#e3efe8', greenInk: '#1b4332',
  font: "'Sora', -apple-system, sans-serif", mono: "'DM Mono', 'Courier New', monospace",
}

const ICONOS_FALLBACK = { fuerza: '💪', correr: '🏃', caminar: '🚶', bicicleta: '🚴', nadar: '🏊', movilidad: '🤸', futbol: '⚽', padel: '🎾' }
function iconoSesion(s) {
  if (s?.icono) return s.icono
  const tipos = s?.tipos_actividad?.length > 0 ? s.tipos_actividad : [s?.tipo_actividad || 'fuerza']
  return tipos.map(t => ICONOS_FALLBACK[t] || '💪').join(' ')
}

function badgeEstado(e) {
  if (e === 'completed') return { label: '✓ Completada', bg: '#E1F5EE', color: '#0F6E56' }
  if (e === 'partial')   return { label: '◐ Parcial',    bg: '#FAEEDA', color: '#633806' }
  if (e === 'missed')    return { label: '✕ No realizada', bg: '#FCEBEB', color: '#A32D2D' }
  return { label: 'Pendiente', bg: T.bg2, color: T.ink3 }
}

function dotColor(e) {
  if (e === 'completed') return '#1D9E75'
  if (e === 'partial')   return '#EF9F27'
  if (e === 'missed')    return '#E24B4A'
  return '#C8C5BC'
}

const TIPO_CONFIG = {
  nota:        { icono: '📝', label: 'Nota',        bg: '#F1EFE8', color: '#5F5E5A' },
  competicion: { icono: '🏆', label: 'Competición', bg: '#FAEEDA', color: '#633806' },
  control:     { icono: '📊', label: 'Valoración',  bg: '#E6F1FB', color: '#0C447C' },
}
function ItemExtra({ item }) {
  const cfg = TIPO_CONFIG[item._tipo] || TIPO_CONFIG.nota
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{cfg.icono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>{item.nombre || item.texto}</div>
        {item.objetivo && <div style={{ fontSize: 11, color: cfg.color, opacity: 0.75, marginTop: 1 }}>{item.objetivo}</div>}
      </div>
      {item.fecha && <span style={{ fontSize: 10, color: cfg.color, opacity: 0.6, flexShrink: 0 }}>{format(parseISO(item.fecha), 'd MMM', { locale: es })}</span>}
    </div>
  )
}

/* ---- Línea de tiempo con zoom ---- */
function Timeline({ bloques, inicio, totalSemanas }) {
  const [zoom, setZoom] = useState(28)
  const scRef = useRef(null)
  const hoy = new Date()
  const diasTranscurridos = Math.max(0, (hoy - inicio) / 86400000)
  const posHoy = Math.min((diasTranscurridos / 7) * zoom, totalSemanas * zoom)
  const enCurso = hoy >= inicio

  useEffect(() => {
    const c = scRef.current
    if (c && enCurso) c.scrollLeft = Math.max(0, posHoy - c.clientWidth / 2)
  }, [posHoy, zoom])

  let acc = 0
  return (
    <div>
      <div ref={scRef} style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ width: totalSemanas * zoom, position: 'relative', paddingTop: 20 }}>
          {enCurso && (
            <>
              <div style={{ position: 'absolute', left: posHoy, top: 0, fontFamily: T.mono, fontSize: 8, background: T.ink, color: '#fff', padding: '1px 5px', borderRadius: 3, transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 5 }}>HOY</div>
              <div style={{ position: 'absolute', left: posHoy, top: 16, width: 2, height: 50, background: T.ink, zIndex: 4 }} />
            </>
          )}
          <div style={{ display: 'flex', gap: 2 }}>
            {bloques.map((b, i) => {
              const w = (b.semanas || 0) * zoom - 2
              const esCurso = (() => {
                if (!b.fecha_inicio) return false
                const bi = parseISO(b.fecha_inicio + 'T12:00:00')
                const bf = addDays(bi, (b.semanas || 0) * 7)
                return hoy >= bi && hoy < bf
              })()
              acc += b.semanas || 0
              return (
                <div key={b.id} style={{ width: w, height: 44, borderRadius: 6, background: b.color || T.green, border: esCurso ? `2px solid ${T.ink}` : '2px solid transparent', padding: '5px 7px', overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.nombre}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 8, color: 'rgba(255,255,255,0.75)' }}>{b.semanas} sem</div>
                </div>
              )
            })}
          </div>
          {/* eje de fechas */}
          <div style={{ display: 'flex', marginTop: 5 }}>
            {bloques.map(b => {
              if (!b.fecha_inicio) return null
              const w = (b.semanas || 0) * zoom
              return (
                <div key={b.id} style={{ width: w, flexShrink: 0, fontFamily: T.mono, fontSize: 8, color: T.ink3, paddingLeft: 2 }}>
                  {format(parseISO(b.fecha_inicio + 'T12:00:00'), 'MMM yy', { locale: es })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
        <button onClick={() => setZoom(z => Math.max(14, z - 7))} style={{ width: 24, height: 22, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 5, cursor: 'pointer', fontSize: 14, color: T.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <button onClick={() => setZoom(z => Math.min(60, z + 7))} style={{ width: 24, height: 22, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 5, cursor: 'pointer', fontSize: 14, color: T.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginLeft: 4 }}>zoom</span>
      </div>
    </div>
  )
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
  const [tab, setTab] = useState('semana')
  const [calMes, setCalMes] = useState(new Date())
  const [bloquesAbiertos, setBloquesAbiertos] = useState(new Set())

  useEffect(() => { cargar() }, [token])

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
        const activo = bls.find(b => esBloqueActivo(b))
        if (activo) setBloquesAbiertos(new Set([activo.id]))
      }
    }

    const { data: ses } = await supabase.from('sesiones').select('*, sesion_feedback(submitted_at)').eq('cliente_id', cli.id).not('fecha', 'is', null).order('fecha')
    setSesiones((ses || []).map(s => ({ ...s, estado_efectivo: s.estado_manual || (s.sesion_feedback?.submitted_at ? 'completed' : null) })))
    const { data: nts } = await supabase.from('sesion_notas').select('*').eq('cliente_id', cli.id).eq('visibilidad', 'cliente').not('fecha', 'is', null).order('fecha')
    setNotas(nts || [])
    const { data: comps } = await supabase.from('competiciones').select('*').eq('cliente_id', cli.id).order('fecha')
    setCompeticiones(comps || [])
    const { data: ctrls } = await supabase.from('controles').select('*').eq('cliente_id', cli.id).order('fecha')
    setControles(ctrls || [])
    setLoading(false)
  }

  function esBloqueActivo(b) {
    if (!b.fecha_inicio) return false
    const ini = parseISO(b.fecha_inicio + 'T12:00:00')
    const fin = addDays(ini, (b.semanas || 0) * 7)
    const hoy = new Date()
    return hoy >= ini && hoy < fin
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
    }) || null
  }

  function getSemanaActual(bloque) {
    if (!bloque?.fecha_inicio) return null
    const hoy = new Date()
    return semanas.filter(s => s.bloque_id === bloque.id).find(s => {
      const ini = addDays(parseISO(bloque.fecha_inicio + 'T12:00:00'), (s.numero - 1) * 7)
      return hoy >= ini && hoy < addDays(ini, 7)
    }) || null
  }

  function getSemanaNumGlobal() {
    let total = 0
    for (const b of bloques) {
      if (!b.fecha_inicio) continue
      const ini = parseISO(b.fecha_inicio + 'T12:00:00')
      const fin = addDays(ini, (b.semanas || 0) * 7)
      const hoy = new Date()
      if (hoy >= ini && hoy < fin) return total + Math.floor((hoy - ini) / (7 * 86400000)) + 1
      total += b.semanas || 0
    }
    return total
  }

  function getTotalSemanas() { return bloques.reduce((a, b) => a + (b.semanas || 0), 0) }

  function getProgresoPlan() {
    const num = getSemanaNumGlobal()
    const total = getTotalSemanas()
    if (!total) return 0
    return Math.min(100, Math.round((num / total) * 100))
  }

  function getSesionesSemanaActual() {
    const lun = startOfWeek(new Date(), { weekStartsOn: 1 })
    const dom = endOfWeek(new Date(), { weekStartsOn: 1 })
    return sesiones.filter(s => { if (!s.fecha) return false; const f = parseISO(s.fecha); return f >= lun && f <= dom })
  }

  function getSesionesCalMes() {
    const ini = startOfMonth(calMes), fin = endOfMonth(calMes)
    return sesiones.filter(s => { if (!s.fecha) return false; const f = parseISO(s.fecha); return f >= ini && f <= fin })
  }

  function getItemsSemanaActual() {
    const lun = startOfWeek(new Date(), { weekStartsOn: 1 })
    const dom = endOfWeek(new Date(), { weekStartsOn: 1 })
    const enSem = arr => (arr || []).filter(x => { const f = parseISO(x.fecha); return f >= lun && f <= dom })
    return [
      ...enSem(notas).map(x => ({ ...x, _tipo: 'nota' })),
      ...enSem(competiciones).map(x => ({ ...x, _tipo: 'competicion' })),
      ...enSem(controles).map(x => ({ ...x, _tipo: 'control' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  function getItemsCalMes() {
    const ini = startOfMonth(calMes), fin = endOfMonth(calMes)
    const enMes = arr => (arr || []).filter(x => { if (!x.fecha) return false; const f = parseISO(x.fecha); return f >= ini && f <= fin })
    return [
      ...enMes(notas).map(x => ({ ...x, _tipo: 'nota' })),
      ...enMes(competiciones).map(x => ({ ...x, _tipo: 'competicion' })),
      ...enMes(controles).map(x => ({ ...x, _tipo: 'control' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  function abrirSesion(s) { if (s.token_publico) window.location.href = `/sesion/${s.token_publico}` }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: T.font }}>
      <p style={{ color: T.ink3 }}>Cargando...</p>
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: T.font }}>
      <p style={{ color: T.ink3 }}>{error}</p>
    </div>
  )

  const bloqueActivo = getBloqueActivo()
  const subbloqueActivo = getSubbloqueActivo(bloqueActivo)
  const semanaActualData = getSemanaActual(bloqueActivo)
  const semanaNum = getSemanaNumGlobal()
  const totalSem = getTotalSemanas()
  const progreso = getProgresoPlan()
  const sesActuales = getSesionesSemanaActual()
  const colA = bloqueActivo?.color || T.green

  const card = { background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }
  const DIAS_SEM = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  /* ---- TAB: ESTA SEMANA ---- */
  function TabSemana() {
    const lun = startOfWeek(new Date(), { weekStartsOn: 1 })
    const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(lun, i))
    const extras = getItemsSemanaActual()
    const hechas = sesActuales.filter(s => s.estado_efectivo === 'completed' || s.estado_efectivo === 'partial').length

    return (
      <div style={{ padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Hero: semana actual */}
        <div style={{ ...card, borderLeft: `4px solid ${colA}` }}>
          <div style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: colA }}>● {bloqueActivo ? bloqueActivo.nombre : 'Esta semana'}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>{format(new Date(), 'dd MMM yyyy', { locale: es })}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 7 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Semana {semanaNum}</div>
              {subbloqueActivo && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3 }}>· {subbloqueActivo.nombre}</div>}
            </div>
            {semanaActualData?.objetivo && (
              <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 5, lineHeight: 1.45 }}>{semanaActualData.objetivo}</div>
            )}
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 5, background: T.bg2, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progreso}%`, background: colA, borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>S{semanaNum} de {totalSem} · {hechas}/{sesActuales.length} sesiones</span>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: colA, fontWeight: 600 }}>{progreso}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nota de la entrenadora */}
        {semanaActualData?.nota_cliente && (
          <div style={{ background: '#fffbe6', borderRadius: 10, padding: '10px 13px', border: '1px solid #f0e5a0' }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 600, color: '#8a7200', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 4 }}>📌 Nota de tu entrenadora</div>
            <div style={{ fontSize: 12.5, color: '#5a4e00', lineHeight: 1.5 }}>{semanaActualData.nota_cliente}</div>
          </div>
        )}

        {/* Sesiones por día */}
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 7 }}>Sesiones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {diasSemana.map((dia, idx) => {
              const sesDia = sesActuales.filter(s => isSameDay(parseISO(s.fecha), dia))
              const hoyDia = isToday(dia)
              const nombreDia = DIAS_SEM[idx]
              const fechaStr = format(dia, 'd MMM', { locale: es })

              if (sesDia.length === 0) {
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: '7px 12px', opacity: hoyDia ? 1 : 0.6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>😴</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: hoyDia ? 600 : 400, color: hoyDia ? T.ink : T.ink2 }}>{nombreDia}{hoyDia && <span style={{ marginLeft: 6, fontSize: 9, background: colA, color: '#fff', padding: '1px 6px', borderRadius: 8, fontFamily: T.mono }}>hoy</span>}</div>
                      <div style={{ fontSize: 10, color: T.ink3 }}>Descanso</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>{fechaStr}</div>
                  </div>
                )
              }

              return (
                <div key={idx} style={{ ...card, border: hoyDia ? `1.5px solid ${colA}` : `1px solid ${T.border}` }}>
                  <div style={{ background: hoyDia ? `${colA}18` : T.bg, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${hoyDia ? colA + '30' : T.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: hoyDia ? colA : T.ink }}>{nombreDia}</span>
                      {hoyDia && <span style={{ fontSize: 8.5, background: colA, color: '#fff', padding: '1px 6px', borderRadius: 8, fontFamily: T.mono }}>hoy</span>}
                    </div>
                    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>{fechaStr}</span>
                  </div>
                  {sesDia.map((s, si) => {
                    const bd = badgeEstado(s.estado_efectivo)
                    return (
                      <div key={s.id} onClick={() => abrirSesion(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: si < sesDia.length - 1 ? `1px solid ${T.bg2}` : 'none', cursor: s.token_publico ? 'pointer' : 'default' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${colA}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {iconoSesion(s)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: T.ink }}>{s.titulo}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginTop: 1 }}>
                            {s.duracion_min ? `${s.duracion_min} min` : ''}{s.duracion_min && s.tipo_sesion ? ' · ' : ''}{s.tipo_sesion === 'opcional' ? 'Opcional' : s.tipo_sesion === 'flexible' ? 'Flexible' : s.tipo_sesion === 'programada' ? 'Programada' : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: bd.bg, color: bd.color, flexShrink: 0 }}>{bd.label}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Notas y eventos de la semana */}
        {extras.length > 0 && (
          <div style={card}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 8 }}>Notas y eventos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {extras.map(x => <ItemExtra key={x.id} item={x} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ---- TAB: CALENDARIO ---- */
  function TabCalendario() {
    const diasMes = eachDayOfInterval({ start: startOfMonth(calMes), end: endOfMonth(calMes) })
    const offset = (() => { const d = diasMes[0].getDay(); return d === 0 ? 6 : d - 1 })()
    const sesMes = getSesionesCalMes()
    const [diaSelec, setDiaSelec] = useState(new Date())
    const sesDia = sesMes.filter(s => isSameDay(parseISO(s.fecha), diaSelec))
    const extras = getItemsCalMes()

    return (
      <div style={{ padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={card}>
          <div style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{format(calMes, 'MMMM yyyy', { locale: es })}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setCalMes(m => subMonths(m, 1))} style={{ width: 28, height: 26, borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T.ink2 }}>‹</button>
                <button onClick={() => setCalMes(new Date())} style={{ padding: '0 8px', height: 26, borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 10.5, color: T.ink2 }}>Hoy</button>
                <button onClick={() => setCalMes(m => addMonths(m, 1))} style={{ width: 28, height: 26, borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T.ink2 }}>›</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {['L','M','X','J','V','S','D'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 9, color: T.ink3, padding: '3px 0' }}>{d}</div>
              ))}
              {Array(offset).fill(null).map((_, i) => <div key={'p'+i} />)}
              {diasMes.map(dia => {
                const sesDia = sesMes.filter(s => isSameDay(parseISO(s.fecha), dia))
                const hoyDia = isToday(dia)
                const selec = isSameDay(dia, diaSelec)
                return (
                  <div key={dia.toISOString()} onClick={() => setDiaSelec(dia)}
                    style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: hoyDia ? colA : selec ? T.bg2 : 'transparent', cursor: 'pointer', position: 'relative', padding: 2 }}>
                    <span style={{ fontSize: 11, color: hoyDia ? '#fff' : T.ink, fontWeight: hoyDia ? 600 : 400 }}>{format(dia, 'd')}</span>
                    {sesDia.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 3 }}>
                        {sesDia.slice(0, 3).map((s, i) => (
                          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: hoyDia ? 'rgba(255,255,255,0.8)' : dotColor(s.estado_efectivo) }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Detalle del día seleccionado */}
        <div style={card}>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 8 }}>
              {format(diaSelec, "EEEE d 'de' MMMM", { locale: es })}
            </div>
            {sesDia.length === 0 ? (
              <div style={{ fontSize: 12, color: T.ink3, padding: '8px 0' }}>Sin sesiones este día</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {sesDia.map((s, si) => {
                  const bd = badgeEstado(s.estado_efectivo)
                  return (
                    <div key={s.id} onClick={() => abrirSesion(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: si < sesDia.length - 1 ? `1px solid ${T.bg2}` : 'none', cursor: s.token_publico ? 'pointer' : 'default' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${colA}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{iconoSesion(s)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{s.titulo}</div>
                        {s.duracion_min && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginTop: 1 }}>{s.duracion_min} min</div>}
                      </div>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: bd.bg, color: bd.color, flexShrink: 0 }}>{bd.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Notas y eventos del mes */}
        {extras.length > 0 && (
          <div style={card}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 8 }}>Notas y eventos · {format(calMes, 'MMMM', { locale: es })}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {extras.map(x => <ItemExtra key={x.id} item={x} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ---- TAB: MI PLAN ---- */
  function TabPlan() {
    const inicio = plan?.fecha_inicio ? parseISO(plan.fecha_inicio + 'T12:00:00') : null

    return (
      <div style={{ padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Resumen del plan */}
        {plan && (
          <div style={card}>
            <div style={{ padding: '13px 14px' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 5 }}>Tu planificación</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{plan.nombre}</div>
              {plan.notas && <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 5, lineHeight: 1.45 }}>{plan.notas}</div>}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.bg2}` }}>
                {plan.fecha_inicio && <div><div style={{ fontFamily: T.mono, fontSize: 8, color: T.ink3, marginBottom: 2 }}>INICIO</div><div style={{ fontSize: 12, fontWeight: 500 }}>{format(parseISO(plan.fecha_inicio + 'T12:00:00'), 'd MMM yyyy', { locale: es })}</div></div>}
                {plan.fecha_fin && <div><div style={{ fontFamily: T.mono, fontSize: 8, color: T.ink3, marginBottom: 2 }}>FIN</div><div style={{ fontSize: 12, fontWeight: 500 }}>{format(parseISO(plan.fecha_fin + 'T12:00:00'), 'd MMM yyyy', { locale: es })}</div></div>}
                <div><div style={{ fontFamily: T.mono, fontSize: 8, color: T.ink3, marginBottom: 2 }}>SEMANAS</div><div style={{ fontSize: 12, fontWeight: 500 }}>{totalSem}</div></div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>Progreso · S{semanaNum} de {totalSem}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: colA, fontWeight: 600 }}>{progreso}%</span>
                </div>
                <div style={{ height: 5, background: T.bg2, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progreso}%`, background: colA, borderRadius: 3 }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Línea de tiempo con zoom */}
        {bloques.length > 0 && inicio && (
          <div style={card}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 10 }}>Línea de tiempo · {totalSem} sem</div>
              <Timeline bloques={bloques} inicio={inicio} totalSemanas={totalSem} />
            </div>
          </div>
        )}

        {/* Bloques */}
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3, marginBottom: 7 }}>Bloques de entrenamiento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bloques.map(b => {
              const activo = esBloqueActivo(b)
              const abierto = bloquesAbiertos.has(b.id)
              const subsBl = subbloques.filter(s => s.bloque_id === b.id)
              const col = b.color || T.green

              const semCurr = (() => {
                if (!activo || !b.fecha_inicio) return null
                const ini = parseISO(b.fecha_inicio + 'T12:00:00')
                return Math.min(b.semanas || 0, Math.floor((new Date() - ini) / (7 * 86400000)) + 1)
              })()
              const pctBloque = semCurr ? Math.round((semCurr / (b.semanas || 1)) * 100) : 0

              return (
                <div key={b.id} style={{ ...card, border: activo ? `1px solid ${col}55` : `1px solid ${T.border}`, borderLeft: activo ? `3px solid ${col}` : `1px solid ${T.border}` }}>
                  <div onClick={() => setBloquesAbiertos(prev => { const s = new Set(prev); s.has(b.id) ? s.delete(b.id) : s.add(b.id); return s })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{b.nombre}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginTop: 1 }}>{b.semanas} sem{b.fecha_inicio ? ` · ${format(parseISO(b.fecha_inicio + 'T12:00:00'), 'd MMM', { locale: es })}` : ''}</div>
                    </div>
                    {activo && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: col + '22', color: col, fontWeight: 600, flexShrink: 0 }}>En curso</span>}
                    <span style={{ color: T.ink3, fontSize: 11 }}>{abierto ? '▲' : '▼'}</span>
                  </div>

                  {abierto && (
                    <div style={{ borderTop: `1px solid ${T.bg2}`, padding: '12px 13px', background: T.bg }}>
                      {b.objetivo && <p style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.55, marginBottom: subsBl.length ? 12 : 0 }}>{b.objetivo}</p>}
                      {activo && semCurr && (
                        <div style={{ marginBottom: subsBl.length ? 12 : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>Semana {semCurr} de {b.semanas}</span>
                            <span style={{ fontFamily: T.mono, fontSize: 9, color: col }}>{pctBloque}%</span>
                          </div>
                          <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pctBloque}%`, background: col, borderRadius: 2 }} />
                          </div>
                        </div>
                      )}
                      {subsBl.length > 0 && (
                        <>
                          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.ink3, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>Subbloques</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {subsBl.map(s => {
                              const esAct = getSubbloqueActivo(b)?.id === s.id
                              return (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0', borderBottom: `1px solid ${T.bg2}` }}>
                                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: esAct ? col : T.border, flexShrink: 0 }} />
                                  <span style={{ fontSize: 12, fontWeight: esAct ? 500 : 400, color: esAct ? col : T.ink2, flex: 1 }}>{s.nombre}</span>
                                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>S{s.semana_inicio}–{s.semana_fin}</span>
                                  {esAct && <span style={{ fontSize: 8.5, padding: '1px 6px', borderRadius: 8, background: col + '22', color: col, fontWeight: 600 }}>aquí</span>}
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
      </div>
    )
  }

  /* ---- RENDER PRINCIPAL ---- */
  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.font, color: T.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* HEADER sticky */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '13px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, paddingBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: T.ink3 }}>Planificación</div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.3px', marginTop: 2 }}>{cliente?.nombre}</div>
              <div style={{ fontSize: 11, color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan?.nombre || 'Sin plan activo'}</div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: colA }}>{semanaNum > 0 ? <>S{semanaNum}<span style={{ color: T.ink3, fontWeight: 400 }}>/{totalSem}</span></> : `${totalSem} sem`}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginTop: 1 }}>{progreso}% completado</div>
            </div>
          </div>
          {/* TABS */}
          <div style={{ display: 'flex', borderTop: `1px solid ${T.bg2}` }}>
            {[['semana', 'Esta semana'], ['calendario', 'Calendario'], ['plan', 'Mi plan']].map(([id, label]) => (
              <div key={id} onClick={() => setTab(id)}
                style={{ flex: 1, textAlign: 'center', padding: '8px 4px 7px', fontSize: 12, fontWeight: tab === id ? 600 : 400, color: tab === id ? colA : T.ink3, cursor: 'pointer', borderBottom: tab === id ? `2px solid ${colA}` : '2px solid transparent', transition: 'all .15s' }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {tab === 'semana' && <TabSemana />}
        {tab === 'calendario' && <TabCalendario />}
        {tab === 'plan' && <TabPlan />}
      </div>
    </div>
  )
}
