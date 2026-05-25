import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, subMonths, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle2 } from 'lucide-react'

const hoy = () => format(new Date(), 'yyyy-MM-dd')

const EMPTY_PAGO = {
  cliente_id: '', tipo: 'sesion', importe: '', metodo_pago: 'efectivo', notas: '', fecha_pago: hoy()
}

export default function Pagos() {
  const [mes, setMes] = useState(new Date())
  const [pagos, setPagos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_PAGO)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todos')

  const mesStr = format(mes, 'yyyy-MM')
  const mesLabel = format(mes, 'MMMM yyyy', { locale: es })

  useEffect(() => { cargarClientes() }, [])
  useEffect(() => { cargarPagos() }, [mesStr])

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
    setClientes(data || [])
  }

  async function cargarPagos() {
    setLoading(true)
    const { data } = await supabase
      .from('pagos')
      .select('*, clientes(nombre)')
      .eq('mes_facturado', mesStr)
      .order('estado')
      .order('created_at', { ascending: false })
    setPagos(data || [])
    setLoading(false)
  }

  async function marcarPagado(pago) {
    await supabase.from('pagos').update({ estado: 'pagado', fecha_pago: hoy() }).eq('id', pago.id)
    cargarPagos()
  }

  async function marcarPendiente(pago) {
    await supabase.from('pagos').update({ estado: 'pendiente', fecha_pago: null }).eq('id', pago.id)
    cargarPagos()
  }

  async function guardarPago() {
    if (!form.cliente_id || !form.importe) return
    setSaving(true)
    await supabase.from('pagos').insert({
      cliente_id: form.cliente_id,
      tipo: form.tipo,
      importe: parseFloat(form.importe),
      estado: 'pagado',
      mes_facturado: mesStr,
      fecha_pago: form.fecha_pago || hoy(),
      metodo_pago: form.metodo_pago || null,
      notas: form.notas || null,
    })
    setSaving(false)
    setModal(false)
    setForm({ ...EMPTY_PAGO, fecha_pago: hoy() })
    cargarPagos()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este pago?')) return
    await supabase.from('pagos').delete().eq('id', id)
    cargarPagos()
  }

  const pagosFiltrados = filtro === 'todos' ? pagos : pagos.filter(p => p.estado === filtro)
  const totalCobrado = pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.importe, 0)
  const totalPendiente = pagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.importe, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Pagos</h2>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{mesLabel}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={14} /> Añadir sesión
        </button>
      </div>

      <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMes(m => subMonths(m, 1))}>
          <ChevronLeft size={14} />
        </button>
        <span className="mono" style={{ fontSize: 13, color: 'var(--text2)', textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>{mesLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setMes(m => addMonths(m, 1))}>
          <ChevronRight size={14} />
        </button>
        <div className="flex gap-2 ml-auto">
          {['todos', 'pendiente', 'pagado'].map(f => (
            <button key={f} className="btn btn-ghost btn-sm"
              style={filtro === f ? { background: 'var(--bg2)', fontWeight: 500 } : {}}
              onClick={() => setFiltro(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3" style={{ marginBottom: 20 }}>
        <div style={{ padding: '10px 16px', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Cobrado</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)', marginTop: 2 }}>{totalCobrado.toFixed(0)}€</div>
        </div>
        <div style={{ padding: '10px 16px', background: 'var(--warning-light)', borderRadius: 'var(--radius-sm)', flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--warning)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Pendiente</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--warning)', marginTop: 2 }}>{totalPendiente.toFixed(0)}€</div>
        </div>
      </div>

      {loading ? (
        <div className="empty"><p>Cargando...</p></div>
      ) : pagosFiltrados.length === 0 ? (
        <div className="empty">
          <CheckCircle2 size={40} />
          <p>No hay pagos {filtro !== 'todos' ? `con estado "${filtro}"` : ''} en {mesLabel}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Importe</th>
                <th>Método</th>
                <th>Fecha pago</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(p => (
                <tr key={p.id}>
                  <td><span className="font-medium">{p.clientes?.nombre}</span></td>
                  <td><span className={`badge ${p.tipo === 'mensualidad' ? 'badge-blue' : 'badge-gray'}`}>{p.tipo}</span></td>
                  <td className="mono">{p.importe}€</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12.5 }}>{p.metodo_pago || '—'}</td>
                  <td className="mono" style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                    {p.fecha_pago ? format(new Date(p.fecha_pago + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${p.estado === 'pagado' ? 'badge-green' : 'badge-orange'}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {p.estado === 'pendiente' ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => marcarPagado(p)} title="Marcar como pagado">
                          <CheckCircle2 size={13} />
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => marcarPendiente(p)} title="Marcar como pendiente">
                          ↩
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminar(p.id)} title="Eliminar">
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Añadir pago / sesión</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><X size={14} /></button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="sesion">Sesión</option>
                  <option value="mensualidad">Mensualidad</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Importe (€) *</label>
                <input className="form-input" type="number" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de pago</label>
                <input className="form-input" type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Método de pago</label>
                <select className="form-select" value={form.metodo_pago} onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value }))}>
                  <option value="efectivo">Efectivo</option>
                  <option value="bizum">Bizum</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Sesión extra, descuento..." />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarPago} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar como pagado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
