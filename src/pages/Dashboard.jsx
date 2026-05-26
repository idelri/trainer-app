import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Clock } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [tareasPendientes, setTareasPendientes] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const mesActual = format(new Date(), 'yyyy-MM')
  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    // Últimos 7 meses para la gráfica
    const meses = Array.from({ length: 7 }, (_, i) =>
      format(subMonths(new Date(), 6 - i), 'yyyy-MM')
    )

    const [
      { data: pagosDelMes },
      { data: clientesActivos },
      { data: tareas },
      { data: todosPagos }
    ] = await Promise.all([
      supabase.from('pagos').select('*, clientes(nombre)').eq('mes_facturado', mesActual),
      supabase.from('clientes').select('id').eq('estado', 'activo'),
      supabase.from('tareas').select('*, clientes(nombre)').eq('estado', 'pendiente')
        .order('fecha_limite', { ascending: true, nullsFirst: false }).limit(5),
      supabase.from('pagos').select('mes_facturado, estado, importe').in('mes_facturado', meses)
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

    // Agrupar por mes
    const porMes = meses.map(m => {
      const pagosDelMes = (todosPagos || []).filter(p => p.mes_facturado === m && p.estado === 'pagado')
      return {
        mes: m,
        label: format(new Date(m + '-01'), 'MMM', { locale: es }),
        total: pagosDelMes.reduce((s, p) => s + p.importe, 0)
      }
    })
    setHistorico(porMes)
    setLoading(false)
  }

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  const maxValor = Math.max(...historico.map(m => m.total), 1)

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

      {/* Gráfica de barras */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 20 }}>Ingresos cobrados por mes</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
          {historico.map(m => (
            <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                {m.total > 0 ? `${m.total}€` : ''}
              </div>
              <div style={{
                width: '100%',
                height: `${Math.max((m.total / maxValor) * 100, m.total > 0 ? 4 : 0)}%`,
                background: m.mes === mesActual ? 'var(--accent)' : 'var(--accent-light)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s ease',
                minHeight: m.total > 0 ? 4 : 0,
                border: m.mes === mesActual ? 'none' : '1px solid var(--border)',
              }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'capitalize' }}>
                {m.label}
              </div>
            </div>
          ))}
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
