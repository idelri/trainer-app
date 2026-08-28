import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL  = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const ESTADOS = ['sin_planificar', 'en_preparacion', 'pendiente_revision', 'lista']
const ESTADO_LABEL = { sin_planificar: '⬜ Sin plan.', en_preparacion: '🔄 En prep.', pendiente_revision: '👁 Revisión', lista: '✅ Lista' }
const ESTADO_STYLE = {
  sin_planificar:    { bg: '#f1f0e8', color: '#5f5e5a' },
  en_preparacion:    { bg: '#faeeda', color: '#854f0b' },
  pendiente_revision:{ bg: '#e6f1fb', color: '#185fa5' },
  lista:             { bg: '#eaf3de', color: '#3b6d11' },
}
const fKey = d => format(d, 'yyyy-MM-dd')

const TIPO_CONFIG = {
  presencial: { color: '#dc2626', bg: '#fef2f2', border: '#dc2626', emoji: '🏋️', label: 'Presencial' },
  fcb:        { color: '#64748b', bg: '#f1f5f9', border: '#94a3b8', emoji: '🏟', label: 'FCB' },
  online:     { color: '#2563eb', bg: '#eff6ff', border: '#3b82f6', emoji: '💻', label: 'Online' },
  gestion:    { color: '#5a7a6e', bg: '#f0f4f2', border: '#789B8A', emoji: '🗂', label: 'Gestión' },
  viaje:      { color: '#d97706', bg: '#fffbeb', border: '#f59e0b', emoji: '✈️', label: 'Viaje' },
  personal:   { color: '#7c3aed', bg: '#f5f3ff', border: '#8b5cf6', emoji: '🩺', label: 'Personal' },
}

