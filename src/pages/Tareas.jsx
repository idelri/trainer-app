import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addDays, addWeeks, addMonths, parseISO, isToday, isTomorrow, isThisWeek, isPast, startOfDay } from 'date-fns'
import { Plus, X, CheckCircle2, Circle, RefreshCw } from 'lucide-react'

const EMPTY_TAREA = { titulo: '', clientes_ids: [], fecha_limite: '', notas: '', recurrencia: '' }

async function generarSiguienteRecurrente(tarea, clienteId) {
  if (!tarea.recurrencia || !tarea.fecha_limite) return
  const base = parseISO(tarea.fecha_limite)
  let siguiente
  if (tarea.recurrencia === 'diaria') siguiente = addDays(base, 1)
  else if (tarea.recurrencia === 'semanal') siguiente = addWeeks(base, 1)
  else if (tarea.recurrencia === 'mensual') siguiente = addMonths(base, 1)
  else return
  await supabase.from('tareas').insert({
    titulo: tarea.titulo,
    cliente_id: clienteId,
    fecha_limite: format(siguiente, 'yyyy-MM-dd'),
    notas: tarea.notas,
    recurrencia: tarea.recurrencia,
    tarea_origen_id: tarea.tarea_origen_id || tarea.id,
    estado: 'pendiente',
  })
}

function getGrupo(fecha_limite) {
  if (!fecha_limite) return 'sin_fecha'
  const d = parseISO(fecha_limite)
  if (isPast(startOfDay(d)) && !isToday(d)) return 'vencidas'
  if (isToday(d)) return 'hoy'
  if (isTomorrow(d)) return 'manana'
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'esta_semana'
  return 'mas_adelante'
}

const PESTANAS = [
  { key: 'todas', label: 'Todas' },
  { key: 'vencidas', label: 'Vencidas', color: 'var(--danger)' },
  { key: 'hoy', label: 'Hoy', color: 'var(--accent)' },
  { key: 'manana', label: 'Mañana', color: 'var(--warning)' },
  { key: 'esta_semana', label: 'Esta semana', color: 'var(--info)' },
  { key: 'mas_adelante', label: 'Más adelante', color: 'var(--text3)' },
  { key: 'sin_fecha', label: 'Sin fecha', color: 'var(--text3)' },
  { key: 'hecho', label: 'Hechas' },
]

