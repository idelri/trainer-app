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
  const [bloques, setBloques] = useState([])
  const [competiciones, setCompeticiones] = useState([])
  const [semanas, setSemanas] = useState({})
  const [vista, setVista] = useState('timeline')
  const [bloqueAbierto, setBloqueAbierto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalPlan, setModalPlan] = useState(false)
  const [modalBloque, setModalBloque] = useState(null)
  const [modalComp, setModalComp] = useState(false)
  const [modalSemana, setModalSemana] = useState(null)
  const [formPlan, setFormPlan] = useState(EMPTY_PLAN)
  const [formBloque, setFormBloque] = useState(EMPTY_BLOQUE)
  const [formComp, setFormComp] = useState(EMPTY_COMP)
  const [formSemana, setFormSemana] = useState({ objetivo: '', notas: '', carga: 'media' })
  const [saving, setSaving] = useState(false)
  const [subbloques, setSubbloques] = useState({})
  const [modalSubbloque, setModalSubbloque] = useState(null)
  const [formSubbloque, setFormSubbloque] = useState({ nombre: '', semana_inicio: 1, semana_fin: 1, objetivo: '', notas: '' })

  useEffect(() => { cargarClientes() }, [])
  useEffect(() => { if (clienteSeleccionado) cargarPlanificacion() }, [clienteSeleccionado])

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  async function cargarPlanificacion() {
    setLoading(true)
    const { data: planes } = await supabase
      .from('planificaciones').select('*')
      .eq('cliente_id', clienteSeleccionado)
      .order('created_at', { ascending: false })
      .limit(1)
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
    await supabase.from('competiciones').insert({
      cliente_id: clienteSeleccionado,
      nombre: formComp.nombre,
      fecha: formComp.fecha,
      tipo: formComp.tipo || null,
      objetivo: formComp.objetivo || null,
      notas: formComp.notas || null,
    })
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
      }).eq('id', semanaExistente.id)
    } else {
      await supabase.from('semanas').insert({
        bloque_id,
        numero,
        objetivo: formSemana.objetivo || null,
        notas: formSemana.notas || null,
        carga: formSemana.carga,
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
    setFormSemana({
      objetivo: semanaExistente?.objetivo || '',
      notas: semanaExistente?.notas || '',
      carga: semanaExistente?.carga || 'media',
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
        <div className="flex gap-2">
          {planificacion && clienteSeleccionado && (
            <>
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
              <button className="btn btn-ghost" onClick={() => { setFormComp(EMPTY_COMP); setModalComp(true) }}>
                <Trophy size={13} /> Competición
              </button>
              <button className="btn btn-primary" onClick={abrirNuevoBloque}>
                <Plus size={13} /> Bloque
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => { setFormPlan(EMPTY_PLAN); setModalPlan(true) }}>
            <Plus size={13} /> Nueva planificación
          </button>
        </div>
      </div>

      <div className="flex gap-3 items-center" style={{ marginBottom: 20 }}>
        <select className="form-select" style={{ maxWidth: 260 }}
          value={clienteSeleccionado || ''}
          onChange={e => { setClienteSeleccionado(e.target.value || null); setPlanificacion(null); setBloques([]) }}>
          <option value="">Selecciona un cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        {planificacion && (
          <div className="flex gap-2">
            {['timeline', 'macro', 'subbloque', 'micro'].map(v => (
              <button key={v} className="btn btn-ghost btn-sm"
                style={vista === v ? { background: 'var(--bg2)', fontWeight: 500 } : {}}
                onClick={() => setVista(v)}>
                {v === 'timeline' ? 'Línea de tiempo' : v === 'macro' ? 'Bloque' : v === 'subbloque' ? 'Sub bloque' : 'Semana'}
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="label">Inicio</div>
              <div style={{ fontWeight: 500, marginTop: 4, fontFamily: 'var(--mono)', fontSize: 13 }}>
                {format(parseISO(planificacion.fecha_inicio), 'dd MMM yyyy', { locale: es })}
              </div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="label">Fin</div>
              <div style={{ fontWeight: 500, marginTop: 4, fontFamily: 'var(--mono)', fontSize: 13 }}>
                {format(parseISO(planificacion.fecha_fin), 'dd MMM yyyy', { locale: es })}
              </div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="label">Semanas totales</div>
              <div className="value">{totalSemanas}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="label">Bloques</div>
              <div className="value">{bloques.length}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="label">Competiciones</div>
              <div className="value">{competiciones.length}</div>
            </div>
          </div>

          {vista === 'timeline' && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: Math.max(totalSemanas * 40, 400), position: 'relative' }}>

                

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
                        }} style={{
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
                        <div key={comp.id} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
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
                  {Array.from({ length: totalSemanas }, (_, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'var(--text3)', fontFamily: 'var(--mono)', borderLeft: i % 4 === 0 ? '1px solid var(--border)' : 'none' }}>
                      {`S${i + 1}`}
                    </div>
                  ))}
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

          {vista === 'macro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {competiciones.length > 0 && (
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                    🏆 Competiciones
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {competiciones.map(comp => (
                      <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--danger-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)' }}>
                        <Trophy size={12} color="var(--danger)" />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)' }}>{comp.nombre}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            {format(parseISO(comp.fecha), 'dd MMM yyyy', { locale: es })}
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 4 }} onClick={() => eliminarComp(comp.id)}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bloques.map((b, idx) => (
                <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          {b.semanas} semanas · desde {format(parseISO(b.fecha_inicio), 'dd MMM', { locale: es })}
                        </span>
                      </div>
                     {b.objetivo && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo</div>
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
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarBloque(b)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><X size={13} /></button>
                    </div>
                  </div>
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
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--bg)' }}
                      onClick={() => setBloqueAbierto(abierto ? null : b.id)}>
                      {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span style={{ fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 4 }}>{b.semanas} semanas</span>
                      <button className="btn btn-ghost btn-sm ml-auto" onClick={e => {
                        e.stopPropagation()
                        setFormSubbloque({ nombre: '', semana_inicio: 1, semana_fin: 1, objetivo: '', notas: '' })
                        setModalSubbloque({ bloque_id: b.id })
                      }}>
                        <Plus size={12} /> Sub bloque
                      </button>
                    </div>
                    {abierto && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {subsBloque.length === 0 ? (
                          <div style={{ padding: '16px', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                            Sin sub bloques — añade el primero.
                          </div>
                        ) : (
                          subsBloque.map(sub => (
                            <div key={sub.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color || '#2d6a4f', flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{sub.nombre}</span>
                                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                                  S{sub.semana_inicio} — S{sub.semana_fin}
                                </span>
                                <div className="flex gap-1 ml-auto">
                                  <button className="btn btn-ghost btn-sm" onClick={() => {
                                    setFormSubbloque({
                                      nombre: sub.nombre,
                                      semana_inicio: sub.semana_inicio,
                                      semana_fin: sub.semana_fin,
                                      objetivo: sub.objetivo || '',
                                      notas: sub.notas || '',
                                    })
                                    setModalSubbloque({ ...sub, bloque_id: b.id })
                                  }}>Editar</button>
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarSubbloque(sub.id)}>
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                              {sub.objetivo && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Objetivo</div>
                                  <div style={{ fontSize: 13 }}>{sub.objetivo}</div>
                                </div>
                              )}
                              {sub.notas && (
                                <div>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'white', background: b.color || '#2d6a4f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>Notas</div>
                                  <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{sub.notas}</div>
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
                const abierto = bloqueAbierto === b.id
                return (
                  <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--bg)' }}
                      onClick={() => setBloqueAbierto(abierto ? null : b.id)}>
                      {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span style={{ fontWeight: 600 }}>Bloque {idx + 1} — {b.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 4 }}>{b.semanas} semanas</span>
                    </div>
                    {abierto && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {Array.from({ length: b.semanas }, (_, i) => {
                          const num = i + 1
                          const sem = semsBloque.find(s => s.numero === num)
                          const fechaSem = format(addWeeks(parseISO(b.fecha_inicio), i), 'dd MMM', { locale: es })
                          const cargaSem = sem?.carga ? CARGAS[sem.carga] : null
                          return (
                            <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                              onClick={() => abrirSemana(b.id, num)}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: cargaSem ? cargaSem.color : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: cargaSem ? 'white' : 'var(--text3)', fontFamily: 'var(--mono)' }}>S{num}</span>
                              </div>
                              <div style={{ flex: 1 }}>
                                {sem?.objetivo ? <div style={{ fontSize: 13 }}>{sem.objetivo}</div> : <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Sin objetivo — clic para añadir</div>}
                                {sem?.notas && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sem.notas}</div>}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{fechaSem}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {bloques.length === 0 && <div className="empty"><p>Añade bloques primero desde la vista Macro.</p></div>}
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
              <input className="form-input" value={formBloque.objetivo} onChange={e => setFormBloque(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Desarrollar base aeróbica" />
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
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <input className="form-input" value={formSubbloque.objetivo} onChange={e => setFormSubbloque(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Adaptación al volumen" />
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={formSubbloque.notas} onChange={e => setFormSubbloque(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: Énfasis en técnica de carrera..." />
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
      {modalComp && (
        <div className="modal-backdrop" onClick={() => setModalComp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nueva competición</span>
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
              <button className="btn btn-primary" onClick={guardarComp} disabled={saving}>{saving ? 'Guardando...' : 'Añadir competición'}</button>
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
            <div className="form-group">
              <label className="form-label">Notas / Contenidos</label>
              <textarea className="form-textarea" value={formSemana.notas} onChange={e => setFormSemana(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: 3 sesiones fuerza + 2 rodajes Z2..." />
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
