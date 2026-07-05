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

const ICONO_ACTIVIDAD = {
  fuerza: '💪', correr: '🏃', caminar: '🚶', bicicleta: '🚴',
  nadar: '🏊', movilidad: '🤸', futbol: '⚽', padel: '🎾',
}
function getTipos(s) {
  return s?.tipos_actividad?.length > 0 ? s.tipos_actividad : (s?.tipo_actividad ? [s.tipo_actividad] : ['fuerza'])
}
function iconoSesion(s) { return getTipos(s).map(t => ICONO_ACTIVIDAD[t] || '💪').join(' ') }

function IconosSesion({ sesion, color }) {
  const tipos = getTipos(sesion)
  const bg = color + '22'
  if (tipos.length === 1) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 19 }}>
        {ICONO_ACTIVIDAD[tipos[0]] || '💪'}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, position: 'relative', zIndex: 2 }}>
        {ICONO_ACTIVIDAD[tipos[0]] || '💪'}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, marginLeft: -10, position: 'relative', zIndex: 1 }}>
        {ICONO_ACTIVIDAD[tipos[1]] || '💪'}
      </div>
    </div>
  )
}

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
    const { data: sem } = await supabase
      .from('semanas')
      .select('*, bloques(*, planificaciones(cliente_id))')
      .eq('token_publico', token)
      .single()

    if (!sem) { setLoading(false); return }
    setSemana(sem)

    const b = sem.bloques
    setBloque(b)

    const { data: subs } = await supabase.from('subbloques').select('*').eq('bloque_id', b.id)
    const sub = (subs || []).find(s => sem.numero >= s.semana_inicio && sem.numero <= s.semana_fin)
    setSubbloque(sub || null)

    const clienteId = b?.planificaciones?.cliente_id
    if (clienteId) {
      const { data: cli } = await supabase.from('clientes').select('nombre').eq('id', clienteId).single()
      setCliente(cli)

      const fechaInicioSem = addWeeks(parseISO(b.fecha_inicio), sem.numero - 1)
      const fechaFinSem = addWeeks(parseISO(b.fecha_inicio), sem.numero)
      const fechaInicioStr = format(fechaInicioSem, 'yyyy-MM-dd')
      const fechaFinStr = format(fechaFinSem, 'yyyy-MM-dd')

      const { data: sesionesSemana } = await supabase
        .from('sesiones')
        .select('*')
        .eq('cliente_id', clienteId)
        .is('pack_id', null)
        .or(`fecha.gte.${fechaInicioStr},tipo_sesion.eq.flexible,tipo_sesion.eq.opcional`)
        .order('fecha', { ascending: true })
        .order('orden', { ascending: true })

      const filtradas = (sesionesSemana || []).filter(s => {
        if (!s.fecha) return false  // sin fecha y sin pack → no mostrar al cliente
        if (s.tipo_sesion === 'flexible' || s.tipo_sesion === 'opcional') return s.fecha >= fechaInicioStr && s.fecha < fechaFinStr
        return s.fecha >= fechaInicioStr && s.fecha < fechaFinStr
      })
      if (filtradas.length > 0) {
        const { data: feedbacks } = await supabase.from('sesion_feedback').select('sesion_id, data').in('sesion_id', filtradas.map(s => s.id))
        const estadoPorSesion = {}
        ;(feedbacks || []).forEach(f => { estadoPorSesion[f.sesion_id] = f.data?.completion?.status })
        filtradas.forEach(s => {
          if (s.estado_manual) s._estado = s.estado_manual
          else if (estadoPorSesion[s.id]) s._estado = estadoPorSesion[s.id]
          else if (s.completada_el) s._estado = 'completed'
          else s._estado = null
        })
      }
      setSesiones(filtradas)

      const { data: existing } = await supabase.from('checkin_semanal').select('id').eq('semana_id', sem.id).maybeSingle()
      if (existing) setYaRespondido(true)

      // Packs flexibles que solapan con esta semana
      const { data: packs } = await supabase
        .from('packs_flexibles')
        .select('*')
        .eq('cliente_id', clienteId)
        .lte('fecha_inicio', fechaFinStr)
        .gte('fecha_fin', fechaInicioStr)
      if (packs && packs.length > 0) {
        const { data: packSesiones } = await supabase
          .from('sesiones')
          .select('*')
          .in('pack_id', packs.map(p => p.id))
        const sesionesPorPack = {}
        ;(packSesiones || []).forEach(s => {
          if (!sesionesPorPack[s.pack_id]) sesionesPorPack[s.pack_id] = []
          sesionesPorPack[s.pack_id].push(s)
        })
        setPacksConSesiones(packs.map(p => ({ ...p, sesiones: sesionesPorPack[p.id] || [] })))
      }
    }
    setLoading(false)
  }

  async function enviarCheckin() {
    if (!semana) return
    setEnviando(true)
    const clienteId = bloque?.planificaciones?.cliente_id
    const { error } = await supabase.from('checkin_semanal').insert({
      cliente_id: clienteId,
      semana_id: semana.id,
      energia, descanso,
      horas_sueno: horasSueno,
      molestias,
      molestias_zonas: molestias && molestias !== 'No' ? zonas.filter(z => z.zona.trim()) : null,
      agujetas,
      agujetas_detalle: agujetasDetalle || null,
      tolerancia_carga: tolerancia,
      comparativa_semanas: comparativa,
      comentario_libre: comentario || null,
    })
    setEnviando(false)
    if (error) {
      alert('No se pudo enviar el check-in. Inténtalo de nuevo.')
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

  const sesionesProgramadas = sesiones.filter(s => s.tipo_sesion === 'programada' || !s.tipo_sesion)
  const sesionesFlexibles = sesiones.filter(s => s.tipo_sesion === 'flexible')
  const sesionesOpcionales = sesiones.filter(s => s.tipo_sesion === 'opcional')

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

        {/* Sesiones programadas */}
        {sesionesProgramadas.length > 0 && (
          <div style={{ margin: '0 12px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.text3, margin: '0 0 8px', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px' }}>Sesiones</p>
            {sesionesProgramadas.map(s => (
              <SesionCard key={s.id} sesion={s} bloque={bloque} />
            ))}
          </div>
        )}

        {/* Sesiones flexibles */}
        {sesionesFlexibles.length > 0 && (
          <div style={{ margin: '0 12px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.text3, margin: '0 0 8px', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px' }}>Sesiones flexibles</p>
            {sesionesFlexibles.map(s => (
              <SesionCard key={s.id} sesion={s} bloque={bloque} flexible />
            ))}
          </div>
        )}

        {/* Sesiones opcionales */}
        {sesionesOpcionales.length > 0 && (
          <div style={{ margin: '0 12px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.text3, margin: '0 0 8px', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px' }}>Opcional</p>
            {sesionesOpcionales.map(s => (
              <SesionCard key={s.id} sesion={s} bloque={bloque} />
            ))}
          </div>
        )}

        {sesiones.length === 0 && packsConSesiones.length === 0 && (
          <div style={{ margin: '0 12px 12px', background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>No hay sesiones asignadas esta semana.</p>
          </div>
        )}

        {/* Packs flexibles */}
        {packsConSesiones.map(pack => (
          <div key={pack.id} style={{ margin: '0 12px 16px' }}>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: pack.descripcion || pack.sesiones.length > 0 ? '1px solid #bae6fd' : 'none' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📦 Plan flexible</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#0c4a6e', margin: '0 0 3px' }}>{pack.nombre}</p>
                <p style={{ fontSize: 11, color: '#0369a1', margin: 0 }}>
                  {format(new Date(pack.fecha_inicio + 'T12:00:00'), 'dd MMM', { locale: es })} – {format(new Date(pack.fecha_fin + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
              {pack.descripcion && (
                <div style={{ padding: '10px 16px', borderBottom: pack.sesiones.length > 0 ? '1px solid #bae6fd' : 'none' }}>
                  <p style={{ fontSize: 13, color: '#075985', margin: 0, lineHeight: 1.55 }}>{pack.descripcion}</p>
                </div>
              )}
              {pack.sesiones.length > 0 && (
                <div style={{ padding: '10px 12px 12px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sesiones disponibles</p>
                  {pack.sesiones.map(s => (
                    <SesionCard key={s.id} sesion={s} bloque={bloque} flexible />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

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
                <p style={{ fontSize: 13, color: T.text2, margin: 0 }}>Tu check-in se ha enviado correctamente.</p>
              </div>
            ) : yaRespondido ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.text2, margin: 0 }}>Ya enviaste el check-in de esta semana. ¡Gracias!</p>
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
                  {enviando ? 'Enviando...' : 'Enviar check-in semanal'}
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

function SesionCard({ sesion, bloque, flexible }) {
  const estado = ESTADO_COLOR[sesion._estado] || null
  const color = estado ? estado.color : (bloque?.color || '#2d6a4f')
  const fechaStr = sesion.fecha ? format(parseISO(sesion.fecha), 'EEEE dd MMM', { locale: es }) : null

  function abrirSesion() {
    if (sesion.token_publico) {
      window.location.href = `/sesion/${sesion.token_publico}`
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid #e8e5e0`, marginBottom: 8, overflow: 'hidden', borderLeft: `4px solid ${color}` }}>
      {fechaStr && (
        <div style={{ padding: '5px 12px', background: '#f8f7f4', borderBottom: '1px solid #e8e5e0' }}>
          <p style={{ fontSize: 10, color: '#9b9b9b', margin: 0, textTransform: 'capitalize', fontWeight: 500 }}>{fechaStr}</p>
        </div>
      )}
      {flexible && !fechaStr && (
        <div style={{ padding: '5px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
          <p style={{ fontSize: 10, color: '#1d4ed8', margin: 0, fontWeight: 500 }}>🔄 Cuando mejor te encaje esta semana</p>
        </div>
      )}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconosSesion sesion={sesion} color={color} />
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
      {sesion.objetivo && (
        <div style={{ padding: '0 14px 12px 66px' }}>
          <p style={{ fontSize: 12, color: '#6b6b6b', margin: 0, lineHeight: 1.5 }}>{sesion.objetivo}</p>
        </div>
      )}
    </div>
  )
}
