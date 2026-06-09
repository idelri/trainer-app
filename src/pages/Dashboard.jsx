import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle } from 'lucide-react'

export default function Dashboard({ setPage, setClientePlanificacion }) {
  const [clientes, setClientes] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)

  const mesActual = format(new Date(), 'yyyy-MM')
  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [
      { data: clientesData },
      { data: pagosData },
    ] = await Promise.all([
      supabase.from('clientes').select('id, nombre, deporte').eq('estado', 'activo').order('nombre'),
      supabase.from('pagos').select('*, clientes(nombre)').eq('mes_facturado', mesActual).eq('estado', 'pendiente'),
    ])
    setClientes(clientesData || [])
    setPendientes(pagosData || [])
    setLoading(false)
  }

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  const porDeporte = {}
  clientes.forEach(c => {
    const dep = c.deporte || 'Sin deporte'
    if (!porDeporte[dep]) porDeporte[dep] = []
    porDeporte[dep].push(c)
  })
  const deportes = Object.keys(porDeporte).sort()

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{mesLabel}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Clientes activos — {clientes.length}</span>
        </div>
        {deportes.map(dep => (
          <div key={dep} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{dep}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {porDeporte[dep].map(c => (
                <button key={c.id} className="btn btn-ghost"
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 13, fontWeight: 500 }}
                  onClick={async () => {
                    const { data: planes } = await supabase.from('planificaciones').select('id').eq('cliente_id', c.id).limit(1)
                    if (setClientePlanificacion) setClientePlanificacion(c.id)
                    if (setPage) setPage('planificacion')
                  }}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}
        {clientes.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Sin clientes activos.</p>}
      </div>
        {pendientes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {pendientes.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{p.clientes?.nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.tipo}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600 }}>{p.importe}€</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
