import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export function useGenerarPagosMensuales() {
  useEffect(() => {
    generarSiNecesario()
  }, [])
}

async function generarSiNecesario() {
  const mesActual = format(new Date(), 'yyyy-MM')

  // Verificar si ya se generaron este mes (usando localStorage como flag)
  const flagKey = `pagos_generados_${mesActual}`
  if (localStorage.getItem(flagKey)) return

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, servicios(tarifa_mensual)')
    .eq('estado', 'activo')

  if (!clientes || clientes.length === 0) return

  const { data: pagosExistentes } = await supabase
    .from('pagos')
    .select('cliente_id')
    .eq('tipo', 'mensualidad')
    .eq('mes_facturado', mesActual)

  const clientesConPago = new Set((pagosExistentes || []).map(p => p.cliente_id))

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
  }

  // Marcar como generado para este mes
  localStorage.setItem(flagKey, '1')
}
