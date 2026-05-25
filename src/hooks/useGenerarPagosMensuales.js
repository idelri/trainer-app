import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

// Se ejecuta al cargar la app. Si es un mes nuevo, genera las mensualidades pendientes
// para todos los clientes activos que aún no las tengan.
export function useGenerarPagosMensuales() {
  useEffect(() => {
    generarSiNecesario()
  }, [])
}

async function generarSiNecesario() {
  const mesActual = format(new Date(), 'yyyy-MM')

  // Clientes activos con su tarifa
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, servicios(tarifa_mensual)')
    .eq('estado', 'activo')

  if (!clientes || clientes.length === 0) return

  // Pagos tipo mensualidad que ya existen este mes
  const { data: pagosExistentes } = await supabase
    .from('pagos')
    .select('cliente_id')
    .eq('tipo', 'mensualidad')
    .eq('mes_facturado', mesActual)

  const clientesConPago = new Set((pagosExistentes || []).map(p => p.cliente_id))

  // Generar solo los que faltan
  const nuevos = clientes
    .filter(c => !clientesConPago.has(c.id))
    .map(c => ({
      cliente_id: c.id,
      tipo: 'mensualidad',
      importe: c.servicios?.[0]?.tarifa_mensual || 0,
      estado: 'pendiente',
      mes_facturado: mesActual,
    }))

  if (nuevos.length > 0) {
    await supabase.from('pagos').insert(nuevos)
    console.log(`✓ Generadas ${nuevos.length} mensualidades para ${mesActual}`)
  }
}
