import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addWeeks, parseISO, differenceInWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, ChevronDown, ChevronRight, Trophy, Calendar, Layers } from 'lucide-react'
import SesionesPlan from './SesionesPlan'
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
const EMPTY_PLAN     = { cliente_id: '', nombre: '', fecha_inicio: '', fecha_fin: '', notas: '' }
const EMPTY_BLOQUE   = { nombre: '', fase: 'general', carga: 'media', semanas: 4, fecha_inicio: '', objetivo: '', contenidos: '', color: '#2d6a4f' }
const EMPTY_COMP     = { nombre: '', fecha: '', tipo: '', objetivo: '', notas: '' }
const EMPTY_CONTROL  = { nombre: '', fecha: '', tipo: '', notas: '' }
const EMPTY_SUBBLOQUE = { nombre: '', semana_inicio: 1, semana_fin: 1, objetivo: '', notas: '', zona1_2: 0, zona3_4: 0, zona5: 0, km_min: null, km_max: null, sesiones_min: null, sesiones_max: null, duracion_media_min: null, exigencia: '', enfoque: [], enfoque_prioridad: {} }
const EMPTY_SEMANA   = { objetivo: '', notas: '', comentario: '', nota_cliente: '', carga: 'media', zona1_2_real: 0, zona3_4_real: 0, zona5_real: 0, km_objetivo: null, km_real: null }

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

  // ── UI ──
  const [vista,           setVista]           = useState('timeline')
  const [loading,         setLoading]         = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [filtros,         setFiltros]         = useState({ bloques: true, sub: true, semanas: true, sesiones: true, eventos: false })
  const [tooltip,         setTooltip]         = useState({ visible: false, tipo: null, item: null, x: 0, y: 0 })
  const [menuAnadir,      setMenuAnadir]      = useState(false)
  const [expandVisible,   setExpandVisible]   = useState({})

  // ── Modales / formularios ──
  const [modalPlan,        setModalPlan]        = useState(false)
  const [formPlan,         setFormPlan]         = useState(EMPTY_PLAN)
  const [modalBloque,      setModalBloque]      = useState(null)
  const [formBloque,       setFormBloque]       = useState(EMPTY_BLOQUE)
  const [modalSubbloque,   setModalSubbloque]   = useState(null)
  const [formSubbloque,    setFormSubbloque]    = useState(EMPTY_SUBBLOQUE)
  const [modalSemana,      setModalSemana]      = useState(null)
  const [formSemana,       setFormSemana]       = useState(EMPTY_SEMANA)
  const [modalComp,        setModalComp]        = useState(false)
  const [formComp,         setFormComp]         = useState(EMPTY_COMP)
  const [modalControl,     setModalControl]     = useState(false)
  const [formControl,      setFormControl]      = useState(EMPTY_CONTROL)
  const [modalCopiar,      setModalCopiar]      = useState(false)
  const [formCopiar,       setFormCopiar]       = useState({ cliente_id: '', fecha_inicio: '', nombre: '' })
  const [modalCopiarBloque, setModalCopiarBloque] = useState(null)
  const [formCopiarBloque,  setFormCopiarBloque]  = useState({ cliente_id: '', planificacion_id: '' })
  const [planesDestino,    setPlanesDestino]    = useState([])
  const [modalSemanaTipo,       setModalSemanaTipo]       = useState(false)
  const [formSemanaTipo,        setFormSemanaTipo]        = useState({})
  const [modalConsideraciones,  setModalConsideraciones]  = useState(false)
  const [formConsideraciones,   setFormConsideraciones]   = useState('')
  const [formDisponibilidad,    setFormDisponibilidad]    = useState('')

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
    setFormSemanaTipo(data?.semana_tipo || {})
    setFormConsideraciones(data?.consideraciones || '')
    setFormDisponibilidad(data?.disponibilidad || '')
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
    setLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ABRIR MODALES (stub — implementación en Paso 2)
  // ─────────────────────────────────────────────────────────────────────────

  function openModal(tipo, item = null) {
    if (tipo === 'bloque') {
      if (item) {
        setFormBloque({ nombre: item.nombre, fase: item.fase, carga: item.carga, semanas: item.semanas, fecha_inicio: item.fecha_inicio, objetivo: item.objetivo || '', contenidos: item.contenidos || '', color: item.color || '#2d6a4f' })
        setModalBloque(item)
      } else {
        const fi = bloques.length > 0 ? format(addWeeks(parseISO(bloques[bloques.length - 1].fecha_inicio), bloques[bloques.length - 1].semanas), 'yyyy-MM-dd') : planificacion?.fecha_inicio || ''
        setFormBloque({ ...EMPTY_BLOQUE, fecha_inicio: fi })
        setModalBloque({})
      }
    } else if (tipo === 'subbloque') {
      if (item) {
        const s = item.sub || item
        setFormSubbloque({ nombre: s.nombre, semana_inicio: s.semana_inicio, semana_fin: s.semana_fin, objetivo: s.objetivo || '', notas: s.notas || '', zona1_2: s.zona1_2 || 0, zona3_4: s.zona3_4 || 0, zona5: s.zona5 || 0, km_min: s.km_min || null, km_max: s.km_max || null, sesiones_min: s.sesiones_min || null, sesiones_max: s.sesiones_max || null, duracion_media_min: s.duracion_media_min || null, exigencia: s.exigencia || '', enfoque: s.enfoque || [], enfoque_prioridad: s.enfoque_prioridad || {} })
        setModalSubbloque({ ...s, bloque_id: item.bloque_id || s.bloque_id })
      } else {
        const bId = item?.bloque_id || bloques[0]?.id
        setFormSubbloque(EMPTY_SUBBLOQUE)
        setModalSubbloque({ bloque_id: bId })
      }
    } else if (tipo === 'semana') {
      const { bloque, numero, semanaData } = item || {}
      const subDeLaSemana = (subbloques[bloque?.id] || []).find(s => numero >= s.semana_inicio && numero <= s.semana_fin)
      setFormSemana({
        objetivo:      semanaData?.objetivo      || '',
        notas:         semanaData?.notas         || '',
        comentario:    semanaData?.comentario    || '',
        nota_cliente:  semanaData?.nota_cliente  || '',
        carga:         semanaData?.carga         || 'media',
        zona1_2_real:  semanaData?.zona1_2_real  || 0,
        zona3_4_real:  semanaData?.zona3_4_real  || 0,
        zona5_real:    semanaData?.zona5_real    || 0,
        km_objetivo:   semanaData?.km_objetivo   || subDeLaSemana?.km_min || null,
        km_real:       semanaData?.km_real       || null,
      })
      setModalSemana({ bloque_id: bloque?.id, numero, semanaExistente: semanaData })
    } else if (tipo === 'comp') {
      if (item) { setFormComp({ nombre: item.nombre, fecha: item.fecha, tipo: item.tipo || '', objetivo: item.objetivo || '', notas: item.notas || '' }); setModalComp(item) }
      else { setFormComp(EMPTY_COMP); setModalComp(true) }
    } else if (tipo === 'control') {
      if (item) { setFormControl({ nombre: item.nombre, fecha: item.fecha, tipo: item.tipo || '', notas: item.notas || '' }); setModalControl(item) }
      else { setFormControl(EMPTY_CONTROL); setModalControl(true) }
    } else if (tipo === 'plan_nuevo') {
      setFormPlan(EMPTY_PLAN); setModalPlan(true)
    } else if (tipo === 'plan_editar') {
      setFormPlan({ cliente_id: planificacion.cliente_id, nombre: planificacion.nombre, fecha_inicio: planificacion.fecha_inicio, fecha_fin: planificacion.fecha_fin, notas: planificacion.notas || '' }); setModalPlan('editar')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACCIONES CRUD (guardados, eliminaciones)
  // ─────────────────────────────────────────────────────────────────────────

  async function guardarPlan() {
    if (!formPlan.nombre || !formPlan.fecha_inicio || !formPlan.fecha_fin) return
    setSaving(true)
    if (modalPlan === 'editar') {
      await supabase.from('planificaciones').update({ nombre: formPlan.nombre, fecha_inicio: formPlan.fecha_inicio, fecha_fin: formPlan.fecha_fin, notas: formPlan.notas || null }).eq('id', planificacion.id)
      setSaving(false); setModalPlan(false); cargarPlanificacion()
    } else {
      if (!formPlan.cliente_id) { setSaving(false); return }
      await supabase.from('planificaciones').insert({ cliente_id: formPlan.cliente_id, nombre: formPlan.nombre, fecha_inicio: formPlan.fecha_inicio, fecha_fin: formPlan.fecha_fin, notas: formPlan.notas || null })
      setSaving(false); setModalPlan(false); setClienteSeleccionado(formPlan.cliente_id)
    }
  }

  async function guardarBloque() {
    if (!formBloque.nombre || !formBloque.fecha_inicio) return
    setSaving(true)
    const datos = { planificacion_id: planificacion.id, nombre: formBloque.nombre, fase: formBloque.fase, carga: formBloque.carga, semanas: parseInt(formBloque.semanas), fecha_inicio: formBloque.fecha_inicio, objetivo: formBloque.objetivo || null, contenidos: formBloque.contenidos || null, color: formBloque.color || '#2d6a4f', orden: modalBloque?.orden ?? bloques.length }
    if (modalBloque?.id) await supabase.from('bloques').update(datos).eq('id', modalBloque.id)
    else await supabase.from('bloques').insert(datos)
    setSaving(false); setModalBloque(null); cargarPlanificacion()
  }

  async function eliminarBloque(id) {
    if (!window.confirm('¿Eliminar este bloque?')) return
    await supabase.from('bloques').delete().eq('id', id); cargarPlanificacion()
  }

  async function guardarSubbloque() {
    if (!formSubbloque.nombre || !modalSubbloque?.bloque_id) return
    setSaving(true)
    const datos = { bloque_id: modalSubbloque.bloque_id, nombre: formSubbloque.nombre, semana_inicio: parseInt(formSubbloque.semana_inicio), semana_fin: parseInt(formSubbloque.semana_fin), objetivo: formSubbloque.objetivo || null, notas: formSubbloque.notas || null, zona1_2: parseInt(formSubbloque.zona1_2) || 0, zona3_4: parseInt(formSubbloque.zona3_4) || 0, zona5: parseInt(formSubbloque.zona5) || 0, km_min: formSubbloque.km_min || null, km_max: formSubbloque.km_max || null, sesiones_min: formSubbloque.sesiones_min ? parseInt(formSubbloque.sesiones_min) : null, sesiones_max: formSubbloque.sesiones_max ? parseInt(formSubbloque.sesiones_max) : null, duracion_media_min: formSubbloque.duracion_media_min ? parseInt(formSubbloque.duracion_media_min) : null, exigencia: formSubbloque.exigencia || null, enfoque: formSubbloque.enfoque?.length ? formSubbloque.enfoque : null, enfoque_prioridad: Object.keys(formSubbloque.enfoque_prioridad || {}).length ? formSubbloque.enfoque_prioridad : null }
    if (modalSubbloque.id) await supabase.from('subbloques').update(datos).eq('id', modalSubbloque.id)
    else await supabase.from('subbloques').insert(datos)
    setSaving(false); setModalSubbloque(null); cargarPlanificacion()
  }

  async function eliminarSubbloque(id) {
    if (!window.confirm('¿Eliminar este sub bloque?')) return
    await supabase.from('subbloques').delete().eq('id', id); cargarPlanificacion()
  }

  async function guardarSemana() {
    if (!modalSemana) return
    setSaving(true)
    const { bloque_id, numero, semanaExistente } = modalSemana
    const datos = { objetivo: formSemana.objetivo || null, notas: formSemana.notas || null, comentario: formSemana.comentario || null, nota_cliente: formSemana.nota_cliente || null, carga: formSemana.carga, zona1_2_real: formSemana.zona1_2_real || 0, zona3_4_real: formSemana.zona3_4_real || 0, zona5_real: formSemana.zona5_real || 0, km_objetivo: formSemana.km_objetivo || null, km_real: formSemana.km_real || null }
    if (semanaExistente) await supabase.from('semanas').update(datos).eq('id', semanaExistente.id)
    else await supabase.from('semanas').insert({ bloque_id, numero, ...datos })
    setSaving(false); setModalSemana(null); cargarPlanificacion()
  }

  async function guardarComp() {
    if (!formComp.nombre || !formComp.fecha) return
    setSaving(true)
    if (modalComp?.id) await supabase.from('competiciones').update({ nombre: formComp.nombre, fecha: formComp.fecha, tipo: formComp.tipo || null, objetivo: formComp.objetivo || null, notas: formComp.notas || null }).eq('id', modalComp.id)
    else await supabase.from('competiciones').insert({ cliente_id: clienteSeleccionado, nombre: formComp.nombre, fecha: formComp.fecha, tipo: formComp.tipo || null, objetivo: formComp.objetivo || null, notas: formComp.notas || null })
    setSaving(false); setModalComp(false); cargarPlanificacion()
  }

  async function eliminarComp(id) {
    if (!window.confirm('¿Eliminar esta competición?')) return
    await supabase.from('competiciones').delete().eq('id', id); cargarPlanificacion()
  }

  async function guardarControl() {
    if (!formControl.nombre || !formControl.fecha) return
    setSaving(true)
    if (modalControl?.id) await supabase.from('controles').update({ nombre: formControl.nombre, fecha: formControl.fecha, tipo: formControl.tipo || null, notas: formControl.notas || null }).eq('id', modalControl.id)
    else await supabase.from('controles').insert({ cliente_id: clienteSeleccionado, nombre: formControl.nombre, fecha: formControl.fecha, tipo: formControl.tipo || null, notas: formControl.notas || null })
    setSaving(false); setModalControl(false); cargarPlanificacion()
  }

  async function eliminarControl(id) {
    if (!window.confirm('¿Eliminar este control?')) return
    await supabase.from('controles').delete().eq('id', id); cargarPlanificacion()
  }

  function copiarEnlace() {
    if (!planificacion?.token_publico) return
    const url = `${window.location.origin}/plan/${planificacion.token_publico}`
    navigator.clipboard.writeText(url)
    alert(`Enlace copiado:\n${url}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CÁLCULOS DERIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  const totalSemanas = calcTotalSemanas(bloques)

  // Lista plana de todas las semanas en orden global (para el timeline)
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
          {planificacion && (
            <button className="btn btn-ghost" onClick={() => openModal('plan_editar')}>Editar</button>
          )}
          {planificacion && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={async () => {
              if (!window.confirm(`¿Eliminar la planificación "${planificacion.nombre}"?`)) return
              await supabase.from('planificaciones').delete().eq('id', planificacion.id)
              setPlanificacion(null); setBloques([]); setSemanas({}); setSubbloques({}); setCompeticiones([]); setSesiones([]); cargarPlanificacion()
            }}><X size={13} /> Eliminar</button>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-primary" onClick={() => setMenuAnadir(v => !v)}>
              <Plus size={13} /> Añadir
            </button>
            {menuAnadir && (
              <div
                style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 200, minWidth: 180, overflow: 'hidden' }}
                onMouseLeave={() => setMenuAnadir(false)}
              >
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                  onClick={() => { setMenuAnadir(false); openModal('plan_nuevo') }}>
                  <Plus size={13} /> Nueva planificación
                </button>
                {planificacion && (<>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                    onClick={() => { setMenuAnadir(false); openModal('bloque') }}>
                    <Plus size={13} /> Bloque
                  </button>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                    onClick={() => {
                      setMenuAnadir(false)
                      if (!bloques.length) { alert('Primero crea un bloque'); return }
                      setFormSubbloque(EMPTY_SUBBLOQUE); setModalSubbloque({ bloque_id: bloques[0].id })
                    }}>
                    <Plus size={13} /> Sub bloque
                  </button>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                    onClick={() => { setMenuAnadir(false); openModal('comp') }}>
                    <Trophy size={13} /> Competición
                  </button>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                    onClick={() => { setMenuAnadir(false); openModal('control') }}>
                    🔬 Control / Valoración
                  </button>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
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
            {[
              ['timeline',   'Timeline'],
              ['lista',      'Lista'],
              ['calendario', 'Calendario'],
              ['seguimiento','Seguimiento'],
            ].map(([v, label]) => (
              <button key={v} className="btn btn-ghost btn-sm"
                style={vista === v ? { background: 'var(--bg2)', fontWeight: 600 } : {}}
                onClick={() => setVista(v)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CARGANDO ── */}
      {loading && <div className="empty"><p>Cargando...</p></div>}

      {/* ── SIN PLANIFICACIÓN ── */}
      {!loading && clienteSeleccionado && !planificacion && (
        <div className="empty">
          <Calendar size={40} />
          <p>No hay planificación para este cliente.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { openModal('plan_nuevo'); setFormPlan(f => ({ ...f, cliente_id: clienteSeleccionado })) }}>
            <Plus size={13} /> Crear planificación
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  CONTENIDO PRINCIPAL                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!loading && planificacion && (
        <>

          {/* ══ VISTA: CALENDARIO (SesionesPlan) ══════════════════════════ */}
          {vista === 'calendario' && (
            <SesionesPlan
              clienteId={clienteSeleccionado}
              bloquesPlan={bloques}
              subbloquesPlan={subbloques}
              clientes={clientes}
            />
          )}

          {/* ══ VISTA: SEGUIMIENTO ════════════════════════════════════════ */}
          {vista === 'seguimiento' && (
            <Seguimiento
              clienteId={clienteSeleccionado}
              planificacionId={planificacion?.id}
              bloques={bloques}
              semanas={semanas}
            />
          )}

          {/* ══ VISTA: LISTA (acordeón 4 niveles) ════════════════════════ */}
          {vista === 'lista' && <VistaLista
            bloques={bloques}
            subbloques={subbloques}
            semanas={semanas}
            sesiones={sesiones}
            competiciones={competiciones}
            controles={controles}
            clienteData={clienteData}
            openModal={openModal}
            eliminarBloque={eliminarBloque}
            eliminarSubbloque={eliminarSubbloque}
            setFormSubbloque={setFormSubbloque}
            setModalSubbloque={setModalSubbloque}
            EMPTY_SUBBLOQUE={EMPTY_SUBBLOQUE}
            setVista={setVista}
          />}

          {/* ══ VISTA: TIMELINE ══════════════════════════════════════════ */}
          {vista === 'timeline' && totalSemanas > 0 && (
            <div>
              {/* Pills de filtro */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  ['bloques',  'Bloques'],
                  ['sub',      'Sub bloques'],
                  ['semanas',  'Semanas'],
                  ['sesiones', 'Sesiones'],
                  ['eventos',  'Comp. / Control'],
                ].map(([key, label]) => (
                  <button key={key}
                    onClick={() => setFiltros(f => ({ ...f, [key]: !f[key] }))}
                    style={{
                      padding: '4px 13px',
                      borderRadius: 20,
                      border: `1.5px solid ${filtros[key] ? 'var(--accent)' : 'var(--border)'}`,
                      background: filtros[key] ? 'var(--accent-light)' : 'var(--bg)',
                      color: filtros[key] ? 'var(--accent)' : 'var(--text3)',
                      fontSize: 12,
                      fontWeight: filtros[key] ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Barra de progreso */}
              {(() => {
                const hoy  = new Date()
                const ini  = parseISO(planificacion.fecha_inicio)
                const fin  = parseISO(planificacion.fecha_fin)
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

              {/* Timeline card */}
              <div className="card" style={{ overflowX: 'auto', padding: '16px 14px' }}>
                <div style={{ minWidth: Math.max(totalSemanas * 44, 400), position: 'relative' }}>

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
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--mono)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>S{semIni}–S{semFin} · {fIni}–{fFin}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* FILA 2 — SUB BLOQUES */}
                  {filtros.sub && (
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
                                <div style={{ fontSize: 9, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  SB{bidx + 1}.{subidx + 1} · {sub.nombre}
                                </div>
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
                              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: esActual ? 700 : 500, color: esActual ? 'var(--accent)' : (bidx % 2 === 0 ? 'var(--text2)' : 'var(--text3)') }}>S{numGlobal}</div>
                              <div style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{format(fi, 'd/M')}</div>
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
                        {todasLasSemanas.map(({ bloque: b, numLocal, numGlobal, fi, ff }) => {
                          const sesionesSem = sesiones.filter(s => {
                            if (!s.fecha) return false
                            const f = parseISO(s.fecha)
                            return f >= fi && f < ff
                          })
                          return (
                            <div key={`${b.id}-${numLocal}-ses`}
                              style={{ flex: 1, minWidth: 28, borderRight: '1px solid var(--border)', padding: '2px', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                              {sesionesSem.slice(0, 3).map(s => (
                                <div key={s.id}
                                  onClick={() => openModal('sesion', s)}
                                  onMouseEnter={e => setTooltip({ visible: true, tipo: 'sesion', item: s, x: e.clientX, y: e.clientY })}
                                  onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                                  style={{ width: 18, height: 18, borderRadius: '50%', background: (b.color || '#2d6a4f') + '22', border: s.tipo_sesion === 'flexible' ? `1.5px dashed ${b.color || '#2d6a4f'}` : `1.5px solid ${b.color || '#2d6a4f'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, cursor: 'pointer' }}
                                  title={s.titulo}>
                                  {iconoSesion(s)}
                                </div>
                              ))}
                              {sesionesSem.length > 3 && <div style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>+{sesionesSem.length - 3}</div>}
                            </div>
                          )
                        })}
                      </div>

                      {/* Leyenda */}
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2d6a4f22', border: '1.5px solid #2d6a4f' }} />
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Programada</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2d6a4f22', border: '1.5px dashed #2d6a4f' }} />
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Flexible</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2d6a4f22', border: '1.5px solid #6b7280' }} />
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Opcional</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {vista === 'timeline' && totalSemanas === 0 && (
            <div className="empty"><Layers size={40} /><p>Añade bloques para ver el timeline.</p><button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openModal('bloque')}><Plus size={13} /> Añadir bloque</button></div>
          )}

        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TOOLTIP GLOBAL                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          top:  tooltip.y + 14,
          left: Math.min(tooltip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300),
          background: 'var(--bg, #fff)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          minWidth: 200,
          maxWidth: 280,
          pointerEvents: 'none',
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          {tooltip.tipo === 'bloque' && tooltip.item && (() => {
            const b = tooltip.item
            const nSubs = tooltip.numSubs || (subbloques[b.id] || []).length
            const fIni = format(parseISO(b.fecha_inicio), "dd 'de' MMMM yyyy", { locale: es })
            const fFin = format(addWeeks(parseISO(b.fecha_inicio), b.semanas), "dd 'de' MMMM yyyy", { locale: es })
            return (<>
              <div style={{ fontWeight: 700, color: b.color || 'var(--accent)', marginBottom: 6 }}>B{(tooltip.bidx ?? 0) + 1} {b.nombre}</div>
              <div style={{ color: 'var(--text2)', marginBottom: 3 }}>{fIni} → {fFin}</div>
              <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{b.semanas} sem · {nSubs} sub bloque{nSubs !== 1 ? 's' : ''}</div>
              {b.objetivo && <div style={{ color: 'var(--text2)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>{b.objetivo.slice(0, 120)}{b.objetivo.length > 120 ? '…' : ''}</div>}
            </>)
          })()}
          {tooltip.tipo === 'subbloque' && tooltip.item && (() => {
            const sub = tooltip.item
            const b   = tooltip.bloque
            const fIni = b ? format(calcFechaInicioSemana(b, sub.semana_inicio), "dd MMM", { locale: es }) : ''
            const fFin = b ? format(calcFechaFinSemana(b, sub.semana_fin), "dd MMM yyyy", { locale: es }) : ''
            return (<>
              <div style={{ fontWeight: 700, color: b?.color || 'var(--accent)', marginBottom: 6 }}>SB{(tooltip.bidx ?? 0) + 1}.{(tooltip.subidx ?? 0) + 1} {sub.nombre}</div>
              <div style={{ color: 'var(--text2)', marginBottom: 3 }}>S{sub.semana_inicio}–S{sub.semana_fin} · {fIni}–{fFin}</div>
              {(sub.km_min || sub.km_max) && <div style={{ color: 'var(--text3)' }}>Volumen: {sub.km_min}{sub.km_max ? `–${sub.km_max}` : '+'} km/sem</div>}
              {sub.exigencia && <div style={{ color: 'var(--text3)' }}>Exigencia: {sub.exigencia}</div>}
              {sub.notas && <div style={{ color: 'var(--text2)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>{sub.notas.slice(0, 100)}{sub.notas.length > 100 ? '…' : ''}</div>}
            </>)
          })()}
          {tooltip.tipo === 'semana' && (() => {
            const sem = tooltip.item
            const b   = tooltip.bloque
            const carga = sem?.carga ? CARGAS[sem.carga] : null
            const fIni = b ? format(calcFechaInicioSemana(b, tooltip.numLocal), "dd MMM", { locale: es }) : ''
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
              <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{s.fecha ? format(parseISO(s.fecha), "dd MMM yyyy", { locale: es }) : 'Sin fecha asignada'}</div>
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
      {/*  MODALES                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Modal: Nueva / Editar planificación */}
      {modalPlan && (
        <div className="modal-backdrop" onClick={() => setModalPlan(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalPlan === 'editar' ? 'Editar planificación' : 'Nueva planificación'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPlan(false)}><X size={14} /></button>
            </div>
            {modalPlan !== 'editar' && (
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={formPlan.cliente_id} onChange={e => setFormPlan(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formPlan.nombre} onChange={e => setFormPlan(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Temporada 2025-2026" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha inicio *</label><input className="form-input" type="date" value={formPlan.fecha_inicio} onChange={e => setFormPlan(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Fecha fin *</label><input className="form-input" type="date" value={formPlan.fecha_fin} onChange={e => setFormPlan(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formPlan.notas} onChange={e => setFormPlan(f => ({ ...f, notas: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPlan(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarPlan} disabled={saving}>{saving ? 'Guardando...' : modalPlan === 'editar' ? 'Guardar cambios' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bloque */}
      {modalBloque !== null && (
        <div className="modal-backdrop" onClick={() => setModalBloque(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalBloque?.id ? 'Editar bloque' : 'Nuevo bloque'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalBloque(null)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formBloque.nombre} onChange={e => setFormBloque(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Base aeróbica" autoFocus /></div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COLORES.map(c => (
                  <div key={c} onClick={() => setFormBloque(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: formBloque.color === c ? '3px solid var(--text)' : '3px solid transparent', transition: 'border 0.15s' }} />
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Semanas *</label><input className="form-input" type="number" min="1" max="52" value={formBloque.semanas} onChange={e => setFormBloque(f => ({ ...f, semanas: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Fecha inicio *</label><input className="form-input" type="date" value={formBloque.fecha_inicio} onChange={e => setFormBloque(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Objetivo</label><textarea className="form-textarea" value={formBloque.objetivo} onChange={e => setFormBloque(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Desarrollar base aeróbica" /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalBloque(null)}>Cancelar</button>
              {modalBloque?.id && <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { eliminarBloque(modalBloque.id); setModalBloque(null) }}>Eliminar</button>}
              <button className="btn btn-primary" onClick={guardarBloque} disabled={saving}>{saving ? 'Guardando...' : modalBloque?.id ? 'Guardar' : 'Crear bloque'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sub bloque */}
      {modalSubbloque && (
        <div className="modal-backdrop" onClick={() => setModalSubbloque(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalSubbloque.id ? 'Editar sub bloque' : 'Nuevo sub bloque'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSubbloque(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              {bloques.length > 1 && (
                <>
                  <label className="form-label">Bloque</label>
                  <select className="form-select" value={modalSubbloque.bloque_id || ''} onChange={e => setModalSubbloque(m => ({ ...m, bloque_id: e.target.value }))}>
                    {bloques.map((b, i) => <option key={b.id} value={b.id}>B{i + 1} {b.nombre}</option>)}
                  </select>
                </>
              )}
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formSubbloque.nombre} onChange={e => setFormSubbloque(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Adaptación" autoFocus /></div>
            <div className="form-group"><label className="form-label">Objetivos específicos</label><textarea className="form-textarea" value={formSubbloque.notas} onChange={e => setFormSubbloque(f => ({ ...f, notas: e.target.value }))} style={{ minHeight: 80 }} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Semana inicio *</label><input className="form-input" type="number" min="1" value={formSubbloque.semana_inicio} onChange={e => setFormSubbloque(f => ({ ...f, semana_inicio: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Semana fin *</label><input className="form-input" type="number" min="1" value={formSubbloque.semana_fin} onChange={e => setFormSubbloque(f => ({ ...f, semana_fin: e.target.value }))} /></div>
            </div>

            {clienteData?.perfil_planificacion !== 'fuerza_salud' ? (
              <>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Km/sem mín</label><input className="form-input" type="number" min="0" value={formSubbloque.km_min || ''} onChange={e => setFormSubbloque(f => ({ ...f, km_min: e.target.value ? parseInt(e.target.value) : null }))} /></div>
                  <div className="form-group"><label className="form-label">Km/sem máx</label><input className="form-input" type="number" min="0" value={formSubbloque.km_max || ''} onChange={e => setFormSubbloque(f => ({ ...f, km_max: e.target.value ? parseInt(e.target.value) : null }))} /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Distribución de zonas</label>
                  {[{ key: 'zona1_2', label: 'Z1-Z2', color: '#10b981' }, { key: 'zona3_4', label: 'Z3-Z4', color: '#f59e0b' }, { key: 'zona5', label: 'Z5-Z5+', color: '#ef4444' }].map(zona => (
                    <div key={zona.key} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: zona.color }}>{zona.label}</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600 }}>{formSubbloque[zona.key]}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={formSubbloque[zona.key]}
                        onChange={e => {
                          const val = parseInt(e.target.value)
                          const otras = ['zona1_2', 'zona3_4', 'zona5'].filter(k => k !== zona.key)
                          const totalOtras = otras.reduce((s, k) => s + (formSubbloque[k] || 0), 0)
                          const resto = 100 - val
                          if (resto < 0) return
                          const nuevas = {}
                          if (totalOtras === 0) otras.forEach(k => { nuevas[k] = Math.round(resto / otras.length) })
                          else otras.forEach(k => { nuevas[k] = Math.round((formSubbloque[k] / totalOtras) * resto) })
                          setFormSubbloque(f => ({ ...f, [zona.key]: val, ...nuevas }))
                        }}
                        style={{ width: '100%', accentColor: zona.color }} />
                    </div>
                  ))}
                  {(formSubbloque.zona1_2 + formSubbloque.zona3_4 + formSubbloque.zona5) > 0 && (
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 4 }}>
                      {formSubbloque.zona1_2 > 0 && <div style={{ width: `${formSubbloque.zona1_2}%`, background: '#10b981' }} />}
                      {formSubbloque.zona3_4 > 0 && <div style={{ width: `${formSubbloque.zona3_4}%`, background: '#f59e0b' }} />}
                      {formSubbloque.zona5 > 0 && <div style={{ width: `${formSubbloque.zona5}%`, background: '#ef4444' }} />}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Sesiones/sem mín</label><input className="form-input" type="number" min="1" max="7" value={formSubbloque.sesiones_min || ''} onChange={e => setFormSubbloque(f => ({ ...f, sesiones_min: e.target.value ? parseInt(e.target.value) : null }))} /></div>
                  <div className="form-group"><label className="form-label">Sesiones/sem máx</label><input className="form-input" type="number" min="1" max="7" value={formSubbloque.sesiones_max || ''} onChange={e => setFormSubbloque(f => ({ ...f, sesiones_max: e.target.value ? parseInt(e.target.value) : null }))} /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Duración media (min)</label>
                  <input className="form-input" type="number" min="1" value={formSubbloque.duracion_media_min || ''} onChange={e => setFormSubbloque(f => ({ ...f, duracion_media_min: e.target.value ? parseInt(e.target.value) : null }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Exigencia</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Baja', 'Moderada', 'Alta'].map(op => {
                      const col = op === 'Baja' ? '#10b981' : op === 'Moderada' ? '#f59e0b' : '#ef4444'
                      const active = formSubbloque.exigencia === op
                      return <button key={op} onClick={() => setFormSubbloque(f => ({ ...f, exigencia: f.exigencia === op ? '' : op }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${active ? col : 'var(--border)'}`, background: active ? col + '20' : 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? col : 'var(--text2)' }}>{op}</button>
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Enfoque / Contenidos</label>
                  {(() => {
                    const ENFOQUES = ['Movilidad', 'Estabilidad y control', 'Fuerza base', 'Potencia y velocidad', 'Especificidad deportiva']
                    const prioridad = formSubbloque.enfoque_prioridad || {}
                    const totalPuntos = Object.values(prioridad).reduce((s, v) => s + v, 0)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ENFOQUES.map(op => {
                          const puntos = prioridad[op] || 0
                          const pct = totalPuntos > 0 ? Math.round((puntos / totalPuntos) * 100) : 0
                          return (
                            <div key={op} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, color: puntos > 0 ? 'var(--text)' : 'var(--text3)', fontWeight: puntos > 0 ? 500 : 400, minWidth: 170, flexShrink: 0 }}>{op}</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {[0,1,2,3,4,5].map(n => (
                                  <button key={n} onClick={() => setFormSubbloque(f => {
                                    const np = { ...(f.enfoque_prioridad || {}), [op]: n }
                                    if (n === 0) delete np[op]
                                    const enfoqueActivo = Object.entries(np).filter(([,v]) => v > 0).map(([k]) => k)
                                    return { ...f, enfoque_prioridad: np, enfoque: enfoqueActivo }
                                  })} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${puntos >= n && n > 0 ? 'var(--accent)' : 'var(--border)'}`, background: puntos >= n && n > 0 ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: puntos >= n && n > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                                    {n === 0 ? '✕' : n}
                                  </button>
                                ))}
                              </div>
                              {puntos > 0 && (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} /></div>
                                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600, minWidth: 30 }}>{pct}%</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {totalPuntos > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                            {Object.entries(prioridad).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k} ${Math.round((v/totalPuntos)*100)}%`).join(' · ')}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSubbloque(null)}>Cancelar</button>
              {modalSubbloque.id && <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { eliminarSubbloque(modalSubbloque.id); setModalSubbloque(null) }}>Eliminar</button>}
              <button className="btn btn-primary" onClick={guardarSubbloque} disabled={saving}>{saving ? 'Guardando...' : modalSubbloque.id ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Semana */}
      {modalSemana && (
        <div className="modal-backdrop" onClick={() => setModalSemana(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="modal-title">Semana {modalSemana.numero}</span>
                {modalSemana.semanaExistente?.token_publico && (
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const url = `${window.location.origin}/semana/${modalSemana.semanaExistente.token_publico}`
                    navigator.clipboard.writeText(url)
                    alert(`Enlace copiado:\n${url}`)
                  }}>🔗 Copiar enlace semana</button>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSemana(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Carga</label>
              <select className="form-select" value={formSemana.carga} onChange={e => setFormSemana(f => ({ ...f, carga: e.target.value }))}>
                {Object.entries(CARGAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Objetivo de la semana</label><input className="form-input" value={formSemana.objetivo} onChange={e => setFormSemana(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Aumentar volumen" autoFocus /></div>
            {clienteData?.perfil_planificacion !== 'fuerza_salud' && (
              <div className="form-row">
                <div className="form-group"><label className="form-label">Km objetivo</label><input className="form-input" type="number" min="0" value={formSemana.km_objetivo || ''} onChange={e => setFormSemana(f => ({ ...f, km_objetivo: e.target.value ? parseInt(e.target.value) : null }))} /></div>
                <div className="form-group"><label className="form-label">Km real</label><input className="form-input" type="number" min="0" value={formSemana.km_real || ''} onChange={e => setFormSemana(f => ({ ...f, km_real: e.target.value ? parseInt(e.target.value) : null }))} /></div>
              </div>
            )}
            <div className="form-group"><label className="form-label">Notas / Contenidos</label><textarea className="form-textarea" value={formSemana.notas} onChange={e => setFormSemana(f => ({ ...f, notas: e.target.value }))} style={{ minHeight: 90 }} /></div>
            <div className="form-group"><label className="form-label">Comentario post-semana</label><textarea className="form-textarea" value={formSemana.comentario} onChange={e => setFormSemana(f => ({ ...f, comentario: e.target.value }))} style={{ minHeight: 70 }} /></div>
            <div className="form-group"><label className="form-label">Nota para el cliente</label><textarea className="form-textarea" value={formSemana.nota_cliente} onChange={e => setFormSemana(f => ({ ...f, nota_cliente: e.target.value }))} placeholder="Visible para el cliente en su vista semanal..." style={{ minHeight: 70 }} /></div>
            {clienteData?.perfil_planificacion !== 'fuerza_salud' && (
              <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <label className="form-label">Zonas reales (minutos)</label>
                {[{ key: 'zona1_2_real', label: 'Z1-Z2', color: '#10b981' }, { key: 'zona3_4_real', label: 'Z3-Z4', color: '#f59e0b' }, { key: 'zona5_real', label: 'Z5-Z5+', color: '#ef4444' }].map(zona => {
                  const total = (formSemana.zona1_2_real || 0) + (formSemana.zona3_4_real || 0) + (formSemana.zona5_real || 0)
                  const pct = total > 0 ? Math.round(((formSemana[zona.key] || 0) / total) * 100) : 0
                  return (
                    <div key={zona.key} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: zona.color }}>{zona.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {total > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: zona.color }}>{pct}%</span>}
                          <input type="number" min="0" max="600" value={formSemana[zona.key] || 0} onChange={e => setFormSemana(f => ({ ...f, [zona.key]: parseInt(e.target.value) || 0 }))} style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 6px)', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'right' }} />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>min</span>
                        </div>
                      </div>
                      {total > 0 && <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: zona.color, borderRadius: 3 }} /></div>}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSemana(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSemana} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Competición */}
      {modalComp && (
        <div className="modal-backdrop" onClick={() => setModalComp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{modalComp?.id ? 'Editar competición' : 'Nueva competición'}</span><button className="btn btn-ghost btn-sm" onClick={() => setModalComp(false)}><X size={14} /></button></div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formComp.nombre} onChange={e => setFormComp(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Media Maratón Barcelona" autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={formComp.fecha} onChange={e => setFormComp(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Tipo</label><input className="form-input" value={formComp.tipo} onChange={e => setFormComp(f => ({ ...f, tipo: e.target.value }))} placeholder="Ej: Carrera, Hyrox..." /></div>
            </div>
            <div className="form-group"><label className="form-label">Objetivo</label><input className="form-input" value={formComp.objetivo} onChange={e => setFormComp(f => ({ ...f, objetivo: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formComp.notas} onChange={e => setFormComp(f => ({ ...f, notas: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalComp(false)}>Cancelar</button>
              {modalComp?.id && <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { eliminarComp(modalComp.id); setModalComp(false) }}>Eliminar</button>}
              <button className="btn btn-primary" onClick={guardarComp} disabled={saving}>{saving ? 'Guardando...' : modalComp?.id ? 'Guardar' : 'Añadir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Control / Valoración */}
      {modalControl && (
        <div className="modal-backdrop" onClick={() => setModalControl(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{modalControl?.id ? 'Editar control' : 'Nuevo control / valoración'}</span><button className="btn btn-ghost btn-sm" onClick={() => setModalControl(false)}><X size={14} /></button></div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formControl.nombre} onChange={e => setFormControl(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Test de fuerza..." autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={formControl.fecha} onChange={e => setFormControl(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={formControl.tipo} onChange={e => setFormControl(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  <option value="Fuerza">Fuerza</option>
                  <option value="Resistencia">Resistencia</option>
                  <option value="Movilidad">Movilidad</option>
                  <option value="Composición corporal">Composición corporal</option>
                  <option value="HRV / Recuperación">HRV / Recuperación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formControl.notas} onChange={e => setFormControl(f => ({ ...f, notas: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalControl(false)}>Cancelar</button>
              {modalControl?.id && <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { eliminarControl(modalControl.id); setModalControl(false) }}>Eliminar</button>}
              <button className="btn btn-primary" onClick={guardarControl} disabled={saving}>{saving ? 'Guardando...' : modalControl?.id ? 'Guardar' : 'Añadir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Copiar planificación */}
      {modalCopiar && (
        <div className="modal-backdrop" onClick={() => setModalCopiar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Copiar planificación</span><button className="btn btn-ghost btn-sm" onClick={() => setModalCopiar(false)}><X size={14} /></button></div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius)' }}>
              Copiando: <strong>{planificacion?.nombre}</strong><br />
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Se copiarán todos los bloques y sub bloques. Los datos reales no se copian.</span>
            </div>
            <div className="form-group"><label className="form-label">Cliente destino *</label>
              <select className="form-select" value={formCopiar.cliente_id} onChange={e => setFormCopiar(f => ({ ...f, cliente_id: e.target.value }))}>
                <option value="">Selecciona...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formCopiar.nombre} onChange={e => setFormCopiar(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Nueva fecha de inicio *</label><input className="form-input" type="date" value={formCopiar.fecha_inicio} onChange={e => setFormCopiar(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCopiar(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !formCopiar.cliente_id || !formCopiar.fecha_inicio || !formCopiar.nombre} onClick={async () => {
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
                  setSaving(false); setModalCopiar(false); alert('Planificación copiada.'); setClienteSeleccionado(formCopiar.cliente_id)
                } catch { setSaving(false); alert('Error al copiar.') }
              }}>{saving ? 'Copiando...' : 'Copiar'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── VISTA LISTA (acordeón 4 niveles) ────────────────────────────────────────

function VistaLista({ bloques, subbloques, semanas, sesiones, competiciones, controles, clienteData, openModal, eliminarBloque, eliminarSubbloque, setFormSubbloque, setModalSubbloque, EMPTY_SUBBLOQUE, setVista }) {
  const [bloqueAbierto,   setBloqueAbierto]   = useState(null)
  const [subAbierto,      setSubAbierto]      = useState(null)
  const [semAbierta,      setSemAbierta]      = useState(null)
  const [modoEdicion,     setModoEdicion]     = useState(false)

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
      {/* Cabecera de vista */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className={`btn btn-sm ${modoEdicion ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setModoEdicion(!modoEdicion)}>
          {modoEdicion ? '🔒 Bloquear edición' : '✏️ Modo edición'}
        </button>
      </div>

      {bloques.map((b, bidx) => {
        const subsDelBloque = subbloques[b.id] || []
        const semsDelBloque = semanas[b.id]   || []
        const bAbierto      = bloqueAbierto === b.id
        const fFin          = addWeeks(parseISO(b.fecha_inicio), b.semanas)

        const semsConSub = new Set(subsDelBloque.flatMap(sub =>
          Array.from({ length: sub.semana_fin - sub.semana_inicio + 1 }, (_, i) => sub.semana_inicio + i)
        ))
        const semsHuerfanas = Array.from({ length: b.semanas }, (_, i) => i + 1).filter(n => !semsConSub.has(n))

        return (
          <div key={b.id} className="card" style={{ padding: 0, borderLeft: `4px solid ${b.color || '#2d6a4f'}`, marginBottom: 10, overflow: 'hidden' }}>

            {/* ── NIVEL 1: BLOQUE ── */}
            <div
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: bAbierto ? 'var(--bg2)' : 'var(--bg)' }}
              onClick={() => setBloqueAbierto(bAbierto ? null : b.id)}>
              {bAbierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
                B{bidx + 1} — {b.nombre}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {b.semanas} sem · {format(parseISO(b.fecha_inicio), 'dd MMM', { locale: es })}–{format(fFin, 'dd MMM yyyy', { locale: es })}
              </span>
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={() => openModal('bloque', b)}>Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setFormSubbloque(EMPTY_SUBBLOQUE); setModalSubbloque({ bloque_id: b.id }) }}>+ Sub bloque</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><X size={12} /></button>
              </div>
            </div>

            {bAbierto && (
              <div style={{ borderTop: '1px solid var(--border)' }}>

                {/* ── NIVEL 2: SUBBLOQUES ── */}
                {subsDelBloque.map((sub, subidx) => {
                  const sAbierto     = subAbierto === sub.id
                  const fIniSub      = calcFechaInicioSemana(b, sub.semana_inicio)
                  const fFinSub      = calcFechaFinSemana(b, sub.semana_fin)
                  const semsDelSub   = Array.from({ length: sub.semana_fin - sub.semana_inicio + 1 }, (_, i) => sub.semana_inicio + i)

                  return (
                    <div key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {/* Cabecera subbloque */}
                      <div
                        style={{ padding: '9px 16px 9px 36px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--bg2)' }}
                        onClick={() => setSubAbierto(sAbierto ? null : sub.id)}>
                        {sAbierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{bidx + 1}.{subidx + 1} {sub.nombre}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          S{sub.semana_inicio}–S{sub.semana_fin} · {format(fIniSub, 'dd MMM', { locale: es })}–{format(fFinSub, 'dd MMM', { locale: es })}
                        </span>
                        {sub.km_min && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#eff6ff', color: '#3b82f6', fontWeight: 500 }}>{sub.km_min}{sub.km_max ? `–${sub.km_max}` : '+'} km</span>}
                        {sub.exigencia && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: sub.exigencia === 'Baja' ? '#d1fae5' : sub.exigencia === 'Moderada' ? '#fef3c7' : '#fee2e2', color: sub.exigencia === 'Baja' ? '#10b981' : sub.exigencia === 'Moderada' ? '#f59e0b' : '#ef4444', fontWeight: 500 }}>{sub.exigencia}</span>}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openModal('subbloque', { ...sub, bloque_id: b.id })}>Editar</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarSubbloque(sub.id)}><X size={12} /></button>
                        </div>
                      </div>

                      {sAbierto && (
                        <div>
                          {/* ── NIVEL 3: SEMANAS ── */}
                          {semsDelSub.map(numSem => {
                            const sem      = semsDelBloque.find(s => s.numero === numSem) || null
                            const fIniSem  = calcFechaInicioSemana(b, numSem)
                            const fFinSem  = calcFechaFinSemana(b, numSem)
                            const carga    = sem?.carga ? CARGAS[sem.carga] : null
                            const semKey   = `${b.id}_${numSem}`
                            const smAb     = semAbierta === semKey
                            const hoy      = new Date()
                            const esActual = hoy >= fIniSem && hoy < fFinSem

                            const sesionesSem = sesiones.filter(s => {
                              if (!s.fecha) return false
                              const f = parseISO(s.fecha)
                              return f >= fIniSem && f < fFinSem
                            })

                            return (
                              <div key={numSem} style={{ borderBottom: '1px solid var(--border)', background: esActual ? 'var(--accent-light)' : modoEdicion ? '#fafdf8' : 'transparent' }}>
                                {/* Fila semana */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px 7px 60px', cursor: 'pointer' }}
                                  onClick={() => setSemAbierta(smAb ? null : semKey)}>
                                  {smAb ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: esActual ? 'var(--accent)' : carga ? carga.color : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: (esActual || carga) ? 'white' : 'var(--text3)', fontFamily: 'var(--mono)' }}>S{numSem}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 52 }}>{format(fIniSem, 'dd MMM', { locale: es })}</span>
                                  {modoEdicion ? (
                                    <input
                                      className="form-input"
                                      style={{ flex: 1, fontSize: 12, padding: '4px 8px', background: '#f0fdf4' }}
                                      defaultValue={sem?.objetivo || ''}
                                      key={sem?.objetivo}
                                      onClick={e => e.stopPropagation()}
                                      onBlur={async e => {
                                        const val = e.target.value
                                        if (sem) await supabase.from('semanas').update({ objetivo: val || null }).eq('id', sem.id)
                                        else await supabase.from('semanas').insert({ bloque_id: b.id, numero: numSem, objetivo: val || null, carga: 'media', zona1_2_real: 0, zona3_4_real: 0, zona5_real: 0 })
                                      }}
                                    />
                                  ) : (
                                    <span style={{ flex: 1, fontSize: 12, color: sem?.objetivo ? 'var(--text)' : 'var(--text3)', fontStyle: sem?.objetivo ? 'normal' : 'italic' }}>
                                      {sem?.objetivo || 'Sin objetivo — clic para añadir'}
                                    </span>
                                  )}
                                  {carga && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: carga.color + '20', color: carga.color, fontWeight: 600, flexShrink: 0 }}>{carga.label}</span>}
                                  {sem?.km_objetivo && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#3b82f6', flexShrink: 0 }}>{sem.km_objetivo} km</span>}
                                  <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                                      onClick={() => openModal('semana', { bloque: b, numero: numSem, semanaData: sem })}>
                                      Editar
                                    </button>
                                  </div>
                                </div>

                                {/* ── NIVEL 4: SESIONES ── */}
                                {smAb && (
                                  <div style={{ padding: '6px 16px 10px 80px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                                    {sesionesSem.length === 0 ? (
                                      <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', margin: '4px 0 8px' }}>Sin sesiones esta semana</p>
                                    ) : (
                                      <div style={{ marginBottom: 8 }}>
                                        {sesionesSem.map(s => {
                                          const tipoBadge = s.tipo_sesion === 'flexible'
                                            ? { bg: '#fef3c7', color: '#92400e', border: '1px dashed #f59e0b' }
                                            : s.tipo_sesion === 'opcional'
                                              ? { bg: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }
                                              : { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                                          return (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                              <span style={{ fontSize: 14, flexShrink: 0 }}>{iconoSesion(s)}</span>
                                              <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{s.titulo}</span>
                                              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                                                {s.fecha ? format(parseISO(s.fecha), 'dd MMM', { locale: es }) : 'Sin día'}
                                              </span>
                                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, flexShrink: 0, ...tipoBadge }}>{s.tipo_sesion || 'programada'}</span>
                                              {s.duracion_min && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{s.duracion_min} min</span>}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                    <button className="btn btn-ghost btn-sm" onClick={() => setVista('calendario')}>
                                      <Plus size={12} /> Gestionar sesiones
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

                {/* Semanas huérfanas (sin subbloque) */}
                {semsHuerfanas.length > 0 && (
                  <div style={{ padding: '8px 16px 8px 36px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, fontFamily: 'var(--mono)' }}>Sin subbloque</span>
                    </div>
                    {semsHuerfanas.map(numSem => {
                      const sem      = (semanas[b.id] || []).find(s => s.numero === numSem) || null
                      const fIniSem  = calcFechaInicioSemana(b, numSem)
                      const carga    = sem?.carga ? CARGAS[sem.carga] : null
                      const hoy      = new Date()
                      const esActual = hoy >= fIniSem && hoy < calcFechaFinSemana(b, numSem)
                      return (
                        <div key={numSem} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0 5px 24px', borderBottom: '1px solid var(--border)', background: esActual ? 'var(--accent-light)' : 'transparent' }}>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: esActual ? 'var(--accent)' : 'var(--text3)', fontWeight: 600, minWidth: 28 }}>S{numSem}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 50 }}>{format(fIniSem, 'dd MMM', { locale: es })}</span>
                          <span style={{ flex: 1, fontSize: 12, color: sem?.objetivo ? 'var(--text)' : 'var(--text3)', fontStyle: sem?.objetivo ? 'normal' : 'italic' }}>{sem?.objetivo || '—'}</span>
                          {carga && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: carga.color + '20', color: carga.color }}>{carga.label}</span>}
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => openModal('semana', { bloque: b, numero: numSem, semanaData: sem })}>Editar</button>
                        </div>
                      )
                    })}
                  </div>
                )}

              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
