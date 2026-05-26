import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, subMonths, addMonths, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

const RANGOS = [
  { label: '3 meses', value: 3 },
  { label: '6 meses', value: 6 },
  { label: '12 meses', value: 12 },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [tareasPendientes, setTareasPendientes] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [rango, setRango] = useState(6)
  const [mesFin, setMesFin] = useState(new Date())

  const mesActual = format(new Date(), 'yyyy-MM')
  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  useEffect(() => { cargar() }, [rango, mesFin])

  async function cargar() {
    const meses = Array.from({ length: rango }, (_, i) =>
      format(subMonths(mesFin, rango - 1 - i), 'yyyy-MM')
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

    const porMes = meses.map(m => {
      const p = (todosPagos || []).filter(p => p.mes_facturado === m && p.estado === 'pagado')
      return {
        mes: m,
        label: format(new Date(m + '-01'), rango > 6 ? 'MMM yy' : 'MMM', { locale: es }),
        total: p.reduce((s, x) => s + x.importe, 0)
      }
    })
    setHistorico(porMes)
    setLoading(false)
  }

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  const maxValor = Math.max(...historico.map(m => m.total), 1)
  const mesFinLabel = format(mesFin, 'MMM yyyy', { locale: es })
  const mesInicioLabel = format(subMonths(mesFin, rango - 1), 'MMM yyyy', { locale: es })

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

      {/* Gráfica */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Ingresos cobrados</span>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'capitalize' }}>
            {mesInicioLabel} — {mesFinLabel}
          </span>

          {/* Selector de rango */}
          <div className="flex gap-1 ml-auto">
            {RANGOS.map(r => (
              <button key={r.value} className="btn btn-ghost btn-sm"
                style={rango === r.value ? { background: 'var(--bg2)', fontWeight: 500 } : { fontSize: 11 }}
                onClick={() => setRango(r.value)}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Navegación de periodo */}
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" title="Periodo anterior"
              onClick={() => setMesFin(m => subMonths(m, rango))}>
              <ChevronLeft size={13} />
            </button>
            <button className="btn btn-ghost btn-sm" title="Periodo siguiente"
              onClick={() => setMesFin(m => addMonths(m, rango))}
              disabled={format(addMonths(mesFin, 1), 'yyyy-MM') > mesActual}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Barras */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: rango > 6 ? 4 : 6, height: 140, padding: '0 4px' }}>
          {historico.map(m => (
            <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              {m.total > 0 && (
                <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {m.total}€
                </div>
              )}
              <div style={{
                width: rango > 6 ? '60%' : '50%',
                height: `${Math.max((m.total / maxValor) * 100, m.total > 0 ? 3 : 0)}%`,
                background: m.mes === mesActual ? 'var(--accent)' : 'var(--accent-light)',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease',
                minHeight: m.total > 0 ? 3 : 0,
                border: m.mes === mesActual ? 'none' : '1px solid var(--border)',
              }} />
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
