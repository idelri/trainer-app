import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addWeeks, differenceInWeeks, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, ChevronDown, ChevronRight, Trophy, Calendar, Layers } from 'lucide-react'

const FASES = {
  general: { label: 'General', color: '#6b7280' },
  pretemporada: { label: 'Pretemporada', color: '#3b82f6' },
  competicion: { label: 'Competición', color: '#ef4444' },
  recuperacion: { label: 'Recuperación', color: '#10b981' },
  transicion: { label: 'Transición', color: '#f59e0b' },
}

const CARGAS = {
  baja: { label: 'Baja', color: '#10b981' },
  media: { label: 'Media', color: '#f59e0b' },
  alta: { label: 'Alta', color: '#ef4444' },
  muy_alta: { label: 'Muy alta', color: '#7c3aed' },
}

const COLORES = [
  '#2d6a4f', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6b7280'
]

const EMPTY_PLAN = { cliente_id: '', nombre: '', fecha_inicio: '', fecha_fin: '', notas: '' }
const EMPTY_BLOQUE = { nombre: '', fase: 'general', carga: 'media', semanas: 4, fecha_inicio: '', objetivo: '', contenidos: '', color: '#2d6a4f' }
const EMPTY_COMP = { nombre: '', fecha: '', tipo: '', objetivo: '', notas: '' }

