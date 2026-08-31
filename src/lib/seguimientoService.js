/**
 * seguimientoService.js — Operaciones de BD para Seguimiento (Fase 5)
 *
 * Fuente única: sesion_feedback + feedback_alertas_revisadas
 * feedLeidos (localStorage) ya NO se usa. La fuente de verdad es BD.
 *
 * RANGO DE CÁLCULO: 8 semanas (para rachas acumulativas con historia suficiente)
 * RANGO DE VISUALIZACIÓN: lo decide el consumidor (UI puede filtrar)
 */

import { supabase } from './supabase'
import { format, addDays } from 'date-fns'

export const SEMANAS_CALCULO = 8  // rango para rachas
export const SEMANAS_DISPLAY = 4  // rango por defecto en la UI

/**
 * Carga feedbacks + sesiones + revisadas para UN cliente.
 * Incluye molestia_reportes para cruzar con Salud.
 */
export async function cargarSeguimientoCliente(clienteId) {
  const desde = format(addDays(new Date(), -(SEMANAS_CALCULO * 7)), 'yyyy-MM-dd')

  // Sesiones del cliente con feedback, últimas 8 semanas
  const { data: sesiones } = await supabase
    .from('sesiones')
    .select('id, titulo, fecha, completada_el, duracion_min, cliente_id')
    .eq('cliente_id', clienteId)
    .gte('fecha', desde)
    .not('fecha', 'is', null)
    .order('fecha', { ascending: false })

  if (!sesiones?.length) return { feedbacks: [], sesiones: [], revisadas: [], molestiaReps: [], notas: [] }

  const sesIds = sesiones.map(s => s.id)

  const [fbRes, revisRes, molRes, notasRes] = await Promise.all([
    supabase.from('sesion_feedback').select('id, sesion_id, data, submitted_at').in('sesion_id', sesIds),
    supabase.from('feedback_alertas_revisadas').select('sesion_feedback_id, categoria').eq('cliente_id', clienteId),
    supabase.from('molestia_reportes').select('id, sesion_feedback_id, estado, episodio_id, intensidad, detalle').eq('cliente_id', clienteId).not('sesion_feedback_id', 'is', null),
    supabase.from('sesion_notas').select('id, fecha, texto, categoria, visibilidad, created_at').eq('cliente_id', clienteId).order('fecha', { ascending: false }),
  ])

  return {
    feedbacks:    fbRes.data    || [],
    sesiones,
    revisadas:    revisRes.data || [],
    molestiaReps: molRes.data   || [],
    notas:        notasRes.data || [],
  }
}

/**
 * Carga feedbacks + sesiones + revisadas para TODOS los clientes (Mi Espacio).
 * clientes: [{id, nombre}]
 */
export async function cargarSeguimientoGlobal(clientes) {
  if (!clientes?.length) return { feedbacks: [], sesiones: [], revisadas: [], molestiaReps: [] }

  const desde = format(addDays(new Date(), -(SEMANAS_CALCULO * 7)), 'yyyy-MM-dd')
  const clienteIds = clientes.map(c => c.id)

  // Sesiones de todos los clientes
  const { data: sesiones } = await supabase
    .from('sesiones')
    .select('id, titulo, fecha, completada_el, duracion_min, cliente_id')
    .in('cliente_id', clienteIds)
    .gte('fecha', desde)
    .not('fecha', 'is', null)
    .order('fecha', { ascending: false })

  if (!sesiones?.length) return { feedbacks: [], sesiones: [], revisadas: [], molestiaReps: [] }

  const sesIds = sesiones.map(s => s.id)

  const [fbRes, revisRes, molRes] = await Promise.all([
    supabase.from('sesion_feedback').select('id, sesion_id, data, submitted_at').in('sesion_id', sesIds),
    supabase.from('feedback_alertas_revisadas').select('sesion_feedback_id, categoria').in('cliente_id', clienteIds),
    supabase.from('molestia_reportes').select('id, sesion_feedback_id, estado, episodio_id, intensidad, detalle').in('cliente_id', clienteIds).not('sesion_feedback_id', 'is', null),
  ])

  return {
    feedbacks:    fbRes.data    || [],
    sesiones,
    revisadas:    revisRes.data || [],
    molestiaReps: molRes.data   || [],
  }
}

/**
 * Marca como revisado todas las categorías pendientes de un item.
 * Idempotente: usa upsert con onConflict ignoreDuplicates.
 *
 * @param {string} clienteId
 * @param {string} sesionFeedbackId
 * @param {string[]} categorias — solo las pendientes del item
 */
export async function marcarRevisado(clienteId, sesionFeedbackId, categorias) {
  if (!categorias?.length) return
  const rows = categorias.map(cat => ({
    cliente_id:         clienteId,
    sesion_feedback_id: sesionFeedbackId,
    categoria:          cat,
  }))
  await supabase.from('feedback_alertas_revisadas')
    .upsert(rows, { onConflict: 'sesion_feedback_id,categoria', ignoreDuplicates: true })
}

/**
 * Crea una nota de seguimiento manual para un cliente.
 */
export async function crearNota(clienteId, { fecha, texto, categoria }) {
  const { data, error } = await supabase.from('sesion_notas').insert({
    cliente_id:   clienteId,
    fecha:        fecha,
    texto:        texto.trim(),
    categoria:    categoria || null,
    visibilidad:  'entrenadora',
  }).select().single()
  return { data, error }
}
