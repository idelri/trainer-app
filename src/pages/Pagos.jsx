import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, subMonths, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle2, Pencil, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'

const hoy = () => format(new Date(), 'yyyy-MM-dd')

const EMPTY_PAGO = {
  cliente_id: '', tipo: 'sesion', importe: '', metodo_pago: 'efectivo',
  notas: '', fecha_pago: hoy(), fecha_sesion: hoy()
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.3 }} />
  return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
}

export default function Pagos() {
  const [mes, setMes] = useState(new Date())
  const [pagos, setPagos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_PAGO)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [sortCol, setSortCol] = useState('estado')
  const [sortDir, setSortDir] = useState('asc')

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
    setPagos(data || [])
    setLoading(false)
  }

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function sortPagos(list) {
    return [...list].sort((a, b) => {
      let va, vb
      switch (sortCol) {
        case 'nombre': va = a.clientes?.nombre || ''; vb = b.clientes?.nombre || ''; break
        case 'tipo': va = a.tipo; vb = b.tipo; break
        case 'importe': va = a.importe; vb = b.importe; break
        case 'metodo': va = a.metodo_pago || ''; vb = b.metodo_pago || ''; break
        case 'fecha_sesion': va = a.fecha_sesion || ''; vb = b.fecha_sesion || ''; break
        case 'fecha_pago': va = a.fecha_pago || ''; vb = b.fecha_pago || ''; break
        case 'estado': va = a.estado; vb = b.estado; break
        default: va = ''; vb = ''
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  async function marcarPagado(pago) {
    await supabase.from('pagos').update({ estado: 'pagado', fecha_pago: hoy() }).eq('id', pago.id)
    cargarPagos()
  }

  async function marcarPendiente(pago) {
    await supabase.from('pagos').update({ estado: 'pendiente', fecha_pago: null }).eq('id', pago.id)
    cargarPagos()
  }

  function abrirEditar(p) {
    setEditando(p)
    setForm({
      cliente_id: p.cliente_id,
      tipo: p.tipo,
      importe: p.importe,
      metodo_pago: p.metodo_pago || 'efectivo',
      notas: p.notas || '',
      fecha_pago: p.fecha_pago || hoy(),
      fecha_sesion: p.fecha_sesion || '',
    })
    setModal(true)
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ ...EMPTY_PAGO, fecha_pago: hoy(), fecha_sesion: hoy() })
    setModal(true)
  }

  async function guardarPago() {
    if (!form.cliente_id || !form.importe) return
    setSaving(true)
    if (editando) {
      await supabase.from('pagos').update({
        tipo: form.tipo,
        importe: parseFloat(form.importe),
        metodo_pago: form.metodo_pago || null,
        notas: form.notas || null,
        fecha_pago: form.fecha_pago || null,
        fecha_sesion: form.fecha_sesion || null,
      }).eq('id', editando.id)
    } else {
      await supabase.from('pagos').insert({
        cliente_id: form.cliente_id,
        tipo: form.tipo,
        importe: parseFloat(form.importe),
        estado: 'pagado',
        mes_facturado: mesStr,
        fecha_pago: form.fecha_pago || hoy(),
        fecha_sesion: form.fecha_sesion || null,
        metodo_pago: form.metodo_pago || null,
        notas: form.notas || null,
      })
    }
    setSaving(false)
    setModal(false)
    setEditando(null)
    cargarPagos()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este pago?')) return
    await supabase.from('pagos').delete().eq('id', id)
    cargarPagos()
  }

  const pagosFiltrados = filtro === 'todos' ? pagos : pagos.filter(p => p.estado === filtro)
  const pagsOrdenados = sortPagos(pagosFiltrados)
  const totalCobrado = pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.importe, 0)
  const totalPendiente = pagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.importe, 0)

  const thStyle = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Pagos</h2>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{mesLabel}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
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
      ) : pagsOrdenados.length === 0 ? (
        <div className="empty">
          <CheckCircle2 size={40} />
          <p>No hay pagos {filtro !== 'todos' ? `con estado "${filtro}"` : ''} en {mesLabel}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  { key: 'nombre', label: 'Cliente' },
                  { key: 'tipo', label: 'Tipo' },
                  { key: 'importe', label: 'Importe' },
                  { key: 'metodo', label: 'Método' },
                  { key: 'fecha_sesion', label: 'Fecha sesión' },
                  { key: 'fecha_pago', label: 'Fecha pago' },
                  { key: 'estado', label: 'Estado' },
                ].map(({ key, label }) => (
                  <th key={key} style={thStyle} onClick={() => toggleSort(key)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {label} <SortIcon col={key} sortCol={sortCol} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagsOrdenados.map(p => (
                <tr key={p.id}>
                  <td><span className="font-medium">{p.clientes?.nombre}</span></td>
                  <td><span className={`badge ${p.tipo === 'mensualidad' ? 'badge-blue' : 'badge-gray'}`}>{p.tipo}</span></td>
                  <td className="mono">{p.importe}€</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12.5 }}>{p.metodo_pago || '—'}</td>
                  <td className="mono" style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                    {p.fecha_sesion ? format(new Date(p.fecha_sesion + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                  </td>
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
