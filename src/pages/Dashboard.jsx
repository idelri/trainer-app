import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, Users, AlertCircle, CheckCircle, Clock, Euro } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [tareasPendientes, setTareasPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const mesActual = format(new Date(), 'yyyy-MM')
  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [
      { data: pagosDelMes },
      { data: clientesActivos },
      { data: tareas }
    ] = await Promise.all([
      supabase.from('pagos')
        .select('*, clientes(nombre)')
        .eq('mes_facturado', mesActual),
      supabase.from('clientes').select('id').eq('estado', 'activo'),
      supabase.from('tareas')
        .select('*, clientes(nombre)')
        .eq('estado', 'pendiente')
        .order('fecha_limite', { ascending: true, nullsFirst: false })
        .limit(5)
    ])

    const pagados = (pagosDelMes || []).filter(p => p.estado === 'pagado')
    const pend = (pagosDelMes || []).filter(p => p.estado === 'pendiente')

    setStats({
      ingresosCobrados: pagados.reduce((s, p) => s + p.importe, 0),
      ingresosPendientes: pend.reduce((s, p) => s + p.importe, 0),
      totalPagados: pagados.length,
      totalPendientes: pend.length,
      clientesActivos: clientesActivos?.length || 0,
    })
    setPendientes(pend)
    setTareasPendientes(tareas || [])
    setLoading(false)
  }

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{mesLabel}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Cobrado este mes</div>
          <div className="value green">{stats.ingresosCobrados.toFixed(0)}€</div>
        </div>
        <div className="stat-card">
          <div className="label">Pendiente de cobro</div>
          <div className="value orange">{stats.ingresosPendientes.toFixed(0)}€</div>
        </div>
        <div className="stat-card">
          <div className="label">Pagos completados</div>
          <div className="value">{stats.totalPagados}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pagos pendientes</div>
          <div className="value red">{stats.totalPendientes}</div>
        </div>
        <div className="stat-card">
          <div className="label">Clientes activos</div>
          <div className="value">{stats.clientesActivos}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Pendientes de pago */}
        <div className="card">
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} color="var(--warning)" />
            <span className="font-medium" style={{ fontSize: 14 }}>Sin pagar este mes</span>
            <span className="badge badge-orange ml-auto">{pendientes.length}</span>
          </div>
          {pendientes.length === 0
            ? <p className="text-muted text-sm">¡Todo cobrado este mes! 🎉</p>
            : pendientes.map(p => (
              <div key={p.id} className="flex items-center gap-2" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div className="font-medium" style={{ fontSize: 13.5 }}>{p.clientes?.nombre}</div>
                  <div className="text-muted text-sm">{p.tipo}</div>
                </div>
                <div className="mono" style={{ fontSize: 13 }}>{p.importe}€</div>
              </div>
            ))
          }
        </div>

        {/* Tareas pendientes */}
        <div className="card">
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <Clock size={15} color="var(--accent)" />
            <span className="font-medium" style={{ fontSize: 14 }}>Tareas pendientes</span>
            <span className="badge badge-blue ml-auto">{tareasPendientes.length}</span>
          </div>
          {tareasPendientes.length === 0
            ? <p className="text-muted text-sm">Sin tareas pendientes.</p>
            : tareasPendientes.map(t => (
              <div key={t.id} className="flex items-center gap-2" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div className="font-medium" style={{ fontSize: 13.5 }}>{t.titulo}</div>
                  {t.clientes && <div className="text-muted text-sm">{t.clientes.nombre}</div>}
                </div>
                {t.fecha_limite && (
                  <div className="text-sm text-muted mono">
                    {format(new Date(t.fecha_limite), 'dd/MM')}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