export default function Agenda({ setPage, setSesionesContext }) {
  const [vista, setVista]               = useState('semana')
  const [semana, setSemana]             = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [mesNav, setMesNav]             = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [diaNav, setDiaNav]             = useState(() => new Date())
  const [clientes, setClientes]         = useState([])
  const [sesiones, setSesiones]         = useState([])   // presencial+online esta semana
  const [agendaBloques, setAgendaBloques] = useState([])
  const [sesionesMes, setSesionesMes]   = useState([])
  const [bloquesMes, setBloquesMes]     = useState([])
  const [sesionesDia, setSesionesDia]   = useState([])
  const [bloquesDia2, setBloquesDia2]   = useState([])
  const [clienteData, setClienteData]   = useState({})   // { id: { sesiones, semanaRec } }
  const [loading, setLoading]           = useState(false)
  const [modalBloque, setModalBloque]   = useState(false)
  const [formBloque, setFormBloque]     = useState({ fecha: '', hora_inicio: '', hora_fin: '', titulo: '', tipo: 'personal', lugar: '', cliente_id: '' })
  const [modoBloque, setModoBloque]     = useState('dia')   // 'dia' | 'rango'
  const [rangoFin, setRangoFin]         = useState('')
  const [diasRango, setDiasRango]       = useState([0,1,2,3]) // índices 0=lun…6=dom
  const [savingBloque, setSavingBloque] = useState(false)
  const [editandoBloque, setEditandoBloque] = useState(null)
  const [popover, setPopover] = useState(null) // { x, y, clienteNombre, dia, diaStr, ses, cd, clienteId, detalle }
  const [loadingPop, setLoadingPop] = useState(false)
  const [horaActual, setHoraActual] = useState(new Date())
  const [filtroGlobal, setFiltroGlobal] = useState({ cliente: null, estado: null })
  const [dropdownOpen, setDropdownOpen] = useState(null) // 'clientes' | 'sesiones' | 'añadir' | null
  const [buscarCliente, setBuscarCliente] = useState('')

  // ── TAREAS ───────────────────────────────────────────────────────────────
  const [tareas, setTareas]             = useState([])
  const [modalTarea, setModalTarea]     = useState(false)
  const [editandoTarea, setEditandoTarea] = useState(null)
  const [savingTarea, setSavingTarea]   = useState(false)
  const [filtroTarea, setFiltroTarea]   = useState({ cliente: '', categoria: '' })
  const EMPTY_TAREA = { titulo: '', cliente_ids: [], categoria: 'planificacion', fecha_limite: '', prioridad: 'normal', completada: false }
  const [formTarea, setFormTarea]       = useState(EMPTY_TAREA)
  const CATS = [
    { value: 'planificacion', label: 'Planificación' },
    { value: 'evaluacion',    label: 'Evaluación' },
    { value: 'seguimiento',   label: 'Seguimiento' },
    { value: 'administracion',label: 'Administración' },
    { value: 'personal',      label: 'Personal / Otro' },
  ]
  const PRIOS = [
    { value: 'alta',   label: '🔴 Alta' },
    { value: 'normal', label: '🟡 Normal' },
    { value: 'baja',   label: '⚪ Baja' },
  ]

  const dias = Array.from({ length: 7 }, (_, i) => addDays(semana, i))
  const semIni = fKey(semana)
  const semFin = fKey(dias[6])

  useEffect(() => { if (vista === 'semana') cargar() }, [semana, vista]) // eslint-disable-line
  useEffect(() => { if (vista === 'mes') cargarMes() }, [mesNav, vista]) // eslint-disable-line
  useEffect(() => { if (vista === 'dia') cargarDia() }, [diaNav, vista]) // eslint-disable-line
  useEffect(() => { cargarTareas() }, []) // eslint-disable-line
  useEffect(() => {
    const t = setInterval(() => setHoraActual(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: cls }, { data: ses }, { data: abs }] = await Promise.all([
      supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('sesiones').select('id, cliente_id, titulo, fecha, hora_inicio, modalidad, lugar, duracion_min, sesion_bloques(id)').in('modalidad', ['presencial', 'online']).gte('fecha', semIni).lte('fecha', semFin),
      supabase.from('agenda_bloques').select('*').gte('fecha', semIni).lte('fecha', semFin).order('hora_inicio'),
    ])
    const clientesList = cls || []
    setClientes(clientesList)
    setSesiones(ses || [])
    setAgendaBloques(abs || [])

    if (clientesList.length === 0) { setLoading(false); return }

    const clienteIds = clientesList.map(c => c.id)
    const [{ data: todasSes }, { data: csems }] = await Promise.all([
      supabase.from('sesiones').select('id, cliente_id, fecha, titulo, tipo_sesion, modalidad, pack_id, lista, publicada').in('cliente_id', clienteIds).gte('fecha', semIni).lte('fecha', semFin),
      supabase.from('cliente_semana').select('*').in('cliente_id', clienteIds).eq('semana_fecha', semIni),
    ])

    const csMap = {}
    ;(csems || []).forEach(r => { csMap[r.cliente_id] = r })

    const data = {}
    clientesList.forEach(c => {
      data[c.id] = {
        sesiones: (todasSes || []).filter(s => s.cliente_id === c.id),
        semanaRec: csMap[c.id] || null,
      }
    })
    setClienteData(data)
    setLoading(false)
  }

  async function cargarDia() {
    setLoading(true)
    const key = fKey(diaNav)
    const [{ data: ses }, { data: abs }] = await Promise.all([
      supabase.from('sesiones').select('id, cliente_id, titulo, fecha, modalidad, lugar, duracion_min').in('modalidad', ['presencial', 'online']).eq('fecha', key),
      supabase.from('agenda_bloques').select('*').eq('fecha', key).order('hora_inicio'),
    ])
    setSesionesDia(ses || [])
    setBloquesDia2(abs || [])
    setLoading(false)
  }

  async function cargarMes() {
    setLoading(true)
    const mesIni = fKey(startOfMonth(mesNav))
    const mesFin = fKey(endOfMonth(mesNav))
    const [{ data: ses }, { data: abs }] = await Promise.all([
      supabase.from('sesiones').select('id, cliente_id, titulo, fecha, modalidad, lugar, duracion_min').in('modalidad', ['presencial', 'online']).gte('fecha', mesIni).lte('fecha', mesFin),
      supabase.from('agenda_bloques').select('*').gte('fecha', mesIni).lte('fecha', mesFin).order('hora_inicio'),
    ])
    setSesionesMes(ses || [])
    setBloquesMes(abs || [])
    setLoading(false)
  }

  async function guardarBloque() {
    if (!formBloque.titulo || !formBloque.fecha || !formBloque.hora_inicio || !formBloque.hora_fin) return
    setSavingBloque(true)
    if (editandoBloque) {
      await supabase.from('agenda_bloques').update(formBloque).eq('id', editandoBloque)
    } else if (modoBloque === 'rango' && rangoFin && rangoFin >= formBloque.fecha) {
      // Insertar una franja por cada día del rango que esté en los días seleccionados
      const registros = []
      const cur = new Date(formBloque.fecha + 'T12:00:00')
      const fin = new Date(rangoFin + 'T12:00:00')
      while (cur <= fin) {
        const dow = cur.getDay() === 0 ? 6 : cur.getDay() - 1 // 0=lun...6=dom
        if (diasRango.includes(dow)) {
          registros.push({ ...formBloque, fecha: fKey(cur) })
        }
        cur.setDate(cur.getDate() + 1)
      }
      if (registros.length > 0) await supabase.from('agenda_bloques').insert(registros)
    } else {
      await supabase.from('agenda_bloques').insert(formBloque)
    }
    setSavingBloque(false); setModalBloque(false); setEditandoBloque(null)
    setFormBloque({ fecha: '', hora_inicio: '', hora_fin: '', titulo: '', tipo: 'personal', lugar: '', cliente_id: '' })
    setModoBloque('dia'); setRangoFin(''); setDiasRango([0,1,2,3])
    if (vista === 'mes') cargarMes(); else cargar()
  }

  async function eliminarBloque(id) {
    await supabase.from('agenda_bloques').delete().eq('id', id)
    if (vista === 'mes') cargarMes(); else cargar()
  }

  async function upsertClienteSemana(clienteId, patch) {
    const { data } = await supabase
      .from('cliente_semana')
      .upsert({ cliente_id: clienteId, semana_fecha: semIni, ...patch }, { onConflict: 'cliente_id,semana_fecha' })
      .select().single()
    return data
  }

  async function toggleEstado(cData, clienteId) {
    const sem = cData.semanaRec
    const idx = ESTADOS.indexOf(sem?.estado_agenda || 'sin_planificar')
    const next = ESTADOS[(idx + 1) % ESTADOS.length]
    const updated = await upsertClienteSemana(clienteId, {
      estado_agenda: next,
      dias_disponibles: sem?.dias_disponibles || [],
    })
    if (updated) setClienteData(prev => ({ ...prev, [clienteId]: { ...prev[clienteId], semanaRec: updated } }))
  }

  async function toggleDia(cData, clienteId, dia) {
    const sem = cData.semanaRec
    const dias_actuales = sem?.dias_disponibles || []
    const nuevos = dias_actuales.includes(dia)
      ? dias_actuales.filter(d => d !== dia)
      : [...dias_actuales, dia]
    const updated = await upsertClienteSemana(clienteId, {
      dias_disponibles: nuevos,
      estado_agenda: sem?.estado_agenda || 'sin_planificar',
    })
    if (updated) setClienteData(prev => ({ ...prev, [clienteId]: { ...prev[clienteId], semanaRec: updated } }))
  }

  async function abrirPopover(e, clienteNombre, clienteId, dia, diaStr, ses, cd) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(rect.left, window.innerWidth - 300)
    const y = rect.bottom + 8
    setPopover({ x, y, clienteNombre, clienteId, dia, diaStr, ses, cd, detalle: null })
    if (ses) {
      setLoadingPop(true)
      const { data: bloques } = await supabase.from('sesion_bloques').select('id, sesion_ejercicios(id)').eq('sesion_id', ses.id)
      const totalBloques = bloques?.length || 0
      const totalEjercicios = bloques?.reduce((acc, b) => acc + (b.sesion_ejercicios?.length || 0), 0) || 0
      setPopover(p => p ? { ...p, detalle: { totalBloques, totalEjercicios } } : null)
      setLoadingPop(false)
    }
  }

  function irASesion(clienteId, sesionId) {
    setSesionesContext && setSesionesContext({ clienteId, sesionId })
    setPage && setPage('sesiones')
    setPopover(null)
  }

  function crearSesion(clienteId, fecha) {
    setSesionesContext && setSesionesContext({ clienteId, fechaNueva: fecha })
    setPage && setPage('sesiones')
    setPopover(null)
  }

  // ── ALERTAS AUTOMÁTICAS ──────────────────────────────────────────────────
  function calcularAlertas() {
    const hoy     = fKey(new Date())
    const mañana  = fKey(addDays(new Date(), 1))
    const alertas = []

    clientes.forEach(c => {
      const cd = clienteData[c.id] || {}
      const { sesiones: cSes = [], semanaRec } = cd
      const diasDisp = semanaRec?.dias_disponibles || []
      const nombre = c.nombre.split(' ')[0]
      const dowHoy = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
      const diaStrHoy = DIAS_SEMANA[dowHoy]

      // 1. Día disponible hoy sin sesión creada
      const tieneSesionHoy = cSes.some(s => s.fecha === hoy && !s.pack_id)
      if (diasDisp.includes(diaStrHoy) && !tieneSesionHoy) {
        alertas.push({ urgencia: 0, icono: '❗', texto: 'Día disponible sin sesión creada', cliente: nombre, clienteId: c.id, etiqueta: 'Hoy', color: '#ef4444' })
      }

      // 2. Sesión hoy u mañana aún oculta al cliente
      cSes.filter(s => (s.fecha === hoy || s.fecha === mañana) && s.publicada === false && !s.pack_id).forEach(s => {
        const esHoy = s.fecha === hoy
        alertas.push({ urgencia: esHoy ? 0 : 1, icono: '🔒', texto: `Sesión ${esHoy ? 'de hoy' : 'de mañana'} oculta al cliente`, cliente: nombre, clienteId: c.id, sesionId: s.id, etiqueta: esHoy ? 'Hoy' : 'Mañana', color: '#94a3b8' })
      })

      // 3. Sesión hoy u mañana sin marcar como lista
      cSes.filter(s => (s.fecha === hoy || s.fecha === mañana) && s.publicada !== false && !s.lista && !s.pack_id).forEach(s => {
        const esHoy = s.fecha === hoy
        alertas.push({ urgencia: esHoy ? 0 : 1, icono: '📝', texto: `Sesión ${esHoy ? 'de hoy' : 'de mañana'} en preparación`, cliente: nombre, clienteId: c.id, sesionId: s.id, etiqueta: esHoy ? 'Hoy' : 'Mañana', color: '#ef9f27' })
      })
    })

    // 4. Tareas vencidas o que vencen hoy
    tareas.filter(t => t.fecha_limite && t.fecha_limite <= hoy).forEach(t => {
      const clienteNombre = t.cliente_id ? (clientes.find(c => c.id === t.cliente_id)?.nombre.split(' ')[0] || null) : null
      alertas.push({ urgencia: 0, icono: '⏰', texto: t.titulo, cliente: clienteNombre, etiqueta: t.fecha_limite < hoy ? 'Vencida' : 'Hoy', color: '#ef4444', tareaId: t.id })
    })

    // 5. Tareas que vencen mañana
    tareas.filter(t => t.fecha_limite === mañana).forEach(t => {
      const clienteNombre = t.cliente_id ? (clientes.find(c => c.id === t.cliente_id)?.nombre.split(' ')[0] || null) : null
      alertas.push({ urgencia: 1, icono: '⏰', texto: t.titulo, cliente: clienteNombre, etiqueta: 'Mañana', color: '#ef9f27', tareaId: t.id })
    })

    alertas.sort((a, b) => a.urgencia - b.urgencia)
    return alertas.slice(0, 8)
  }

  // ── TAREAS: carga y CRUD ─────────────────────────────────────────────────
  async function cargarTareas() {
    const { data } = await supabase.from('tareas').select('*').eq('completada', false).order('fecha_limite', { ascending: true, nullsFirst: false })
    setTareas(data || [])
  }

  async function guardarTarea() {
    if (!formTarea.titulo.trim()) return
    setSavingTarea(true)
    const ids = formTarea.cliente_ids || []
    const payload = {
      titulo: formTarea.titulo.trim(),
      cliente_id: ids[0] || null,           // compat legacy
      cliente_ids: ids,
      categoria: formTarea.categoria,
      fecha_limite: formTarea.fecha_limite || null,
      prioridad: formTarea.prioridad,
      completada: false,
    }
    if (editandoTarea) {
      await supabase.from('tareas').update(payload).eq('id', editandoTarea)
    } else {
      await supabase.from('tareas').insert(payload)
    }
    setSavingTarea(false)
    setModalTarea(false)
    setEditandoTarea(null)
    setFormTarea(EMPTY_TAREA)
    cargarTareas()
  }

  async function completarTarea(id) {
    await supabase.from('tareas').update({ completada: true, completed_at: new Date().toISOString() }).eq('id', id)
    setTareas(t => t.filter(x => x.id !== id))
  }

  async function eliminarTarea(id) {
    await supabase.from('tareas').delete().eq('id', id)
    setTareas(t => t.filter(x => x.id !== id))
  }

  function abrirNuevaTarea(clienteId = '') {
    setFormTarea({ ...EMPTY_TAREA, cliente_ids: clienteId ? [clienteId] : [] })
    setEditandoTarea(null)
    setModalTarea(true)
  }

  function abrirEditarTarea(t) {
    // compatibilidad: si hay cliente_ids usar ese, si no migrar de cliente_id
    const ids = (t.cliente_ids && t.cliente_ids.length > 0)
      ? t.cliente_ids
      : (t.cliente_id ? [t.cliente_id] : [])
    setFormTarea({
      titulo: t.titulo, cliente_ids: ids,
      categoria: t.categoria, fecha_limite: t.fecha_limite || '',
      prioridad: t.prioridad, completada: t.completada,
    })
    setEditandoTarea(t.id)
    setModalTarea(true)
  }

  // Agrupación de tareas por fecha límite
  function agruparTareas(lista) {
    const hoyStr = fKey(new Date())
    const finSemStr = fKey(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6))
    const grupos = { hoy: [], semana: [], adelante: [], sinFecha: [] }
    lista.forEach(t => {
      if (!t.fecha_limite) { grupos.sinFecha.push(t); return }
      if (t.fecha_limite <= hoyStr) { grupos.hoy.push(t); return }
      if (t.fecha_limite <= finSemStr) { grupos.semana.push(t); return }
      grupos.adelante.push(t)
    })
    return grupos
  }

  // ── VISTAS ───────────────────────────────────────────────────────────────

  const hoy = fKey(new Date())

  function renderCalendarioSemana() {
    const PX_H = 52
    const H_INI = 7
    const H_FIN = 21
    const HORAS = Array.from({ length: H_FIN - H_INI }, (_, i) => H_INI + i)

    function tTop(t) {
      if (!t) return null
      const [h, m] = t.split(':').map(Number)
      return ((h - H_INI) + m / 60) * PX_H
    }
    function tHeight(start, end, durMin) {
      if (start && end) {
        const [h1, m1] = start.split(':').map(Number)
        const [h2, m2] = end.split(':').map(Number)
        return Math.max(((h2 - h1) + (m2 - m1) / 60) * PX_H, PX_H * 0.5)
      }
      return Math.max(((durMin || 60) / 60) * PX_H, PX_H * 0.5)
    }

    const topLinea = ((horaActual.getHours() - H_INI) + horaActual.getMinutes() / 60) * PX_H
    const horaEnGrid = horaActual.getHours() >= H_INI && horaActual.getHours() < H_FIN

    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Grid horario scrollable — cabecera sticky dentro para alinear columnas */}
        <div style={{ overflowY: 'auto', maxHeight: 500 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', position: 'relative' }}>
            {/* Cabecera días sticky */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ background: 'var(--bg)' }} />
              {dias.map((d, i) => {
                const esHoy = fKey(d) === hoy
                return (
                  <div key={i} style={{ padding: '8px 4px', textAlign: 'center', borderLeft: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: esHoy ? 'var(--accent)' : 'var(--text3)' }}>{DIAS_LABEL[i]}</div>
                    <div style={{ fontSize: 14, fontWeight: esHoy ? 700 : 400, color: esHoy ? '#fff' : 'var(--text2)', background: esHoy ? 'var(--accent)' : 'transparent', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '3px auto 0' }}>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>
            {/* Horas */}
            <div>
              {HORAS.map(h => (
                <div key={h} style={{ height: PX_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 3, fontSize: 10, fontWeight: 500, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
                  {h}:00
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            {dias.map((dia, i) => {
              const key = fKey(dia)
              const esHoyCol = key === hoy
              const sesDia = sesiones.filter(s => s.fecha === key)
              const bloqDia = agendaBloques.filter(b => b.fecha === key)
              const sesSinHora = sesDia.filter(s => !s.hora_inicio)
              const sesConHora = sesDia.filter(s => s.hora_inicio)

              return (
                <div key={i} style={{ borderLeft: '1px solid var(--border)', position: 'relative', minHeight: (H_FIN - H_INI) * PX_H, background: esHoyCol ? 'rgba(100,150,120,0.04)' : 'transparent' }}>
                  {/* Líneas horizontales de hora */}
                  {HORAS.map(h => (
                    <div key={h} style={{ position: 'absolute', top: (h - H_INI) * PX_H, left: 0, right: 0, borderTop: '1px solid var(--border)' }} />
                  ))}

                  {/* Línea hora actual — span completo */}
                  {horaEnGrid && (
                    <>
                      {esHoyCol && <div style={{ position: 'absolute', top: topLinea - 4, left: -5, width: 10, height: 10, borderRadius: '50%', background: '#ef4444', zIndex: 10 }} />}
                      <div style={{ position: 'absolute', top: topLinea, left: esHoyCol ? 0 : -1, right: 0, height: 2, background: '#ef4444', opacity: esHoyCol ? 1 : 0.35, zIndex: 10 }} />
                    </>
                  )}

                  {/* Sesiones sin hora → tira superior */}
                  {sesSinHora.length > 0 && (
                    <div style={{ position: 'absolute', top: 2, left: 2, right: 2, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {sesSinHora.map(s => (
                        <div key={s.id} onClick={() => irASesion(s.cliente_id, s.id)}
                          style={{ borderRadius: 4, padding: '2px 5px', fontSize: 9, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            ...(s.modalidad === 'presencial' ? { background: '#dcfce7', color: '#166534', borderLeft: '3px solid #16a34a' } : { background: '#dbeafe', color: '#1e40af', borderLeft: '3px solid #3b82f6' }) }}>
                          {s.titulo}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Franjas ocupadas */}
                  {bloqDia.map(b => {
                    const top = tTop(b.hora_inicio)
                    if (top === null) return null
                    const height = tHeight(b.hora_inicio, b.hora_fin)
                    return (
                      <div key={b.id}
                        onClick={() => { setEditandoBloque(b.id); setModoBloque('dia'); setFormBloque({ fecha: b.fecha, hora_inicio: b.hora_inicio, hora_fin: b.hora_fin, titulo: b.titulo, tipo: b.tipo, lugar: b.lugar || '', cliente_id: b.cliente_id || '' }); setModalBloque(true) }}
                        style={{ position: 'absolute', top, left: 2, right: 2, height, borderRadius: 6, padding: '3px 6px', fontSize: 10, cursor: 'pointer', overflow: 'hidden', zIndex: 2,
                          background: (TIPO_CONFIG[b.tipo] || TIPO_CONFIG.personal).bg,
                          borderLeft: `3px solid ${(TIPO_CONFIG[b.tipo] || TIPO_CONFIG.personal).border}`,
                          color: (TIPO_CONFIG[b.tipo] || TIPO_CONFIG.personal).color }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titulo}</div>
                        <div style={{ fontSize: 9, opacity: 0.7 }}>{b.hora_inicio?.slice(0,5)}–{b.hora_fin?.slice(0,5)}{b.lugar ? ` · ${b.lugar}` : ''}</div>
                      </div>
                    )
                  })}

                  {/* Sesiones con hora */}
                  {sesConHora.map(s => {
                    const top = tTop(s.hora_inicio)
                    if (top === null) return null
                    const height = tHeight(s.hora_inicio, null, s.duracion_min || 60)
                    const esP = s.modalidad === 'presencial'
                    return (
                      <div key={s.id} onClick={() => irASesion(s.cliente_id, s.id)}
                        style={{ position: 'absolute', top, left: 2, right: 2, height, borderRadius: 6, padding: '3px 6px', fontSize: 10, cursor: 'pointer', overflow: 'hidden', zIndex: 3,
                          background: esP ? '#e6f3eb' : '#dbeafe',
                          borderLeft: `3px solid ${esP ? '#3D8C4F' : '#3b82f6'}`,
                          color: esP ? '#1a4a2a' : '#1e40af' }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.titulo}</div>
                        <div style={{ fontSize: 9, opacity: 0.75 }}>{s.hora_inicio?.slice(0,5)}{s.duracion_min ? ` · ${s.duracion_min}min` : ''}{s.lugar ? ` · ${s.lugar}` : ''}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderCalendarioDia() {
    const PX_H = 56
    const H_INI = 7
    const H_FIN = 22
    const HORAS = Array.from({ length: H_FIN - H_INI }, (_, i) => H_INI + i)
    const esDiaHoy = fKey(diaNav) === hoy

    function tTop(t) {
      if (!t) return null
      const [h, m] = t.split(':').map(Number)
      return ((h - H_INI) + m / 60) * PX_H
    }
    function tHeight(start, end, durMin) {
      if (start && end) {
        const [h1, m1] = start.split(':').map(Number)
        const [h2, m2] = end.split(':').map(Number)
        return Math.max(((h2 - h1) + (m2 - m1) / 60) * PX_H, PX_H * 0.5)
      }
      return Math.max(((durMin || 60) / 60) * PX_H, PX_H * 0.5)
    }

    const topLinea = ((horaActual.getHours() - H_INI) + horaActual.getMinutes() / 60) * PX_H
    const horaEnGrid = horaActual.getHours() >= H_INI && horaActual.getHours() < H_FIN

    const sesSinHora = sesionesDia.filter(s => !s.hora_inicio)
    const sesConHora = sesionesDia.filter(s => s.hora_inicio)

    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Cabecera */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: esDiaHoy ? 'var(--accent)' : 'var(--text)' }}>
            {format(diaNav, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
          </span>
          {esDiaHoy && <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', borderRadius: 20, padding: '1px 8px' }}>Hoy</span>}
          {sesSinHora.length > 0 && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{sesSinHora.length} sin hora fija</span>}
        </div>

        {/* Sesiones sin hora */}
        {sesSinHora.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', background: 'var(--bg2)' }}>
            {sesSinHora.map(s => (
              <div key={s.id} onClick={() => irASesion(s.cliente_id, s.id)}
                style={{ borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                  ...(s.modalidad === 'presencial' ? { background: '#dcfce7', color: '#166534' } : { background: '#dbeafe', color: '#1e40af' }) }}>
                {s.modalidad === 'presencial' ? '🏋️' : '💻'} {s.titulo}
              </div>
            ))}
          </div>
        )}

        {/* Grid horario */}
        <div style={{ overflowY: 'auto', maxHeight: 520 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', position: 'relative' }}>
            {/* Columna horas */}
            <div>
              {HORAS.map(h => (
                <div key={h} style={{ height: PX_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 3, fontSize: 10, fontWeight: 500, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
                  {h}:00
                </div>
              ))}
            </div>
            {/* Columna día */}
            <div style={{ borderLeft: '1px solid var(--border)', position: 'relative', minHeight: (H_FIN - H_INI) * PX_H, background: esDiaHoy ? 'rgba(100,150,120,0.04)' : 'transparent' }}>
              {HORAS.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - H_INI) * PX_H, left: 0, right: 0, borderTop: '1px solid var(--border)' }} />
              ))}

              {/* Línea hora actual */}
              {esDiaHoy && horaEnGrid && (
                <>
                  <div style={{ position: 'absolute', top: topLinea - 4, left: -5, width: 10, height: 10, borderRadius: '50%', background: '#ef4444', zIndex: 10 }} />
                  <div style={{ position: 'absolute', top: topLinea, left: 0, right: 0, height: 2, background: '#ef4444', zIndex: 10 }} />
                </>
              )}

              {/* Franjas ocupadas */}
              {bloquesDia2.map(b => {
                const top = tTop(b.hora_inicio)
                if (top === null) return null
                const height = tHeight(b.hora_inicio, b.hora_fin)
                return (
                  <div key={b.id}
                    onClick={() => { setEditandoBloque(b.id); setModoBloque('dia'); setFormBloque({ fecha: b.fecha, hora_inicio: b.hora_inicio, hora_fin: b.hora_fin, titulo: b.titulo, tipo: b.tipo, lugar: b.lugar || '', cliente_id: b.cliente_id || '' }); setModalBloque(true) }}
                    style={{ position: 'absolute', top, left: 4, right: 4, height, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', overflow: 'hidden', zIndex: 2,
                      background: (TIPO_CONFIG[b.tipo] || TIPO_CONFIG.personal).bg,
                      borderLeft: `3px solid ${(TIPO_CONFIG[b.tipo] || TIPO_CONFIG.personal).border}`,
                      color: (TIPO_CONFIG[b.tipo] || TIPO_CONFIG.personal).color }}>
                    <div style={{ fontWeight: 600 }}>{b.titulo}</div>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>{b.hora_inicio?.slice(0,5)}–{b.hora_fin?.slice(0,5)}</div>
                  </div>
                )
              })}

              {/* Sesiones con hora */}
              {sesConHora.map(s => {
                const top = tTop(s.hora_inicio)
                if (top === null) return null
                const height = tHeight(s.hora_inicio, null, s.duracion_min || 60)
                const esP = s.modalidad === 'presencial'
                return (
                  <div key={s.id} onClick={() => irASesion(s.cliente_id, s.id)}
                    style={{ position: 'absolute', top, left: 4, right: 4, height, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', overflow: 'hidden', zIndex: 3,
                      background: esP ? '#e6f3eb' : '#dbeafe',
                      borderLeft: `3px solid ${esP ? '#3D8C4F' : '#3b82f6'}`,
                      color: esP ? '#1a4a2a' : '#1e40af' }}>
                    <div style={{ fontWeight: 600 }}>{s.titulo}</div>
                    <div style={{ fontSize: 10, opacity: 0.75 }}>{s.hora_inicio?.slice(0,5)}{s.duracion_min ? ` · ${s.duracion_min}min` : ''}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderCalendarioMes() {
    const primerDia = startOfMonth(mesNav)
    const totalDias = getDaysInMonth(mesNav)
    // Día de la semana del primer día (0=dom → 1=lun para nuestro grid lun-dom)
    const offsetRaw = primerDia.getDay() // 0=dom, 1=lun...
    const offset = offsetRaw === 0 ? 6 : offsetRaw - 1 // 0=lun, 6=dom

    const celdas = []
    for (let i = 0; i < offset; i++) celdas.push(null)
    for (let d = 1; d <= totalDias; d++) {
      celdas.push(new Date(mesNav.getFullYear(), mesNav.getMonth(), d))
    }
    while (celdas.length % 7 !== 0) celdas.push(null)

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Cabecera días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          {DIAS_LABEL.map((l, i) => (
            <div key={i} style={{ padding: '6px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text3)', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', opacity: i >= 5 ? 0.5 : 1 }}>{l}</div>
          ))}
        </div>
        {/* Grid días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {celdas.map((d, i) => {
            if (!d) return <div key={i} style={{ borderLeft: i % 7 > 0 ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border)', padding: 4, minHeight: 60, background: 'var(--bg2)', opacity: 0.3 }} />
            const key = fKey(d)
            const sesDia = sesionesMes.filter(s => s.fecha === key)
            const bloquesDia = bloquesMes.filter(b => b.fecha === key)
            const esHoyDia = key === hoy
            const col = i % 7
            const esFinSemana = col >= 5
            return (
              <div key={i} style={{ borderLeft: col > 0 ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border)', padding: '4px 6px', minHeight: 60, opacity: esFinSemana ? 0.6 : 1, background: esHoyDia ? 'var(--accent-light)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 12, fontWeight: esHoyDia ? 700 : 400, color: esHoyDia ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{d.getDate()}</div>
                {bloquesDia.map(b => (
                  <div key={b.id} onClick={() => { setEditandoBloque(b.id); setFormBloque({ fecha: b.fecha, hora_inicio: b.hora_inicio, hora_fin: b.hora_fin, titulo: b.titulo, tipo: b.tipo, lugar: b.lugar || '', cliente_id: b.cliente_id || '' }); setModalBloque(true) }}
                    style={{ fontSize: 9, background: '#e2e8f0', color: '#475569', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🏢 {b.hora_inicio?.slice(0,5)} {b.titulo}
                  </div>
                ))}
                {sesDia.map(s => (
                  <div key={s.id} style={{ fontSize: 9, borderRadius: 3, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    ...(s.modalidad === 'presencial' ? { background: '#dcfce7', color: '#166534' } : { background: '#dbeafe', color: '#1e40af' }) }}>
                    {s.hora_inicio ? <span style={{ opacity: 0.7 }}>{s.hora_inicio.slice(0,5)} </span> : null}
                    {s.modalidad === 'presencial' ? '🏋️' : '💻'} {s.titulo}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
          {Object.entries(TIPO_CONFIG).map(([, cfg]) => [cfg.border, `${cfg.emoji} ${cfg.label}`]).map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── NAVEGACIÓN ────────────────────────────────────────────────────────────

  const tituloNav = vista === 'mes'
    ? format(mesNav, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())
    : vista === 'dia'
      ? format(diaNav, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase())
      : `${format(semana, 'd MMM', { locale: es })} — ${format(dias[6], 'd MMM yyyy', { locale: es })}`

  function navAnterior() {
    if (vista === 'mes') setMesNav(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (vista === 'dia') setDiaNav(d => addDays(d, -1))
    else setSemana(d => addDays(d, -7))
  }
  function navSiguiente() {
    if (vista === 'mes') setMesNav(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (vista === 'dia') setDiaNav(d => addDays(d, 1))
    else setSemana(d => addDays(d, 7))
  }
  function navHoy() {
    setSemana(startOfWeek(new Date(), { weekStartsOn: 1 }))
    setMesNav(new Date())
    setDiaNav(new Date())
  }

  // ── STATS SEMANA ────────────────────────────────────────────────────────
  const statsSesiones = Object.values(clienteData).flatMap(cd =>
    (cd.sesiones || []).filter(s => s.fecha && s.fecha >= semIni && s.fecha <= semFin && !s.pack_id)
  )
  const statsListas = statsSesiones.filter(s => s.lista && s.publicada !== false)
  const statsPreparacion = statsSesiones.filter(s => !s.lista && s.publicada !== false)
  let statsPendientes = 0
  clientes.forEach(c => {
    const cd = clienteData[c.id] || {}
    const cSes = (cd.sesiones || []).filter(s => s.fecha && !s.pack_id)
    const diasDisp = cd.semanaRec?.dias_disponibles || []
    diasDisp.forEach(diaStr => {
      const idx = DIAS_SEMANA.indexOf(diaStr)
      if (idx < 0) return
      const fecha = fKey(addDays(semana, idx))
      if (!cSes.some(s => s.fecha === fecha)) statsPendientes++
    })
  })

  // Clientes visibles en la matriz según filtros
  const clientesVisibles = clientes.filter(c => {
    if (filtroGlobal.cliente && c.id !== filtroGlobal.cliente) return false
    if (!filtroGlobal.estado) return true
    const cd = clienteData[c.id] || {}
    const cSes = (cd.sesiones || []).filter(s => s.fecha && s.fecha >= semIni && s.fecha <= semFin && !s.pack_id)
    if (filtroGlobal.estado === 'lista') return cSes.some(s => s.lista && s.publicada !== false)
    if (filtroGlobal.estado === 'preparacion') return cSes.some(s => !s.lista && s.publicada !== false)
    if (filtroGlobal.estado === 'pendiente') {
      const diasDisp = cd.semanaRec?.dias_disponibles || []
      return diasDisp.some(diaStr => {
        const idx = DIAS_SEMANA.indexOf(diaStr)
        if (idx < 0) return false
        const fecha = fKey(addDays(semana, idx))
        return !cSes.some(s => s.fecha === fecha)
      })
    }
    return true
  })

  function limpiarFiltro(campo) {
    setFiltroGlobal(f => ({ ...f, [campo]: null }))
    if (campo === 'cliente') setBuscarCliente('')
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1500 }} onClick={() => setDropdownOpen(null)}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Buenos días, Irene 👋</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' }}>Aquí tienes tu semana de trabajo</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {/* Navegación fecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
            <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: '0 2px' }} onClick={navAnterior}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 500, minWidth: vista === 'dia' ? 200 : 160, textAlign: 'center', textTransform: 'capitalize' }}>{tituloNav}</span>
            <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: '0 2px' }} onClick={navSiguiente}>›</button>
          </div>
          {vista === 'dia' && (
            <input type="date" value={fKey(diaNav)} onChange={e => { if (e.target.value) setDiaNav(new Date(e.target.value + 'T12:00:00')) }}
              style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }} />
          )}
          {/* Selector de vista */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
            {[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([v, l]) => (
              <button key={v} onClick={() => setVista(v)}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 500, border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer',
                  background: vista === v ? 'var(--accent)' : 'transparent', color: vista === v ? '#fff' : 'var(--text2)' }}>
                {l}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={navHoy}>Hoy</button>
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-primary btn-sm" onClick={() => setDropdownOpen(d => d === 'añadir' ? null : 'añadir')}>
              + Añadir ▾
            </button>
            {dropdownOpen === 'añadir' && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.13)', width: 200, zIndex: 300, overflow: 'hidden' }}>
                <button onClick={() => { setDropdownOpen(null); setEditandoBloque(null); setModoBloque('dia'); setRangoFin(''); setDiasRango([0,1,2,3]); setFormBloque({ fecha: hoy, hora_inicio: '09:00', hora_fin: '10:00', titulo: '', tipo: 'presencial', lugar: '', cliente_id: '' }); setModalBloque(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 16 }}>🗓</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Franja ocupada</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Reunión, viaje, bloqueo...</div>
                  </div>
                </button>
                <button onClick={() => { setDropdownOpen(null); abrirNuevaTarea() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Tarea sin hora</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Pendiente, recordatorio...</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BARRA RESUMEN / FILTROS ── */}
      <div style={{ marginBottom: 16 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

            {/* Clientes */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setDropdownOpen(d => d === 'clientes' ? null : 'clientes')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: filtroGlobal.cliente ? 'var(--accent)' : 'var(--bg)', color: filtroGlobal.cliente ? '#fff' : 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                <span style={{ fontWeight: 700 }}>{filtroGlobal.cliente ? clientes.find(c => c.id === filtroGlobal.cliente)?.nombre.split(' ')[0] : clientes.length}</span>
                <span style={{ opacity: 0.75 }}>{filtroGlobal.cliente ? '' : 'clientes'}</span>
                <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {dropdownOpen === 'clientes' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.12)', width: 200, zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <input autoFocus placeholder="Buscar cliente…" value={buscarCliente} onChange={e => setBuscarCliente(e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <div onClick={() => { setFiltroGlobal(f => ({ ...f, cliente: null })); setBuscarCliente(''); setDropdownOpen(null) }}
                      style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)', fontStyle: 'italic' }}>Todos los clientes</div>
                    {clientes.filter(c => !buscarCliente || c.nombre.toLowerCase().includes(buscarCliente.toLowerCase())).map(c => (
                      <div key={c.id} onClick={() => { setFiltroGlobal(f => ({ ...f, cliente: c.id })); setDropdownOpen(null) }}
                        style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: filtroGlobal.cliente === c.id ? 700 : 400, color: filtroGlobal.cliente === c.id ? 'var(--accent)' : 'var(--text)', background: filtroGlobal.cliente === c.id ? 'rgba(120,155,138,0.1)' : 'transparent' }}>
                        {c.nombre}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span style={{ color: 'var(--border)', fontSize: 14 }}>·</span>

            {/* Sesiones total */}
            <span style={{ fontSize: 12, color: 'var(--text3)', padding: '5px 0' }}>
              <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{statsSesiones.length}</span> sesiones
            </span>

            <span style={{ color: 'var(--border)', fontSize: 14 }}>·</span>

            {/* Listas */}
            <button onClick={() => setFiltroGlobal(f => ({ ...f, estado: f.estado === 'lista' ? null : 'lista' }))}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: filtroGlobal.estado === 'lista' ? '#639922' : 'var(--bg)', color: filtroGlobal.estado === 'lista' ? '#fff' : '#639922', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✓ <span>{statsListas.length}</span> <span style={{ fontWeight: 400, opacity: 0.8 }}>listas</span>
            </button>

            {/* En preparación */}
            <button onClick={() => setFiltroGlobal(f => ({ ...f, estado: f.estado === 'preparacion' ? null : 'preparacion' }))}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: filtroGlobal.estado === 'preparacion' ? '#ef9f27' : 'var(--bg)', color: filtroGlobal.estado === 'preparacion' ? '#fff' : '#ef9f27', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ● <span>{statsPreparacion.length}</span> <span style={{ fontWeight: 400, opacity: 0.8 }}>preparación</span>
            </button>

            {/* Pendientes */}
            {statsPendientes > 0 && (
              <button onClick={() => setFiltroGlobal(f => ({ ...f, estado: f.estado === 'pendiente' ? null : 'pendiente' }))}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: filtroGlobal.estado === 'pendiente' ? '#ef4444' : 'var(--bg)', color: filtroGlobal.estado === 'pendiente' ? '#fff' : '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ! <span>{statsPendientes}</span> <span style={{ fontWeight: 400, opacity: 0.8 }}>pendientes</span>
              </button>
            )}

            {/* Chips filtros activos */}
            {(filtroGlobal.cliente || filtroGlobal.estado) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Filtro:</span>
                {filtroGlobal.cliente && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {clientes.find(c => c.id === filtroGlobal.cliente)?.nombre.split(' ')[0]}
                    <span style={{ cursor: 'pointer', opacity: 0.8, fontSize: 13 }} onClick={() => limpiarFiltro('cliente')}>×</span>
                  </span>
                )}
                {filtroGlobal.estado && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: filtroGlobal.estado === 'lista' ? '#639922' : filtroGlobal.estado === 'preparacion' ? '#ef9f27' : '#ef4444', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {filtroGlobal.estado === 'lista' ? '✓ Listas' : filtroGlobal.estado === 'preparacion' ? '● Preparación' : '! Pendientes'}
                    <span style={{ cursor: 'pointer', opacity: 0.8, fontSize: 13 }} onClick={() => limpiarFiltro('estado')}>×</span>
                  </span>
                )}
                <button style={{ fontSize: 11, color: 'var(--text3)', border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px' }} onClick={() => setFiltroGlobal({ cliente: null, estado: null })}>
                  Limpiar todo
                </button>
              </div>
            )}
          </div>
        </div>

      {/* ── DOS COLUMNAS PRINCIPALES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

        {/* ── IZQUIERDA: CALENDARIO + TAREAS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading
            ? <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Cargando...</div>
            : vista === 'mes' ? renderCalendarioMes()
            : vista === 'dia' ? renderCalendarioDia()
            : renderCalendarioSemana()
          }
          {/* ── PANEL TAREAS ── */}
          {(() => {
            const tareasFiltradas = tareas.filter(t => {
              if (filtroTarea.cliente) {
                const ids = t.cliente_ids?.length ? t.cliente_ids : (t.cliente_id ? [t.cliente_id] : [])
                if (!ids.includes(filtroTarea.cliente)) return false
              }
              if (filtroTarea.categoria && t.categoria !== filtroTarea.categoria) return false
              return true
            })
            const grupos = agruparTareas(tareasFiltradas)
            const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nombre]))

            function FechaBadge({ fecha }) {
              if (!fecha) return null
              const hoyStr = fKey(new Date())
              const mañanaStr = fKey(addDays(new Date(), 1))
              const finSemStr = fKey(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6))
              let label, color
              if (fecha < hoyStr) { label = 'Vencida'; color = '#ef4444' }
              else if (fecha === hoyStr) { label = 'Hoy'; color = '#ef9f27' }
              else if (fecha === mañanaStr) { label = 'Mañana'; color = '#ef9f27' }
              else if (fecha <= finSemStr) { label = format(new Date(fecha + 'T12:00:00'), "EEEE", { locale: es }); color = '#639922' }
              else { label = format(new Date(fecha + 'T12:00:00'), "d MMM", { locale: es }); color = 'var(--text3)' }
              return <span style={{ fontSize: 10, color }}>{label}</span>
            }

            function TareaRow({ t }) {
              const ids = t.cliente_ids?.length ? t.cliente_ids : (t.cliente_id ? [t.cliente_id] : [])
              const nombres = ids.map(id => (clienteMap[id] || '').split(' ')[0]).filter(Boolean)
              const cat = CATS.find(c => c.value === t.categoria)?.label || t.categoria
              const prio = t.prioridad === 'alta' ? '🔴' : t.prioridad === 'baja' ? '⚪' : null
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => abrirEditarTarea(t)}>
                  <div onClick={e => { e.stopPropagation(); completarTarea(t.id) }}
                    style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--border)', flexShrink: 0, marginTop: 2, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {prio && <span style={{ fontSize: 10 }}>{prio}</span>}
                      {t.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {nombres.length > 0 && nombres.map(n => (
                        <span key={n} style={{ fontWeight: 600, color: 'var(--accent)', background: 'rgba(120,155,138,0.12)', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{n}</span>
                      ))}
                      {nombres.length > 0 && <span>·</span>}
                      <span>{cat}</span>
                      {t.fecha_limite && <span>·</span>}
                      <FechaBadge fecha={t.fecha_limite} />
                    </div>
                  </div>
                </div>
              )
            }

            function GrupoTareas({ titulo, lista, accentColor }) {
              if (!lista.length) return null
              return (
                <div>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accentColor || 'var(--text3)', background: 'var(--bg2)' }}>
                    {titulo} <span style={{ fontWeight: 400, opacity: 0.7 }}>({lista.length})</span>
                  </div>
                  {lista.map(t => <TareaRow key={t.id} t={t} />)}
                </div>
              )
            }

            return (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text2)' }}>Tareas pendientes</span>
                    {tareasFiltradas.length > 0 && (
                      <span style={{ fontSize: 10, background: 'var(--bg)', color: 'var(--text3)', borderRadius: 20, padding: '2px 7px' }}>{tareasFiltradas.length}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select value={filtroTarea.cliente} onChange={e => setFiltroTarea(f => ({ ...f, cliente: e.target.value }))}
                      style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', background: 'var(--bg)', color: 'var(--text2)' }}>
                      <option value="">Todos los clientes</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre.split(' ')[0]}</option>)}
                    </select>
                    <select value={filtroTarea.categoria} onChange={e => setFiltroTarea(f => ({ ...f, categoria: e.target.value }))}
                      style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', background: 'var(--bg)', color: 'var(--text2)' }}>
                      <option value="">Todas las categorías</option>
                      {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={() => abrirNuevaTarea()} style={{ fontSize: 11, padding: '4px 10px' }}>+ Nueva</button>
                  </div>
                </div>
                {tareasFiltradas.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No hay tareas pendientes 🎉</div>
                ) : (
                  <>
                    <GrupoTareas titulo="Hoy / Vencidas" lista={grupos.hoy} accentColor="#ef4444" />
                    <GrupoTareas titulo="Esta semana" lista={grupos.semana} accentColor="#ef9f27" />
                    <GrupoTareas titulo="Más adelante" lista={grupos.adelante} accentColor="var(--text3)" />
                    <GrupoTareas titulo="Sin fecha" lista={grupos.sinFecha} accentColor="var(--text3)" />
                  </>
                )}
              </div>
            )
          })()}
        </div>

        {/* ── DERECHA: PLANIFICACIÓN + ALERTAS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Panel planificación semanal */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text2)' }}>Planificación semanal de clientes</span>
          </div>
          {/* Leyenda */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            {[
              ['#639922', <svg key="c" width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.5 1.5 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, 'Lista y visible'],
              ['#94a3b8', <svg key="o" width="9" height="8" viewBox="0 0 9 8" fill="none"><path d="M.5 4S2 1.5 4.5 1.5 8.5 4 8.5 4 7 6.5 4.5 6.5.5 4 .5 4z" stroke="#fff" strokeWidth=".9" strokeLinecap="round"/><circle cx="4.5" cy="4" r="1" stroke="#fff" strokeWidth=".9"/><line x1="1" y1=".5" x2="8" y2="7.5" stroke="#fff" stroke-width="1" strokeLinecap="round"/></svg>, 'No publicada'],
              ['#ef9f27', null, 'Borrador'],
              ['#ef4444', <span key="e" style={{color:'#fff',fontSize:8,fontWeight:900,lineHeight:1}}>!</span>, 'Pendiente'],
            ].map(([bg, icon, label], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                {label}
              </div>
            ))}
          </div>
          {clientes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>No hay clientes</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>Cliente</th>
                  <th style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {DIAS_LABEL.map(l => (
                        <div key={l} style={{ width: 16, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>{l}</div>
                      ))}
                    </div>
                  </th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)', minWidth: 72 }}>Progreso</th>
                </tr>
              </thead>
              <tbody>
                {[...clientesVisibles].sort((a, b) => {
                  const cdA = clienteData[a.id] || {}
                  const cdB = clienteData[b.id] || {}
                  const dispA = (cdA.semanaRec?.dias_disponibles || []).length + (cdA.sesiones || []).filter(s => s.fecha && !s.pack_id).length
                  const dispB = (cdB.semanaRec?.dias_disponibles || []).length + (cdB.sesiones || []).filter(s => s.fecha && !s.pack_id).length
                  return (dispA > 0 ? 0 : 1) - (dispB > 0 ? 0 : 1)
                }).map(c => {
                  const cd = clienteData[c.id] || {}
                  const { sesiones: cSes = [], semanaRec } = cd
                  const diasDisp = semanaRec?.dias_disponibles || []
                  const sesPorDia = {}
                  cSes.filter(s => s.fecha && !s.pack_id).forEach(s => {
                    if (!sesPorDia[s.fecha]) sesPorDia[s.fecha] = []
                    sesPorDia[s.fecha].push(s)
                  })
                  const packSes = cSes.filter(s => s.pack_id)

                  // Estado automático calculado
                  const sesConFecha = cSes.filter(s => s.fecha && !s.pack_id)
                  const sesLista = sesConFecha.filter(s => s.lista && s.publicada !== false)
                  const totalEsperados = Math.max(diasDisp.length, sesConFecha.length)
                  const listaCount = sesLista.length
                  let estadoBadge, badgeBg, badgeColor
                  if (totalEsperados === 0) {
                    estadoBadge = '— Sin horario'; badgeBg = '#f1f0e8'; badgeColor = '#b0aea8'
                  } else if (listaCount >= totalEsperados) {
                    estadoBadge = `✅ ${listaCount}/${totalEsperados}`; badgeBg = '#eaf3de'; badgeColor = '#3b6d11'
                  } else {
                    estadoBadge = `🔄 ${listaCount}/${totalEsperados}`; badgeBg = '#faeeda'; badgeColor = '#854f0b'
                  }
                  const esLista = listaCount >= totalEsperados && totalEsperados > 0

                  const pct = totalEsperados > 0 ? Math.round((listaCount / totalEsperados) * 100) : 0
                  const barColor = pct === 100 ? '#639922' : pct >= 50 ? '#ef9f27' : '#ef4444'

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 500 }}>{c.nombre.split(' ')[0]}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                          {dias.map((d, i) => {
                            const key = fKey(d)
                            const diaStr = DIAS_SEMANA[i]
                            const tieneDisp = diasDisp.includes(diaStr)
                            const sesArr = sesPorDia[key] || []

                            const ICONS = {
                              lista:  <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                              prep:   <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M5.5 1.5l2 2-4.5 4.5H1v-2L5.5 1.5z" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                              excl:   <span style={{color:'#fff',fontSize:9,fontWeight:900,lineHeight:1,fontFamily:'sans-serif'}}>!</span>,
                              oculta: <svg width="10" height="9" viewBox="0 0 10 9" fill="none"><path d="M1 4.5S2.5 2 5 2s4 2.5 4 2.5S7.5 7 5 7 1 4.5 1 4.5z" stroke="#fff" strokeWidth="1" strokeLinecap="round"/><circle cx="5" cy="4.5" r="1.2" stroke="#fff" strokeWidth="1"/><line x1="1.5" y1="1" x2="8.5" y2="8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/></svg>,
                            }

                            function dotDeSesion(ses) {
                              if (ses.publicada === false) return { bg: '#94a3b8', title: 'Sesión oculta al cliente', icon: 'oculta' }
                              if (ses.lista) return { bg: '#639922', title: 'Sesión lista', icon: 'lista' }
                              return { bg: '#ef9f27', title: 'Sesión en preparación', icon: 'prep' }
                            }

                            // Si hay sesiones, mostrar un dot por sesión apilados; si hay disponibilidad sin sesión, mostrar excl; si nada, círculo vacío punteado
                            return (
                              <div key={i} style={{ width: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                {sesArr.length > 0 ? sesArr.map((ses, si) => {
                                  const dot = dotDeSesion(ses)
                                  return (
                                    <div key={si}
                                      title={dot.title}
                                      onClick={e => abrirPopover(e, c.nombre, c.id, d, diaStr, ses, cd)}
                                      style={{ width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                                        background: dot.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {ICONS[dot.icon]}
                                    </div>
                                  )
                                }) : (
                                  <div
                                    title={tieneDisp ? 'Día disponible sin sesión' : 'Clic para marcar disponible'}
                                    onClick={e => tieneDisp ? abrirPopover(e, c.nombre, c.id, d, diaStr, null, cd) : toggleDia(cd, c.id, diaStr)}
                                    style={{ width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                                      background: tieneDisp ? '#ef4444' : 'transparent',
                                      border: tieneDisp ? 'none' : '1.5px dashed #cbd5e1',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: tieneDisp ? '#fff' : '#cbd5e1', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                                    {tieneDisp ? ICONS.excl : '—'}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {packSes.length > 0 && (
                            <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 2, whiteSpace: 'nowrap' }}>+{packSes.length}📦</span>
                          )}
                        </div>
                      </td>
                      {/* Progreso */}
                      <td style={{ padding: '6px 12px', textAlign: 'right', minWidth: 72 }}>
                        {totalEsperados > 0 ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 600, color: barColor, marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>{listaCount} / {totalEsperados}</div>
                            <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 10, color: '#b0aea8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {/* Alertas en columna derecha */}
        {vista === 'semana' && (() => {
          const alertas = calcularAlertas()
          if (!alertas.length) return null
          return (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text2)' }}>Necesita atención</span>
                <span style={{ fontSize: 10, background: '#fef2f2', color: '#ef4444', borderRadius: 20, padding: '2px 7px', fontWeight: 700 }}>{alertas.length}</span>
              </div>
              {alertas.map((a, i) => (
                <div key={i} onClick={() => { if (a.sesionId) irASesion(a.clienteId, a.sesionId) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < alertas.length - 1 ? '1px solid var(--border)' : 'none', cursor: a.sesionId || a.clienteId ? 'pointer' : 'default' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {a.cliente && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{a.cliente}</div>}
                    <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.texto}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: a.color, background: a.color + '18', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{a.etiqueta}</span>
                </div>
              ))}
            </div>
          )
        })()}

        </div>{/* fin columna derecha */}

        {/* Tareas en columna izquierda — se añaden dentro del left col via portal trick */}
      </div>{/* fin grid dos columnas */}

      {/* ── POPOVER DOT ── */}
      {popover && (
        <>
          <div onClick={() => setPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{ position: 'fixed', left: popover.x, top: popover.y, zIndex: 1000, background: 'var(--bg)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: 280, padding: 16, border: '1px solid var(--border)' }}>
            {/* Cabecera */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{popover.clienteNombre.split(' ')[0]}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, textTransform: 'capitalize' }}>
                {format(popover.dia, "EEEE d 'de' MMMM", { locale: es })}
              </div>
            </div>

            {popover.ses ? (
              <>
                {/* Info sesión */}
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{popover.ses.titulo}</div>
                  {(() => {
                    const pub = popover.ses.publicada !== false
                    const lista = popover.ses.lista
                    const color = !pub ? '#94a3b8' : lista ? '#16a34a' : '#ef9f27'
                    const label = !pub ? '🔒 Oculta al cliente' : lista ? '✅ Lista para el cliente' : '📝 En preparación'
                    return <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
                  })()}
                  {loadingPop ? (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Cargando...</div>
                  ) : popover.detalle && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {popover.detalle.totalBloques > 0
                        ? `${popover.detalle.totalBloques} bloques · ${popover.detalle.totalEjercicios} ejercicios`
                        : 'Sin bloques aún'}
                    </div>
                  )}
                </div>
                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => irASesion(popover.clienteId, popover.ses.id)}>
                    {popover.ses.lista ? '👁 Ver' : '✏️ Continuar'}
                  </button>
                  {popover.ses.lista && (
                    <button className="btn btn-ghost btn-sm" onClick={() => irASesion(popover.clienteId, popover.ses.id)}>Editar</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPopover(null); toggleDia(popover.cd, popover.clienteId, popover.diaStr) }} title="Quitar disponibilidad">×</button>
                </div>
              </>
            ) : (
              <>
                {/* Sin sesión */}
                <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>🔴 Sesión pendiente de crear</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>El cliente tiene disponibilidad este día</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => crearSesion(popover.clienteId, fKey(popover.dia))}>
                    + Crear sesión
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPopover(null); toggleDia(popover.cd, popover.clienteId, popover.diaStr) }}>Quitar día</button>
                </div>
              </>
            )}
          </div>
        </>
      )}


      {/* ── MODAL TAREA ── */}
      {modalTarea && (
        <div onClick={() => { setModalTarea(false); setEditandoTarea(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', margin: '0 16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>{editandoTarea ? 'Editar tarea' : 'Nueva tarea'}</h3>

            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" placeholder="Ej: Revisar test CMJ de Marta" value={formTarea.titulo}
                onChange={e => setFormTarea(f => ({ ...f, titulo: e.target.value }))} autoFocus />
            </div>

            <div className="form-group">
              <label className="form-label">Clientes (opcional, selecciona uno o varios)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', maxHeight: 120, overflowY: 'auto' }}>
                {clientes.map(c => {
                  const sel = (formTarea.cliente_ids || []).includes(c.id)
                  return (
                    <button key={c.id} type="button"
                      onClick={() => setFormTarea(f => ({
                        ...f,
                        cliente_ids: sel
                          ? (f.cliente_ids || []).filter(id => id !== c.id)
                          : [...(f.cliente_ids || []), c.id]
                      }))}
                      style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: sel ? 600 : 400, border: '1px solid', cursor: 'pointer',
                        background: sel ? 'var(--accent)' : 'transparent',
                        color: sel ? '#fff' : 'var(--text2)',
                        borderColor: sel ? 'var(--accent)' : 'var(--border)' }}>
                      {c.nombre.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-input" value={formTarea.categoria} onChange={e => setFormTarea(f => ({ ...f, categoria: e.target.value }))}>
                {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Fecha límite (opcional)</label>
                <input className="form-input" type="date" value={formTarea.fecha_limite}
                  onChange={e => setFormTarea(f => ({ ...f, fecha_limite: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Prioridad</label>
                <select className="form-input" value={formTarea.prioridad} onChange={e => setFormTarea(f => ({ ...f, prioridad: e.target.value }))}>
                  {PRIOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              {editandoTarea && (
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }}
                  onClick={() => { eliminarTarea(editandoTarea); setModalTarea(false); setEditandoTarea(null) }}>
                  Eliminar
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => { setModalTarea(false); setEditandoTarea(null) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarTarea} disabled={savingTarea || !formTarea.titulo.trim()}>
                {savingTarea ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FRANJA OCUPADA ── */}
      {modalBloque && (
        <div
          onClick={() => setModalBloque(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', margin: '0 16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{editandoBloque ? 'Editar franja' : 'Nueva franja ocupada'}</h3>

            {/* Título + Tipo */}
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" value={formBloque.titulo} onChange={e => setFormBloque(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Barça, Reunión, Médico..." />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(TIPO_CONFIG).map(([val, cfg]) => {
                  const sel = formBloque.tipo === val
                  return (
                    <button key={val} type="button" onClick={() => setFormBloque(f => ({ ...f, tipo: val }))}
                      style={{ padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: sel ? 700 : 500, border: `1.5px solid`, cursor: 'pointer',
                        background: sel ? cfg.color : 'transparent',
                        color: sel ? '#fff' : cfg.color,
                        borderColor: sel ? cfg.color : cfg.border }}>
                      {cfg.emoji} {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cliente (presencial, fcb, online) */}
            {['presencial', 'fcb', 'online'].includes(formBloque.tipo) && (
              <div className="form-group">
                <label className="form-label">Cliente (opcional)</label>
                <select className="form-input" value={formBloque.cliente_id || ''} onChange={e => setFormBloque(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Sin cliente específico</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Lugar */}
            {['presencial', 'fcb', 'gestion'].includes(formBloque.tipo) && (
              <div className="form-group">
                <label className="form-label">Lugar</label>
                <input className="form-input" value={formBloque.lugar || ''} onChange={e => setFormBloque(f => ({ ...f, lugar: e.target.value }))}
                  placeholder={formBloque.tipo === 'fcb' ? 'Ej: Ciudad Deportiva, Camp Nou...' : formBloque.tipo === 'presencial' ? 'Ej: Instalaciones, gimnasio...' : 'Ej: Despacho asesor, videollamada...'} />
              </div>
            )}

            {/* Modo: un día / rango (solo al crear) */}
            {!editandoBloque && (
              <div className="form-group">
                <label className="form-label">Repetición</label>
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
                  {[['dia','Un día'], ['rango','Rango de fechas']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setModoBloque(v)}
                      style={{ padding: '5px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                        background: modoBloque === v ? 'var(--accent)' : 'transparent',
                        color: modoBloque === v ? '#fff' : 'var(--text2)',
                        borderRight: v === 'dia' ? '1px solid var(--border)' : 'none' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fecha(s) */}
            {modoBloque === 'dia' || editandoBloque ? (
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={formBloque.fecha} onChange={e => setFormBloque(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Desde</label>
                    <input className="form-input" type="date" value={formBloque.fecha} onChange={e => setFormBloque(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hasta</label>
                    <input className="form-input" type="date" value={rangoFin} onChange={e => setRangoFin(e.target.value)} min={formBloque.fecha} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Días de la semana</label>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['L','M','X','J','V','S','D'].map((l, i) => {
                      const sel = diasRango.includes(i)
                      return (
                        <button key={i} type="button"
                          onClick={() => setDiasRango(d => sel ? d.filter(x => x !== i) : [...d, i])}
                          style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            background: sel ? 'var(--accent)' : 'transparent',
                            color: sel ? '#fff' : 'var(--text2)',
                            borderColor: sel ? 'var(--accent)' : 'var(--border)' }}>
                          {l}
                        </button>
                      )
                    })}
                  </div>
                  {modoBloque === 'rango' && formBloque.fecha && rangoFin && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {(() => {
                        let cnt = 0
                        const cur = new Date(formBloque.fecha + 'T12:00:00')
                        const fin = new Date(rangoFin + 'T12:00:00')
                        while (cur <= fin) {
                          const dow = cur.getDay() === 0 ? 6 : cur.getDay() - 1
                          if (diasRango.includes(dow)) cnt++
                          cur.setDate(cur.getDate() + 1)
                        }
                        return cnt > 0 ? `Se crearán ${cnt} franjas` : 'Selecciona al menos un día'
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Horas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Hora inicio</label>
                <input className="form-input" type="time" value={formBloque.hora_inicio} onChange={e => setFormBloque(f => ({ ...f, hora_inicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Hora fin</label>
                <input className="form-input" type="time" value={formBloque.hora_fin} onChange={e => setFormBloque(f => ({ ...f, hora_fin: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              {editandoBloque && (
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }}
                  onClick={() => { eliminarBloque(editandoBloque); setModalBloque(false); setEditandoBloque(null) }}>
                  Eliminar
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => { setModalBloque(false); setEditandoBloque(null) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarBloque} disabled={savingBloque}>{savingBloque ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
