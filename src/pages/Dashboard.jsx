import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard({ setPage, setClientePlanificacion }) {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  useEffect(() => { cargar() }, [])

  async function cargar() {
   const { data } = await supabase.from('clientes').select('id, nombre, servicios(deporte)').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  if (loading) return <div className="empty"><p>Cargando...</p></div>

  const porDeporte = {}
  clientes.forEach(c => {
    const dep = c.servicios?.[0]?.deporte || c.servicios?.deporte || 'Sin deporte'
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

      <div className="card">
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
                  onClick={() => {
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
    </div>
  )
}
