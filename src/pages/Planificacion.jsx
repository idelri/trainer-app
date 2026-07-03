import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addWeeks, addDays, parseISO, differenceInWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, ChevronDown, ChevronRight, Trophy, Calendar, Layers, Pencil, Lock } from 'lucide-react'
import CalendarioSesiones from '../components/CalendarioSesiones'
import Seguimiento from './Seguimiento'

// ─── HELPERS ────────────────────────────────────────────────────────────────

function calcFechaInicioSemana(bloque, numSemana) {
  return addWeeks(parseISO(bloque.fecha_inicio), numSemana - 1)
}
function calcFechaFinSemana(bloque, numSemana) {
  return addWeeks(parseISO(bloque.fecha_inicio), numSemana)
}
function calcTotalSemanas(bloques) {
  return bloques.reduce((s, b) => s + b.semanas, 0)
}
function calcOffsetSemanaGlobal(bloques, bloqueId, numSemanaLocal) {
  let offset = 0
  for (const b of bloques) {
    if (b.id === bloqueId) return offset + numSemanaLocal
    offset += b.semanas
  }
  return offset + numSemanaLocal
}
function iconoSesion(s) {
  const t = (s.titulo || '').toLowerCase()
  if (/fuerza|gym|pesas|pesa|musculac|core|funcional/.test(t)) return '💪'
  if (/rodaje|carrera|run|correr|trote|fondo|series|tempo|interval/.test(t)) return '🏃'
  if (/movilidad|yoga|stretching|flexibilidad|estiram/.test(t)) return '🧘'
  if (/bici|ciclis|spinning|cycling/.test(t)) return '🚴'
  if (/nadar|natación|piscina|swim/.test(t)) return '🏊'
  return '⚡'
}

// ─── CONSTANTES ─────────────────────────────────────────────────────────────

