import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

const T = {
  bg: '#f8f7f4',
  card: '#ffffff',
  text: '#1a1a1a',
  text2: '#6b6b6b',
  text3: '#9b9b9b',
  border: '#e8e5e0',
  accent: '#2d6a4f',
  accentLight: '#e8f5f0',
  warning: '#b45309',
  warningLight: '#fffbeb',
}

function iconoSesion(s) { return s?.icono || '💪' }

function ScaleButtons({ labels, selected, onSelect, color }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {labels.map((label, i) => {
        const n = i + 1
        const isSelected = selected === n
        return (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div onClick={() => onSelect(n)} style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `1.5px solid ${isSelected ? color : T.border}`, background: isSelected ? color : T.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: isSelected ? '#fff' : T.text2 }}>{n}</span>
            </div>
            <span style={{ fontSize: 9, color: T.text3, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function RadioOpts({ options, selected, onSelect, color, bgColor, borderColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(op => {
        const sel = selected === op
        return (
          <div key={op} onClick={() => onSelect(op)} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${sel ? borderColor : T.border}`, background: sel ? bgColor : T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${sel ? color : T.border}`, background: sel ? color : 'transparent', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: sel ? color : T.text }}>{op}</span>
          </div>
        )
      })}
    </div>
  )
}

function TipoChip({ tipo }) {
  const cfg = {
    programada: { label: 'Programada', bg: '#e8f5f0', color: '#2d6a4f' },
    flexible: { label: 'Flexible', bg: '#eff6ff', color: '#1d4ed8' },
    opcional: { label: 'Opcional', bg: '#f5f3ff', color: '#7c3aed' },
  }
  const c = cfg[tipo] || cfg.programada
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, fontWeight: 500 }}>{c.label}</span>
}

function EstadoIcon({ estado }) {
  if (estado === 'completada') return <span style={{ fontSize: 18 }}>✅</span>
  if (estado === 'no_realizada') return <span style={{ fontSize: 18 }}>❌</span>
  if (estado === 'parcial') return <span style={{ fontSize: 18 }}>🔄</span>
  return <span style={{ fontSize: 18 }}>⏳</span>
}