export default function Tareas() {
  const [tareas, setTareas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_TAREA)
  const [saving, setSaving] = useState(false)
  const [pestana, setPestana] = useState('todas')

  useEffect(() => { cargarClientes(); cargar() }, [])

  async function cargar() {
    const { data } = await supabase
      .from('tareas')
      .select('*, clientes(nombre, estado)')
      .order('fecha_limite', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setTareas(data || [])
    setLoading(false)
  }

  async function cargarClientes() {
    const { data } = await supabase
      .from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  function toggleClienteForm(id) {
    setForm(f => {
      const ids = f.clientes_ids.includes(id)
        ? f.clientes_ids.filter(x => x !== id)
        : [...f.clientes_ids, id]
      return { ...f, clientes_ids: ids }
    })
  }

  function toggleTodos() {
    setForm(f => ({
      ...f,
      clientes_ids: f.clientes_ids.length === clientes.length ? [] : clientes.map(c => c.id)
    }))
  }

  async function toggleEstado(t) {
    const nuevo = t.estado === 'pendiente' ? 'hecho' : 'pendiente'
    await supabase.from('tareas').update({ estado: nuevo }).eq('id', t.id)
    if (nuevo === 'hecho' && t.recurrencia) {
      await generarSiguienteRecurrente(t, t.cliente_id)
    }
    cargar()
  }

  async function guardar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    const clientesAInsertar = form.clientes_ids.length > 0 ? form.clientes_ids : [null]
    await Promise.all(clientesAInsertar.map(clienteId =>
      supabase.from('tareas').insert({
        titulo: form.titulo.trim(),
        cliente_id: clienteId,
        fecha_limite: form.fecha_limite || null,
        notas: form.notas || null,
        recurrencia: form.recurrencia || null,
        estado: 'pendiente',
      })
    ))
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

  const RECURRENCIA_LABEL = { diaria: 'Diaria', semanal: 'Semanal', mensual: 'Mensual' }
  const RECURRENCIA_COLOR = { diaria: 'badge-red', semanal: 'badge-blue', mensual: 'badge-orange' }

  const pendientes = tareas.filter(t => t.estado === 'pendiente')
  const hechas = tareas.filter(t => t.estado === 'hecho')
  const todosSeleccionados = form.clientes_ids.length === clientes.length && clientes.length > 0

  function contarPestana(key) {
    if (key === 'todas') return pendientes.length
    if (key === 'hecho') return hechas.length
    return pendientes.filter(t => getGrupo(t.fecha_limite) === key).length
  }

  function tareasMostrar() {
    if (pestana === 'todas') return pendientes
    if (pestana === 'hecho') return hechas
    return pendientes.filter(t => getGrupo(t.fecha_limite) === pestana)
  }

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  const mostrar = tareasMostrar()

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

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {PESTANAS.map(p => {
          const count = contarPestana(p.key)
          const activa = pestana === p.key
          return (
            <button key={p.key} onClick={() => setPestana(p.key)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                background: activa ? (p.color || 'var(--accent)') : 'var(--surface)',
                color: activa ? 'white' : (count === 0 ? 'var(--text3)' : 'var(--text)'),
                fontSize: 12.5, fontWeight: activa ? 600 : 400, cursor: 'pointer',
                fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5,
                opacity: count === 0 && !activa ? 0.5 : 1,
              }}>
              {p.label}
              {count > 0 && (
                <span style={{
                  background: activa ? 'rgba(255,255,255,0.3)' : 'var(--bg2)',
                  color: activa ? 'white' : 'var(--text2)',
                  borderRadius: 10, padding: '0 5px', fontSize: 11, fontFamily: 'var(--mono)'
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {mostrar.length === 0 ? (
        <div className="empty">
          <CheckCircle2 size={40} />
          <p>{pestana === 'hecho' ? 'Ninguna tarea completada aún' : 'Sin tareas en esta categoría 🎉'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mostrar.map(t => (
            <TareaCard key={t.id} t={t} onToggle={toggleEstado} onEliminar={eliminar}
              RECURRENCIA_LABEL={RECURRENCIA_LABEL} RECURRENCIA_COLOR={RECURRENCIA_COLOR} />
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

            <div className="form-group">
              <label className="form-label">Clientes (opcional)</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                <div onClick={toggleTodos} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', background: todosSeleccionados ? 'var(--accent-light)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${todosSeleccionados ? 'var(--accent)' : 'var(--border2)'}`, background: todosSeleccionados ? 'var(--accent)' : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {todosSeleccionados && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: todosSeleccionados ? 'var(--accent-text)' : 'var(--text)' }}>Todos los clientes activos</span>
                </div>
                {clientes.map(c => {
                  const sel = form.clientes_ids.includes(c.id)
                  return (
                    <div key={c.id} onClick={() => toggleClienteForm(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: sel ? 'var(--accent-light)' : 'white', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? 'var(--accent)' : 'var(--border2)'}`, background: sel ? 'var(--accent)' : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 13, color: sel ? 'var(--accent-text)' : 'var(--text)' }}>{c.nombre}</span>
                    </div>
                  )
                })}
              </div>
              {form.clientes_ids.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  Se creará una tarea separada para cada cliente seleccionado ({form.clientes_ids.length})
                </p>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Recurrencia</label>
                <select className="form-select" value={form.recurrencia} onChange={e => setForm(f => ({ ...f, recurrencia: e.target.value }))}>
                  <option value="">Sin repetición</option>
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{form.recurrencia ? 'Primera fecha límite' : 'Fecha límite'}</label>
                <input className="form-input" type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            {form.recurrencia && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                Al marcar como hecha, se creará automáticamente la siguiente con la fecha correspondiente.
              </p>
            )}

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

function TareaCard({ t, onToggle, onEliminar, RECURRENCIA_LABEL, RECURRENCIA_COLOR }) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.estado === 'hecho' ? 'var(--accent)' : 'var(--text3)', flexShrink: 0, display: 'flex' }}>
          {t.estado === 'hecho' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span className="font-medium" style={{ textDecoration: t.estado === 'hecho' ? 'line-through' : 'none', color: t.estado === 'hecho' ? 'var(--text3)' : 'var(--text)' }}>
              {t.titulo}
            </span>
            {t.recurrencia && (
              <span className={`badge ${RECURRENCIA_COLOR[t.recurrencia]}`} style={{ fontSize: 10 }}>
                <RefreshCw size={9} /> {RECURRENCIA_LABEL[t.recurrencia]}
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-1" style={{ flexWrap: 'wrap' }}>
            {t.fecha_limite && (
              <span className="text-sm mono" style={{ color: 'var(--text3)' }}>
                {format(new Date(t.fecha_limite + 'T12:00:00'), 'dd/MM/yyyy')}
              </span>
            )}
            {t.clientes && (
              <span className="text-sm text-muted">{t.clientes.nombre}</span>
            )}
          </div>
          {t.notas && <div className="text-sm text-muted mt-1">{t.notas}</div>}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => onEliminar(t.id)}>
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