const CARGAS = {
  baja:     { label: 'Baja',     color: '#10b981' },
  media:    { label: 'Media',    color: '#f59e0b' },
  alta:     { label: 'Alta',     color: '#ef4444' },
  muy_alta: { label: 'Muy alta', color: '#7c3aed' },
}
const COLORES = [
  '#2d6a4f', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6b7280',
]
const ENFOQUES = ['Movilidad', 'Estabilidad y control', 'Fuerza base', 'Potencia y velocidad', 'Especificidad deportiva']

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function Planificacion({ clientePlanificacion }) {
  // ── Datos ──
  const [clientes,            setClientes]            = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [clienteData,         setClienteData]         = useState(null)
  const [planificacion,       setPlanificacion]       = useState(null)
  const [planificaciones,     setPlanificaciones]     = useState([])
  const [bloques,             setBloques]             = useState([])
  const [subbloques,          setSubbloques]          = useState({})
  const [semanas,             setSemanas]             = useState({})
  const [sesiones,            setSesiones]            = useState([])
  const [competiciones,       setCompeticiones]       = useState([])
  const [controles,           setControles]           = useState([])
  const [notas,               setNotas]               = useState([])
  const [feedbacks,           setFeedbacks]           = useState([])
  const [clipboardSesion,     setClipboardSesion]     = useState(null)

  // ── UI ──
  const [vista,      setVista]      = useState('timeline')
  const [zoomTL,     setZoomTL]     = useState(44)   // px por semana en el timeline
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [filtros,    setFiltros]    = useState({ bloques: true, sub: true, semanas: true, sesiones: true, eventos: false })
  const [tooltip,    setTooltip]    = useState({ visible: false, tipo: null, item: null, x: 0, y: 0 })
  const [menuAnadir, setMenuAnadir] = useState(false)

  // ── Modal unificado ──
  const [modalTipo, setModalTipo] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const [formData,  setFormData]  = useState({})

  // ── Modal copiar (flujo especial) ──
  const [modalCopiar, setModalCopiar] = useState(false)
  const [formCopiar,  setFormCopiar]  = useState({ cliente_id: '', fecha_inicio: '', nombre: '' })

  // ── Estado visual de sesión ──
  function estadoSesion(s) {
    if (s.estado && s.estado !== 'pendiente') return s.estado
    const tieneFeedback = feedbacks.some(f => f.sesion_id === s.id)
    if (tieneFeedback) return 'completada'
    if (s.fecha && new Date(s.fecha) < new Date(new Date().toDateString())) return 'perdida'
    return 'pendiente'
  }
  function iconoEstado(s) {
    const e = estadoSesion(s)
    if (e === 'completada') return { icono: '✓', bg: '#dcfce7', border: '#16a34a', color: '#166534' }
    if (e === 'parcial')    return { icono: '〜', bg: '#fef9c3', border: '#ca8a04', color: '#713f12' }
    if (e === 'perdida')    return { icono: '✗', bg: '#fee2e2', border: '#dc2626', color: '#7f1d1d' }
    return null
  }

  // ── Effects ──
  useEffect(() => { cargarClientes() }, [])
  useEffect(() => {
    if (clientePlanificacion && !clienteSeleccionado) setClienteSeleccionado(clientePlanificacion)
  }, [clientePlanificacion])
  useEffect(() => {
    if (clienteSeleccionado) { cargarPlanificacion(); cargarClienteData(clienteSeleccionado) }
  }, [clienteSeleccionado])

  // ─────────────────────────────────────────────────────────────────────────
  // CARGA DE DATOS
  // ─────────────────────────────────────────────────────────────────────────

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  async function cargarClienteData(id) {
    const { data } = await supabase.from('clientes').select('semana_tipo, disponibilidad, consideraciones, perfil_planificacion').eq('id', id).single()
    setClienteData(data || null)
  }

  async function cargarPlanificacion() {
    setLoading(true)
    const { data: planes } = await supabase
      .from('planificaciones').select('*')
      .eq('cliente_id', clienteSeleccionado)
      .order('created_at', { ascending: false })
    setPlanificaciones(planes || [])
    const plan = planes?.[0] || null

    if (plan) {
      setPlanificacion(plan)
      const { data: bls } = await supabase.from('bloques').select('*').eq('planificacion_id', plan.id).order('orden')
      setBloques(bls || [])

      if (bls && bls.length > 0) {
        const ids = bls.map(b => b.id)
        const { data: subs } = await supabase.from('subbloques').select('*').in('bloque_id', ids).order('semana_inicio')
        const subsMap = {}
        ;(subs || []).forEach(s => { if (!subsMap[s.bloque_id]) subsMap[s.bloque_id] = []; subsMap[s.bloque_id].push(s) })
        setSubbloques(subsMap)

        const { data: sems } = await supabase.from('semanas').select('*').in('bloque_id', ids).order('numero')
        const semsMap = {}
        ;(sems || []).forEach(s => { if (!semsMap[s.bloque_id]) semsMap[s.bloque_id] = []; semsMap[s.bloque_id].push(s) })
        setSemanas(semsMap)
      } else {
        setSubbloques({}); setSemanas({})
      }

      const { data: sess } = await supabase.from('sesiones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha', { ascending: true, nullsFirst: false })
      setSesiones(sess || [])
    } else {
      setPlanificacion(null); setBloques([]); setSemanas({}); setSubbloques({}); setSesiones([])
    }

    const { data: comps } = await supabase.from('competiciones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha')
    setCompeticiones(comps || [])
    const { data: ctrls } = await supabase.from('controles').select('*').eq('cliente_id', clienteSeleccionado).order('fecha')
    setControles(ctrls || [])
    const { data: nts } = await supabase.from('sesion_notas').select('*').eq('cliente_id', clienteSeleccionado).order('fecha')
    setNotas(nts || [])
    const { data: allSess } = await supabase.from('sesiones').select('id').eq('cliente_id', clienteSeleccionado)
    if (allSess && allSess.length > 0) {
      const { data: fbs } = await supabase.from('sesion_feedback').select('sesion_id, submitted_at').in('sesion_id', allSess.map(s => s.id))
      setFeedbacks(fbs || [])
    } else {
      setFeedbacks([])
    }
    setLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SISTEMA DE MODALES UNIFICADO
  // ─────────────────────────────────────────────────────────────────────────

  function getInitialForm(tipo, item) {
    switch (tipo) {
      case 'plan_nuevo':
        return { cliente_id: clienteSeleccionado || '', nombre: '', fecha_inicio: '', fecha_fin: '', notas: '', tipo: 'deportiva' }
      case 'plan_editar':
        return { nombre: planificacion?.nombre || '', fecha_inicio: planificacion?.fecha_inicio || '', fecha_fin: planificacion?.fecha_fin || '', notas: planificacion?.notas || '', tipo: planificacion?.tipo || 'deportiva' }
      case 'bloque':
        return {
          nombre:             item?.nombre             || '',
          color:              item?.color              || '#2d6a4f',
          fecha_inicio:       item?.fecha_inicio       || (
            bloques.length > 0
              ? format(addWeeks(parseISO(bloques[bloques.length - 1].fecha_inicio), bloques[bloques.length - 1].semanas), 'yyyy-MM-dd')
              : planificacion?.fecha_inicio || ''
          ),
          semanas:            item?.semanas            || 4,
          objetivo:           item?.objetivo           || '',
          sesiones_min:       item?.sesiones_min       || '',
          sesiones_max:       item?.sesiones_max       || '',
          duracion_media_min: item?.duracion_media_min || '',
          exigencia:          item?.exigencia          || '',
          enfoque_prioridad:  item?.enfoque_prioridad  || {},
          enfoque:            item?.enfoque            || [],
        }
      case 'subbloque':
        return {
          bloque_id:          item?.bloque_id          || bloques[0]?.id || '',
          nombre:             item?.nombre             || '',
          semana_inicio:      item?.semana_inicio      || 1,
          semana_fin:         item?.semana_fin         || 1,
          notas:              item?.notas              || '',
          zona1_2:            item?.zona1_2            || 0,
          zona3_4:            item?.zona3_4            || 0,
          zona5:              item?.zona5              || 0,
          km_min:             item?.km_min             || '',
          km_max:             item?.km_max             || '',
          sesiones_min:       item?.sesiones_min       || '',
          sesiones_max:       item?.sesiones_max       || '',
          duracion_media_min: item?.duracion_media_min || '',
          exigencia:          item?.exigencia          || '',
          enfoque:            item?.enfoque            || [],
          enfoque_prioridad:  item?.enfoque_prioridad  || {},
        }
      case 'semana': {
        // item = { bloque, numero, semanaData }
        const sem = item?.semanaData
        return {
          objetivo:     sem?.objetivo     || '',
          carga:        sem?.carga        || 'media',
          km_objetivo:  sem?.km_objetivo  || '',
          km_real:      sem?.km_real      || '',
          zona1_2_real: sem?.zona1_2_real || 0,
          zona3_4_real: sem?.zona3_4_real || 0,
          zona5_real:   sem?.zona5_real   || 0,
          notas:        sem?.notas        || '',
          nota_cliente: sem?.nota_cliente || '',
          comentario:   sem?.comentario   || '',
        }
      }
      case 'sesion':
        return {
          titulo:       item?.titulo       || '',
          fecha:        item?.fecha        || '',
          sinFecha:     !item?.fecha,
          tipo_sesion:  item?.tipo_sesion  || 'programada',
          estado:       item?.estado       || 'pendiente',
          objetivo:     item?.objetivo     || '',
          duracion_min: item?.duracion_min || '',
        }
      case 'comp':
        return { nombre: item?.nombre || '', fecha: item?.fecha || '', tipo: item?.tipo || '', objetivo: item?.objetivo || '', notas: item?.notas || '' }
      case 'control':
        return { nombre: item?.nombre || '', fecha: item?.fecha || '', tipo: item?.tipo || '', notas: item?.notas || '' }
      case 'nota':
        return { texto: item?.texto || '', fecha: item?.fecha || format(new Date(), 'yyyy-MM-dd') }
      default:
        return {}
    }
  }

  function openModal(tipo, item = null) {
    setModalTipo(tipo)
    setModalItem(item)
    setFormData(getInitialForm(tipo, item))
  }

  function closeModal() {
    setModalTipo(null)
    setModalItem(null)
    setFormData({})
  }

  // Atajo para actualizar un campo de formData
  function fd(key, val) {
    setFormData(f => ({ ...f, [key]: val }))
  }

  async function guardarModal() {
    setSaving(true)
    try {
      switch (modalTipo) {

        case 'plan_nuevo': {
          if (!formData.cliente_id || !formData.nombre || !formData.fecha_inicio || !formData.fecha_fin) break
          await supabase.from('planificaciones').insert({ cliente_id: formData.cliente_id, nombre: formData.nombre, fecha_inicio: formData.fecha_inicio, fecha_fin: formData.fecha_fin, notas: formData.notas || null, tipo: formData.tipo || 'deportiva' })
          closeModal()
          setClienteSeleccionado(formData.cliente_id)
          break
        }

        case 'plan_editar': {
          if (!formData.nombre || !formData.fecha_inicio || !formData.fecha_fin) break
          await supabase.from('planificaciones').update({ nombre: formData.nombre, fecha_inicio: formData.fecha_inicio, fecha_fin: formData.fecha_fin, notas: formData.notas || null, tipo: formData.tipo || 'deportiva' }).eq('id', planificacion.id)
          closeModal(); cargarPlanificacion()
          break
        }

        case 'bloque': {
          if (!formData.nombre || !formData.fecha_inicio) break
          const esSaludGuardar = planificacion?.tipo === 'salud'
          const datos = { planificacion_id: planificacion.id, nombre: formData.nombre, color: formData.color || '#2d6a4f', fecha_inicio: formData.fecha_inicio, semanas: parseInt(formData.semanas) || 4, objetivo: formData.objetivo || null, orden: modalItem?.orden ?? bloques.length,
            ...(esSaludGuardar ? {
              sesiones_min:       formData.sesiones_min       ? parseInt(formData.sesiones_min)       : null,
              sesiones_max:       formData.sesiones_max       ? parseInt(formData.sesiones_max)       : null,
              duracion_media_min: formData.duracion_media_min ? parseInt(formData.duracion_media_min) : null,
              exigencia:          formData.exigencia          || null,
              enfoque_prioridad:  Object.keys(formData.enfoque_prioridad || {}).length > 0 ? formData.enfoque_prioridad : null,
              enfoque:            formData.enfoque?.length    > 0 ? formData.enfoque : null,
            } : {}),
          }
          if (modalItem?.id) await supabase.from('bloques').update(datos).eq('id', modalItem.id)
          else await supabase.from('bloques').insert(datos)
          closeModal(); cargarPlanificacion()
          break
        }

        case 'subbloque': {
          if (!formData.nombre || !formData.bloque_id) break
          const datos = {
            bloque_id:          formData.bloque_id,
            nombre:             formData.nombre,
            semana_inicio:      parseInt(formData.semana_inicio),
            semana_fin:         parseInt(formData.semana_fin),
            notas:              formData.notas || null,
            zona1_2:            parseInt(formData.zona1_2) || 0,
            zona3_4:            parseInt(formData.zona3_4) || 0,
            zona5:              parseInt(formData.zona5) || 0,
            km_min:             formData.km_min ? parseInt(formData.km_min) : null,
            km_max:             formData.km_max ? parseInt(formData.km_max) : null,
            sesiones_min:       formData.sesiones_min ? parseInt(formData.sesiones_min) : null,
            sesiones_max:       formData.sesiones_max ? parseInt(formData.sesiones_max) : null,
            duracion_media_min: formData.duracion_media_min ? parseInt(formData.duracion_media_min) : null,
            exigencia:          formData.exigencia || null,
            enfoque:            formData.enfoque?.length ? formData.enfoque : null,
            enfoque_prioridad:  Object.keys(formData.enfoque_prioridad || {}).length ? formData.enfoque_prioridad : null,
          }
          if (modalItem?.id) await supabase.from('subbloques').update(datos).eq('id', modalItem.id)
          else await supabase.from('subbloques').insert(datos)
          closeModal(); cargarPlanificacion()
          break
        }

        case 'semana': {
          const bloque_id       = modalItem?.bloque?.id
          const numero          = modalItem?.numero
          const semanaExistente = modalItem?.semanaData
          const datos = {
            objetivo:     formData.objetivo || null,
            carga:        formData.carga,
            km_objetivo:  formData.km_objetivo  ? parseInt(formData.km_objetivo)  : null,
            km_real:      formData.km_real      ? parseInt(formData.km_real)      : null,
            zona1_2_real: parseInt(formData.zona1_2_real) || 0,
            zona3_4_real: parseInt(formData.zona3_4_real) || 0,
            zona5_real:   parseInt(formData.zona5_real)   || 0,
            notas:        formData.notas        || null,
            nota_cliente: formData.nota_cliente || null,
            comentario:   formData.comentario   || null,
          }
          if (semanaExistente?.id) await supabase.from('semanas').update(datos).eq('id', semanaExistente.id)
          else await supabase.from('semanas').insert({ bloque_id, numero, ...datos })
          closeModal(); cargarPlanificacion()
          break
        }

        case 'sesion': {
          if (!formData.titulo) break
          const datos = { titulo: formData.titulo, fecha: formData.sinFecha ? null : (formData.fecha || null), tipo_sesion: formData.tipo_sesion || 'programada', estado: formData.estado || 'pendiente', objetivo: formData.objetivo || null, duracion_min: formData.duracion_min ? parseInt(formData.duracion_min) : null }
          if (modalItem?.id) await supabase.from('sesiones').update(datos).eq('id', modalItem.id)
          else await supabase.from('sesiones').insert({ cliente_id: clienteSeleccionado, ...datos })
          closeModal(); cargarPlanificacion()
          break
        }

        case 'comp': {
          if (!formData.nombre || !formData.fecha) break
          const datos = { nombre: formData.nombre, fecha: formData.fecha, tipo: formData.tipo || null, objetivo: formData.objetivo || null, notas: formData.notas || null }
          if (modalItem?.id) await supabase.from('competiciones').update(datos).eq('id', modalItem.id)
          else await supabase.from('competiciones').insert({ cliente_id: clienteSeleccionado, ...datos })
          closeModal(); cargarPlanificacion()
          break
        }

        case 'control': {
          if (!formData.nombre || !formData.fecha) break
          const datos = { nombre: formData.nombre, fecha: formData.fecha, tipo: formData.tipo || null, notas: formData.notas || null }
          if (modalItem?.id) await supabase.from('controles').update(datos).eq('id', modalItem.id)
          else await supabase.from('controles').insert({ cliente_id: clienteSeleccionado, ...datos })
          closeModal(); cargarPlanificacion()
          break
        }

        case 'nota': {
          if (!formData.texto) break
          const datos = { texto: formData.texto, fecha: formData.fecha || null }
          if (modalItem?.id) await supabase.from('sesion_notas').update(datos).eq('id', modalItem.id)
          else await supabase.from('sesion_notas').insert({ cliente_id: clienteSeleccionado, ...datos })
          closeModal(); cargarPlanificacion()
          break
        }

        default: break
      }
    } finally {
      setSaving(false)
    }
  }

  async function eliminarItem(tipoArg, idArg) {
    const tipo = tipoArg || modalTipo
    const id   = idArg   || modalItem?.id
    const mensajes = {
      bloque:    '¿Eliminar este bloque? Se eliminarán también sus sub bloques y semanas.',
      subbloque: '¿Eliminar este sub bloque?',
      sesion:    '¿Eliminar esta sesión?',
      comp:      '¿Eliminar esta competición?',
      control:   '¿Eliminar este control?',
      nota:      '¿Eliminar esta nota?',
    }
    if (!window.confirm(mensajes[tipo] || '¿Eliminar?')) return
    const tablas = { bloque: 'bloques', subbloque: 'subbloques', sesion: 'sesiones', comp: 'competiciones', control: 'controles', nota: 'sesion_notas' }
    await supabase.from(tablas[tipo]).delete().eq('id', id)
    if (!tipoArg) closeModal()
    cargarPlanificacion()
  }

  function copiarEnlace() {
    if (!planificacion?.token_publico) return
    navigator.clipboard.writeText(`${window.location.origin}/plan/${planificacion.token_publico}`)
    alert(`Enlace copiado:\n${window.location.origin}/plan/${planificacion.token_publico}`)
  }

  const esSalud = planificacion?.tipo === 'salud'

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS DE MODAL: TÍTULOS Y FORMULARIO
  // ─────────────────────────────────────────────────────────────────────────

  function getTituloModal() {
    const esEditar = !!modalItem?.id || (modalTipo === 'semana' && !!modalItem?.semanaData?.id)
    return {
      plan_nuevo:  'Nueva planificación',
      plan_editar: 'Editar planificación',
      bloque:      esEditar ? 'Editar bloque'              : 'Nuevo bloque',
      subbloque:   esEditar ? 'Editar sub bloque'          : 'Nuevo sub bloque',
      semana:      (() => {
        const b   = modalItem?.bloque
        const num = modalItem?.numero
        if (b && num) {
          const fi = format(calcFechaInicioSemana(b, num), 'dd MMM', { locale: es })
          const ff = format(calcFechaFinSemana(b, num), 'dd MMM', { locale: es })
          return `Semana ${num} · ${fi} – ${ff}`
        }
        return `Semana ${num || ''}`
      })(),
      sesion:      esEditar ? 'Editar sesión'              : 'Nueva sesión',
      comp:        esEditar ? 'Editar competición'         : 'Nueva competición',
      control:     esEditar ? 'Editar control / valoración' : 'Nuevo control / valoración',
      nota:        esEditar ? 'Editar nota'                : 'Nueva nota',
    }[modalTipo] || ''
  }

  function getTituloCrear() {
    return { plan_nuevo: 'Crear planificación', bloque: 'Crear bloque', subbloque: 'Crear sub bloque', semana: 'Guardar semana', sesion: 'Añadir sesión', comp: 'Añadir competición', control: 'Añadir control', nota: 'Añadir nota' }[modalTipo] || 'Guardar'
  }

  function renderFormulario() {
    const perfil = clienteData?.perfil_planificacion

    switch (modalTipo) {

      // ── PLAN ──────────────────────────────────────────────────────────────
      case 'plan_nuevo':
      case 'plan_editar':
        return (
          <div style={{ padding: '0 20px 4px' }}>
            {modalTipo === 'plan_nuevo' && (
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={formData.cliente_id || ''} onChange={e => fd('cliente_id', e.target.value)}>
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
            {(modalTipo === 'plan_nuevo' || modalTipo === 'plan_editar') && (
              <div className="form-group">
                <label className="form-label">Tipo de planificación</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  {[
                    { val: 'deportiva', label: 'Deportiva / Competición', desc: 'Bloques · Sub-bloques · Semanas · Sesiones con zonas' },
                    { val: 'salud',     label: 'Salud / Progresión',      desc: 'Bloques · Semanas · Sin sub-bloques' },
                  ].map(({ val, label, desc }) => {
                    const active = (formData.tipo || 'deportiva') === val
                    return (
                      <button key={val} onClick={() => fd('tipo', val)}
                        style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', textAlign: 'left', transition: 'border 0.15s' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formData.nombre || ''} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Temporada 2025-2026" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={formData.fecha_inicio || ''} onChange={e => fd('fecha_inicio', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha fin *</label>
                <input className="form-input" type="date" value={formData.fecha_fin || ''} onChange={e => fd('fecha_fin', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={formData.notas || ''} onChange={e => fd('notas', e.target.value)} />
            </div>
          </div>
        )

      // ── BLOQUE ────────────────────────────────────────────────────────────
      case 'bloque':
        return (
          <div style={{ padding: '0 20px 4px' }}>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formData.nombre || ''} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Base aeróbica" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COLORES.map(c => (
                  <div key={c} onClick={() => fd('color', c)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: formData.color === c ? '3px solid var(--text)' : '3px solid transparent', transition: 'border 0.15s' }} />
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={formData.fecha_inicio || ''} onChange={e => fd('fecha_inicio', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Semanas *</label>
                <input className="form-input" type="number" min="1" max="52" value={formData.semanas || 4} onChange={e => fd('semanas', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <textarea className="form-textarea" value={formData.objetivo || ''} onChange={e => fd('objetivo', e.target.value)} placeholder="Ej: Desarrollar base aeróbica" />
            </div>
            {esSalud && (() => {
              const prioridadB   = formData.enfoque_prioridad || {}
              const totalPuntosB = Object.values(prioridadB).reduce((s, v) => s + v, 0)
              return (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Sesiones/sem mín</label>
                      <input className="form-input" type="number" min="1" max="7" value={formData.sesiones_min || ''} onChange={e => fd('sesiones_min', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sesiones/sem máx</label>
                      <input className="form-input" type="number" min="1" max="7" value={formData.sesiones_max || ''} onChange={e => fd('sesiones_max', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duración media (min)</label>
                    <input className="form-input" type="number" min="1" value={formData.duracion_media_min || ''} onChange={e => fd('duracion_media_min', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Exigencia</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['Baja', '#10b981'], ['Moderada', '#f59e0b'], ['Alta', '#ef4444']].map(([op, col]) => {
                        const active = formData.exigencia === op
                        return (
                          <button key={op} onClick={() => fd('exigencia', active ? '' : op)}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${active ? col : 'var(--border)'}`, background: active ? col + '20' : 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? col : 'var(--text2)' }}>
                            {op}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enfoque / Contenidos</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      {ENFOQUES.map(op => {
                        const puntos = prioridadB[op] || 0
                        const pct    = totalPuntosB > 0 ? Math.round((puntos / totalPuntosB) * 100) : 0
                        return (
                          <div key={op} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: puntos > 0 ? 'var(--text)' : 'var(--text3)', fontWeight: puntos > 0 ? 500 : 400, minWidth: 170, flexShrink: 0 }}>{op}</span>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => {
                                  const np = { ...(formData.enfoque_prioridad || {}), [op]: n }
                                  if (n === 0) delete np[op]
                                  setFormData(f => ({ ...f, enfoque_prioridad: np, enfoque: Object.entries(np).filter(([, v]) => v > 0).map(([k]) => k) }))
                                }} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${puntos >= n && n > 0 ? 'var(--accent)' : 'var(--border)'}`, background: puntos >= n && n > 0 ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: puntos >= n && n > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                                  {n === 0 ? '✕' : n}
                                </button>
                              ))}
                            </div>
                            {puntos > 0 && (
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600, minWidth: 30 }}>{pct}%</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {totalPuntosB > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                          {Object.entries(prioridadB).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / totalPuntosB) * 100)}%`).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
            {modalItem?.id && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={eliminarItem}>Eliminar bloque</button>
              </div>
            )}
          </div>
        )

      // ── SUB BLOQUE ────────────────────────────────────────────────────────
      case 'subbloque': {
        const prioridad   = formData.enfoque_prioridad || {}
        const totalPuntos = Object.values(prioridad).reduce((s, v) => s + v, 0)
        return (
          <div style={{ padding: '0 20px 4px' }}>
            {bloques.length > 1 && (
              <div className="form-group">
                <label className="form-label">Bloque</label>
                <select className="form-select" value={formData.bloque_id || ''} onChange={e => fd('bloque_id', e.target.value)}>
                  {bloques.map((b, i) => <option key={b.id} value={b.id}>B{i + 1} {b.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formData.nombre || ''} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Adaptación" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Semana inicio *</label>
                <input className="form-input" type="number" min="1" value={formData.semana_inicio || 1} onChange={e => fd('semana_inicio', e.target.value)} />
                {(() => {
                  const b = bloques.find(x => x.id === formData.bloque_id)
                  if (!b || !formData.semana_inicio) return null
                  const f = calcFechaInicioSemana(b, parseInt(formData.semana_inicio))
                  return <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3, display: 'block' }}>{format(f, 'dd MMM yyyy', { locale: es })}</span>
                })()}
              </div>
              <div className="form-group">
                <label className="form-label">Semana fin *</label>
                <input className="form-input" type="number" min="1" value={formData.semana_fin || 1} onChange={e => fd('semana_fin', e.target.value)} />
                {(() => {
                  const b = bloques.find(x => x.id === formData.bloque_id)
                  if (!b || !formData.semana_fin) return null
                  const f = calcFechaFinSemana(b, parseInt(formData.semana_fin))
                  return <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3, display: 'block' }}>{format(f, 'dd MMM yyyy', { locale: es })}</span>
                })()}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivos / Contenidos</label>
              <textarea className="form-textarea" value={formData.notas || ''} onChange={e => fd('notas', e.target.value)} style={{ minHeight: 72 }} />
            </div>

            {perfil !== 'fuerza_salud' ? (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Km/sem mín</label>
                    <input className="form-input" type="number" min="0" value={formData.km_min || ''} onChange={e => fd('km_min', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Km/sem máx</label>
                    <input className="form-input" type="number" min="0" value={formData.km_max || ''} onChange={e => fd('km_max', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Distribución de zonas</label>
                  {[{ key: 'zona1_2', label: 'Z1-Z2', color: '#10b981' }, { key: 'zona3_4', label: 'Z3-Z4', color: '#f59e0b' }, { key: 'zona5', label: 'Z5+', color: '#ef4444' }].map(zona => (
                    <div key={zona.key} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: zona.color }}>{zona.label}</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600 }}>{formData[zona.key] || 0}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={formData[zona.key] || 0}
                        onChange={e => {
                          const val     = parseInt(e.target.value)
                          const otras   = ['zona1_2', 'zona3_4', 'zona5'].filter(k => k !== zona.key)
                          const totOtra = otras.reduce((s, k) => s + (formData[k] || 0), 0)
                          const resto   = 100 - val
                          if (resto < 0) return
                          const nuevas  = {}
                          if (totOtra === 0) otras.forEach(k => { nuevas[k] = Math.round(resto / otras.length) })
                          else otras.forEach(k => { nuevas[k] = Math.round((formData[k] / totOtra) * resto) })
                          setFormData(f => ({ ...f, [zona.key]: val, ...nuevas }))
                        }}
                        style={{ width: '100%', accentColor: zona.color }} />
                    </div>
                  ))}
                  {((formData.zona1_2 || 0) + (formData.zona3_4 || 0) + (formData.zona5 || 0)) > 0 && (
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 4 }}>
                      {(formData.zona1_2 || 0) > 0 && <div style={{ width: `${formData.zona1_2}%`, background: '#10b981' }} />}
                      {(formData.zona3_4 || 0) > 0 && <div style={{ width: `${formData.zona3_4}%`, background: '#f59e0b' }} />}
                      {(formData.zona5   || 0) > 0 && <div style={{ width: `${formData.zona5}%`,   background: '#ef4444' }} />}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sesiones/sem mín</label>
                    <input className="form-input" type="number" min="1" max="7" value={formData.sesiones_min || ''} onChange={e => fd('sesiones_min', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sesiones/sem máx</label>
                    <input className="form-input" type="number" min="1" max="7" value={formData.sesiones_max || ''} onChange={e => fd('sesiones_max', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Duración media (min)</label>
                  <input className="form-input" type="number" min="1" value={formData.duracion_media_min || ''} onChange={e => fd('duracion_media_min', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Exigencia</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['Baja', '#10b981'], ['Moderada', '#f59e0b'], ['Alta', '#ef4444']].map(([op, col]) => {
                      const active = formData.exigencia === op
                      return (
                        <button key={op} onClick={() => fd('exigencia', active ? '' : op)}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${active ? col : 'var(--border)'}`, background: active ? col + '20' : 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? col : 'var(--text2)' }}>
                          {op}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Enfoque / Contenidos</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {ENFOQUES.map(op => {
                      const puntos = prioridad[op] || 0
                      const pct    = totalPuntos > 0 ? Math.round((puntos / totalPuntos) * 100) : 0
                      return (
                        <div key={op} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: puntos > 0 ? 'var(--text)' : 'var(--text3)', fontWeight: puntos > 0 ? 500 : 400, minWidth: 170, flexShrink: 0 }}>{op}</span>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[0, 1, 2, 3, 4, 5].map(n => (
                              <button key={n} onClick={() => {
                                const np = { ...(formData.enfoque_prioridad || {}), [op]: n }
                                if (n === 0) delete np[op]
                                setFormData(f => ({ ...f, enfoque_prioridad: np, enfoque: Object.entries(np).filter(([, v]) => v > 0).map(([k]) => k) }))
                              }} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${puntos >= n && n > 0 ? 'var(--accent)' : 'var(--border)'}`, background: puntos >= n && n > 0 ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: puntos >= n && n > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                                {n === 0 ? '✕' : n}
                              </button>
                            ))}
                          </div>
                          {puntos > 0 && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600, minWidth: 30 }}>{pct}%</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {totalPuntos > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                        {Object.entries(prioridad).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / totalPuntos) * 100)}%`).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {modalItem?.id && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={eliminarItem}>Eliminar sub bloque</button>
              </div>
            )}
          </div>
        )
      }

      // ── SEMANA ────────────────────────────────────────────────────────────
      case 'semana': {
        const tokenSemana = modalItem?.semanaData?.token_publico
        return (
          <div style={{ padding: '0 20px 4px' }}>
            <div className="form-group">
              <label className="form-label">Objetivo de la semana</label>
              <input className="form-input" value={formData.objetivo || ''} onChange={e => fd('objetivo', e.target.value)} placeholder="Ej: Aumentar volumen" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Carga</label>
              <select className="form-select" value={formData.carga || 'media'} onChange={e => fd('carga', e.target.value)}>
                {Object.entries(CARGAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nota para el cliente</label>
              <textarea className="form-textarea" value={formData.nota_cliente || ''} onChange={e => fd('nota_cliente', e.target.value)} placeholder="Mensaje que verá el cliente en su vista semanal..." style={{ minHeight: 70 }} />
            </div>

            {!esSalud && perfil !== 'fuerza_salud' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Km objetivo</label>
                    <input className="form-input" type="number" min="0" value={formData.km_objetivo || ''} onChange={e => fd('km_objetivo', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Km real</label>
                    <input className="form-input" type="number" min="0" value={formData.km_real || ''} onChange={e => fd('km_real', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Zonas reales (min)</label>
                  {[
                    { key: 'zona1_2_real', label: 'Z1-Z2', color: '#10b981' },
                    { key: 'zona3_4_real', label: 'Z3-Z4', color: '#f59e0b' },
                    { key: 'zona5_real',   label: 'Z5+',   color: '#ef4444' },
                  ].map(zona => {
                    const total = (parseInt(formData.zona1_2_real) || 0) + (parseInt(formData.zona3_4_real) || 0) + (parseInt(formData.zona5_real) || 0)
                    const pct   = total > 0 ? Math.round(((parseInt(formData[zona.key]) || 0) / total) * 100) : 0
                    return (
                      <div key={zona.key} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: zona.color }}>{zona.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {total > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: zona.color }}>{pct}%</span>}
                            <input type="number" min="0" max="600" value={formData[zona.key] || 0} onChange={e => fd(zona.key, parseInt(e.target.value) || 0)} style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'right' }} />
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>min</span>
                          </div>
                        </div>
                        {total > 0 && (
                          <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: zona.color, borderRadius: 3 }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <textarea className="form-textarea" value={formData.notas || ''} onChange={e => fd('notas', e.target.value)} placeholder="Solo visible para ti..." style={{ minHeight: 70 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Comentario post-semana</label>
              <textarea className="form-textarea" value={formData.comentario || ''} onChange={e => fd('comentario', e.target.value)} style={{ minHeight: 56 }} />
            </div>

            {tokenSemana && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const url = `${window.location.origin}/semana/${tokenSemana}`
                  navigator.clipboard.writeText(url)
                  alert(`Enlace copiado:\n${url}`)
                }}>🔗 Copiar enlace semana</button>
              </div>
            )}
          </div>
        )
      }

      // ── SESIÓN ────────────────────────────────────────────────────────────
      case 'sesion':
        return (
          <div style={{ padding: '0 20px 4px' }}>
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" value={formData.titulo || ''} onChange={e => fd('titulo', e.target.value)} placeholder="Ej: Fuerza tren superior" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input className="form-input" type="date" value={formData.fecha || ''} onChange={e => fd('fecha', e.target.value)}
                  disabled={!!formData.sinFecha} style={{ flex: 1, opacity: formData.sinFecha ? 0.4 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={!!formData.sinFecha} onChange={e => {
                    const checked = e.target.checked
                    setFormData(f => ({
                      ...f,
                      sinFecha:    checked,
                      fecha:       checked ? '' : f.fecha,
                      tipo_sesion: checked
                        ? (f.tipo_sesion === 'programada' ? 'flexible' : f.tipo_sesion)
                        : (f.tipo_sesion === 'flexible'   ? 'programada' : f.tipo_sesion),
                    }))
                  }} />
                  Sin fecha asignada
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de sesión</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(formData.sinFecha
                  ? [['flexible', '🔄 Flexible'], ['opcional', '⭐ Opcional']]
                  : [['programada', '📅 Programada'], ['opcional', '⭐ Opcional']]
                ).map(([val, label]) => {
                  const active = (formData.tipo_sesion || 'programada') === val
                  return (
                    <button key={val} onClick={() => fd('tipo_sesion', val)}
                      style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text2)' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            {modalItem?.id && (
              <div className="form-group">
                <label className="form-label">Estado</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[['pendiente','Pendiente','#f3f4f6','#6b7280','#d1d5db'],['completada','✓ Completada','#dcfce7','#166534','#16a34a'],['parcial','〜 Parcial','#fef9c3','#713f12','#ca8a04'],['perdida','✗ No realizada','#fee2e2','#7f1d1d','#dc2626']].map(([val, label, bg, color, border]) => {
                    const active = (formData.estado || 'pendiente') === val
                    return (
                      <button key={val} onClick={() => fd('estado', val)}
                        style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? border : 'var(--border)'}`, background: active ? bg : 'var(--bg)', color: active ? color : 'var(--text3)', fontSize: 11, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <textarea className="form-textarea" value={formData.objetivo || ''} onChange={e => fd('objetivo', e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Duración (min)</label>
              <input className="form-input" type="number" min="1" value={formData.duracion_min || ''} onChange={e => fd('duracion_min', e.target.value)} style={{ maxWidth: 120 }} />
            </div>
            {(modalItem?.token_publico || modalItem?.id) && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {modalItem?.token_publico && (
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const url = `${window.location.origin}/sesion/${modalItem.token_publico}`
                    navigator.clipboard.writeText(url)
                    alert(`Enlace copiado:\n${url}`)
                  }}>🔗 Compartir sesión</button>
                )}
                {modalItem?.id && (
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={eliminarItem}>Eliminar sesión</button>
                )}
              </div>
            )}
          </div>
        )

      // ── COMPETICIÓN ───────────────────────────────────────────────────────
      case 'comp':
        return (
          <div style={{ padding: '0 20px 4px' }}>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formData.nombre || ''} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Media Maratón Barcelona" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={formData.fecha || ''} onChange={e => fd('fecha', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <input className="form-input" value={formData.tipo || ''} onChange={e => fd('tipo', e.target.value)} placeholder="Ej: Carrera, Hyrox..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <input className="form-input" value={formData.objetivo || ''} onChange={e => fd('objetivo', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={formData.notas || ''} onChange={e => fd('notas', e.target.value)} />
            </div>
            {modalItem?.id && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={eliminarItem}>Eliminar competición</button>
              </div>
            )}
          </div>
        )

      // ── CONTROL / VALORACIÓN ──────────────────────────────────────────────
      case 'control':
        return (
          <div style={{ padding: '0 20px 4px' }}>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formData.nombre || ''} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Test de fuerza..." autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={formData.fecha || ''} onChange={e => fd('fecha', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={formData.tipo || ''} onChange={e => fd('tipo', e.target.value)}>
                  <option value="">Sin categoría</option>
                  <option value="Fuerza">Fuerza</option>
                  <option value="Resistencia">Resistencia</option>
                  <option value="Movilidad">Movilidad</option>
                  <option value="Composición corporal">Composición corporal</option>
                  <option value="HRV · Recuperación">HRV · Recuperación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={formData.notas || ''} onChange={e => fd('notas', e.target.value)} placeholder="Protocolo, resultados, observaciones..." />
            </div>
            {modalItem?.id && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={eliminarItem}>Eliminar control</button>
              </div>
            )}
          </div>
        )

      // ── NOTA ──────────────────────────────────────────────────────────────
      case 'nota':
        return (
          <div style={{ padding: '0 20px 4px' }}>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={formData.fecha || ''} onChange={e => fd('fecha', e.target.value)} style={{ maxWidth: 180 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Nota *</label>
              <textarea className="form-textarea" value={formData.texto || ''} onChange={e => fd('texto', e.target.value)} style={{ minHeight: 100 }} autoFocus />
            </div>
            {modalItem?.id && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={eliminarItem}>Eliminar nota</button>
              </div>
            )}
          </div>
        )

      default: return null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CÁLCULOS DERIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  const totalSemanas = calcTotalSemanas(bloques)

  const todasLasSemanas = bloques.flatMap((b, bidx) =>
    Array.from({ length: b.semanas }, (_, i) => {
      const numLocal  = i + 1
      const numGlobal = calcOffsetSemanaGlobal(bloques, b.id, numLocal)
      const fi        = calcFechaInicioSemana(b, numLocal)
      const ff        = calcFechaFinSemana(b, numLocal)
      const hoy       = new Date()
      const esActual  = hoy >= fi && hoy < ff
      const semData   = (semanas[b.id] || []).find(s => s.numero === numLocal) || null
      return { bloque: b, bidx, numLocal, numGlobal, fi, ff, esActual, semData }
    })
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── CABECERA ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Planificación</h2>
          {planificacion && <p className="page-subtitle">{planificacion.nombre}</p>}
        </div>
        <div className="flex gap-2" style={{ position: 'relative' }}>
          {planificacion && <button className="btn btn-ghost btn-sm" onClick={copiarEnlace}>🔗 Compartir</button>}
          {planificacion && <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ Imprimir</button>}
          {planificacion && <button className="btn btn-ghost" onClick={() => openModal('plan_editar')}>Editar</button>}
          {planificacion && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={async () => {
              if (!window.confirm(`¿Eliminar la planificación "${planificacion.nombre}"?`)) return
              await supabase.from('planificaciones').delete().eq('id', planificacion.id)
              setPlanificacion(null); setBloques([]); setSemanas({}); setSubbloques({}); setCompeticiones([]); setSesiones([])
              cargarPlanificacion()
            }}><X size={13} /> Eliminar</button>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-primary" onClick={() => setMenuAnadir(v => !v)}>
              <Plus size={13} /> Añadir
            </button>
            {menuAnadir && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 200, minWidth: 200, overflow: 'hidden' }}
                onMouseLeave={() => setMenuAnadir(false)}>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px', fontSize: 13 }}
                  onClick={() => { setMenuAnadir(false); openModal('plan_nuevo') }}>
                  + Nueva planificación
                </button>
                {planificacion && (<>
                  {[
                    ['bloque',   '+ Bloque'],
                    ['sesion',   '+ Sesión'],
                    ['comp',     '🏆 Competición'],
                    ['control',  '🔬 Control / Valoración'],
                    ['nota',     '📝 Nota'],
                  ].map(([tipo, label]) => (
                    <button key={tipo} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px', fontSize: 13 }}
                      onClick={() => { setMenuAnadir(false); openModal(tipo) }}>
                      {label}
                    </button>
                  ))}
                  {bloques.length > 0 && (
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px', fontSize: 13 }}
                      onClick={() => { setMenuAnadir(false); openModal('subbloque', { bloque_id: bloques[0]?.id }) }}>
                      + Sub bloque
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px', fontSize: 13 }}
                    onClick={() => { setMenuAnadir(false); setFormCopiar({ cliente_id: '', fecha_inicio: planificacion.fecha_inicio, nombre: planificacion.nombre + ' (copia)' }); setModalCopiar(true) }}>
                    📋 Copiar planificación
                  </button>
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SELECTOR CLIENTE + PLAN + VISTAS ── */}
      <div className="flex gap-3 items-center" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-select" style={{ maxWidth: 260 }} value={clienteSeleccionado || ''}
          onChange={e => { setClienteSeleccionado(e.target.value || null); setPlanificacion(null); setBloques([]) }}>
          <option value="">Selecciona un cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {planificaciones.length > 1 && (
          <select className="form-select" style={{ maxWidth: 260 }} value={planificacion?.id || ''}
            onChange={e => { const p = planificaciones.find(x => x.id === e.target.value); setPlanificacion(p || null); setBloques([]); setSemanas({}); setSubbloques({}) }}>
            {planificaciones.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )}
        {planificacion && (
          <div className="flex gap-2">
            {[['timeline','Timeline'],['lista','Lista'],['calendario','Calendario'],['seguimiento','Seguimiento']].map(([v, label]) => (
              <button key={v} className="btn btn-ghost btn-sm"
                style={vista === v ? { background: 'var(--bg2)', fontWeight: 600 } : {}}
                onClick={() => setVista(v)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="empty"><p>Cargando...</p></div>}

      {!loading && clienteSeleccionado && !planificacion && (
        <div className="empty">
          <Calendar size={40} />
          <p>No hay planificación para este cliente.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openModal('plan_nuevo')}>
            <Plus size={13} /> Crear planificación
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  CONTENIDO PRINCIPAL                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!loading && planificacion && (
        <>
          {vista === 'calendario' && (
            <div>
              {sesiones.filter(s => !s.fecha).length > 0 && (
                <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Sesiones sin fecha asignada</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sesiones.filter(s => !s.fecha).map(s => (
                      <div key={s.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}
                        onClick={() => openModal('sesion', s)}>
                        💪 {s.titulo}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <CalendarioSesiones
                sesiones={sesiones}
                competiciones={competiciones}
                controles={controles}
                notas={notas}
                bloquesPlan={bloques}
                subbloquesPlan={subbloques}
                onAbrirSesion={s => openModal('sesion', s)}
                onNuevaSesion={fecha => openModal('sesion', { fecha })}
                onNuevaCompeticion={fecha => openModal('comp', { fecha })}
                onNuevaValoracion={fecha => openModal('control', { fecha })}
                onNuevaNota={fecha => openModal('nota', { fecha })}
                onEliminar={item => eliminarItem(item._tipo === 'sesion' ? 'sesion' : item._tipo === 'competicion' ? 'comp' : item._tipo === 'control' ? 'control' : 'nota', item.id)}
                onMoverSesion={async (item, fechaDestino) => {
                  const tabla = item._tipo === 'sesion' ? 'sesiones' : item._tipo === 'competicion' ? 'competiciones' : item._tipo === 'control' ? 'controles' : 'sesion_notas'
                  const campo = item._tipo === 'nota' ? 'fecha' : 'fecha'
                  await supabase.from(tabla).update({ [campo]: fechaDestino }).eq('id', item.id)
                  cargarPlanificacion()
                }}
                clipboard={clipboardSesion}
                onCopiar={setClipboardSesion}
                onPegar={async (item, fecha) => {
                  const tabla = item._tipo === 'sesion' ? 'sesiones' : item._tipo === 'competicion' ? 'competiciones' : item._tipo === 'control' ? 'controles' : 'sesion_notas'
                  const { id, created_at, token_publico, ...resto } = item
                  await supabase.from(tabla).insert({ ...resto, cliente_id: clienteSeleccionado, fecha })
                  cargarPlanificacion()
                }}
              />
            </div>
          )}
          {vista === 'seguimiento' && (
            <Seguimiento clienteId={clienteSeleccionado} planificacionId={planificacion?.id} bloques={bloques} semanas={semanas} subbloques={subbloques} clienteData={clienteData} />
          )}
          {vista === 'lista' && (
            <VistaLista bloques={bloques} subbloques={subbloques} semanas={semanas} sesiones={sesiones} clienteData={clienteData} esSalud={esSalud} openModal={openModal} setVista={setVista} eliminarItem={eliminarItem} cargarPlanificacion={cargarPlanificacion} />
          )}

          {/* ══ TIMELINE ══════════════════════════════════════════════════ */}
          {vista === 'timeline' && totalSemanas > 0 && (
            <div>
              {/* Pills de filtro */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[['bloques','Bloques'],['sub','Sub bloques'],['semanas','Semanas'],['sesiones','Sesiones'],['eventos','Comp. / Control']].map(([key, label]) => (
                  <button key={key} onClick={() => setFiltros(f => ({ ...f, [key]: !f[key] }))}
                    style={{ padding: '4px 13px', borderRadius: 20, border: `1.5px solid ${filtros[key] ? 'var(--accent)' : 'var(--border)'}`, background: filtros[key] ? 'var(--accent-light)' : 'var(--bg)', color: filtros[key] ? 'var(--accent)' : 'var(--text3)', fontSize: 12, fontWeight: filtros[key] ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Zoom:</span>
                <button onClick={() => setZoomTL(z => Math.max(11, z - 11))}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, lineHeight: 1, fontWeight: 700 }}>−</button>
                <button onClick={() => setZoomTL(44)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--mono)', minWidth: 48 }}>{Math.round(zoomTL / 44 * 100)}%</button>
                <button onClick={() => setZoomTL(z => Math.min(110, z + 11))}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, lineHeight: 1, fontWeight: 700 }}>+</button>
              </div>

              {/* Barra de progreso */}
              {(() => {
                const hoy   = new Date()
                const ini   = parseISO(planificacion.fecha_inicio)
                const fin   = parseISO(planificacion.fecha_fin)
                const total = (fin - ini) / (1000 * 60 * 60 * 24)
                const trans = Math.max(0, Math.min((hoy - ini) / (1000 * 60 * 60 * 24), total))
                const pct   = Math.round((trans / total) * 100)
                const semAc = Math.max(1, Math.min(Math.ceil(trans / 7), totalSemanas))
                if (hoy < ini || hoy > fin) return null
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{format(ini, 'dd MMM yyyy', { locale: es })}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>S{semAc} / {totalSemanas} — {pct}%</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{format(fin, 'dd MMM yyyy', { locale: es })}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })()}

              <div className="card" style={{ overflowX: 'auto', padding: '16px 14px' }}>
                <div style={{ minWidth: Math.max(totalSemanas * zoomTL, 400), position: 'relative' }}>

                  {/* FILA 1 — BLOQUES */}
                  {filtros.bloques && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Bloques</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {bloques.map((b, bidx) => {
                          const semIni = calcOffsetSemanaGlobal(bloques, b.id, 1)
                          const semFin = calcOffsetSemanaGlobal(bloques, b.id, b.semanas)
                          const fIni  = format(parseISO(b.fecha_inicio), 'dd MMM', { locale: es })
                          const fFin  = format(addWeeks(parseISO(b.fecha_inicio), b.semanas), 'dd MMM', { locale: es })
                          return (
                            <div key={b.id}
                              style={{ flex: b.semanas, background: b.color || '#2d6a4f', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
                              onClick={() => openModal('bloque', b)}
                              onMouseEnter={e => setTooltip({ visible: true, tipo: 'bloque', item: b, bidx, numSubs: (subbloques[b.id] || []).length, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>B{bidx + 1} {b.nombre}</div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--mono)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fIni} – {fFin}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* FILA 2 — SUB BLOQUES */}
                  {filtros.sub && !esSalud && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Sub bloques</div>
                      <div style={{ position: 'relative', height: 30 }}>
                        {bloques.map((b, bidx) => {
                          const subsDelBloque = subbloques[b.id] || []
                          const offsetB = bloques.slice(0, bidx).reduce((s, x) => s + x.semanas, 0)
                          return subsDelBloque.map((sub, subidx) => {
                            const left  = (offsetB + sub.semana_inicio - 1) / totalSemanas * 100
                            const width = (sub.semana_fin - sub.semana_inicio + 1) / totalSemanas * 100
                            return (
                              <div key={sub.id}
                                style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: 28, background: (b.color || '#2d6a4f') + '88', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', overflow: 'hidden', border: `1px solid ${b.color || '#2d6a4f'}55`, display: 'flex', alignItems: 'center' }}
                                onClick={() => openModal('subbloque', { ...sub, bloque_id: b.id })}
                                onMouseEnter={e => setTooltip({ visible: true, tipo: 'subbloque', item: sub, bloque: b, bidx, subidx, x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.nombre}</div>
                              </div>
                            )
                          })
                        })}
                      </div>
                    </div>
                  )}

                  {/* FILA 3 — EVENTOS */}
                  {filtros.eventos && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Eventos</div>
                      <div style={{ position: 'relative', height: 38 }}>
                        {competiciones.map(comp => {
                          const pct = Math.max(0, Math.min(differenceInWeeks(parseISO(comp.fecha), parseISO(planificacion.fecha_inicio)) / totalSemanas * 100, 96))
                          return (
                            <div key={comp.id}
                              style={{ position: 'absolute', left: `${pct}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', zIndex: 2 }}
                              onClick={() => openModal('comp', comp)}
                              onMouseEnter={e => setTooltip({ visible: true, tipo: 'comp', item: comp, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
                              <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 10, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ fontSize: 10 }}>🏆</span>
                                <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{comp.nombre}</span>
                              </div>
                              <div style={{ fontSize: 8, color: '#ef4444', fontFamily: 'var(--mono)', marginTop: 1 }}>{format(parseISO(comp.fecha), 'dd/MM', { locale: es })}</div>
                            </div>
                          )
                        })}
                        {controles.map(ctrl => {
                          const pct = Math.max(0, Math.min(differenceInWeeks(parseISO(ctrl.fecha), parseISO(planificacion.fecha_inicio)) / totalSemanas * 100, 96))
                          return (
                            <div key={ctrl.id}
                              style={{ position: 'absolute', left: `${pct}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', zIndex: 2 }}
                              onClick={() => openModal('control', ctrl)}
                              onMouseEnter={e => setTooltip({ visible: true, tipo: 'control', item: ctrl, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
                              <div style={{ background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 10, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ fontSize: 10 }}>🔬</span>
                                <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{ctrl.nombre}</span>
                              </div>
                              <div style={{ fontSize: 8, color: '#3b82f6', fontFamily: 'var(--mono)', marginTop: 1 }}>{format(parseISO(ctrl.fecha), 'dd/MM', { locale: es })}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* FILA 4 — SEMANAS */}
                  {filtros.semanas && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginBottom: 4 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Semanas</div>
                      <div style={{ display: 'flex' }}>
                        {todasLasSemanas.map(({ bloque: b, bidx, numLocal, numGlobal, fi, esActual, semData }) => {
                          const carga = semData?.carga ? CARGAS[semData.carga] : null
                          return (
                            <div key={`${b.id}-${numLocal}`}
                              style={{ flex: 1, textAlign: 'center', padding: '3px 1px', borderRight: '1px solid var(--border)', background: esActual ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', borderRadius: esActual ? 3 : 0, minWidth: 28 }}
                              onClick={() => openModal('semana', { bloque: b, numero: numLocal, semanaData: semData })}
                              onMouseEnter={e => setTooltip({ visible: true, tipo: 'semana', item: semData, bloque: b, numGlobal, numLocal, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
                              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: esActual ? 700 : 500, color: esActual ? 'var(--accent)' : (bidx % 2 === 0 ? 'var(--text2)' : 'var(--text3)') }}>{format(fi, 'd/M')}</div>
                              <div style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>S{numGlobal}</div>
                              {carga && <div style={{ width: 6, height: 3, background: carga.color, borderRadius: 2, margin: '2px auto 0' }} />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* FILA 5 — SESIONES */}
                  {filtros.sesiones && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: filtros.semanas ? 2 : 6 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Sesiones</div>
                      <div style={{ display: 'flex' }}>
                        {todasLasSemanas.map(({ bloque: b, numLocal, fi, ff }) => {
                          const sesionesSem = sesiones.filter(s => { if (!s.fecha) return false; const f = parseISO(s.fecha); return f >= fi && f < ff })
                          return (
                            <div key={`${b.id}-${numLocal}-ses`}
                              style={{ flex: 1, minWidth: 28, borderRight: '1px solid var(--border)', padding: '2px', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                              {sesionesSem.slice(0, 3).map(s => {
                                const est = iconoEstado(s)
                                return (
                                  <div key={s.id}
                                    onClick={() => openModal('sesion', s)}
                                    onMouseEnter={e => setTooltip({ visible: true, tipo: 'sesion', item: s, x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                                    style={{ width: 18, height: 18, borderRadius: '50%', background: est ? est.bg : (b.color || '#2d6a4f') + '22', border: est ? `1.5px solid ${est.border}` : s.tipo_sesion === 'flexible' ? `1.5px dashed ${b.color || '#2d6a4f'}` : `1.5px solid ${b.color || '#2d6a4f'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, cursor: 'pointer', color: est?.color }}
                                    title={s.titulo}>
                                    {est ? est.icono : iconoSesion(s)}
                                  </div>
                                )
                              })}
                              {sesionesSem.length > 3 && <div style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>+{sesionesSem.length - 3}</div>}
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2d6a4f22', border: '1.5px solid #2d6a4f' }} /><span style={{ fontSize: 10, color: 'var(--text3)' }}>Programada</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2d6a4f22', border: '1.5px dashed #2d6a4f' }} /><span style={{ fontSize: 10, color: 'var(--text3)' }}>Flexible</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#6b728022', border: '1.5px solid #6b7280' }} /><span style={{ fontSize: 10, color: 'var(--text3)' }}>Opcional</span></div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {vista === 'timeline' && totalSemanas === 0 && (
            <div className="empty">
              <Layers size={40} />
              <p>Añade bloques para ver el timeline.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openModal('bloque')}><Plus size={13} /> Añadir bloque</button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TOOLTIP GLOBAL                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tooltip.visible && (
        <div style={{ position: 'fixed', top: tooltip.y + 14, left: Math.min(tooltip.x + 14, window.innerWidth - 300), background: 'var(--bg, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', zIndex: 1000, minWidth: 200, maxWidth: 280, pointerEvents: 'none', fontSize: 12, lineHeight: 1.5 }}>
          {tooltip.tipo === 'bloque' && tooltip.item && (() => {
            const b     = tooltip.item
            const nSubs = tooltip.numSubs || (subbloques[b.id] || []).length
            const fIni  = format(parseISO(b.fecha_inicio), "dd 'de' MMMM yyyy", { locale: es })
            const fFin  = format(addWeeks(parseISO(b.fecha_inicio), b.semanas), "dd 'de' MMMM yyyy", { locale: es })
            return (<>
              <div style={{ fontWeight: 700, color: b.color || 'var(--accent)', marginBottom: 6 }}>B{(tooltip.bidx ?? 0) + 1} {b.nombre}</div>
              <div style={{ color: 'var(--text2)', marginBottom: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>{fIni} – {fFin}</div>
              <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{b.semanas} sem · {nSubs} sub bloque{nSubs !== 1 ? 's' : ''}</div>
              {b.objetivo && <div style={{ color: 'var(--text2)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>{b.objetivo.slice(0, 120)}{b.objetivo.length > 120 ? '…' : ''}</div>}
            </>)
          })()}
          {tooltip.tipo === 'subbloque' && tooltip.item && (() => {
            const sub  = tooltip.item
            const b    = tooltip.bloque
            const fIni = b ? format(calcFechaInicioSemana(b, sub.semana_inicio), 'dd MMM', { locale: es }) : ''
            const fFin = b ? format(calcFechaFinSemana(b, sub.semana_fin), 'dd MMM yyyy', { locale: es }) : ''
            return (<>
              <div style={{ fontWeight: 700, color: b?.color || 'var(--accent)', marginBottom: 6 }}>SB{(tooltip.bidx ?? 0) + 1}.{(tooltip.subidx ?? 0) + 1} {sub.nombre}</div>
              <div style={{ color: 'var(--text2)', marginBottom: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>{fIni} – {fFin}</div>
              {(sub.km_min || sub.km_max) && <div style={{ color: 'var(--text3)' }}>Volumen: {sub.km_min}{sub.km_max ? `–${sub.km_max}` : '+'} km/sem</div>}
              {sub.exigencia && <div style={{ color: 'var(--text3)' }}>Exigencia: {sub.exigencia}</div>}
              {sub.notas && <div style={{ color: 'var(--text2)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>{sub.notas.slice(0, 100)}{sub.notas.length > 100 ? '…' : ''}</div>}
            </>)
          })()}
          {tooltip.tipo === 'semana' && (() => {
            const sem   = tooltip.item
            const b     = tooltip.bloque
            const carga = sem?.carga ? CARGAS[sem.carga] : null
            const fIni  = b ? format(calcFechaInicioSemana(b, tooltip.numLocal), 'dd MMM', { locale: es }) : ''
            return (<>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>S{tooltip.numGlobal} · {fIni}</div>
              {sem?.objetivo ? <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{sem.objetivo}</div> : <div style={{ color: 'var(--text3)', fontStyle: 'italic', marginBottom: 4 }}>Sin objetivo</div>}
              {carga && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: carga.color + '20', color: carga.color, fontWeight: 600 }}>{carga.label}</span></div>}
              {sem?.km_objetivo && <div style={{ color: 'var(--text3)' }}>Obj: {sem.km_objetivo} km{sem?.km_real ? ` · Real: ${sem.km_real} km` : ''}</div>}
            </>)
          })()}
          {tooltip.tipo === 'sesion' && tooltip.item && (() => {
            const s = tooltip.item
            return (<>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{iconoSesion(s)} {s.titulo}</div>
              <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{s.fecha ? format(parseISO(s.fecha), 'dd MMM yyyy', { locale: es }) : 'Sin fecha asignada'}</div>
              <div style={{ color: 'var(--text3)', marginBottom: 3, textTransform: 'capitalize' }}>{s.tipo_sesion || 'programada'}</div>
              {s.duracion_min && <div style={{ color: 'var(--text3)' }}>{s.duracion_min} min</div>}
              {s.objetivo && <div style={{ color: 'var(--text2)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>{s.objetivo.slice(0, 100)}</div>}
            </>)
          })()}
          {tooltip.tipo === 'comp' && tooltip.item && (() => {
            const c = tooltip.item
            return (<>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🏆 {c.nombre}</div>
              <div style={{ color: 'var(--text2)', marginBottom: 3 }}>{format(parseISO(c.fecha), "dd 'de' MMMM yyyy", { locale: es })}</div>
              {c.tipo && <div style={{ color: 'var(--text3)' }}>{c.tipo}</div>}
              {c.objetivo && <div style={{ color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>{c.objetivo}</div>}
            </>)
          })()}
          {tooltip.tipo === 'control' && tooltip.item && (() => {
            const c = tooltip.item
            return (<>
              <div style={{ fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>🔬 {c.nombre}</div>
              <div style={{ color: 'var(--text2)', marginBottom: 3 }}>{format(parseISO(c.fecha), "dd 'de' MMMM yyyy", { locale: es })}</div>
              {c.tipo && <div style={{ color: 'var(--text3)' }}>{c.tipo}</div>}
            </>)
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  MODAL UNIFICADO                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {modalTipo && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{getTituloModal()}</span>
              <button className="btn btn-ghost btn-sm" onClick={closeModal}><X size={14} /></button>
            </div>
            {renderFormulario()}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarModal} disabled={saving}>
                {saving ? 'Guardando...' : (modalItem?.id || modalItem?.semanaData?.id) ? 'Guardar cambios' : getTituloCrear()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COPIAR PLANIFICACIÓN ────────────────────────────────── */}
      {modalCopiar && (
        <div className="modal-backdrop" onClick={() => setModalCopiar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Copiar planificación</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCopiar(false)}><X size={14} /></button>
            </div>
            <div style={{ padding: '0 20px 4px' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius)' }}>
                Copiando: <strong>{planificacion?.nombre}</strong><br />
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Se copiarán bloques y sub bloques. Los datos reales no se copian.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Cliente destino *</label>
                <select className="form-select" value={formCopiar.cliente_id} onChange={e => setFormCopiar(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={formCopiar.nombre} onChange={e => setFormCopiar(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva fecha de inicio *</label>
                <input className="form-input" type="date" value={formCopiar.fecha_inicio} onChange={e => setFormCopiar(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCopiar(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !formCopiar.cliente_id || !formCopiar.fecha_inicio || !formCopiar.nombre}
                onClick={async () => {
                  setSaving(true)
                  try {
                    const offsetDias = (new Date(formCopiar.fecha_inicio) - new Date(planificacion.fecha_inicio)) / (1000 * 60 * 60 * 24)
                    const nuevaFin   = new Date(planificacion.fecha_fin); nuevaFin.setDate(nuevaFin.getDate() + offsetDias)
                    const { data: nuevaPlan } = await supabase.from('planificaciones').insert({ cliente_id: formCopiar.cliente_id, nombre: formCopiar.nombre, fecha_inicio: formCopiar.fecha_inicio, fecha_fin: nuevaFin.toISOString().split('T')[0], notas: planificacion.notas || null }).select().single()
                    for (const b of bloques) {
                      const nfb = new Date(b.fecha_inicio); nfb.setDate(nfb.getDate() + offsetDias)
                      const { data: nb } = await supabase.from('bloques').insert({ planificacion_id: nuevaPlan.id, nombre: b.nombre, fase: b.fase, carga: b.carga, semanas: b.semanas, fecha_inicio: nfb.toISOString().split('T')[0], objetivo: b.objetivo || null, contenidos: b.contenidos || null, color: b.color || '#2d6a4f', orden: b.orden }).select().single()
                      for (const s of (subbloques[b.id] || [])) await supabase.from('subbloques').insert({ bloque_id: nb.id, nombre: s.nombre, semana_inicio: s.semana_inicio, semana_fin: s.semana_fin, objetivo: s.objetivo || null, notas: s.notas || null, zona1_2: s.zona1_2 || 0, zona3_4: s.zona3_4 || 0, zona5: s.zona5 || 0, km_min: s.km_min || null, km_max: s.km_max || null })
                    }
                    setModalCopiar(false); alert('Planificación copiada.'); setClienteSeleccionado(formCopiar.cliente_id)
                  } catch { alert('Error al copiar.') } finally { setSaving(false) }
                }}>
                {saving ? 'Copiando...' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── VISTA LISTA ─────────────────────────────────────────────────────────────

function VistaLista({ bloques, subbloques, semanas, sesiones, clienteData, esSalud, openModal, setVista, eliminarItem, cargarPlanificacion }) {
  const [editMode,         setEditMode]         = useState(false)
  const [bloqueAbierto,    setBloqueAbierto]    = useState(new Set())
  const [subBloqueAbierto, setSubBloqueAbierto] = useState(new Set())
  const [semanaAbierta,    setSemanaAbierta]    = useState(new Set())
  const [inlineEdits,      setInlineEdits]      = useState({})

  function toggleBloque(id) {
    setBloqueAbierto(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSubBloque(id) {
    setSubBloqueAbierto(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSemana(key) {
    setSemanaAbierta(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  function handleInlineChange(tipo, id, campo, valor) {
    setInlineEdits(prev => ({ ...prev, [`${tipo}-${id}-${campo}`]: valor }))
  }
  function getInlineValue(tipo, id, campo, fallback) {
    const key = `${tipo}-${id}-${campo}`
    return inlineEdits[key] !== undefined ? inlineEdits[key] : (fallback ?? '')
  }
  async function handleInlineBlur(tipo, id, campo, valor) {
    if (tipo === 'bloque')    await supabase.from('bloques').update({ [campo]: valor || null }).eq('id', id)
    if (tipo === 'subbloque') await supabase.from('subbloques').update({ [campo]: valor || null }).eq('id', id)
    if (tipo === 'semana')    await supabase.from('semanas').update({ [campo]: valor || null }).eq('id', id)
    cargarPlanificacion()
  }

  const esResistencia = !esSalud && clienteData?.perfil_planificacion !== 'fuerza_salud'

  if (bloques.length === 0) {
    return (
      <div className="empty">
        <Layers size={40} />
        <p>Sin bloques. Añade el primero con el botón "Añadir".</p>
      </div>
    )
  }

  return (
    <div>
      {/* Barra superior */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={() => { setEditMode(!editMode); setInlineEdits({}) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${editMode ? 'var(--accent)' : 'var(--border)'}`, background: editMode ? 'var(--accent-light)' : 'var(--bg)', color: editMode ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: editMode ? 600 : 400, transition: 'all 0.15s' }}>
          {editMode ? <><Lock size={13} /> Bloquear edición</> : <><Pencil size={13} /> Modo edición</>}
        </button>
      </div>

      {/* ACORDEÓN */}
      {bloques.map((b, bidx) => {
        const subsDelBloque = (subbloques[b.id] || []).slice().sort((a, x) => a.semana_inicio - x.semana_inicio)
        const semsDelBloque = semanas[b.id] || []
        const bAb = bloqueAbierto.has(b.id)
        const fFin = addWeeks(parseISO(b.fecha_inicio), b.semanas)

        return (
          <div key={b.id} style={{ border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}`, marginBottom: 8 }}>

            {/* ── NIVEL 1: BLOQUE ────────────────────────────────────── */}
            <div onClick={() => toggleBloque(b.id)}
              style={{ padding: '10px 16px', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              {bAb ? <ChevronDown size={15} /> : <ChevronRight size={15} />}

              {!editMode ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{b.nombre}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {b.semanas} sem · {format(parseISO(b.fecha_inicio), 'd MMM yyyy', { locale: es })} – {format(fFin, 'd MMM yyyy', { locale: es })}
                  </span>
                </div>
              ) : (
                <input
                  value={getInlineValue('bloque', b.id, 'nombre', b.nombre)}
                  onChange={e => { e.stopPropagation(); handleInlineChange('bloque', b.id, 'nombre', e.target.value) }}
                  onBlur={e => handleInlineBlur('bloque', b.id, 'nombre', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, fontSize: 13, fontWeight: 500, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-light)', outline: 'none', minWidth: 0 }}
                />
              )}

              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={() => openModal('bloque', b)}>Editar</button>
                {!esSalud && <button className="btn btn-ghost btn-sm" onClick={() => openModal('subbloque', { bloque_id: b.id, semana_inicio: 1, semana_fin: 1 })}>+ Sub bloque</button>}
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px 6px' }} onClick={() => eliminarItem('bloque', b.id)}><X size={13} /></button>
              </div>
            </div>

            {/* ── CONTENIDO DEL BLOQUE ───────────────────────────────── */}
            {bAb && (
              <div style={{ borderTop: '0.5px solid var(--border)' }}>

                {/* SALUD: semanas directamente bajo el bloque */}
                {esSalud && (() => {
                  const allNums = Array.from({ length: b.semanas }, (_, i) => i + 1)
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '44px 96px 1fr 58px 36px', padding: '6px 16px', background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', gap: 8 }}>
                        {['Sem', 'Semana', 'Objetivo', 'Carga', ''].map((h, i) => (
                          <span key={i} style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                        ))}
                      </div>
                      {allNums.map(numSem => {
                        const semKey  = `${b.id}-${numSem}`
                        const semData = semsDelBloque.find(s => s.numero === numSem) || null
                        const fIniSem = calcFechaInicioSemana(b, numSem)
                        const fFinSem = calcFechaFinSemana(b, numSem)
                        const fechaStr = `${format(fIniSem, 'd', { locale: es })}–${format(addDays(fIniSem, 6), 'd MMM', { locale: es })}`
                        const carga   = semData?.carga ? CARGAS[semData.carga] : CARGAS.media
                        const hoy     = new Date()
                        const esActual = hoy >= fIniSem && hoy < fFinSem
                        const semAb   = semanaAbierta.has(semKey)
                        const sesionesSem = sesiones.filter(s => {
                          if (!s.fecha) return false
                          const f = parseISO(s.fecha)
                          return f >= fIniSem && f < fFinSem
                        })
                        return (
                          <div key={semKey}>
                            <div onClick={() => toggleSemana(semKey)}
                              style={{ display: 'grid', gridTemplateColumns: '44px 96px 1fr 58px 36px', padding: '8px 16px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', gap: 8, alignItems: 'center', background: esActual ? 'var(--accent-light)' : editMode ? 'var(--bg2)' : 'var(--bg)' }}
                              onMouseOver={e => { if (!esActual) e.currentTarget.style.background = 'var(--bg2)' }}
                              onMouseOut={e => { if (!esActual) e.currentTarget.style.background = esActual ? 'var(--accent-light)' : editMode ? 'var(--bg2)' : 'var(--bg)' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', color: esActual ? 'var(--accent)' : 'var(--text2)' }}>S{numSem}</span>
                              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fechaStr}</span>
                              {!editMode ? (
                                <span style={{ fontSize: 12, color: semData?.objetivo ? 'var(--text)' : 'var(--text3)', fontStyle: semData?.objetivo ? 'normal' : 'italic' }}>{semData?.objetivo || 'Sin objetivo'}</span>
                              ) : (
                                <input
                                  value={getInlineValue('semana', semData?.id || semKey, 'objetivo', semData?.objetivo || '')}
                                  onChange={e => { e.stopPropagation(); handleInlineChange('semana', semData?.id || semKey, 'objetivo', e.target.value) }}
                                  onBlur={async e => { e.stopPropagation(); const val = e.target.value; if (semData?.id) { await supabase.from('semanas').update({ objetivo: val || null }).eq('id', semData.id) } else { await supabase.from('semanas').insert({ bloque_id: b.id, numero: numSem, objetivo: val || null, carga: 'media' }) }; cargarPlanificacion() }}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="Añadir objetivo..."
                                  style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-light)', outline: 'none', width: '100%' }}
                                />
                              )}
                              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: carga.color + '20', color: carga.color, width: 'fit-content' }}>{carga.label}</span>
                              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={e => { e.stopPropagation(); openModal('semana', { bloque_id: b.id, semanaData: semData, numeroSemana: numSem }) }}><Pencil size={11} /></button>
                            </div>
                            {semAb && sesionesSem.length > 0 && (
                              <div style={{ padding: '8px 16px 8px 24px', background: 'var(--bg2)', borderBottom: '0.5px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {sesionesSem.map(s => (
                                  <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => { openModal('sesion', s); setVista('calendario') }}
                                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                    {s.titulo || 'Sesión'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )
                })()}

                {!esSalud && subsDelBloque.length === 0 && (
                  <div style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                    Sin sub bloques — añade el primero con "+ Sub bloque".
                  </div>
                )}

                {!esSalud && subsDelBloque.map((sub, subidx) => {
                  const sAb     = subBloqueAbierto.has(sub.id)
                  const fIniSub = calcFechaInicioSemana(b, sub.semana_inicio)
                  const fFinSub = calcFechaFinSemana(b, sub.semana_fin)
                  const semsDelSub = Array.from({ length: sub.semana_fin - sub.semana_inicio + 1 }, (_, i) => sub.semana_inicio + i)

                  return (
                    <div key={sub.id} style={{ borderBottom: '0.5px solid var(--border)' }}>

                      {/* ── NIVEL 2: SUB BLOQUE ──────────────────────── */}
                      <div onClick={() => toggleSubBloque(sub.id)}
                        style={{ padding: '9px 16px 9px 28px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        {sAb ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0 }} />

                        {!editMode ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{bidx + 1}.{subidx + 1} · {sub.nombre}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                              {format(fIniSub, 'd MMM', { locale: es })} – {format(fFinSub, 'd MMM', { locale: es })}
                            </span>
                            {esResistencia && (sub.km_min || sub.km_max) && (
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text2)' }}>
                                {sub.km_min ?? '?'}–{sub.km_max ?? '?'} km/sem
                              </span>
                            )}
                            {!esResistencia && sub.exigencia && (
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8,
                                background: sub.exigencia === 'Baja' ? '#10b98120' : sub.exigencia === 'Moderada' ? '#f59e0b20' : '#ef444420',
                                color:      sub.exigencia === 'Baja' ? '#10b981'   : sub.exigencia === 'Moderada' ? '#f59e0b'   : '#ef4444' }}>
                                {sub.exigencia}
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            value={getInlineValue('subbloque', sub.id, 'nombre', sub.nombre)}
                            onChange={e => { e.stopPropagation(); handleInlineChange('subbloque', sub.id, 'nombre', e.target.value) }}
                            onBlur={e => handleInlineBlur('subbloque', sub.id, 'nombre', e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-light)', outline: 'none', minWidth: 0 }}
                          />
                        )}

                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openModal('subbloque', { ...sub, bloque_id: b.id })}>Editar</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px 6px' }} onClick={() => eliminarItem('subbloque', sub.id)}><X size={12} /></button>
                        </div>
                      </div>

                      {/* ── CONTENIDO DEL SUB BLOQUE ─────────────────── */}
                      {sAb && (
                        <div style={{ borderTop: '0.5px solid var(--border)' }}>

                          {/* Cabecera de tabla de semanas */}
                          <div style={{ display: 'grid', gridTemplateColumns: esResistencia ? '44px 96px 1fr 58px 68px 160px 28px 36px' : '52px 110px 1fr 76px 36px', padding: '6px 16px 6px 44px', background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', gap: 8 }}>
                            {(esResistencia
                              ? ['Sem', 'Semana', 'Objetivo', 'Carga', 'Km', 'Zonas (obj→real)', '', '']
                              : ['Sem', 'Semana', 'Objetivo', 'Carga', '']
                            ).map((h, i) => (
                              <span key={i} style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                            ))}
                          </div>

                          {/* ── NIVEL 3: SEMANAS ───────────────────────── */}
                          {semsDelSub.map(numSem => {
                            const semKey  = `${b.id}-${numSem}`
                            const semData = semsDelBloque.find(s => s.numero === numSem) || null
                            const fIniSem = calcFechaInicioSemana(b, numSem)
                            const fFinSem = calcFechaFinSemana(b, numSem)
                            const fechaStr = `${format(fIniSem, 'd', { locale: es })}–${format(addDays(fIniSem, 6), 'd MMM', { locale: es })}`
                            const carga   = semData?.carga ? CARGAS[semData.carga] : CARGAS.media
                            const hoy     = new Date()
                            const esActual = hoy >= fIniSem && hoy < fFinSem
                            const semAb   = semanaAbierta.has(semKey)
                            const sesionesSem = sesiones.filter(s => {
                              if (!s.fecha) return false
                              const f = parseISO(s.fecha)
                              return f >= fIniSem && f < fFinSem
                            })

                            const kmReal = semData?.km_real ?? null
                            const kmMin  = sub?.km_min ?? null
                            const kmMax  = sub?.km_max ?? null
                            const kmMed  = kmMin != null ? (kmMin + (kmMax || kmMin)) / 2 : null
                            const kmDiff2  = kmMed != null && kmReal != null ? Math.abs(kmReal - kmMed) : null
                            const kmOK     = kmDiff2 != null && kmDiff2 <= 8
                            const kmColor  = kmReal == null ? 'var(--text3)' : kmDiff2 == null ? 'var(--text3)' : kmDiff2 <= 8 ? '#16a34a' : kmDiff2 <= 12 ? '#ca8a04' : '#dc2626'
                            const estadoBg = kmReal == null ? 'var(--bg2)' : kmDiff2 == null ? 'var(--bg2)' : kmDiff2 <= 8 ? '#bbf7d0' : kmDiff2 <= 12 ? '#fef9c3' : '#fca5a5'
                            const estadoColor = kmReal == null ? 'var(--text3)' : kmDiff2 == null ? 'var(--text3)' : kmDiff2 <= 8 ? '#166534' : kmDiff2 <= 12 ? '#713f12' : '#7f1d1d'

                            return (
                              <div key={semKey}>
                                {/* Fila de semana */}
                                <div
                                  onClick={() => toggleSemana(semKey)}
                                  style={{ display: 'grid', gridTemplateColumns: esResistencia ? '44px 96px 1fr 58px 68px 160px 28px 36px' : '52px 110px 1fr 76px 36px', padding: '8px 16px 8px 44px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', gap: 8, alignItems: 'center', background: esActual ? 'var(--accent-light)' : editMode ? 'var(--bg2)' : 'var(--bg)' }}
                                  onMouseOver={e => { if (!esActual) e.currentTarget.style.background = 'var(--bg2)' }}
                                  onMouseOut={e => { if (!esActual) e.currentTarget.style.background = esActual ? 'var(--accent-light)' : editMode ? 'var(--bg2)' : 'var(--bg)' }}>

                                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', color: esActual ? 'var(--accent)' : 'var(--text2)' }}>
                                    S{numSem}
                                  </span>

                                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fechaStr}</span>

                                  {!editMode ? (
                                    <span style={{ fontSize: 12, color: semData?.objetivo ? 'var(--text)' : 'var(--text3)', fontStyle: semData?.objetivo ? 'normal' : 'italic' }}>
                                      {semData?.objetivo || 'Sin objetivo'}
                                    </span>
                                  ) : (
                                    <input
                                      value={getInlineValue('semana', semData?.id || semKey, 'objetivo', semData?.objetivo || '')}
                                      onChange={e => { e.stopPropagation(); handleInlineChange('semana', semData?.id || semKey, 'objetivo', e.target.value) }}
                                      onBlur={async e => {
                                        e.stopPropagation()
                                        const val = e.target.value
                                        if (semData?.id) {
                                          await supabase.from('semanas').update({ objetivo: val || null }).eq('id', semData.id)
                                        } else {
                                          await supabase.from('semanas').insert({ bloque_id: b.id, numero: numSem, objetivo: val || null, carga: 'media' })
                                        }
                                        cargarPlanificacion()
                                      }}
                                      onClick={e => e.stopPropagation()}
                                      placeholder="Añadir objetivo..."
                                      style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-light)', outline: 'none', width: '100%' }}
                                    />
                                  )}

                                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: carga.color + '20', color: carga.color, width: 'fit-content' }}>
                                    {carga.label}
                                  </span>

                                  {esResistencia && (
                                    editMode ? (
                                      <input type="number" min="0"
                                        value={getInlineValue('semana', semData?.id || semKey, 'km_real', semData?.km_real || '')}
                                        onChange={e => { e.stopPropagation(); handleInlineChange('semana', semData?.id || semKey, 'km_real', e.target.value) }}
                                        onBlur={async e => {
                                          e.stopPropagation()
                                          if (semData?.id) await supabase.from('semanas').update({ km_real: e.target.value ? parseInt(e.target.value) : null }).eq('id', semData.id)
                                          cargarPlanificacion()
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-light)', outline: 'none', width: 64, fontFamily: 'var(--mono)' }}
                                      />
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: kmColor, fontFamily: 'var(--mono)' }}>
                                          {kmReal != null ? `${kmReal} km` : '—'}
                                        </span>
                                        {kmMin != null && <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>obj {kmMin}{kmMax && kmMax !== kmMin ? `–${kmMax}` : ''}</span>}
                                      </div>
                                    )
                                  )}

                                  {esResistencia && (() => {
                                    const z12o = sub?.zona1_2, z34o = sub?.zona3_4, z5o = sub?.zona5
                                    const totalMin = (semData?.zona1_2_real ?? 0) + (semData?.zona3_4_real ?? 0) + (semData?.zona5_real ?? 0)
                                    const toPct = min => totalMin > 0 ? Math.round(min / totalMin * 100) : null
                                    const z12r = semData?.zona1_2_real != null ? toPct(semData.zona1_2_real) : null
                                    const z34r = semData?.zona3_4_real != null ? toPct(semData.zona3_4_real) : null
                                    const z5r  = semData?.zona5_real   != null ? toPct(semData.zona5_real)   : null
                                    if (!z12o) return <span style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} onClick={e => e.stopPropagation()}>
                                        {[[z12o, z12r, '#3b82f6'], [z34o, z34r, '#f59e0b'], [z5o, z5r, '#ef4444']].map(([obj, real, col], i) => {
                                          if (!obj) return null
                                          const barW = real != null ? Math.min(real, 100) : 0
                                          const tickW = Math.min(obj, 100)
                                          const barCol = real == null ? '#d1d5db' : Math.abs(real - obj) <= 10 ? '#16a34a' : Math.abs(real - obj) <= 20 ? '#f59e0b' : '#ef4444'
                                          return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                              <div style={{ width: 44, height: 5, background: '#f3f4f6', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barW}%`, background: barCol, borderRadius: 3 }} />
                                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${tickW}%`, width: 1.5, background: '#6b7280' }} />
                                              </div>
                                              <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text)', width: 28, flexShrink: 0 }}>{real != null ? `${real}%` : '—'}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )
                                  })()}

                                  {esResistencia && (
                                    <div style={{ width: 22, height: 22, borderRadius: 5, background: estadoBg, color: estadoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }} title={kmReal == null ? 'Sin datos' : kmOK ? 'En rango' : 'Fuera de rango'}>
                                      {kmReal == null ? '—' : kmOK ? '✓' : '!'}
                                    </div>
                                  )}

                                  <button
                                    style={{ fontSize: 13, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                                    onClick={e => { e.stopPropagation(); openModal('semana', { bloque: b, numero: numSem, semanaData: semData }) }}
                                    title="Editar semana">✎</button>
                                </div>

                                {/* ── NIVEL 4: SESIONES ────────────────── */}
                                {semAb && (
                                  <div style={{ padding: '10px 16px 12px 60px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg)' }}>

                                    {/* Cabecera sesiones */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 96px 96px 64px 36px', padding: '4px 0 8px', borderBottom: '0.5px solid var(--border)', gap: 8, marginBottom: 4 }}>
                                      {['', 'Sesión', 'Día', 'Tipo', 'Dur.', ''].map((h, i) => (
                                        <span key={i} style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                                      ))}
                                    </div>

                                    {sesionesSem.length === 0 && (
                                      <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', margin: '6px 0 10px' }}>Sin sesiones esta semana.</p>
                                    )}

                                    {sesionesSem.map(s => {
                                      const tipoBg    = s.tipo_sesion === 'flexible' ? '#eeedfe' : s.tipo_sesion === 'opcional' ? '#f1efe8' : '#e6f1fb'
                                      const tipoColor = s.tipo_sesion === 'flexible' ? '#4a3aa7' : s.tipo_sesion === 'opcional' ? '#52514e' : '#185fa5'
                                      const tipoLabel = s.tipo_sesion === 'flexible' ? 'Flexible' : s.tipo_sesion === 'opcional' ? 'Opcional' : 'Programada'
                                      return (
                                        <div key={s.id}
                                          onClick={() => openModal('sesion', s)}
                                          onMouseOver={e => e.currentTarget.style.background = 'var(--bg2)'}
                                          onMouseOut={e => e.currentTarget.style.background = ''}
                                          style={{ display: 'grid', gridTemplateColumns: '20px 1fr 96px 96px 64px 36px', padding: '7px 0', borderBottom: '0.5px solid var(--border)', gap: 8, alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}>
                                          <span style={{ fontSize: 14 }} title={s.estado || ''}>
                                            {s.estado === 'completada' ? '✅' : s.estado === 'parcial' ? '〜' : s.estado === 'perdida' ? '❌' : iconoSesion(s)}
                                          </span>
                                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titulo}</span>
                                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                                            {s.fecha ? format(parseISO(s.fecha), 'EEE d MMM', { locale: es }) : 'Sin día'}
                                          </span>
                                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, width: 'fit-content', background: tipoBg, color: tipoColor, border: s.tipo_sesion === 'flexible' ? `0.5px dashed ${tipoColor}66` : undefined }}>
                                            {tipoLabel}
                                          </span>
                                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{s.duracion_min ? `${s.duracion_min} min` : '—'}</span>
                                          <button
                                            style={{ fontSize: 13, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                            onClick={e => { e.stopPropagation(); openModal('sesion', s) }}>✎</button>
                                        </div>
                                      )
                                    })}

                                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                                      onClick={() => openModal('sesion', { fecha: format(fIniSem, 'yyyy-MM-dd'), tipo_sesion: 'programada' })}>
                                      <Plus size={12} /> Añadir sesión
                                    </button>
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
          </div>
        )
      })}
    </div>
  )
}
