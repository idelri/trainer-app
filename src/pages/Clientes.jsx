import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Plus, X, Pencil, User } from 'lucide-react'

const EMPTY_CLIENTE = {
  nombre: '', email: '', telefono: '', estado: 'activo',
  fecha_inicio: '', objetivo: '', tipo_cliente: 'estandar'
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

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase
      .from('clientes')
      .select('*, servicios(*)')
      .order('estado')
      .order('nombre')
    setClientes(data || [])
    setLoading(false)
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
      tipo_cliente: c.tipo_cliente || 'estandar'
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
      objetivo: form.objetivo || null,
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

  const activos = clientes.filter(c => c.estado === 'activo')
  const bajas = clientes.filter(c => c.estado === 'baja')

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

      {/* Modal */}
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