export default function VistaSemanalCliente() {
  const token = window.location.pathname.split('/semana/')[1]
  const [semana, setSemana] = useState(null)
  const [bloque, setBloque] = useState(null)
  const [subbloque, setSubbloque] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [sesiones, setSesiones] = useState([])
  const [packsConSesiones, setPacksConSesiones] = useState([])
  const [notasCliente, setNotasCliente] = useState([])
  const [competicionesCliente, setCompeticionesCliente] = useState([])
  const [controlesCliente, setControlesCliente] = useState([])
  const [loading, setLoading] = useState(true)
  const [seccionAbierta, setSeccionAbierta] = useState(null)
  const [checkinEnviado, setCheckinEnviado] = useState(false)
  const [yaRespondido, setYaRespondido] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Checkin state
  const [energia, setEnergia] = useState(null)
  const [descanso, setDescanso] = useState(null)
  const [horasSueno, setHorasSueno] = useState(null)
  const [molestias, setMolestias] = useState(null)
  const [zonas, setZonas] = useState([{ zona: '', intensidad: 0 }])
  const [agujetas, setAgujetas] = useState(null)
  const [agujetasDetalle, setAgujetasDetalle] = useState('')
  const [tolerancia, setTolerancia] = useState(null)
  const [comparativa, setComparativa] = useState(null)
  const [comentario, setComentario] = useState('')

  useEffect(() => { if (token) cargarDatos() }, [token])

  async function cargarDatos() {
    setLoading(true)

    // Round trip 1: contexto de la semana (sin ningún ID interno en el retorno)
    const { data: ctxArr } = await supabase.rpc('get_contexto_semana_por_token', { p_token: token })
    const ctx = ctxArr?.[0] ?? null
    if (!ctx) { setLoading(false); return }

    setSemana({ numero: ctx.numero, objetivo: ctx.objetivo, nota_cliente: ctx.nota_cliente })
    const b = { nombre: ctx.bloque_nombre, objetivo: ctx.bloque_objetivo, color: ctx.bloque_color, fecha_inicio: ctx.bloque_fecha_ini }
    setBloque(b)
    setSubbloque(ctx.subbloque_nombre ? {
      nombre: ctx.subbloque_nombre,
      objetivo: ctx.subbloque_objetivo,
      notas: ctx.subbloque_notas,
      duracion_media_min: ctx.subbloque_duracion,
    } : null)

    // Round trips 2-6 en paralelo: todo resuelto por el token de semana
    const [cliArr, sesArr, agendaArr, packsArr, packSesArr, yaRespondidoVal] = await Promise.all([
      supabase.rpc('get_nombre_por_token_semana',            { p_token: token }).then(r => r.data),
      supabase.rpc('get_sesiones_por_token_semana',          { p_token: token }).then(r => r.data),
      supabase.rpc('get_agenda_por_token_semana',            { p_token: token }).then(r => r.data),
      supabase.rpc('get_packs_por_token_semana',             { p_token: token }).then(r => r.data),
      supabase.rpc('get_sesiones_de_packs_por_token_semana', { p_token: token }).then(r => r.data),
      supabase.rpc('get_checkin_estado_por_token_semana',    { p_token: token }).then(r => r.data),
    ])

    setCliente(cliArr?.[0] ?? null)

    // Calcular _estado de cada sesión en el frontend
    const estadoMap = { completada: 'completed', parcial: 'partial', perdida: 'missed' }
    setSesiones((sesArr || []).map(s => {
      let _estado = null
      if (s.estado_manual)                              _estado = s.estado_manual
      else if (s.estado && s.estado !== 'pendiente')    _estado = estadoMap[s.estado] || s.estado
      else if (s.feedback_status)                       _estado = s.feedback_status
      else if (s.completada_el)                         _estado = 'completed'
      return { ...s, _estado }
    }))

    // Agenda semanal: separar por tipo
    const agenda = agendaArr || []
    setNotasCliente(agenda.filter(a => a.tipo === 'nota'))
    setCompeticionesCliente(agenda.filter(a => a.tipo === 'competicion'))
    setControlesCliente(agenda.filter(a => a.tipo === 'control'))

    // Packs con sus sesiones agrupadas
    const packs = packsArr || []
    if (packs.length > 0) {
      const sesionesPorPack = {}
      ;(packSesArr || []).forEach(s => {
        if (!sesionesPorPack[s.pack_id]) sesionesPorPack[s.pack_id] = []
        sesionesPorPack[s.pack_id].push(s)
      })
      setPacksConSesiones(packs.map(p => ({ ...p, sesiones: sesionesPorPack[p.id] || [] })))
    }

    if (yaRespondidoVal) setYaRespondido(true)
    setLoading(false)
  }

  async function enviarCheckin() {
    if (!semana) return
    setEnviando(true)
    const { error } = await supabase.rpc('insertar_checkin_por_token_semana', {
      p_token:            token,
      p_energia:          energia,
      p_descanso:         descanso,
      p_horas_sueno:      horasSueno,
      p_molestias:        molestias,
      p_molestias_zonas:  molestias && molestias !== 'No' ? zonas.filter(z => z.zona.trim()) : null,
      p_agujetas:         agujetas,
      p_agujetas_detalle: agujetasDetalle || null,
      p_tolerancia_carga: tolerancia,
      p_comparativa:      comparativa,
      p_comentario:       comentario || null,
    })
    setEnviando(false)
    if (error) {
      alert('No se pudo enviar el feedback de semana. Inténtalo de nuevo.')
      return
    }
    setCheckinEnviado(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: T.text2, fontSize: 14 }}>Cargando...</p>
    </div>
  )

  if (!semana) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <p style={{ color: T.text2, fontSize: 14, textAlign: 'center' }}>Este enlace no es válido o ha caducado.</p>
    </div>
  )

  const fechaInicio = bloque?.fecha_inicio ? format(addWeeks(parseISO(bloque.fecha_inicio), semana.numero - 1), 'dd MMM', { locale: es }) : ''
  const fechaFin = bloque?.fecha_inicio ? format(addWeeks(parseISO(bloque.fecha_inicio), semana.numero - 1 + 1), 'dd MMM yyyy', { locale: es }) : ''

  const sesionesConFecha = sesiones.filter(s => s.fecha)
  const sesionesOpcionales = sesiones.filter(s => !s.fecha)

  const fechaInicioStr = bloque?.fecha_inicio ? format(addWeeks(parseISO(bloque.fecha_inicio), semana.numero - 1), 'yyyy-MM-dd') : ''

  // Construir lista cronológica: días con sesiones + packs interleaved
  const buildSemanaItems = () => {
    const porDia = {}
    sesionesConFecha.forEach(s => {
      if (!porDia[s.fecha]) porDia[s.fecha] = []
      porDia[s.fecha].push(s)
    })
    const items = []
    Object.keys(porDia).sort().forEach(dia => items.push({ type: 'dia', dia, sesDia: porDia[dia] }))
    packsConSesiones.forEach(pack => {
      const efectiveDate = pack.fecha_inicio < fechaInicioStr ? fechaInicioStr : pack.fecha_inicio
      items.push({ type: 'pack', pack, efectiveDate })
    })
    items.sort((a, b) => {
      const da = a.type === 'dia' ? a.dia : a.efectiveDate
      const db = b.type === 'dia' ? b.dia : b.efectiveDate
      return da.localeCompare(db)
    })
    return items
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 48px' }}>

        {/* Cabecera */}
        <div style={{ background: '#1a1a2e', padding: '24px 20px 28px', borderRadius: '0 0 20px 20px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{cliente?.nombre}</p>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#fff', margin: '0 0 4px' }}>Semana {semana.numero}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>{fechaInicio} – {fechaFin}</p>

          {semana.objetivo && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Objetivo de la semana</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.5 }}>{semana.objetivo}</p>
            </div>
          )}

          {(bloque || subbloque) && (
            <div onClick={() => setSeccionAbierta(seccionAbierta === 'bloque' ? null : 'bloque')}
              style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {bloque?.nombre}
                </p>
                {subbloque?.nombre && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '0 0 2px', fontWeight: 500 }}>{subbloque.nombre}</p>
                )}
                {subbloque?.notas && seccionAbierta !== 'bloque' && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Ver objetivos específicos ↓</p>
                )}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>{seccionAbierta === 'bloque' ? '▲' : '▼'}</span>
            </div>
          )}
          {seccionAbierta === 'bloque' && (
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '0 0 10px 10px', padding: '12px 14px', marginTop: 1 }}>
              {bloque?.objetivo && (
                <div style={{ marginBottom: (subbloque?.notas || subbloque?.duracion_media_min) ? 10 : 0 }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Objetivo del bloque</p>
                  {bloque.objetivo.split('\n').filter(l => l.trim()).map((l, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 3px', lineHeight: 1.4 }}>· {l}</p>
                  ))}
                </div>
              )}
              {subbloque?.duracion_media_min && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 10px' }}>⏱ Duración media de sesión: {subbloque.duracion_media_min} min</p>
              )}
              {subbloque?.notas && (
                <div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Objetivos específicos</p>
                  {subbloque.notas.split('\n').filter(l => l.trim()).map((l, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 3px', lineHeight: 1.4 }}>· {l}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {semana.nota_cliente && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', marginTop: 10, borderLeft: '3px solid rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nota de tu entrenadora</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.5 }}>{semana.nota_cliente}</p>
            </div>
          )}
        </div>

        {/* Competiciones visibles al cliente */}
        {competicionesCliente.map(c => (
          <div key={c.id} style={{ margin: '0 12px 10px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#be123c', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🏆 Competición</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#9f1239', margin: '0 0 2px' }}>{c.nombre}</p>
            {c.fecha && <p style={{ fontSize: 12, color: '#be123c', margin: 0 }}>{format(new Date(c.fecha + 'T12:00:00'), 'EEEE dd MMM yyyy', { locale: es })}</p>}
            {c.objetivo && <p style={{ fontSize: 13, color: '#9f1239', margin: '6px 0 0', lineHeight: 1.45 }}>{c.objetivo}</p>}
          </div>
        ))}

        {/* Controles/valoraciones visibles al cliente */}
        {controlesCliente.map(c => (
          <div key={c.id} style={{ margin: '0 12px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#15803d', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📋 {c.tipo || 'Valoración'}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#14532d', margin: '0 0 2px' }}>{c.nombre}</p>
            {c.fecha && <p style={{ fontSize: 12, color: '#15803d', margin: 0 }}>{format(new Date(c.fecha + 'T12:00:00'), 'EEEE dd MMM yyyy', { locale: es })}</p>}
          </div>
        ))}

        {/* Notas visibles al cliente */}
        {notasCliente.map(n => (
          <div key={n.id} style={{ margin: '0 12px 10px', background: '#fffbeb', borderRadius: 10, padding: '10px 14px', borderLeft: '3px solid #fbbf24' }}>
            <p style={{ fontSize: 10, color: '#92400e', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>📝 Nota de tu entrenadora</p>
            <p style={{ fontSize: 13, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{n.texto}</p>
          </div>
        ))}

        {/* Sesiones y packs integrados cronológicamente */}
        {(sesionesConFecha.length > 0 || packsConSesiones.length > 0) && buildSemanaItems().map((item, i) => {
          if (item.type === 'dia') {
            const { dia, sesDia } = item
            return (
              <div key={`dia-${dia}`} style={{ margin: '0 12px 12px' }}>
                <div style={{ background: bloque?.color || T.accent, borderRadius: '10px 10px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#fff', textTransform: 'capitalize' }}>{format(new Date(dia + 'T12:00:00'), 'EEEE', { locale: es })}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{format(new Date(dia + 'T12:00:00'), 'dd MMM', { locale: es })}</span>
                </div>
                <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  {sesDia.map((s, si) => (
                    <SesionCard key={s.id} sesion={s} bloque={bloque} primeroDia={si === 0} ultimoDia={si === sesDia.length - 1} />
                  ))}
                </div>
              </div>
            )
          }
          // Pack flexible
          const { pack } = item
          const diasPack = (() => {
            const dias = []
            const start = new Date(pack.fecha_inicio + 'T12:00:00')
            const end = new Date(pack.fecha_fin + 'T12:00:00')
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              dias.push(new Date(d))
            }
            return dias
          })()
          return (
            <div key={`pack-${pack.id}`} style={{ margin: '0 12px 16px' }}>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #bae6fd' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📦 Pack flexible</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#0c4a6e', margin: '0 0 4px' }}>{pack.nombre}</p>
                  {pack.descripcion && <p style={{ fontSize: 13, color: '#075985', margin: '0 0 8px', lineHeight: 1.45 }}>{pack.descripcion}</p>}
                  <p style={{ fontSize: 11, color: '#0369a1', margin: '0 0 8px' }}>Haz las sesiones cuando puedas · {format(new Date(pack.fecha_inicio + 'T12:00:00'), 'dd MMM', { locale: es })} – {format(new Date(pack.fecha_fin + 'T12:00:00'), 'dd MMM', { locale: es })}</p>
                  {/* Pills de días */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {diasPack.map((d, di) => {
                      const dStr = format(d, 'yyyy-MM-dd')
                      const esHoy = dStr === format(new Date(), 'yyyy-MM-dd')
                      return (
                        <span key={di} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: esHoy ? '#0369a1' : '#e0f2fe', color: esHoy ? '#fff' : '#0369a1', fontWeight: esHoy ? 600 : 400 }}>
                          {format(d, 'EEE d', { locale: es })}
                        </span>
                      )
                    })}
                  </div>
                </div>
                {pack.sesiones.length > 0 && (
                  <div>
                    {pack.sesiones.map(s => (
                      <SesionCard key={s.id} sesion={s} bloque={bloque} flexible />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Sesiones sin fecha (flexibles/opcionales) */}
        {sesionesOpcionales.length > 0 && (
          <div style={{ margin: '0 12px 12px' }}>
            <div style={{ background: '#6b7280', borderRadius: '10px 10px 0 0', padding: '8px 14px' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>🔄 Cuando mejor te encaje</span>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {sesionesOpcionales.map((s, si) => (
                <SesionCard key={s.id} sesion={s} bloque={bloque} primeroDia={si === 0} ultimoDia={si === sesionesOpcionales.length - 1} />
              ))}
            </div>
          </div>
        )}

        {sesiones.length === 0 && packsConSesiones.length === 0 && (
          <div style={{ margin: '0 12px 12px', background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>No hay sesiones asignadas esta semana.</p>
          </div>
        )}

        {/* Check-in semanal */}
        <div style={{ margin: '16px 12px 0' }}>
          <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
           <div onClick={() => setSeccionAbierta(seccionAbierta === 'checkin' ? null : 'checkin')}
              style={{ padding: '16px 16px 14px', background: '#f0fdf4', borderBottom: seccionAbierta === 'checkin' ? `1px solid #bbf7d0` : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#065f46', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>✅ Sensaciones de la semana</p>
                <p style={{ fontSize: 12, color: '#047857', margin: 0 }}>Pulsa para valorar cómo ha ido la semana</p>
              </div>
              <span style={{ color: '#065f46', fontSize: 16 }}>{seccionAbierta === 'checkin' ? '▲' : '▼'}</span>
            </div>

            {seccionAbierta === 'checkin' && (checkinEnviado ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <p style={{ fontSize: 15, fontWeight: 500, color: T.text, margin: '0 0 6px' }}>¡Gracias!</p>
                <p style={{ fontSize: 13, color: T.text2, margin: 0 }}>Tu feedback de semana se ha enviado correctamente.</p>
              </div>
            ) : yaRespondido ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.text2, margin: 0 }}>Ya enviaste el feedback de semana. ¡Gracias!</p>
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ fontSize: 13, color: T.text2, margin: 0, lineHeight: 1.5 }}>Tus sensaciones son importantes para ajustar el entrenamiento de forma individualizada.</p>

                {/* Bloque 1 */}
                <div style={{ padding: 14, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚡ Energía y descanso</p>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo ha sido tu nivel de energía?</p>
                    <ScaleButtons labels={['Muy bajo','Bajo','Normal','Bueno','Muy bueno']} selected={energia} onSelect={setEnergia} color="#1d4ed8" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo ha sido la calidad de tu descanso?</p>
                    <ScaleButtons labels={['Muy mala','Mala','Regular','Buena','Muy buena']} selected={descanso} onSelect={setDescanso} color="#1d4ed8" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cuántas horas has dormido de media?</p>
                    <RadioOpts options={['Menos de 5h','5–6h','6–7h','7–8h','Más de 8h']} selected={horasSueno} onSelect={setHorasSueno} color="#1d4ed8" bgColor="#eff6ff" borderColor="#bfdbfe" />
                  </div>
                </div>

                {/* Bloque 2 */}
                <div style={{ padding: 14, background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#b45309', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🛡️ Molestias y recuperación</p>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Has tenido molestias o dolor esta semana?</p>
                    <RadioOpts options={['No','Sí, leve','Sí, moderado','Sí, alto']} selected={molestias} onSelect={setMolestias} color="#b45309" bgColor="#fffbeb" borderColor="#fde68a" />
                  </div>
                  {molestias && molestias !== 'No' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#b45309', margin: 0 }}>Zona y nivel de molestia</p>
                      {zonas.map((z, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="text" placeholder="Ej: rodilla derecha" value={z.zona}
                            onChange={e => setZonas(zs => zs.map((x, j) => j === i ? { ...x, zona: e.target.value } : x))}
                            style={{ flex: 1, fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #fde68a', background: '#fff', minWidth: 0, fontFamily: 'inherit' }} />
                          <input type="range" min="0" max="10" value={z.intensidad}
                            onChange={e => setZonas(zs => zs.map((x, j) => j === i ? { ...x, intensidad: parseInt(e.target.value) } : x))}
                            style={{ width: 60 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#b45309', minWidth: 16 }}>{z.intensidad}</span>
                        </div>
                      ))}
                      <button onClick={() => setZonas(zs => [...zs, { zona: '', intensidad: 0 }])}
                        style={{ fontSize: 12, color: '#b45309', background: 'none', border: '1px dashed #fde68a', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Añadir zona
                      </button>
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo han sido las agujetas o fatiga muscular?</p>
                    <RadioOpts options={['No he tenido','Leves y normales','Moderadas, tolerables','Altas, me han limitado','Muy altas, varios días']} selected={agujetas} onSelect={setAgujetas} color="#b45309" bgColor="#fffbeb" borderColor="#fde68a" />
                    <textarea placeholder="Después de qué sesión y en qué zona (opcional)..." value={agujetasDetalle} onChange={e => setAgujetasDetalle(e.target.value)}
                      style={{ width: '100%', marginTop: 8, fontSize: 13, padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, boxSizing: 'border-box', minHeight: 64, resize: 'none', fontFamily: 'inherit', color: T.text }} />
                  </div>
                </div>

                {/* Bloque 3 */}
                <div style={{ padding: 14, background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#065f46', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>💪 Carga y sensaciones</p>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo has tolerado la carga de entrenamiento?</p>
                    <RadioOpts options={['Muy fácil','Fácil','Adecuada','Exigente, pero asumible','Demasiado exigente']} selected={tolerancia} onSelect={setTolerancia} color={T.accent} bgColor={T.accentLight} borderColor="#6ee7b7" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>Respecto a semanas anteriores, ¿cómo notas tu cuerpo?</p>
                    <RadioOpts options={['Mejor','Igual','Algo peor','Claramente peor','No lo sé']} selected={comparativa} onSelect={setComparativa} color={T.accent} bgColor={T.accentLight} borderColor="#6ee7b7" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Hay algo que quieras comentar?</p>
                    <textarea placeholder="Escribe aquí lo que quieras..." value={comentario} onChange={e => setComentario(e.target.value)}
                      style={{ width: '100%', fontSize: 13, padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, boxSizing: 'border-box', minHeight: 80, resize: 'none', fontFamily: 'inherit', color: T.text }} />
                  </div>
                </div>

                <button onClick={enviarCheckin} disabled={enviando}
                  style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: T.accent, color: '#fff', fontSize: 15, fontWeight: 500, cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1, fontFamily: 'inherit' }}>
                  {enviando ? 'Enviando...' : 'Enviar feedback de semana'}
                </button>
                <p style={{ fontSize: 12, color: T.text3, textAlign: 'center', margin: '-10px 0 0' }}>Tu entrenadora lo recibirá antes de planificar la siguiente semana.</p>
              </div>
         ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const ESTADO_COLOR = {
  completed: { color: '#1baf7a', label: '✓ Completada' },
  partial: { color: '#ca8a04', label: '◐ Parcial' },
  missed: { color: '#e34948', label: '✕ No realizada' },
}

function SesionCard({ sesion, bloque, sinFecha, primeroDia, ultimoDia }) {
  const estado = ESTADO_COLOR[sesion._estado] || null
  const color = estado ? estado.color : (bloque?.color || '#2d6a4f')

  function abrirSesion() {
    if (sesion.token_publico) window.location.href = `/sesion/${sesion.token_publico}`
  }

  const borderBottom = ultimoDia ? 'none' : '1px solid #e8e5e0'

  return (
    <div style={{ borderBottom, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${color}` }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
        {iconoSesion(sesion)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sesion.titulo}</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sesion.duracion_min && <span style={{ fontSize: 11, color: '#9b9b9b' }}>{sesion.duracion_min} min</span>}
          <TipoChip tipo={sesion.tipo_sesion || 'programada'} />
          {estado && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: estado.color + '20', color: estado.color, fontWeight: 500 }}>{estado.label}</span>}
        </div>
      </div>
      {sesion.token_publico && (
        <button onClick={abrirSesion}
          style={{ background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
          Ver
        </button>
      )}
    </div>
  )
}