export default function Planificacion() {
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [planificacion, setPlanificacion] = useState(null)
  const [planificaciones, setPlanificaciones] = useState([])
  const [bloques, setBloques] = useState([])
  const [competiciones, setCompeticiones] = useState([])
  const [semanas, setSemanas] = useState({})
  const [vista, setVista] = useState('timeline')
  const [bloqueAbierto, setBloqueAbierto] = useState(null)
  const [objetivoVisible, setObjetivoVisible] = useState({})
  const [loading, setLoading] = useState(false)
  const [modalPlan, setModalPlan] = useState(false)
  const [modalBloque, setModalBloque] = useState(null)
  const [modalComp, setModalComp] = useState(false)
  const [modalSemana, setModalSemana] = useState(null)
  const [formPlan, setFormPlan] = useState(EMPTY_PLAN)
  const [formBloque, setFormBloque] = useState(EMPTY_BLOQUE)
  const [formComp, setFormComp] = useState(EMPTY_COMP)
  const [formSemana, setFormSemana] = useState({ objetivo: '', notas: '', carga: 'media', zona1_2_real: 0, zona3_4_real: 0, zona5_real: 0, km_objetivo: null, km_real: null })
  const [saving, setSaving] = useState(false)
  const [clienteData, setClienteData] = useState(null)
  const [modalSemanaTipo, setModalSemanaTipo] = useState(false)
  const [modalConsideraciones, setModalConsideraciones] = useState(false)
  const [formSemanaTipo, setFormSemanaTipo] = useState({})
  const [formConsideraciones, setFormConsideraciones] = useState('')
  const [formDisponibilidad, setFormDisponibilidad] = useState('')
  const [subbloques, setSubbloques] = useState({})
  const [modalSubbloque, setModalSubbloque] = useState(null)
  const [formSubbloque, setFormSubbloque] = useState({ nombre: '', semana_inicio: 1, semana_fin: 1, objetivo: '', notas: '', zona1_2: 0, zona3_4: 0, zona5: 0, km_min: null, km_max: null })

  useEffect(() => { cargarClientes() }, [])
  useEffect(() => { if (clienteSeleccionado) { cargarPlanificacion(); cargarClienteData(clienteSeleccionado) } }, [clienteSeleccionado])
  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  async function cargarClienteData(id) {
    const { data } = await supabase.from('clientes').select('semana_tipo, disponibilidad, consideraciones').eq('id', id).single()
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
      const { data: bls } = await supabase
        .from('bloques').select('*')
        .eq('planificacion_id', plan.id)
        .order('orden')
      setBloques(bls || [])
     // cargar subbloques
      if (bls && bls.length > 0) {
        const { data: subs } = await supabase
          .from('subbloques').select('*')
          .in('bloque_id', (bls || []).map(b => b.id))
          .order('semana_inicio')
        const subsMap = {}
        ;(subs || []).forEach(s => {
          if (!subsMap[s.bloque_id]) subsMap[s.bloque_id] = []
          subsMap[s.bloque_id].push(s)
        })
        setSubbloques(subsMap)
      }

      if (bls && bls.length > 0) {
        const { data: sems } = await supabase
          .from('semanas').select('*')
          .in('bloque_id', bls.map(b => b.id))
          .order('numero')
        const semsMap = {}
        ;(sems || []).forEach(s => {
          if (!semsMap[s.bloque_id]) semsMap[s.bloque_id] = []
          semsMap[s.bloque_id].push(s)
        })
        setSemanas(semsMap)
      }
    } else {
      setPlanificacion(null)
      setBloques([])
      setSemanas({})
    }

    const { data: comps } = await supabase
      .from('competiciones').select('*')
      .eq('cliente_id', clienteSeleccionado)
      .order('fecha')
    setCompeticiones(comps || [])
    setLoading(false)
  }

  async function guardarPlan() {
    if (!formPlan.nombre || !formPlan.fecha_inicio || !formPlan.fecha_fin) return
    setSaving(true)
    if (modalPlan === 'editar') {
      await supabase.from('planificaciones').update({
        nombre: formPlan.nombre,
        fecha_inicio: formPlan.fecha_inicio,
        fecha_fin: formPlan.fecha_fin,
        notas: formPlan.notas || null,
      }).eq('id', planificacion.id)
      setSaving(false)
      setModalPlan(false)
      cargarPlanificacion()
    } else {
      if (!formPlan.cliente_id) return
      await supabase.from('planificaciones').insert({
        cliente_id: formPlan.cliente_id,
        nombre: formPlan.nombre,
        fecha_inicio: formPlan.fecha_inicio,
        fecha_fin: formPlan.fecha_fin,
        notas: formPlan.notas || null,
      })
      setSaving(false)
      setModalPlan(false)
      setClienteSeleccionado(formPlan.cliente_id)
    }
  }
  function copiarEnlace() {
    if (!planificacion?.token_publico) return
    const url = `${window.location.origin}/plan/${planificacion.token_publico}`
    navigator.clipboard.writeText(url)
    alert(`Enlace copiado:\n${url}`)
  }

  async function guardarBloque() {
    if (!formBloque.nombre || !formBloque.fecha_inicio) return
    setSaving(true)
    const datos = {
      planificacion_id: planificacion.id,
      nombre: formBloque.nombre,
      fase: formBloque.fase,
      carga: formBloque.carga,
      semanas: parseInt(formBloque.semanas),
      fecha_inicio: formBloque.fecha_inicio,
      objetivo: formBloque.objetivo || null,
      contenidos: formBloque.contenidos || null,
      color: formBloque.color || '#2d6a4f',
      orden: modalBloque?.orden ?? bloques.length,
    }
    if (modalBloque?.id) {
      await supabase.from('bloques').update(datos).eq('id', modalBloque.id)
    } else {
      await supabase.from('bloques').insert(datos)
    }
    setSaving(false)
    setModalBloque(null)
    cargarPlanificacion()
  }

  async function guardarComp() {
    if (!formComp.nombre || !formComp.fecha) return
    setSaving(true)
    if (modalComp?.id) {
      await supabase.from('competiciones').update({
        nombre: formComp.nombre,
        fecha: formComp.fecha,
        tipo: formComp.tipo || null,
        objetivo: formComp.objetivo || null,
        notas: formComp.notas || null,
      }).eq('id', modalComp.id)
    } else {
      await supabase.from('competiciones').insert({
        cliente_id: clienteSeleccionado,
        nombre: formComp.nombre,
        fecha: formComp.fecha,
        tipo: formComp.tipo || null,
        objetivo: formComp.objetivo || null,
        notas: formComp.notas || null,
      })
    }
    setSaving(false)
    setModalComp(false)
    cargarPlanificacion()
  }

  async function guardarSemana() {
    if (!modalSemana) return
    setSaving(true)
    const { bloque_id, numero, semanaExistente } = modalSemana
    if (semanaExistente) {
      await supabase.from('semanas').update({
        objetivo: formSemana.objetivo || null,
        notas: formSemana.notas || null,
        carga: formSemana.carga,
        km_objetivo: formSemana.km_objetivo || null,
        km_real: formSemana.km_real || null,
      }).eq('id', semanaExistente.id)
    } else {
      await supabase.from('semanas').insert({
        bloque_id,
        numero,
        objetivo: formSemana.objetivo || null,
        notas: formSemana.notas || null,
        carga: formSemana.carga,
       km_objetivo: formSemana.km_objetivo || null,
        km_real: formSemana.km_real || null,
      })
    }
    setSaving(false)
    setModalSemana(null)
    cargarPlanificacion()
  }

  async function eliminarBloque(id) {
    if (!window.confirm('¿Eliminar este bloque?')) return
    await supabase.from('bloques').delete().eq('id', id)
    cargarPlanificacion()
  }

  async function eliminarComp(id) {
    if (!window.confirm('¿Eliminar esta competición?')) return
    await supabase.from('competiciones').delete().eq('id', id)
    cargarPlanificacion()
  }
  async function guardarSubbloque() {
    if (!formSubbloque.nombre || !modalSubbloque?.bloque_id) return
    setSaving(true)
    const datos = {
      bloque_id: modalSubbloque.bloque_id,
      nombre: formSubbloque.nombre,
      semana_inicio: parseInt(formSubbloque.semana_inicio),
      semana_fin: parseInt(formSubbloque.semana_fin),
      objetivo: formSubbloque.objetivo || null,
      notas: formSubbloque.notas || null,
      zona1_2: parseInt(formSubbloque.zona1_2) || 0,
      zona3_4: parseInt(formSubbloque.zona3_4) || 0,
      zona5: parseInt(formSubbloque.zona5) || 0,
      km_min: formSubbloque.km_min || null,
      km_max: formSubbloque.km_max || null,
    }
    if (modalSubbloque.id) {
      await supabase.from('subbloques').update(datos).eq('id', modalSubbloque.id)
    } else {
      await supabase.from('subbloques').insert(datos)
    }
    setSaving(false)
    setModalSubbloque(null)
    cargarPlanificacion()
  }

  async function eliminarSubbloque(id) {
    if (!window.confirm('¿Eliminar este sub bloque?')) return
    await supabase.from('subbloques').delete().eq('id', id)
    cargarPlanificacion()
  }

  function abrirNuevoBloque() {
    const fechaInicio = bloques.length > 0
      ? format(addWeeks(parseISO(bloques[bloques.length - 1].fecha_inicio), bloques[bloques.length - 1].semanas), 'yyyy-MM-dd')
      : planificacion?.fecha_inicio || ''
    setFormBloque({ ...EMPTY_BLOQUE, fecha_inicio: fechaInicio })
    setModalBloque({})
  }

  function abrirEditarBloque(b) {
    setFormBloque({
      nombre: b.nombre, fase: b.fase, carga: b.carga,
      semanas: b.semanas, fecha_inicio: b.fecha_inicio,
      objetivo: b.objetivo || '', contenidos: b.contenidos || '', color: b.color || '#2d6a4f'
    })
    setModalBloque(b)
  }

  function abrirSemana(bloque_id, numero) {
    const semsBloque = semanas[bloque_id] || []
    const semanaExistente = semsBloque.find(s => s.numero === numero)

    // Buscar el sub bloque al que pertenece esta semana
    const subDeLaSemana = (subbloques[bloque_id] || []).find(s => numero >= s.semana_inicio && numero <= s.semana_fin)
    const objetivoPorDefecto = semanaExistente?.objetivo || (subDeLaSemana?.nombre ? subDeLaSemana.nombre : '')

    setFormSemana({
      objetivo: objetivoPorDefecto,
      notas: semanaExistente?.notas || '',
      carga: semanaExistente?.carga || 'media',
      zona1_2_real: semanaExistente?.zona1_2_real || 0,
      zona3_4_real: semanaExistente?.zona3_4_real || 0,
      zona5_real: semanaExistente?.zona5_real || 0,
      km_objetivo: semanaExistente?.km_objetivo || subDeLaSemana?.km_min || null,
      km_real: semanaExistente?.km_real || null,
    })
    setModalSemana({ bloque_id, numero, semanaExistente })
  }

  const totalSemanas = planificacion
    ? differenceInWeeks(parseISO(planificacion.fecha_fin), parseISO(planificacion.fecha_inicio)) + 1
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Planificación</h2>
          {planificacion && <p className="page-subtitle">{planificacion.nombre}</p>}
        </div>
        <div className="flex gap-2" style={{ position: 'relative' }}>
          {planificacion && (
            <button className="btn btn-ghost btn-sm" onClick={copiarEnlace} title="Copiar enlace público">
              🔗 Compartir
            </button>
          )}
          {planificacion && clienteSeleccionado && (
            <button className="btn btn-ghost" onClick={() => {
              setFormPlan({
                cliente_id: planificacion.cliente_id,
                nombre: planificacion.nombre,
                fecha_inicio: planificacion.fecha_inicio,
                fecha_fin: planificacion.fecha_fin,
                notas: planificacion.notas || ''
              })
              setModalPlan('editar')
            }}>
              Editar
            </button>
          )}
          {planificacion && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={async () => {
              if (!window.confirm(`¿Eliminar la planificación "${planificacion.nombre}"? Se borrarán todos sus bloques y sub bloques.`)) return
              await supabase.from('planificaciones').delete().eq('id', planificacion.id)
              setPlanificacion(null)
              setBloques([])
              setSemanas({})
              setSubbloques({})
              setCompeticiones([])
              cargarPlanificacion()
            }}>
              <X size={13} /> Eliminar
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-primary" onClick={() => setObjetivoVisible(v => ({ ...v, menuAnadir: !v.menuAnadir }))}>
              <Plus size={13} /> Añadir
            </button>
            {objetivoVisible.menuAnadir && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 180, overflow: 'hidden' }}
                onMouseLeave={() => setObjetivoVisible(v => ({ ...v, menuAnadir: false }))}>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                  onClick={() => { setObjetivoVisible(v => ({ ...v, menuAnadir: false })); setFormPlan(EMPTY_PLAN); setModalPlan(true) }}>
                  <Plus size={13} /> Nueva planificación
                </button>
                {planificacion && (
                  <>
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                      onClick={() => { setObjetivoVisible(v => ({ ...v, menuAnadir: false })); abrirNuevoBloque() }}>
                      <Plus size={13} /> Bloque
                    </button>
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                      onClick={() => {
                        setObjetivoVisible(v => ({ ...v, menuAnadir: false }))
                        if (bloques.length === 0) { alert('Primero crea un bloque'); return }
                        setFormSubbloque({ nombre: '', semana_inicio: 1, semana_fin: 1, objetivo: '', notas: '', zona1_2: 0, zona3_4: 0, zona5: 0 })
                        setModalSubbloque({ bloque_id: bloques[0].id })
                      }}>
                      <Plus size={13} /> Sub bloque
                    </button>
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                      onClick={() => { setObjetivoVisible(v => ({ ...v, menuAnadir: false })); setFormComp(EMPTY_COMP); setModalComp(true) }}>
                      <Trophy size={13} /> Competición
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-center" style={{ marginBottom: 20 }}>
        <select className="form-select" style={{ maxWidth: 260 }}
          value={clienteSeleccionado || ''}
          onChange={e => { setClienteSeleccionado(e.target.value || null); setPlanificacion(null); setBloques([]) }}>
          <option value="">Selecciona un cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {planificaciones.length > 1 && (
          <select className="form-select" style={{ maxWidth: 260 }}
            value={planificacion?.id || ''}
            onChange={e => {
              const p = planificaciones.find(x => x.id === e.target.value)
              setPlanificacion(p || null)
              setBloques([])
              setSemanas({})
              setSubbloques({})
            }}>
            {planificaciones.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        )}

        {planificacion && (
          <div className="flex gap-2">
            {['timeline', 'macro', 'subbloque', 'micro'].map(v => (
              <button key={v} className="btn btn-ghost btn-sm"
                style={vista === v ? { background: 'var(--bg2)', fontWeight: 500 } : {}}
                onClick={() => setVista(v)}>
               {v === 'timeline' ? 'Resumen' : v === 'macro' ? 'Bloque' : v === 'subbloque' ? 'Sub bloque' : 'Semana'}
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
          <button className="btn btn-primary" style={{ marginTop: 16 }}
            onClick={() => { setFormPlan({ ...EMPTY_PLAN, cliente_id: clienteSeleccionado }); setModalPlan(true) }}>
            <Plus size={13} /> Crear planificación
          </button>
        </div>
      )}

      {!loading && planificacion && (
        <>
         {/* Panel de control */}
          {vista === 'timeline' && (
            <>
              {/* Barra de progreso */}
              {(() => {
                const hoy = new Date()
                const inicio = parseISO(planificacion.fecha_inicio)
                const fin = parseISO(planificacion.fecha_fin)
                const totalDias = (fin - inicio) / (1000 * 60 * 60 * 24)
                const diasTranscurridos = Math.max(0, Math.min((hoy - inicio) / (1000 * 60 * 60 * 24), totalDias))
                const pct = Math.round((diasTranscurridos / totalDias) * 100)
                const semanaActual = Math.max(1, Math.min(Math.ceil(diasTranscurridos / 7), totalSemanas))
                const enCurso = hoy >= inicio && hoy <= fin

                // Bloque actual
                let bloqueActual = null
                let semanaGlobal = 0
                for (const b of bloques) {
                  if (semanaActual > semanaGlobal && semanaActual <= semanaGlobal + b.semanas) {
                    bloqueActual = b
                    break
                  }
                  semanaGlobal += b.semanas
                }

                // Subbloque actual
                let subbloqueActual = null
                if (bloqueActual) {
                  const semanaEnBloque = semanaActual - semanaGlobal
                  const subs = subbloques[bloqueActual.id] || []
                  subbloqueActual = subs.find(s => semanaEnBloque >= s.semana_inicio && semanaEnBloque <= s.semana_fin)
                }

                return (
                  <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {enCurso ? 'En curso' : hoy < inicio ? 'No iniciada' : 'Completada'}
                      </span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>
                        {enCurso ? `S${semanaActual} / ${totalSemanas}` : `${totalSemanas} semanas`}
                      </span>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: enCurso ? 'var(--accent)' : hoy < inicio ? 'var(--border2)' : 'var(--accent)', borderRadius: 5, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: enCurso && bloqueActual ? 12 : 0 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'capitalize' }}>{format(inicio, 'dd MMM yyyy', { locale: es })}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{pct}%</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'capitalize' }}>{format(fin, 'dd MMM yyyy', { locale: es })}</span>
                    </div>

                    {enCurso && bloqueActual && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: bloqueActual.color || 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Bloque actual</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{bloqueActual.nombre}</span>
                        </div>
                        {subbloqueActual && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: bloqueActual.color || 'var(--accent)', flexShrink: 0, opacity: 0.6 }} />
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Sub bloque</span>
                            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{subbloqueActual.nombre}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Resumen */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                 { label: 'Bloques', value: bloques.length },
                { label: 'Sub bloques', value: Object.values(subbloques).flat().length },
                { label: 'Semanas', value: totalSemanas },
                { label: 'Compet.', value: competiciones.length },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className="label">{s.label}</div>
                    <div className="value">{s.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {vista !== 'timeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Semanas', value: totalSemanas },
                { label: 'Bloques', value: bloques.length },
                { label: 'Sub bloques', value: Object.values(subbloques).flat().length },
                { label: 'Compet.', value: competiciones.length },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ padding: '10px 14px' }}>
                  <div className="label">{s.label}</div>
                  <div className="value">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {vista === 'timeline' && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: Math.max(totalSemanas * 40, 400), position: 'relative' }}>

                
{/* Marcador estás aquí */}
                {(() => {
                  const hoy2 = new Date()
                  const ini2 = parseISO(planificacion.fecha_inicio)
                  const fin2 = parseISO(planificacion.fecha_fin)
                  const enCurso2 = hoy2 >= ini2 && hoy2 <= fin2
                  if (!enCurso2) return null
                  const dias2 = (hoy2 - ini2) / (1000 * 60 * 60 * 24)
                  const pct2 = (dias2 / (totalSemanas * 7)) * 100
                  return (
                    <div style={{ position: 'relative', height: 20, marginBottom: 2 }}>
                      <div style={{ position: 'absolute', left: `${pct2}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                        <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--accent)' }}>
                          ▼ Estás aquí
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Bloques */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                  {bloques.map(b => {
                    const width = (b.semanas / totalSemanas) * 100
                    return (
                      <div key={b.id} style={{ width: `${width}%`, minWidth: 40 }}>
                        <div style={{
                          background: b.color || '#2d6a4f', borderRadius: '4px 4px 0 0', padding: '5px 8px',
                          cursor: 'pointer', height: 40, overflow: 'hidden',
                        }} onClick={() => abrirEditarBloque(b)}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.nombre}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                            {b.semanas}s
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Sub bloques */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 3, position: 'relative', height: 28 }}>
                  {bloques.map(b => {
                    const subsBloque = subbloques[b.id] || []
                    const bloquePct = (b.semanas / totalSemanas) * 100
                    const bloqueOffset = bloques.slice(0, bloques.indexOf(b)).reduce((s, x) => s + (x.semanas / totalSemanas) * 100, 0)
                    return subsBloque.map(sub => {
                      const subWidth = ((sub.semana_fin - sub.semana_inicio + 1) / totalSemanas) * 100
                      const subOffset = bloqueOffset + ((sub.semana_inicio - 1) / totalSemanas) * 100
                      return (
                        <div key={sub.id} onClick={() => {
                          setFormSubbloque({
                            nombre: sub.nombre,
                            semana_inicio: sub.semana_inicio,
                            semana_fin: sub.semana_fin,
                            objetivo: sub.objetivo || '',
                            notas: sub.notas || '',
                          })
                          setModalSubbloque({ ...sub, bloque_id: b.id })
                        }} title={sub.nombre} style={{
                          position: 'absolute',
                          left: `${subOffset}%`,
                          width: `${subWidth}%`,
                          height: 28,
                          background: b.color ? b.color + 'aa' : '#2d6a4f88',
                          borderRadius: 3,
                          padding: '3px 6px',
                          overflow: 'hidden',
                          border: `1px solid ${b.color || '#2d6a4f'}`,
                          cursor: 'pointer',
                        }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sub.nombre}
                          </div>
                        </div>
                      )
                    })
                  })}
                </div>

                {/* Competiciones */}
                {competiciones.length > 0 && (
                  <div style={{ display: 'flex', marginBottom: 3, position: 'relative', height: 36 }}>
                    {competiciones.map(comp => {
                      const semanaComp = differenceInWeeks(parseISO(comp.fecha), parseISO(planificacion.fecha_inicio))
                      const pct = (semanaComp / totalSemanas) * 100
                      return (
                       <div key={comp.id} onClick={() => {
                          setFormComp({
                            nombre: comp.nombre,
                            fecha: comp.fecha,
                            tipo: comp.tipo || '',
                            objetivo: comp.objetivo || '',
                            notas: comp.notas || '',
                          })
                          setModalComp({ ...comp })
                        }} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, cursor: 'pointer' }}>
                          <Trophy size={13} color="var(--danger)" />
                          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--danger)', whiteSpace: 'nowrap', marginTop: 1, textAlign: 'center' }}>
                            {comp.nombre}
                          </div>
                          <div style={{ fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--danger)', whiteSpace: 'nowrap', opacity: 0.8 }}>
                            {format(parseISO(comp.fecha), 'dd MMM', { locale: es })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Semanas */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)', paddingTop: 2 }}>
                  {Array.from({ length: totalSemanas }, (_, i) => {
                    // Encontrar qué bloque contiene esta semana
                    let semanaGlobal = i + 1
                    let bloqueDeEstaSemana = null
                    let semanaEnBloque = null
                    let acum = 0
                    for (const b of bloques) {
                      if (semanaGlobal > acum && semanaGlobal <= acum + b.semanas) {
                        bloqueDeEstaSemana = b
                        semanaEnBloque = semanaGlobal - acum
                        break
                      }
                      acum += b.semanas
                    }
                    return (
                      <div key={i}
                        onClick={() => {
                          if (bloqueDeEstaSemana) {
                            setVista('micro')
                            setBloqueAbierto(bloqueDeEstaSemana.id)
                          }
                        }}
                        style={{
                          flex: 1, textAlign: 'center', fontSize: 8, color: bloqueDeEstaSemana ? 'var(--accent)' : 'var(--text3)',
                          fontFamily: 'var(--mono)', borderLeft: i % 4 === 0 ? '1px solid var(--border)' : 'none',
                          cursor: bloqueDeEstaSemana ? 'pointer' : 'default',
                          padding: '2px 0',
                          borderRadius: 2,
                        }}
                        onMouseEnter={e => { if (bloqueDeEstaSemana) e.currentTarget.style.background = 'var(--accent-light)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        title={bloqueDeEstaSemana ? `${bloqueDeEstaSemana.nombre} · Semana ${semanaEnBloque}` : ''}
                      >
                        {`S${i + 1}`}
                      </div>
                    )
                  })}
                </div>

                {/* Meses */}
                <div style={{ display: 'flex', marginTop: 2 }}>
                  {Array.from({ length: totalSemanas }, (_, i) => {
                    const fecha = addWeeks(parseISO(planificacion.fecha_inicio), i)
                    const esPrimeroDelMes = i === 0 || format(fecha, 'MM') !== format(addWeeks(parseISO(planificacion.fecha_inicio), i - 1), 'MM')
                    return (
                      <div key={i} style={{ flex: 1, position: 'relative', height: 16 }}>
                        {esPrimeroDelMes && (
                          <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--accent)', whiteSpace: 'nowrap', textTransform: 'capitalize', borderLeft: '1px solid var(--accent)', paddingLeft: 3, fontWeight: 600 }}>
                            {format(fecha, 'MMM yyyy', { locale: es })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

              </div>
            </div>
          )}

          
          {/* Semana tipo y Consideraciones — solo en timeline */}
          {vista === 'timeline' && clienteData && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>

              {/* Semana tipo */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Semana tipo</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModalSemanaTipo(true)}>Editar</button>
                </div>
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia, i) => {
                  const val = (clienteData.semana_tipo || {})[dia] || ''
                  return (
                    <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < 6 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', width: 72, flexShrink: 0 }}>{dia}</span>
                      <span style={{ fontSize: 13, color: val ? 'var(--text)' : 'var(--text3)', fontStyle: val ? 'normal' : 'italic' }}>
                        {val || 'Descanso'}
                      </span>
                    </div>
                  )
                })}
                {clienteData.disponibilidad && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Disponibilidad</div>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{clienteData.disponibilidad}</div>
                  </div>
                )}
              </div>

              {/* Consideraciones */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Consideraciones</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModalConsideraciones(true)}>Editar</button>
                </div>
                {clienteData.consideraciones ? (
                  <div>
                    {clienteData.consideraciones.split('\n').filter(l => l.trim()).map((linea, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                        <span style={{ fontSize: 13 }}>{linea}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Sin consideraciones — clic en Editar para añadir</p>
                )}
              </div>
            </div>
          )}
          {vista === 'macro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              

              {bloques.map((b, idx) => (
                <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {b.semanas} semanas · desde {format(parseISO(b.fecha_inicio), 'dd MMM', { locale: es })}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {b.objetivo && (
                        <button className="btn btn-ghost btn-sm" title={objetivoVisible[b.id] ? 'Ocultar detalle' : 'Ver detalle'}
                          onClick={() => setObjetivoVisible(v => ({ ...v, [b.id]: !v[b.id] }))}
                          style={{ color: objetivoVisible[b.id] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                          <Layers size={13} />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarBloque(b)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><X size={13} /></button>
                    </div>
                  </div>
                  {objetivoVisible[b.id] && b.objetivo && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 0 6px', display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo</div>
                      <div>
                        {b.objetivo.split('\n').filter(l => l.trim()).map((linea, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                            <span style={{ fontSize: 13 }}>{linea}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {bloques.length === 0 && <div className="empty"><Layers size={40} /><p>No hay bloques. Añade el primero.</p></div>}
            </div>
          )}

          {vista === 'subbloque' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {bloques.map((b, idx) => {
                const subsBloque = subbloques[b.id] || []
                const abierto = bloqueAbierto === b.id
                return (
                  <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                   <div style={{ padding: '12px 16px', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                        onClick={() => setBloqueAbierto(abierto ? null : b.id)}>
                        {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 4 }}>{b.semanas} semanas</span>
                        {b.objetivo && (
                          <button className="btn btn-ghost btn-sm" title={objetivoVisible[b.id] ? 'Ocultar objetivo' : 'Ver objetivo'}
                            onClick={e => { e.stopPropagation(); setObjetivoVisible(v => ({ ...v, [b.id]: !v[b.id] })) }}
                            style={{ color: objetivoVisible[b.id] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                            <Layers size={13} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm ml-auto" onClick={e => {
                          e.stopPropagation()
                          setFormSubbloque({ nombre: '', semana_inicio: 1, semana_fin: 1, objetivo: '', notas: '' })
                          setModalSubbloque({ bloque_id: b.id })
                        }}>
                          <Plus size={12} /> Sub bloque
                        </button>
                      </div>
                      {abierto && b.objetivo && objetivoVisible[b.id] && (
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo del bloque</div>
                          <div>
                            {b.objetivo.split('\n').filter(l => l.trim()).map((linea, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                                <span style={{ fontSize: 13 }}>{linea}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {abierto && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {subsBloque.length === 0 ? (
                          <div style={{ padding: '16px', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                            Sin sub bloques — añade el primero.
                          </div>
                        ) : (
                          subsBloque.map(sub => (
                            <div key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{sub.nombre}</span>
                                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                                  S{sub.semana_inicio} — S{sub.semana_fin}
                                </span>
                                <div className="flex gap-1 ml-auto">
                                  {sub.notas && (
                                    <button className="btn btn-ghost btn-sm"
                                      title={objetivoVisible[sub.id] ? 'Ocultar contenidos' : 'Ver contenidos'}
                                      onClick={() => setObjetivoVisible(v => ({ ...v, [sub.id]: !v[sub.id] }))}
                                      style={{ color: objetivoVisible[sub.id] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                                      <Layers size={13} />
                                    </button>
                                  )}
                                  <button className="btn btn-ghost btn-sm" onClick={() => {
                                    setFormSubbloque({
                                      nombre: sub.nombre,
                                      semana_inicio: sub.semana_inicio,
                                      semana_fin: sub.semana_fin,
                                      objetivo: sub.objetivo || '',
                                      notas: sub.notas || '',
                                      zona1_2: sub.zona1_2 || 0,
                                      zona3_4: sub.zona3_4 || 0,
                                      zona5: sub.zona5 || 0,
                                      km_min: sub.km_min || null,
                                      km_max: sub.km_max || null,
                                    })
                                    setModalSubbloque({ ...sub, bloque_id: b.id })
                                  }}>Editar</button>
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarSubbloque(sub.id)}>
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                              {objetivoVisible[sub.id] && (
                                <div style={{ padding: '0 16px 12px 30px' }}>
                                  {sub.notas && (
                                    <>
                                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Contenidos</div>
                                      <div style={{ marginBottom: 10 }}>
                                        {sub.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                                            <span style={{ fontSize: 13 }}>{linea}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                  {(() => {
                                    // Calcular zonas reales sumando semanas del sub bloque
                                    const semsBloque = semanas[b.id] || []
                                    const semsDelSub = semsBloque.filter(s => s.numero >= sub.semana_inicio && s.numero <= sub.semana_fin)
                                    const totalMin = semsDelSub.reduce((s, x) => s + (x.zona1_2_real || 0) + (x.zona3_4_real || 0) + (x.zona5_real || 0), 0)
                                    const z1real = semsDelSub.reduce((s, x) => s + (x.zona1_2_real || 0), 0)
                                    const z3real = semsDelSub.reduce((s, x) => s + (x.zona3_4_real || 0), 0)
                                    const z5real = semsDelSub.reduce((s, x) => s + (x.zona5_real || 0), 0)
                                    const tieneObjetivo = sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0
                                    const tieneReal = totalMin > 0

                                    if (!tieneObjetivo && !tieneReal) return null
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {tieneObjetivo && (
                                          <div>
                                            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo zonas</div>
                                            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                                              {sub.zona1_2 > 0 && <div style={{ width: `${sub.zona1_2}%`, background: '#10b981', opacity: 0.6 }} />}
                                              {sub.zona3_4 > 0 && <div style={{ width: `${sub.zona3_4}%`, background: '#f59e0b', opacity: 0.6 }} />}
                                              {sub.zona5 > 0 && <div style={{ width: `${sub.zona5}%`, background: '#ef4444', opacity: 0.6 }} />}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                              {sub.zona1_2 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981', opacity: 0.8 }}>Z1-Z2 {sub.zona1_2}%</span>}
                                              {sub.zona3_4 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b', opacity: 0.8 }}>Z3-Z4 {sub.zona3_4}%</span>}
                                              {sub.zona5 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444', opacity: 0.8 }}>Z5-Z5+ {sub.zona5}%</span>}
                                            </div>
                                          </div>
                                        )}
                                        {(() => {
                                          const kmObj = sub.km_min && sub.km_max ? `${sub.km_min}-${sub.km_max} km/sem` : sub.km_min ? `${sub.km_min}+ km/sem` : null
                                          const semsConKm = semsDelSub.filter(s => s.km_real)
                                          const kmRealTotal = semsDelSub.reduce((s, x) => s + (x.km_real || 0), 0)
                                          const kmRealMedio = semsConKm.length > 0 ? Math.round(kmRealTotal / semsConKm.length) : 0
                                          if (!kmObj && kmRealMedio === 0) return null
                                          const kmMax = Math.max(sub.km_max || 0, kmRealMedio, 1)
                                          return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                              <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', flexShrink: 0 }}>Vol</span>
                                              {kmObj && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text2)', opacity: 0.7 }}>obj: {kmObj}</span>}
                                              {kmRealMedio > 0 && (
                                                <>
                                                  <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                                                    {sub.km_max && <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min((sub.km_min / sub.km_max) * 100, 100)}%`, background: '#3b82f6', opacity: 0.3, borderRadius: 2 }} />}
                                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min((kmRealMedio / kmMax) * 100, 100)}%`, background: '#3b82f6', borderRadius: 2 }} />
                                                  </div>
                                                  <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#3b82f6', flexShrink: 0 }}>real: {kmRealMedio} km/sem</span>
                                                </>
                                              )}
                                            </div>
                                          )
                                        })()}
                                        {tieneReal && (
                                          <div>
                                            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Real — {totalMin} min</div>
                                            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                                              {z1real > 0 && <div style={{ width: `${(z1real / totalMin) * 100}%`, background: '#10b981' }} />}
                                              {z3real > 0 && <div style={{ width: `${(z3real / totalMin) * 100}%`, background: '#f59e0b' }} />}
                                              {z5real > 0 && <div style={{ width: `${(z5real / totalMin) * 100}%`, background: '#ef4444' }} />}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                              {z1real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981' }}>Z1-Z2 {Math.round((z1real / totalMin) * 100)}% ({z1real}min)</span>}
                                              {z3real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b' }}>Z3-Z4 {Math.round((z3real / totalMin) * 100)}% ({z3real}min)</span>}
                                              {z5real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444' }}>Z5-Z5+ {Math.round((z5real / totalMin) * 100)}% ({z5real}min)</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {bloques.length === 0 && <div className="empty"><p>Añade bloques primero desde la vista Bloque.</p></div>}
            </div>
          )}
         {vista === 'micro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {bloques.map((b, idx) => {
                const semsBloque = semanas[b.id] || []
                const subsBloque = subbloques[b.id] || []
                const abierto = bloqueAbierto === b.id
                return (
                  <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>

                    {/* Cabecera bloque */}
                    <div style={{ padding: '12px 16px', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                        onClick={() => setBloqueAbierto(abierto ? null : b.id)}>
                        {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 4 }}>{b.semanas} semanas</span>
                        {b.objetivo && (
                          <button className="btn btn-ghost btn-sm" title={objetivoVisible[b.id] ? 'Ocultar info bloque' : 'Ver info bloque'}
                            onClick={e => { e.stopPropagation(); setObjetivoVisible(v => ({ ...v, [b.id]: !v[b.id] })) }}
                            style={{ color: objetivoVisible[b.id] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                            <Layers size={13} />
                          </button>
                        )}
                      </div>

                      {/* Objetivo bloque desplegable */}
                      {objetivoVisible[b.id] && b.objetivo && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo bloque</div>
                          <div>
                            {b.objetivo.split('\n').filter(l => l.trim()).map((linea, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 4 }} />
                                <span style={{ fontSize: 13 }}>{linea}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Semanas agrupadas por sub bloque */}
                    {abierto && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {subsBloque.length > 0 ? (
                          subsBloque.map(sub => {
                            const semsDelSub = Array.from(
                              { length: sub.semana_fin - sub.semana_inicio + 1 },
                              (_, i) => sub.semana_inicio + i
                            )
                            return (
                              <div key={sub.id}>
                                {/* Cabecera sub bloque */}
                                <div style={{ padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>{sub.nombre}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>S{sub.semana_inicio}–S{sub.semana_fin}</span>
                                    {sub.notas && (
                                      <button className="btn btn-ghost btn-sm"
                                        title={objetivoVisible[sub.id] ? 'Ocultar contenidos' : 'Ver contenidos'}
                                        onClick={() => setObjetivoVisible(v => ({ ...v, [sub.id]: !v[sub.id] }))}
                                        style={{ color: objetivoVisible[sub.id] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                                        <Layers size={12} />
                                      </button>
                                    )}
                                  </div>
                                  {(() => {
                                    const semsBloque = semanas[b.id] || []
                                    const semsDelSub = semsBloque.filter(s => s.numero >= sub.semana_inicio && s.numero <= sub.semana_fin)
                                    const totalMin = semsDelSub.reduce((s, x) => s + (x.zona1_2_real || 0) + (x.zona3_4_real || 0) + (x.zona5_real || 0), 0)
                                    const z1real = semsDelSub.reduce((s, x) => s + (x.zona1_2_real || 0), 0)
                                    const z3real = semsDelSub.reduce((s, x) => s + (x.zona3_4_real || 0), 0)
                                    const z5real = semsDelSub.reduce((s, x) => s + (x.zona5_real || 0), 0)
                                    const tieneObjetivo = sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0
                                    const tieneReal = totalMin > 0
                                    if (!tieneObjetivo && !tieneReal) return null
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {tieneObjetivo && (
                                          <div>
                                            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 3 }}>Objetivo</div>
                                            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
                                              {sub.zona1_2 > 0 && <div style={{ width: `${sub.zona1_2}%`, background: '#10b981', opacity: 0.6 }} />}
                                              {sub.zona3_4 > 0 && <div style={{ width: `${sub.zona3_4}%`, background: '#f59e0b', opacity: 0.6 }} />}
                                              {sub.zona5 > 0 && <div style={{ width: `${sub.zona5}%`, background: '#ef4444', opacity: 0.6 }} />}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                              {sub.zona1_2 > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#10b981', opacity: 0.8 }}>Z1-Z2 {sub.zona1_2}%</span>}
                                              {sub.zona3_4 > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#f59e0b', opacity: 0.8 }}>Z3-Z4 {sub.zona3_4}%</span>}
                                              {sub.zona5 > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#ef4444', opacity: 0.8 }}>Z5-Z5+ {sub.zona5}%</span>}
                                            </div>
                                          </div>
                                        )}
                                        {tieneReal && (
                                          <div>
                                            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 3 }}>Real acumulado — {totalMin} min</div>
                                            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
                                              {z1real > 0 && <div style={{ width: `${(z1real / totalMin) * 100}%`, background: '#10b981' }} />}
                                              {z3real > 0 && <div style={{ width: `${(z3real / totalMin) * 100}%`, background: '#f59e0b' }} />}
                                              {z5real > 0 && <div style={{ width: `${(z5real / totalMin) * 100}%`, background: '#ef4444' }} />}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                              {z1real > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#10b981' }}>Z1-Z2 {Math.round((z1real / totalMin) * 100)}%</span>}
                                              {z3real > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#f59e0b' }}>Z3-Z4 {Math.round((z3real / totalMin) * 100)}%</span>}
                                              {z5real > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#ef4444' }}>Z5-Z5+ {Math.round((z5real / totalMin) * 100)}%</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                                {/* Contenidos sub bloque desplegable */}
                                {objetivoVisible[sub.id] && (sub.notas || sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0) && (
                                  <div style={{ padding: '8px 16px 12px 30px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                    {sub.notas && (
                                      <div style={{ marginBottom: 8 }}>
                                        {sub.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 5, opacity: 0.7 }} />
                                            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{linea}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {(sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0) && (
                                      <div>
                                        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                                          {sub.zona1_2 > 0 && <div style={{ width: `${sub.zona1_2}%`, background: '#10b981' }} />}
                                          {sub.zona3_4 > 0 && <div style={{ width: `${sub.zona3_4}%`, background: '#f59e0b' }} />}
                                          {sub.zona5 > 0 && <div style={{ width: `${sub.zona5}%`, background: '#ef4444' }} />}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                          {sub.zona1_2 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981' }}>Z1-Z2 {sub.zona1_2}%</span>}
                                          {sub.zona3_4 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b' }}>Z3-Z4 {sub.zona3_4}%</span>}
                                          {sub.zona5 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444' }}>Z5-Z5+ {sub.zona5}%</span>}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Semanas del sub bloque */}
                                {semsDelSub.map(num => {
                                  const sem = semsBloque.find(s => s.numero === num)
                                  const fechaSem = format(addWeeks(parseISO(b.fecha_inicio), num - 1), 'dd MMM', { locale: es })
                                  const cargaSem = sem?.carga ? CARGAS[sem.carga] : null
                                  return (
                                  <div key={num} style={{ borderBottom: '1px solid var(--border)' }}>
                                      {(() => {
                                        const fechaSemana = addWeeks(parseISO(b.fecha_inicio), num - 1)
                                        const compSemana = competiciones.filter(c => {
                                          const fc = parseISO(c.fecha)
                                          const fs = fechaSemana
                                          const fe = addWeeks(fechaSemana, 1)
                                          return fc >= fs && fc < fe
                                        })
                                        return compSemana.map(comp => (
                                          <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'var(--danger-light)', borderBottom: '1px solid var(--danger)', cursor: 'pointer' }}
                                            onClick={() => { setFormComp({ nombre: comp.nombre, fecha: comp.fecha, tipo: comp.tipo || '', objetivo: comp.objetivo || '', notas: comp.notas || '' }); setModalComp({ ...comp }) }}>
                                            <Trophy size={12} color="var(--danger)" />
                                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)' }}>{comp.nombre}</span>
                                            <span style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'var(--mono)', opacity: 0.8 }}>{format(parseISO(comp.fecha), 'dd MMM', { locale: es })}</span>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); eliminarComp(comp.id) }}><X size={11} /></button>
                                          </div>
                                        ))
                                      })()}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
                                        onClick={() => abrirSemana(b.id, num)}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: cargaSem ? cargaSem.color : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: cargaSem ? 'white' : 'var(--text3)', fontFamily: 'var(--mono)' }}>S{num}</span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          {sem?.objetivo ? <div style={{ fontSize: 13 }}>{sem.objetivo}</div> : <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Sin objetivo — clic para añadir</div>}
                                          {(sem?.km_objetivo || sem?.km_real) && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                              {sem?.km_objetivo && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#3b82f6', opacity: 0.7 }}>obj: {sem.km_objetivo}km</span>}
                                              {sem?.km_real && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#3b82f6', fontWeight: 600 }}>real: {sem.km_real}km</span>}
                                              {sem?.km_objetivo && sem?.km_real && (
                                                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: sem.km_real >= sem.km_objetivo ? '#10b981' : '#ef4444' }}>
                                                  ({sem.km_real >= sem.km_objetivo ? '+' : ''}{sem.km_real - sem.km_objetivo}km)
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          {sem?.notas && (
                                            <button className="btn btn-ghost btn-sm"
                                              title={objetivoVisible[`sem-${b.id}-${num}`] ? 'Ocultar contenidos' : 'Ver contenidos'}
                                              onClick={e => { e.stopPropagation(); setObjetivoVisible(v => ({ ...v, [`sem-${b.id}-${num}`]: !v[`sem-${b.id}-${num}`] })) }}
                                              style={{ color: objetivoVisible[`sem-${b.id}-${num}`] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                                              <Layers size={12} />
                                            </button>
                                          )}
                                          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fechaSem}</div>
                                        </div>
                                      </div>
                                      {objetivoVisible[`sem-${b.id}-${num}`] && (sem?.notas || sem?.zona1_2_real > 0 || sem?.zona3_4_real > 0 || sem?.zona5_real > 0) && (
                                        <div style={{ padding: '0 16px 12px 56px' }}>
                                          {sem?.notas && (
                                            <div style={{ marginBottom: 10 }}>
                                              {sem.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
                                                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 5 }} />
                                                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{linea}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {(sem?.zona1_2_real > 0 || sem?.zona3_4_real > 0 || sem?.zona5_real > 0) && (
                                            <div>
                                              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Real vs Objetivo</div>
                                              {(() => {
                                                const subActual = (subbloques[b.id] || []).find(s => num >= s.semana_inicio && num <= s.semana_fin)
                                                return (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {subActual && (subActual.zona1_2 > 0 || subActual.zona3_4 > 0 || subActual.zona5 > 0) && (
                                                      <div>
                                                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Objetivo</div>
                                                        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                                          {subActual.zona1_2 > 0 && <div style={{ width: `${subActual.zona1_2}%`, background: '#10b981', opacity: 0.5 }} />}
                                                          {subActual.zona3_4 > 0 && <div style={{ width: `${subActual.zona3_4}%`, background: '#f59e0b', opacity: 0.5 }} />}
                                                          {subActual.zona5 > 0 && <div style={{ width: `${subActual.zona5}%`, background: '#ef4444', opacity: 0.5 }} />}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                                          {subActual.zona1_2 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981', opacity: 0.7 }}>Z1-Z2 {subActual.zona1_2}%</span>}
                                                          {subActual.zona3_4 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b', opacity: 0.7 }}>Z3-Z4 {subActual.zona3_4}%</span>}
                                                          {subActual.zona5 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444', opacity: 0.7 }}>Z5-Z5+ {subActual.zona5}%</span>}
                                                        </div>
                                                      </div>
                                                    )}
                                                    <div>
                                                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Real</div>
                                                      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                                        {sem.zona1_2_real > 0 && <div style={{ width: `${sem.zona1_2_real}%`, background: '#10b981' }} />}
                                                        {sem.zona3_4_real > 0 && <div style={{ width: `${sem.zona3_4_real}%`, background: '#f59e0b' }} />}
                                                        {sem.zona5_real > 0 && <div style={{ width: `${sem.zona5_real}%`, background: '#ef4444' }} />}
                                                      </div>
                                                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                                        {sem.zona1_2_real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981' }}>Z1-Z2 {sem.zona1_2_real}%</span>}
                                                        {sem.zona3_4_real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b' }}>Z3-Z4 {sem.zona3_4_real}%</span>}
                                                        {sem.zona5_real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444' }}>Z5-Z5+ {sem.zona5_real}%</span>}
                                                      </div>
                                                    </div>
                                                  </div>
                                                )
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })
                        ) : (
                          /* Sin sub bloques — mostrar semanas directamente */
                          Array.from({ length: b.semanas }, (_, i) => {
                            const num = i + 1
                            const sem = semsBloque.find(s => s.numero === num)
                            const fechaSem = format(addWeeks(parseISO(b.fecha_inicio), i), 'dd MMM', { locale: es })
                            const cargaSem = sem?.carga ? CARGAS[sem.carga] : null
                            return (
                              <div key={num} style={{ borderBottom: '1px solid var(--border)' }}>
                                {(() => {
                                  const fechaSemana = addWeeks(parseISO(b.fecha_inicio), num - 1)
                                  const compSemana = competiciones.filter(c => {
                                    const fc = parseISO(c.fecha)
                                    const fe = addWeeks(fechaSemana, 1)
                                    return fc >= fechaSemana && fc < fe
                                  })
                                  return compSemana.map(comp => (
                                    <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'var(--danger-light)', borderBottom: '1px solid var(--danger)', cursor: 'pointer' }}
                                      onClick={() => { setFormComp({ nombre: comp.nombre, fecha: comp.fecha, tipo: comp.tipo || '', objetivo: comp.objetivo || '', notas: comp.notas || '' }); setModalComp({ ...comp }) }}>
                                      <Trophy size={12} color="var(--danger)" />
                                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)' }}>{comp.nombre}</span>
                                      <span style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'var(--mono)', opacity: 0.8 }}>{format(parseISO(comp.fecha), 'dd MMM', { locale: es })}</span>
                                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); eliminarComp(comp.id) }}><X size={11} /></button>
                                    </div>
                                  ))
                                })()}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
                                  onClick={() => abrirSemana(b.id, num)}>
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: cargaSem ? cargaSem.color : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: cargaSem ? 'white' : 'var(--text3)', fontFamily: 'var(--mono)' }}>S{num}</span>
                                  </div>
                                 <div style={{ flex: 1 }}>
                                    {sem?.objetivo ? <div style={{ fontSize: 13 }}>{sem.objetivo}</div> : <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Sin objetivo — clic para añadir</div>}
                                    {(sem?.km_objetivo || sem?.km_real) && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                        {sem?.km_objetivo && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#3b82f6', opacity: 0.7 }}>obj: {sem.km_objetivo}km</span>}
                                        {sem?.km_real && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#3b82f6', fontWeight: 600 }}>real: {sem.km_real}km</span>}
                                        {sem?.km_objetivo && sem?.km_real && (
                                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: sem.km_real >= sem.km_objetivo ? '#10b981' : '#ef4444' }}>
                                            ({sem.km_real >= sem.km_objetivo ? '+' : ''}{sem.km_real - sem.km_objetivo}km)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {sem?.notas && (
                                      <button className="btn btn-ghost btn-sm"
                                        title={objetivoVisible[`sem-${b.id}-${num}`] ? 'Ocultar contenidos' : 'Ver contenidos'}
                                        onClick={e => { e.stopPropagation(); setObjetivoVisible(v => ({ ...v, [`sem-${b.id}-${num}`]: !v[`sem-${b.id}-${num}`] })) }}
                                        style={{ color: objetivoVisible[`sem-${b.id}-${num}`] ? b.color || 'var(--accent)' : 'var(--text3)', padding: '2px 6px' }}>
                                        <Layers size={12} />
                                      </button>
                                    )}
                                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fechaSem}</div>
                                  </div>
                                </div>
                                {objetivoVisible[`sem-${b.id}-${num}`] && (sem?.notas || sem?.zona1_2_real > 0 || sem?.zona3_4_real > 0 || sem?.zona5_real > 0) && (
                                  <div style={{ padding: '0 16px 12px 56px' }}>
                                    {sem?.notas && (
                                      <div style={{ marginBottom: 10 }}>
                                        {sem.notas.split('\n').filter(l => l.trim()).map((linea, i) => (
                                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0, marginTop: 5 }} />
                                            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{linea}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {(sem?.zona1_2_real > 0 || sem?.zona3_4_real > 0 || sem?.zona5_real > 0) && (
                                      <div>
                                        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Real vs Objetivo</div>
                                        {(() => {
                                          const subActual = (subbloques[b.id] || []).find(s => num >= s.semana_inicio && num <= s.semana_fin)
                                          return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                              {subActual && (subActual.zona1_2 > 0 || subActual.zona3_4 > 0 || subActual.zona5 > 0) && (
                                                <div>
                                                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Objetivo</div>
                                                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                                    {subActual.zona1_2 > 0 && <div style={{ width: `${subActual.zona1_2}%`, background: '#10b981', opacity: 0.5 }} />}
                                                    {subActual.zona3_4 > 0 && <div style={{ width: `${subActual.zona3_4}%`, background: '#f59e0b', opacity: 0.5 }} />}
                                                    {subActual.zona5 > 0 && <div style={{ width: `${subActual.zona5}%`, background: '#ef4444', opacity: 0.5 }} />}
                                                  </div>
                                                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                                    {subActual.zona1_2 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981', opacity: 0.7 }}>Z1-Z2 {subActual.zona1_2}%</span>}
                                                    {subActual.zona3_4 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b', opacity: 0.7 }}>Z3-Z4 {subActual.zona3_4}%</span>}
                                                    {subActual.zona5 > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444', opacity: 0.7 }}>Z5-Z5+ {subActual.zona5}%</span>}
                                                  </div>
                                                </div>
                                              )}
                                              <div>
                                                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Real</div>
                                                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                                  {sem.zona1_2_real > 0 && <div style={{ width: `${sem.zona1_2_real}%`, background: '#10b981' }} />}
                                                  {sem.zona3_4_real > 0 && <div style={{ width: `${sem.zona3_4_real}%`, background: '#f59e0b' }} />}
                                                  {sem.zona5_real > 0 && <div style={{ width: `${sem.zona5_real}%`, background: '#ef4444' }} />}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                                  {sem.zona1_2_real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#10b981' }}>Z1-Z2 {sem.zona1_2_real}%</span>}
                                                  {sem.zona3_4_real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#f59e0b' }}>Z3-Z4 {sem.zona3_4_real}%</span>}
                                                  {sem.zona5_real > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#ef4444' }}>Z5-Z5+ {sem.zona5_real}%</span>}
                                                </div>
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {bloques.length === 0 && <div className="empty"><p>Añade bloques primero desde la vista Bloque.</p></div>}
            </div>
          )}
        </>
      )}

      {modalPlan && (
        <div className="modal-backdrop" onClick={() => setModalPlan(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalPlan === 'editar' ? 'Editar planificación' : 'Nueva planificación'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPlan(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Cliente *</label>
              <select className="form-select" value={formPlan.cliente_id} onChange={e => setFormPlan(f => ({ ...f, cliente_id: e.target.value }))}>
                <option value="">Selecciona...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formPlan.nombre} onChange={e => setFormPlan(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Temporada 2025-2026" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={formPlan.fecha_inicio} onChange={e => setFormPlan(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha fin *</label>
                <input className="form-input" type="date" value={formPlan.fecha_fin} onChange={e => setFormPlan(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={formPlan.notas} onChange={e => setFormPlan(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPlan(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarPlan} disabled={saving}>{saving ? 'Guardando...' : modalPlan === 'editar' ? 'Guardar cambios' : 'Crear planificación'}</button>
            </div>
          </div>
        </div>
      )}

      {modalBloque !== null && (
        <div className="modal-backdrop" onClick={() => setModalBloque(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalBloque?.id ? 'Editar bloque' : 'Nuevo bloque'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalBloque(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formBloque.nombre} onChange={e => setFormBloque(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Base aeróbica" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Color del bloque</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COLORES.map(c => (
                  <div key={c} onClick={() => setFormBloque(f => ({ ...f, color: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: formBloque.color === c ? '3px solid var(--text)' : '3px solid transparent',
                      transition: 'border 0.15s' }} />
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Semanas *</label>
                <input className="form-input" type="number" min="1" max="52" value={formBloque.semanas} onChange={e => setFormBloque(f => ({ ...f, semanas: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={formBloque.fecha_inicio} onChange={e => setFormBloque(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
            </div>
           <div className="form-group">
              <label className="form-label">Objetivo del bloque</label>
              <textarea className="form-textarea" value={formBloque.objetivo} onChange={e => setFormBloque(f => ({ ...f, objetivo: e.target.value }))} placeholder={"Ej: Desarrollar base aeróbica\nMejorar técnica de carrera"} />
            </div>
            <div className="form-group">
              <label className="form-label">Contenidos</label>
              <textarea className="form-textarea" value={formBloque.contenidos} onChange={e => setFormBloque(f => ({ ...f, contenidos: e.target.value }))} placeholder="Ej: Fuerza general, rodajes suaves, técnica de carrera..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalBloque(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarBloque} disabled={saving}>{saving ? 'Guardando...' : modalBloque?.id ? 'Guardar cambios' : 'Crear bloque'}</button>
            </div>
          </div>
        </div>
      )}

      {modalSubbloque && (
        <div className="modal-backdrop" onClick={() => setModalSubbloque(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalSubbloque.id ? 'Editar sub bloque' : 'Nuevo sub bloque'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSubbloque(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formSubbloque.nombre} onChange={e => setFormSubbloque(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Adaptación" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Semana inicio *</label>
                <input className="form-input" type="number" min="1" value={formSubbloque.semana_inicio} onChange={e => setFormSubbloque(f => ({ ...f, semana_inicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Semana fin *</label>
                <input className="form-input" type="number" min="1" value={formSubbloque.semana_fin} onChange={e => setFormSubbloque(f => ({ ...f, semana_fin: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Km/semana mín</label>
                <input className="form-input" type="number" min="0" value={formSubbloque.km_min || ''} onChange={e => setFormSubbloque(f => ({ ...f, km_min: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Ej: 20" />
              </div>
              <div className="form-group">
                <label className="form-label">Km/semana máx</label>
                <input className="form-input" type="number" min="0" value={formSubbloque.km_max || ''} onChange={e => setFormSubbloque(f => ({ ...f, km_max: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Ej: 25" />
              </div>
            </div>
          
            <div className="form-group">
              <label className="form-label">Contenidos</label>
              <textarea className="form-textarea" value={formSubbloque.notas} onChange={e => setFormSubbloque(f => ({ ...f, notas: e.target.value }))} placeholder={"Ej: Fuerza general\nRodajes suaves\nTécnica de carrera"} style={{ minHeight: 120 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Distribución de zonas</label>
              {[
                { key: 'zona1_2', label: 'Z1-Z2', sublabel: 'Recuperación / Base', color: '#10b981' },
                { key: 'zona3_4', label: 'Z3-Z4', sublabel: 'Ritmos específicos / Calidad', color: '#f59e0b' },
                { key: 'zona5', label: 'Z5-Z5+', sublabel: 'Techo', color: '#ef4444' },
              ].map(zona => {
                const bloqueada = formSubbloque[`lock_${zona.key}`]
                return (
                  <div key={zona.key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => setFormSubbloque(f => ({ ...f, [`lock_${zona.key}`]: !f[`lock_${zona.key}`] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, opacity: bloqueada ? 1 : 0.3 }}
                          title={bloqueada ? 'Desbloquear' : 'Bloquear esta zona'}>
                          🔒
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 600, color: zona.color }}>{zona.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{zona.sublabel}</span>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600 }}>{formSubbloque[zona.key]}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={formSubbloque[zona.key]}
                      disabled={bloqueada}
                      onChange={e => {
                        const val = parseInt(e.target.value)
                        const otrasZonas = ['zona1_2', 'zona3_4', 'zona5'].filter(k => k !== zona.key)
                        const desbloqueadas = otrasZonas.filter(k => !formSubbloque[`lock_${k}`])
                        if (desbloqueadas.length === 0) return
                        const bloqueadasValor = otrasZonas.filter(k => formSubbloque[`lock_${k}`]).reduce((s, k) => s + (formSubbloque[k] || 0), 0)
                        const resto = 100 - val - bloqueadasValor
                        if (resto < 0) return
                        const totalDesbloqueadas = desbloqueadas.reduce((s, k) => s + (formSubbloque[k] || 0), 0)
                        const nuevasZonas = {}
                        if (totalDesbloqueadas === 0) {
                          desbloqueadas.forEach(k => { nuevasZonas[k] = Math.round(resto / desbloqueadas.length) })
                        } else {
                          desbloqueadas.forEach(k => { nuevasZonas[k] = Math.round((formSubbloque[k] / totalDesbloqueadas) * resto) })
                        }
                        setFormSubbloque(f => ({ ...f, [zona.key]: val, ...nuevasZonas }))
                      }}
                      style={{ width: '100%', accentColor: zona.color, opacity: bloqueada ? 0.4 : 1 }} />
                  </div>
                )
              })}
              {(formSubbloque.zona1_2 + formSubbloque.zona3_4 + formSubbloque.zona5) > 0 && (
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 4 }}>
                  {formSubbloque.zona1_2 > 0 && <div style={{ width: `${formSubbloque.zona1_2}%`, background: '#10b981' }} />}
                  {formSubbloque.zona3_4 > 0 && <div style={{ width: `${formSubbloque.zona3_4}%`, background: '#f59e0b' }} />}
                  {formSubbloque.zona5 > 0 && <div style={{ width: `${formSubbloque.zona5}%`, background: '#ef4444' }} />}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSubbloque(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSubbloque} disabled={saving}>
                {saving ? 'Guardando...' : modalSubbloque.id ? 'Guardar cambios' : 'Crear sub bloque'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal semana tipo */}
      {modalSemanaTipo && (
        <div className="modal-backdrop" onClick={() => setModalSemanaTipo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Semana tipo</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSemanaTipo(false)}><X size={14} /></button>
            </div>
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
              <div key={dia} className="form-group">
                <label className="form-label">{dia}</label>
                <input className="form-input" value={formSemanaTipo[dia] || ''} onChange={e => setFormSemanaTipo(f => ({ ...f, [dia]: e.target.value }))} placeholder="Ej: Rodaje Z2, Fuerza, Descanso..." />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Disponibilidad habitual</label>
              <textarea className="form-textarea" value={formDisponibilidad} onChange={e => setFormDisponibilidad(e.target.value)} placeholder={"Ej: Mañanas L-V de 7-8h\nFines de semana más flexible\nViajes frecuentes en septiembre"} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSemanaTipo(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                setSaving(true)
                await supabase.from('clientes').update({ semana_tipo: formSemanaTipo, disponibilidad: formDisponibilidad }).eq('id', clienteSeleccionado)
                setSaving(false)
                setModalSemanaTipo(false)
                cargarClienteData(clienteSeleccionado)
              }} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal consideraciones */}
      {modalConsideraciones && (
        <div className="modal-backdrop" onClick={() => setModalConsideraciones(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Consideraciones</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalConsideraciones(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Una consideración por línea</label>
              <textarea className="form-textarea" style={{ minHeight: 160 }} value={formConsideraciones} onChange={e => setFormConsideraciones(e.target.value)} placeholder={"Ej: Molestia en rodilla derecha\nViaje previsto en octubre\nCompatibiliza con padel los jueves"} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalConsideraciones(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                setSaving(true)
                await supabase.from('clientes').update({ consideraciones: formConsideraciones }).eq('id', clienteSeleccionado)
                setSaving(false)
                setModalConsideraciones(false)
                cargarClienteData(clienteSeleccionado)
              }} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
      {modalComp && (
        <div className="modal-backdrop" onClick={() => setModalComp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalComp?.id ? 'Editar competición' : 'Nueva competición'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalComp(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={formComp.nombre} onChange={e => setFormComp(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Media Maratón Barcelona" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={formComp.fecha} onChange={e => setFormComp(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <input className="form-input" value={formComp.tipo} onChange={e => setFormComp(f => ({ ...f, tipo: e.target.value }))} placeholder="Ej: Carrera, Hyrox..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <input className="form-input" value={formComp.objetivo} onChange={e => setFormComp(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Bajar de 1h45min" />
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={formComp.notas} onChange={e => setFormComp(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalComp(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarComp} disabled={saving}>{saving ? 'Guardando...' : modalComp?.id ? 'Guardar cambios' : 'Añadir competición'}</button>
            </div>
          </div>
        </div>
      )}

      {modalSemana && (
        <div className="modal-backdrop" onClick={() => setModalSemana(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Semana {modalSemana.numero}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSemana(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Carga</label>
              <select className="form-select" value={formSemana.carga} onChange={e => setFormSemana(f => ({ ...f, carga: e.target.value }))}>
                {Object.entries(CARGAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo de la semana</label>
              <input className="form-input" value={formSemana.objetivo} onChange={e => setFormSemana(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Aumentar volumen de carrera" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Km objetivo</label>
                <input className="form-input" type="number" min="0" value={formSemana.km_objetivo || ''} onChange={e => setFormSemana(f => ({ ...f, km_objetivo: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Ej: 22" />
              </div>
              <div className="form-group">
                <label className="form-label">Km real</label>
                <input className="form-input" type="number" min="0" value={formSemana.km_real || ''} onChange={e => setFormSemana(f => ({ ...f, km_real: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Ej: 24" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas / Contenidos</label>
              <textarea className="form-textarea" value={formSemana.notas} onChange={e => setFormSemana(f => ({ ...f, notas: e.target.value }))} placeholder={"Ej: Fuerza general\nRodajes Z2\nTécnica de carrera"} style={{ minHeight: 120 }} />
            </div>
            <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label className="form-label">Zonas reales — minutos</label>
              {[
                { key: 'zona1_2_real', label: 'Z1-Z2', sublabel: 'Base / Recuperación', color: '#10b981' },
                { key: 'zona3_4_real', label: 'Z3-Z4', sublabel: 'Umbral / Calidad', color: '#f59e0b' },
                { key: 'zona5_real', label: 'Z5-Z5+', sublabel: 'Alta intensidad', color: '#ef4444' },
              ].map(zona => {
                const total = (formSemana.zona1_2_real || 0) + (formSemana.zona3_4_real || 0) + (formSemana.zona5_real || 0)
                const pct = total > 0 ? Math.round(((formSemana[zona.key] || 0) / total) * 100) : 0
                return (
                  <div key={zona.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: zona.color }}>{zona.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{zona.sublabel}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {total > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: zona.color }}>{pct}%</span>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min="0" max="600" value={formSemana[zona.key] || 0}
                            onChange={e => setFormSemana(f => ({ ...f, [zona.key]: parseInt(e.target.value) || 0 }))}
                            style={{ width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'right' }} />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>min</span>
                        </div>
                      </div>
                    </div>
                    {total > 0 && (
                      <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: zona.color, borderRadius: 3 }} />
                      </div>
                    )}
                  </div>
                )
              })}
              {((formSemana.zona1_2_real || 0) + (formSemana.zona3_4_real || 0) + (formSemana.zona5_real || 0)) > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                    {(() => {
                      const total = (formSemana.zona1_2_real || 0) + (formSemana.zona3_4_real || 0) + (formSemana.zona5_real || 0)
                      return <>
                        {(formSemana.zona1_2_real || 0) > 0 && <div style={{ width: `${((formSemana.zona1_2_real || 0) / total) * 100}%`, background: '#10b981' }} />}
                        {(formSemana.zona3_4_real || 0) > 0 && <div style={{ width: `${((formSemana.zona3_4_real || 0) / total) * 100}%`, background: '#f59e0b' }} />}
                        {(formSemana.zona5_real || 0) > 0 && <div style={{ width: `${((formSemana.zona5_real || 0) / total) * 100}%`, background: '#ef4444' }} />}
                      </>
                    })()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4, textAlign: 'right' }}>
                    Total: {(formSemana.zona1_2_real || 0) + (formSemana.zona3_4_real || 0) + (formSemana.zona5_real || 0)} min
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSemana(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSemana} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
