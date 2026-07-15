import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Plus, X, Pencil } from 'lucide-react'

const EMPTY_CLIENTE = {
  nombre: '', email: '', telefono: '', estado: 'activo',
  fecha_inicio: '', objetivo: '', tipo_cliente: 'estandar', perfil_planificacion: 'resistencia'
}
const EMPTY_SERVICIO = {
  modalidad: 'online', tarifa_mensual: '', tarifa_sesion: '',
  deporte: '', deporte_complementario: '', dispositivo: ''
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuevo' | {cliente, servicio}
  const [form, setForm] = useState(EMPTY_CLIENTE)
  const [servicio, setServicio] = useState(EMPTY_SERVICIO)
  const [saving, setSaving] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [cuestionarioModal, setCuestionarioModal] = useState(null) // null | { cliente, cuestionario }
  const [cuestionarioTab, setCuestionarioTab] = useState('resumen')
  const [cuestionarios, setCuestionarios] = useState({}) // { clienteId: cuestionario }
  const [generandoEnlace, setGenerandoEnlace] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: cls }, { data: cues }] = await Promise.all([
      supabase.from('clientes').select('*, servicios(*)').order('estado').order('nombre'),
      supabase.from('cuestionario_inicial').select('*'),
    ])
    setClientes(cls || [])
    const map = {}
    ;(cues || []).forEach(c => { map[c.cliente_id] = c })
    setCuestionarios(map)
    setLoading(false)
  }

  async function generarEnlaceCuestionario(cliente) {
    setGenerandoEnlace(true)
    const { data } = await supabase
      .from('cuestionario_inicial')
      .insert({ cliente_id: cliente.id })
      .select()
      .single()
    const map = { ...cuestionarios, [cliente.id]: data }
    setCuestionarios(map)
    setCuestionarioModal({ cliente, cuestionario: data })
    setGenerandoEnlace(false)
  }

  function abrirCuestionario(cliente) {
    setCuestionarioTab('resumen')
    setCuestionarioModal({ cliente, cuestionario: cuestionarios[cliente.id] || null })
  }

  function abrirNuevo() {
    setForm(EMPTY_CLIENTE)
    setServicio(EMPTY_SERVICIO)
    setModal('nuevo')
  }

 function abrirEditar(c) {
    setForm({
      nombre: c.nombre || '', email: c.email || '', telefono: c.telefono || '',
      estado: c.estado || 'activo', fecha_inicio: c.fecha_inicio || '', objetivo: c.objetivo || '',
     tipo_cliente: c.tipo_cliente || 'estandar',
      perfil_planificacion: c.perfil_planificacion || 'resistencia'
    })
    const s = c.servicios?.[0]
    setServicio(s ? {
      modalidad: s.modalidad || 'online',
      tarifa_mensual: s.tarifa_mensual || '',
      tarifa_sesion: s.tarifa_sesion || '',
      deporte: servicio.deporte || null,
        deporte_complementario: servicio.deporte_complementario || null,
      dispositivo: s.dispositivo || ''
    } : EMPTY_SERVICIO)
    setModal({ cliente: c, servicioId: s?.id })
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    const datosCliente = {
      nombre: form.nombre.trim(),
      email: form.email || null,
      telefono: form.telefono || null,
      estado: form.estado,
      fecha_inicio: form.fecha_inicio || null,
      tipo_cliente: form.tipo_cliente || 'estandar',
      perfil_planificacion: form.perfil_planificacion || 'resistencia',
      tipo_cliente: form.tipo_cliente || 'estandar',
    }

    let clienteId
    if (modal === 'nuevo') {
      const { data } = await supabase.from('clientes').insert(datosCliente).select().single()
      clienteId = data?.id
    } else {
      await supabase.from('clientes').update(datosCliente).eq('id', modal.cliente.id)
      clienteId = modal.cliente.id
    }

    if (clienteId) {
      const datosServicio = {
        modalidad: servicio.modalidad,
        tarifa_mensual: parseFloat(servicio.tarifa_mensual) || 0,
        tarifa_sesion: servicio.tarifa_sesion ? parseFloat(servicio.tarifa_sesion) : null,
        deporte: servicio.deporte || null,
        dispositivo: servicio.dispositivo || null,
      }

      // Buscar si ya existe un servicio para este cliente
     const { data: serviciosExistentes } = await supabase
        .from('servicios')
        .select('id')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
      const servicioExistente = serviciosExistentes?.[0]
      if (servicioExistente) {
        await supabase.from('servicios').update(datosServicio).eq('id', servicioExistente.id)
      } else {
        await supabase.from('servicios').insert({ ...datosServicio, cliente_id: clienteId })
      }
    }

    setSaving(false)
    setModal(null)
    cargar()
  }

  const clientesFiltrados = filtroTipo === 'todos' ? clientes : clientes.filter(c => (c.tipo_cliente || 'estandar') === filtroTipo)
  const activos = clientesFiltrados.filter(c => c.estado === 'activo')
  const bajas = clientesFiltrados.filter(c => c.estado === 'baja')

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  return (
    <div>
     <div className="page-header">
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="page-subtitle">{activos.length} activos · {bajas.length} bajas</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={14} /> Nuevo cliente
        </button>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        {[
          { value: 'todos', label: 'Todos' },
          { value: 'estandar', label: 'De pago' },
          { value: 'familia_gratis', label: 'Familia / Gratis' },
        ].map(f => (
          <button key={f.value} className="btn btn-ghost btn-sm"
            style={filtroTipo === f.value ? { background: 'var(--bg2)', fontWeight: 600 } : {}}
            onClick={() => setFiltroTipo(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Activos */}
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Modalidad</th>
              <th>Tarifa</th>
              <th>Inicio</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activos.map(c => {
              const s = c.servicios?.[0]
              return (
                <tr key={c.id}>
                 <td>
                    <span className="font-medium">{c.nombre}</span>
                    {c.tipo_cliente === 'familia_gratis' && <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 10 }}>Gratis</span>}
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{c.email}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{c.telefono}</div>
                  </td>
                  <td><span className="badge badge-blue">{s?.modalidad || '—'}</span></td>
                  <td className="mono">
                    {s ? `${s.tarifa_mensual}€` : '—'}
                    {s?.tarifa_sesion ? <span style={{ color: 'var(--text3)' }}> + {s.tarifa_sesion}€/ses.</span> : ''}
                  </td>
                  <td className="mono" style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                    {c.fecha_inicio ? format(new Date(c.fecha_inicio), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td><span className="badge badge-green">Activo</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)}>
                      <Pencil size={12} />
                    </button>
                    {c.token_cliente && (
                      <button className="btn btn-ghost btn-sm" title="Enlace portal del cliente" onClick={() => {
                        const url = `${window.location.origin}/cliente/${c.token_cliente}`
                        navigator.clipboard.writeText(url).catch(() => {})
                        alert(`Enlace del portal copiado:\n${url}`)
                      }}>🔗</button>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Cuestionario inicial"
                      onClick={() => abrirCuestionario(c)}
                      style={{ position: 'relative' }}>
                      📋
                      {cuestionarios[c.id]?.submitted_at && (
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: '#2d6a4f', border: '1.5px solid #fff' }} />
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bajas */}
      {bajas.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bajas</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Email</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {bajas.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ color: 'var(--text2)' }}>{c.nombre}</span></td>
                    <td style={{ color: 'var(--text3)', fontSize: 12.5 }}>{c.email || '—'}</td>
                    <td><span className="badge badge-gray">Baja</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)}>
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal cuestionario */}
      {cuestionarioModal && (
        <div className="modal-backdrop" onClick={() => setCuestionarioModal(null)}>
          <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Cuestionario inicial · {cuestionarioModal.cliente.nombre}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setCuestionarioModal(null)}><X size={14} /></button>
            </div>

            {!cuestionarioModal.cuestionario ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 20 }}>Genera el enlace del cuestionario para enviárselo al cliente.</p>
                <button className="btn btn-primary" onClick={() => generarEnlaceCuestionario(cuestionarioModal.cliente)} disabled={generandoEnlace}>
                  {generandoEnlace ? 'Generando...' : '📋 Generar enlace del cuestionario'}
                </button>
              </div>
            ) : !cuestionarioModal.cuestionario.submitted_at ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                  ⏳ Pendiente de respuesta por el cliente
                </div>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>Enlace para enviar al cliente:</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input readOnly value={`${window.location.origin}/cuestionario/${cuestionarioModal.cuestionario.token_publico}`}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12.5, color: 'var(--text2)', fontFamily: 'monospace' }} />
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const url = `${window.location.origin}/cuestionario/${cuestionarioModal.cuestionario.token_publico}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    alert('Enlace copiado al portapapeles')
                  }}>Copiar</button>
                </div>
              </div>
            ) : (
              <div>
                {/* Enlace + estado */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ background: 'var(--bg2)', color: 'var(--green)', border: '1px solid var(--green-light)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                    ✓ Completado · {format(new Date(cuestionarioModal.cuestionario.submitted_at), 'dd/MM/yyyy')}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const url = `${window.location.origin}/cuestionario/${cuestionarioModal.cuestionario.token_publico}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    alert('Enlace copiado al portapapeles')
                  }}>🔗 Copiar enlace</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                  {[['resumen','Resumen práctico'],['respuestas','Respuestas completas']].map(([id, label]) => (
                    <button key={id} onClick={() => setCuestionarioTab(id)}
                      style={{ padding: '8px 14px', fontSize: 13, fontWeight: cuestionarioTab === id ? 600 : 400, color: cuestionarioTab === id ? 'var(--green)' : 'var(--text2)', background: 'none', border: 'none', borderBottom: cuestionarioTab === id ? '2px solid var(--green)' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
                      {label}
                    </button>
                  ))}
                </div>

                {cuestionarioTab === 'resumen' ? (
                  <ResumenCuestionario data={cuestionarioModal.cuestionario} />
                ) : (
                  <RespuestasCompletas data={cuestionarioModal.cuestionario} />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal editar/crear */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modal === 'nuevo' ? 'Nuevo cliente' : `Editar · ${modal.cliente.nombre}`}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Datos personales</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-select" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  <option value="activo">Activo</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de cliente</label>
                <select className="form-select" value={form.tipo_cliente} onChange={e => setForm(f => ({ ...f, tipo_cliente: e.target.value }))}>
                  <option value="estandar">Estándar</option>
                  <option value="familia_gratis">Familia / Gratis</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Perfil de planificación</label>
                <select className="form-select" value={form.perfil_planificacion} onChange={e => setForm(f => ({ ...f, perfil_planificacion: e.target.value }))}>
                  <option value="resistencia">Resistencia</option>
                  <option value="fuerza_salud">Fuerza y salud</option>
                </select>
              </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha inicio</label>
                <input className="form-input" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <input className="form-input" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} />
            </div>

            <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '20px 0 14px' }}>Servicio y tarifa</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Modalidad</label>
                <select className="form-select" value={servicio.modalidad} onChange={e => setServicio(s => ({ ...s, modalidad: e.target.value }))}>
                  <option value="online">Online</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tarifa mensual (€)</label>
                <input className="form-input" type="number" value={servicio.tarifa_mensual} onChange={e => setServicio(s => ({ ...s, tarifa_mensual: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tarifa sesión (€) — opcional</label>
                <input className="form-input" type="number" value={servicio.tarifa_sesion} onChange={e => setServicio(s => ({ ...s, tarifa_sesion: e.target.value }))} placeholder="Solo si es híbrido" />
              </div>
              <div className="form-group">
                <label className="form-label">Actividad principal</label>
                <input className="form-input" value={servicio.deporte} onChange={e => setServicio(s => ({ ...s, deporte: e.target.value }))} placeholder="Ej: Running, Triatlón, Ciclismo..." />
              </div>
              <div className="form-group">
                <label className="form-label">Actividades complementarias</label>
                <input className="form-input" value={servicio.deporte_complementario || ''} onChange={e => setServicio(s => ({ ...s, deporte_complementario: e.target.value }))} placeholder="Ej: Fuerza, Yoga, Pádel..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Dispositivo / wearable</label>
              <input className="form-input" value={servicio.dispositivo} onChange={e => setServicio(s => ({ ...s, dispositivo: e.target.value }))} placeholder="Garmin, Apple Watch..." />
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Resumen práctico ──────────────────────────────────────────────────────────

function Bloque({ titulo, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 8 }}>{titulo}</div>
      <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

function Fila({ label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--text3)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{Array.isArray(value) ? value.join(' · ') : value}</span>
    </div>
  )
}

function ResumenCuestionario({ data: d }) {
  const CONFIANZA_LABELS = ['','Muy difícil ser constante','Bastantes dificultades','Con algunas dificultades','Bastante confianza','Totalmente seguro/a']
  const ESCALA_LABELS = ['','1','2','3','4','5']
  const CALIDAD_LABELS = ['','Muy mala','Regular','Normal','Buena','Muy buena']
  const ESTRES_LABELS = ['','Muy bajo','Bajo','Moderado','Alto','Muy alto']

  const lesiones = d.lesiones_actuales || []

  return (
    <div>
      <Bloque titulo="Persona">
        <Fila label="Nombre" value={d.nombre} />
        <Fila label="Fecha nac." value={d.fecha_nacimiento ? format(new Date(d.fecha_nacimiento + 'T12:00:00'), 'dd/MM/yyyy') : null} />
        <Fila label="Profesión" value={d.profesion} />
        <Fila label="Ciudad" value={d.ciudad} />
        <Fila label="Email" value={d.email} />
        <Fila label="Teléfono" value={d.telefono} />
      </Bloque>

      <Bloque titulo="Objetivos">
        <Fila label="Objetivo principal" value={d.objetivo_principal} />
        {(d.competiciones || []).length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            <span style={{ color: 'var(--text3)', marginRight: 10 }}>Competiciones</span>
            {d.competiciones.map((c, i) => (
              <div key={i} style={{ marginLeft: 140, marginTop: 2, lineHeight: 1.5 }}>
                <strong>{c.nombre}</strong>{c.fecha ? ` · ${format(new Date(c.fecha + 'T12:00:00'), 'dd/MM/yyyy')}` : ''}{c.modalidad ? ` · ${c.modalidad}` : ''}{c.objetivo_rendimiento ? ` — ${c.objetivo_rendimiento}` : ''}
              </div>
            ))}
          </div>
        )}
        <Fila label="Objetivos secundarios" value={d.objetivos_secundarios} />
        <Fila label="A 3–6 meses" value={d.objetivo_3_6_meses} />
      </Bloque>

      <Bloque titulo="Experiencia y actividad">
        <Fila label="Deportes actuales" value={d.deportes_actuales} />
        <Fila label="Le gusta" value={d.actividades_gustan} />
        <Fila label="Prefiere evitar" value={d.actividades_evitar} />
        <Fila label="Frecuencia actual" value={d.frecuencia_actual} />
        <Fila label="Duración habitual" value={d.duracion_habitual} />
        <Fila label="Exp. fuerza" value={d.experiencia_fuerza ? `${d.experiencia_fuerza}${d.experiencia_fuerza_obs ? ` — ${d.experiencia_fuerza_obs}` : ''}` : null} />
        <Fila label="Exp. resistencia" value={d.experiencia_resistencia ? `${d.experiencia_resistencia}${d.experiencia_resistencia_obs ? ` — ${d.experiencia_resistencia_obs}` : ''}` : null} />
        <Fila label="Exp. funcional" value={d.experiencia_funcional ? `${d.experiencia_funcional}${d.experiencia_funcional_obs ? ` — ${d.experiencia_funcional_obs}` : ''}` : null} />
      </Bloque>

      <Bloque titulo="Disponibilidad">
        <Fila label="Días/semana" value={d.dias_semana} />
        <Fila label="Días preferentes" value={d.dias_preferentes} />
        <Fila label="Tiempo por sesión" value={d.tiempo_sesion} />
        {d.tiempo_sesion_obs && <Fila label="" value={d.tiempo_sesion_obs} />}
        <Fila label="Horarios" value={d.horarios_preferentes} />
        <Fila label="Lugar" value={d.lugares_entrenamiento} />
        {d.tiene_gimnasio && <Fila label="Gimnasio" value={d.gimnasio_nombre || 'Sí'} />}
        {d.tiene_gimnasio && <Fila label="Material gym" value={d.material_gimnasio} />}
        <Fila label="Material en casa" value={d.material_casa} />
        {d.tiene_wearable && <Fila label="Wearable" value={d.wearable_modelo || 'Sí'} />}
      </Bloque>

      {lesiones.length > 0 && (
        <Bloque titulo={`Lesiones actuales (${lesiones.length})`}>
          {lesiones.map((l, i) => (
            <div key={i} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#be123c', marginBottom: 4 }}>{l.zona || 'Zona no especificada'}</div>
              {l.tipo && <div style={{ color: 'var(--text2)' }}>{l.tipo}{l.antiguedad ? ` · ${l.antiguedad}` : ''}{l.intensidad != null ? ` · intensidad ${l.intensidad}/10` : ''}</div>}
              {l.movimientos && <div style={{ color: 'var(--text2)', marginTop: 4 }}>{l.movimientos}</div>}
              {l.diagnostico && <div style={{ color: 'var(--text3)', fontStyle: 'italic', marginTop: 2 }}>Dx: {l.diagnostico}</div>}
              {l.limitaciones && <div style={{ color: 'var(--text2)', marginTop: 2 }}>Limitaciones: {l.limitaciones}</div>}
            </div>
          ))}
        </Bloque>
      )}

      {(d.lesiones_anteriores || d.operaciones || d.enfermedades || d.medicacion || d.restricciones_medicas || d.seguimiento_fisio) && (
        <Bloque titulo="Antecedentes de salud">
          <Fila label="Lesiones anteriores" value={d.lesiones_anteriores} />
          <Fila label="Operaciones" value={d.operaciones} />
          <Fila label="Enfermedades" value={d.enfermedades} />
          <Fila label="Medicación" value={d.medicacion} />
          <Fila label="Restricciones médicas" value={d.restricciones_medicas} />
          <Fila label="Seguimiento / fisio" value={d.seguimiento_fisio} />
        </Bloque>
      )}

      <Bloque titulo="Estilo de vida">
        <Fila label="Sueño" value={d.horas_sueno ? `${d.horas_sueno}${d.calidad_sueno ? ` · calidad ${CALIDAD_LABELS[d.calidad_sueno]}` : ''}` : null} />
        <Fila label="Estrés" value={d.nivel_estres ? ESTRES_LABELS[d.nivel_estres] : null} />
        <Fila label="Energía" value={d.nivel_energia ? ESTRES_LABELS[d.nivel_energia] : null} />
        <Fila label="Trabajo" value={d.tipo_trabajo} />
        <Fila label="Pasos diarios" value={d.pasos_diarios} />
        <Fila label="Tabaco" value={d.consumo_tabaco} />
        <Fila label="Alcohol" value={d.consumo_alcohol} />
        <Fila label="Confianza en rutina" value={d.confianza_rutina ? `${d.confianza_rutina}/5 — ${CONFIANZA_LABELS[d.confianza_rutina]}` : null} />
      </Bloque>

      {d.info_adicional && (
        <Bloque titulo="Información adicional">
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{d.info_adicional}</div>
        </Bloque>
      )}
    </div>
  )
}

// ── Respuestas completas ──────────────────────────────────────────────────────

function RespuestasCompletas({ data: d }) {
  function Seccion({ titulo, children }) {
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12 }}>{titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      </div>
    )
  }
  function R({ q, a }) {
    if (a == null || a === '' || (Array.isArray(a) && a.length === 0)) return null
    return (
      <div style={{ fontSize: 13 }}>
        <div style={{ color: 'var(--text3)', marginBottom: 2 }}>{q}</div>
        <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{Array.isArray(a) ? a.join(', ') : String(a)}</div>
      </div>
    )
  }

  const lesiones = d.lesiones_actuales || []
  const comps = d.competiciones || []

  return (
    <div>
      <Seccion titulo="1. Datos personales">
        <R q="Nombre" a={d.nombre} />
        <R q="Email" a={d.email} />
        <R q="Teléfono" a={d.telefono} />
        <R q="Fecha de nacimiento" a={d.fecha_nacimiento ? format(new Date(d.fecha_nacimiento + 'T12:00:00'), 'dd/MM/yyyy') : null} />
        <R q="Profesión" a={d.profesion} />
        <R q="Ciudad" a={d.ciudad} />
      </Seccion>

      <Seccion titulo="2. Objetivos">
        <R q="Objetivo principal" a={d.objetivo_principal} />
        {comps.length > 0 && comps.map((c, i) => (
          <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: '#166534', marginBottom: 2 }}>Competición {i + 1}: {c.nombre}</div>
            {c.fecha && <div style={{ color: 'var(--text2)' }}>Fecha: {format(new Date(c.fecha + 'T12:00:00'), 'dd/MM/yyyy')}</div>}
            {c.modalidad && <div style={{ color: 'var(--text2)' }}>Modalidad: {c.modalidad}</div>}
            {c.objetivo_rendimiento && <div style={{ color: 'var(--text2)' }}>Objetivo: {c.objetivo_rendimiento}</div>}
          </div>
        ))}
        <R q="Objetivos secundarios" a={d.objetivos_secundarios} />
        <R q="¿Qué te gustaría conseguir en 3–6 meses?" a={d.objetivo_3_6_meses} />
      </Seccion>

      <Seccion titulo="3. Actividad y experiencia">
        <R q="Deportes actuales" a={d.deportes_actuales} />
        <R q="Actividades que le gustan" a={d.actividades_gustan} />
        <R q="Actividades que prefiere evitar" a={d.actividades_evitar} />
        <R q="Frecuencia actual" a={d.frecuencia_actual} />
        <R q="Duración habitual" a={d.duracion_habitual} />
        <R q="Experiencia en fuerza" a={d.experiencia_fuerza} />
        <R q="Observaciones fuerza" a={d.experiencia_fuerza_obs} />
        <R q="Experiencia en resistencia" a={d.experiencia_resistencia} />
        <R q="Observaciones resistencia" a={d.experiencia_resistencia_obs} />
        <R q="Experiencia en funcional / dirigidas" a={d.experiencia_funcional} />
        <R q="Observaciones funcional" a={d.experiencia_funcional_obs} />
      </Seccion>

      <Seccion titulo="4. Disponibilidad y material">
        <R q="Días disponibles por semana" a={d.dias_semana} />
        <R q="Días preferentes" a={d.dias_preferentes} />
        <R q="Tiempo por sesión" a={d.tiempo_sesion} />
        <R q="Notas sobre tiempo" a={d.tiempo_sesion_obs} />
        <R q="Horarios preferentes" a={d.horarios_preferentes} />
        <R q="Lugar de entrenamiento" a={d.lugares_entrenamiento} />
        <R q="¿Va al gimnasio?" a={d.tiene_gimnasio === true ? 'Sí' : d.tiene_gimnasio === false ? 'No' : null} />
        <R q="Gimnasio" a={d.gimnasio_nombre} />
        <R q="Material en el gimnasio" a={d.material_gimnasio} />
        <R q="Material en casa" a={d.material_casa} />
        <R q="¿Tiene wearable?" a={d.tiene_wearable === true ? 'Sí' : d.tiene_wearable === false ? 'No' : null} />
        <R q="Modelo wearable" a={d.wearable_modelo} />
      </Seccion>

      <Seccion titulo="5. Salud y lesiones">
        {lesiones.length > 0 ? lesiones.map((l, i) => (
          <div key={i} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: '#be123c', marginBottom: 4 }}>Lesión {i + 1}: {l.zona}</div>
            <R q="Tipo" a={l.tipo} />
            <R q="Antigüedad" a={l.antiguedad} />
            <R q="Intensidad" a={l.intensidad != null ? `${l.intensidad}/10` : null} />
            <R q="Movimientos" a={l.movimientos} />
            <R q="Diagnóstico" a={l.diagnostico} />
            <R q="Limitaciones" a={l.limitaciones} />
          </div>
        )) : <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sin lesiones actuales</div>}
        <R q="Lesiones anteriores" a={d.lesiones_anteriores} />
        <R q="Operaciones" a={d.operaciones} />
        <R q="Enfermedades" a={d.enfermedades} />
        <R q="Medicación" a={d.medicacion} />
        <R q="Restricciones médicas" a={d.restricciones_medicas} />
        <R q="Seguimiento / fisioterapia" a={d.seguimiento_fisio} />
      </Seccion>

      <Seccion titulo="6. Estilo de vida">
        <R q="Horas de sueño" a={d.horas_sueno} />
        <R q="Calidad del sueño" a={d.calidad_sueno ? `${d.calidad_sueno}/5` : null} />
        <R q="Nivel de estrés" a={d.nivel_estres ? `${d.nivel_estres}/5` : null} />
        <R q="Nivel de energía" a={d.nivel_energia ? `${d.nivel_energia}/5` : null} />
        <R q="Tipo de trabajo" a={d.tipo_trabajo} />
        <R q="Pasos diarios" a={d.pasos_diarios} />
        <R q="Tabaco" a={d.consumo_tabaco} />
        <R q="Alcohol" a={d.consumo_alcohol} />
        <R q="Confianza en rutina" a={d.confianza_rutina ? `${d.confianza_rutina}/5` : null} />
      </Seccion>

      {d.info_adicional && (
        <Seccion titulo="7. Cierre">
          <R q="Información adicional" a={d.info_adicional} />
        </Seccion>
      )}
    </div>
  )
}
