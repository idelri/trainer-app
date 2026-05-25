import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Plus, X, CheckCircle2, Circle } from 'lucide-react'

const EMPTY_TAREA = { titulo: '', cliente_id: '', fecha_limite: '', notas: '' }

export default function Tareas() {
  const [tareas, setTareas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_TAREA)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('pendiente')

  useEffect(() => { cargarClientes(); cargar() }, [])

  async function cargar() {
    const { data } = await supabase
      .from('tareas')
      .select('*, clientes(nombre)')
      .order('estado')
      .order('fecha_limite', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setTareas(data || [])
    setLoading(false)
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
    setClientes(data || [])
  }

  async function toggleEstado(t) {
    const nuevo = t.estado === 'pendiente' ? 'hecho' : 'pendiente'
    await supabase.from('tareas').update({ estado: nuevo }).eq('id', t.id)
    cargar()
  }

  async function guardar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    await supabase.from('tareas').insert({
      titulo: form.titulo.trim(),
      cliente_id: form.cliente_id || null,
      fecha_limite: form.fecha_limite || null,
      notas: form.notas || null,
      estado: 'pendiente',
    })
    setSaving(false)
    setModal(false)
    setForm(EMPTY_TAREA)
    cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id', id)
    cargar()
  }

  const pendientes = tareas.filter(t => t.estado === 'pendiente')
  const hechas = tareas.filter(t => t.estado === 'hecho')
  const mostrar = filtro === 'pendiente' ? pendientes : hechas

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Tareas</h2>
          <p className="page-subtitle">{pendientes.length} pendientes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={14} /> Nueva tarea
        </button>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 20 }}>
        {['pendiente', 'hecho'].map(f => (
          <button key={f} className="btn btn-ghost btn-sm"
            style={filtro === f ? { background: 'var(--bg2)', fontWeight: 500 } : {}}
            onClick={() => setFiltro(f)}>
            {f === 'pendiente' ? `Pendientes (${pendientes.length})` : `Hechas (${hechas.length})`}
          </button>
        ))}
      </div>

      {mostrar.length === 0 ? (
        <div className="empty">
          <CheckCircle2 size={40} />
          <p>{filtro === 'pendiente' ? 'Sin tareas pendientes 🎉' : 'Ninguna tarea completada aún'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mostrar.map(t => (
            <div key={t.id} className="card" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleEstado(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.estado === 'hecho' ? 'var(--accent)' : 'var(--text3)', flexShrink: 0, display: 'flex' }}>
                  {t.estado === 'hecho' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div className="font-medium" style={{ textDecoration: t.estado === 'hecho' ? 'line-through' : 'none', color: t.estado === 'hecho' ? 'var(--text3)' : 'var(--text)' }}>
                    {t.titulo}
                  </div>
                  <div className="flex gap-3 mt-1">
                    {t.clientes && <span className="text-sm text-muted">{t.clientes.nombre}</span>}
                    {t.fecha_limite && (
                      <span className="text-sm mono" style={{ color: 'var(--text3)' }}>
                        {format(new Date(t.fecha_limite), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>
                  {t.notas && <div className="text-sm text-muted mt-1">{t.notas}</div>}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => eliminar(t.id)}>
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nueva tarea</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Tarea *</label>
              <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Revisar plan de Blanca" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cliente (opcional)</label>
                <select className="form-select" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha límite (opcional)</label>
                <input className="form-input" type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
