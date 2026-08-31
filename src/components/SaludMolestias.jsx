/**
 * SaludMolestias.jsx — Fase 4
 *
 * Sistema de registro y seguimiento de molestias.
 * NO hace diagnóstico médico, NO vincula automáticamente por texto libre,
 * NO modifica sesion_feedback ni cuestionario_inicial.
 *
 * Estrategia de idempotencia para feedback:
 *   - sincronizarFeedback() crea molestia_reportes (estado='pendiente') desde
 *     sesion_feedback con pain data, comprobando previamente si ya existe por
 *     sesion_feedback_id. Nunca duplica.
 *
 * origen válidos: 'entrenadora' | 'feedback_sesion' | 'cuestionario_inicial'
 * estado reporte: 'pendiente' | 'vinculado' | 'descartado'
 * estado episodio: 'activo' | 'resuelto'
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const HOY = () => new Date().toISOString().slice(0, 10)
const LATERALIDAD = ['derecha', 'izquierda', 'bilateral', 'no especificada']
const ORIGEN_LABEL = {
  entrenadora:          'Entrenadora',
  feedback_sesion:      'Feedback de sesión',
  cuestionario_inicial: 'Cuestionario inicial',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasPainData(fb) {
  const p = fb?.data?.pain
  if (!p) return false
  return (p.hasPain && p.mainPainDetails?.trim()) ||
         (p.additionalPain && p.additionalPainDetails?.trim())
}

function extractPainText(p) {
  if (!p) return ''
  if (p.hasPain && p.mainPainDetails?.trim()) return p.mainPainDetails.trim()
  if (p.additionalPain && p.additionalPainDetails?.trim()) {
    const nivel = p.additionalPainLevel && p.additionalPainLevel !== 'No'
      ? `${p.additionalPainLevel}. ` : ''
    return `${nivel}${p.additionalPainDetails.trim()}`
  }
  return ''
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export default function SaludMolestias({
  clienteId,
  cuestionario,
  abrirNueva = false,
  onAbrirConsumido,
}) {
  const [episodios, setEpisodios] = useState([])
  const [reportes,  setReportes]  = useState([])
  const [sesionMap, setSesionMap] = useState({}) // feedbackId → { sesion_titulo, sesion_fecha }
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)

  // modal: null | { tipo: 'nueva'|'resolver'|'vincular'|'crearDesde'|'cuestionario'|'editar', data }
  const [modal, setModal] = useState(null)
  const [expandidos, setExpandidos] = useState(new Set())

  // ── Idempotent feedback sync ─────────────────────────────────────────────

  const sincronizarFeedback = useCallback(async () => {
    setSyncing(true)
    try {
      // 1. Sesiones del cliente
      const { data: sesiones } = await supabase
        .from('sesiones').select('id, titulo, fecha').eq('cliente_id', clienteId)
      if (!sesiones?.length) return

      // 2. Feedbacks con pain
      const { data: fbs } = await supabase
        .from('sesion_feedback')
        .select('id, sesion_id, data, submitted_at')
        .in('sesion_id', sesiones.map(s => s.id))

      const conDolor = (fbs || []).filter(hasPainData)
      if (!conDolor.length) return

      // 3. Comprobar cuáles ya tienen reporte
      const { data: existentes } = await supabase
        .from('molestia_reportes')
        .select('sesion_feedback_id')
        .eq('cliente_id', clienteId)
        .not('sesion_feedback_id', 'is', null)

      const yaExisten = new Set((existentes || []).map(r => r.sesion_feedback_id))
      const sesMap = Object.fromEntries(sesiones.map(s => [s.id, s]))

      // 4. Crear solo los que faltan
      const nuevos = conDolor
        .filter(fb => !yaExisten.has(fb.id))
        .map(fb => ({
          cliente_id:         clienteId,
          sesion_feedback_id: fb.id,
          fecha:              sesMap[fb.sesion_id]?.fecha || fb.submitted_at?.slice(0, 10) || HOY(),
          detalle:            extractPainText(fb.data?.pain),
          origen:             'feedback_sesion',
          estado:             'pendiente',
        }))

      if (nuevos.length) {
        await supabase.from('molestia_reportes').insert(nuevos)
      }
    } finally {
      setSyncing(false)
    }
  }, [clienteId])

  // ── Carga de datos ───────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true)
    await sincronizarFeedback()

    const [episRes, repRes] = await Promise.all([
      supabase.from('molestia_episodios')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha_inicio', { ascending: false }),
      supabase.from('molestia_reportes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: false }),
    ])

    const rpts = repRes.data || []
    setEpisodios(episRes.data || [])
    setReportes(rpts)

    // Cargar info de sesión para reportes de feedback
    const fbIds = rpts.filter(r => r.sesion_feedback_id).map(r => r.sesion_feedback_id)
    if (fbIds.length) {
      const { data: fbs } = await supabase
        .from('sesion_feedback').select('id, sesion_id').in('id', fbIds)
      const sesIds = [...new Set((fbs || []).map(f => f.sesion_id))]
      if (sesIds.length) {
        const { data: sesis } = await supabase
          .from('sesiones').select('id, titulo, fecha').in('id', sesIds)
        const sesById = Object.fromEntries((sesis || []).map(s => [s.id, s]))
        const map = {}
        ;(fbs || []).forEach(fb => {
          const s = sesById[fb.sesion_id]
          if (s) map[fb.id] = { sesion_titulo: s.titulo, sesion_fecha: s.fecha }
        })
        setSesionMap(map)
      }
    }

    setLoading(false)
  }, [clienteId, sincronizarFeedback])

  useEffect(() => { cargar() }, [cargar])

  // Abrir modal "nueva molestia" desde ClienteFicha (+Añadir)
  useEffect(() => {
    if (abrirNueva) {
      setModal({ tipo: 'nueva', data: {} })
      onAbrirConsumido?.()
    }
  }, [abrirNueva, onAbrirConsumido])

  // ── Acciones ─────────────────────────────────────────────────────────────

  async function descartarReporte(rep) {
    if (!window.confirm('¿Descartar este reporte? El feedback original permanece intacto.')) return
    await supabase.from('molestia_reportes').update({ estado: 'descartado' }).eq('id', rep.id)
    cargar()
  }

  async function resolverEpisodio(episodio, fechaResolucion, nota) {
    await supabase.from('molestia_episodios').update({
      estado: 'resuelto',
      fecha_resolucion: fechaResolucion,
      observaciones: nota || episodio.observaciones || null,
    }).eq('id', episodio.id)
    setModal(null)
    cargar()
  }

  async function reabrirEpisodio(episodio) {
    await supabase.from('molestia_episodios').update({
      estado: 'activo',
      fecha_resolucion: null,
    }).eq('id', episodio.id)
    cargar()
  }

  async function vincularReporte(reporteId, episodio) {
    const esResuelto = episodio.estado === 'resuelto'
    if (esResuelto) {
      await supabase.from('molestia_episodios').update({
        estado: 'activo',
        fecha_resolucion: null,
      }).eq('id', episodio.id)
    }
    await supabase.from('molestia_reportes').update({
      episodio_id: episodio.id,
      estado: 'vinculado',
    }).eq('id', reporteId)
    setModal(null)
    cargar()
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  const pendientes  = reportes.filter(r => r.estado === 'pendiente')
  const activos     = episodios.filter(e => e.estado === 'activo')
  const resueltos   = episodios.filter(e => e.estado === 'resuelto')

  // Lesiones del cuestionario no gestionadas
  const gestionadas = new Set(
    episodios
      .filter(e => e.cuestionario_inicial_id === cuestionario?.id && e.cuestionario_lesion_idx != null)
      .map(e => e.cuestionario_lesion_idx)
  )
  const lesionesIniciales = (cuestionario?.lesiones_actuales || [])
    .map((l, i) => ({ ...l, idx: i }))
    .filter(l => !gestionadas.has(l.idx) && (l.zona || l.diagnostico))

  // Reportes de un episodio (ordenados asc para evolución)
  function reportesDeEpisodio(epId) {
    return reportes.filter(r => r.episodio_id === epId).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  function toggleExpandido(id) {
    setExpandidos(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ marginBottom: 28 }}>
      <SaludHeader onNueva={() => setModal({ tipo: 'nueva', data: {} })} />
      <p style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando...</p>
    </div>
  )

  const hayAlgo = pendientes.length || activos.length || resueltos.length || lesionesIniciales.length

  return (
    <div style={{ marginBottom: 28 }}>
      <SaludHeader onNueva={() => setModal({ tipo: 'nueva', data: {} })} />

      {/* ── Pendientes de revisión ── */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            Pendientes de revisión
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendientes.map(rep => (
              <CardPendiente
                key={rep.id}
                rep={rep}
                sesionInfo={sesionMap[rep.sesion_feedback_id]}
                onVincular={() => setModal({ tipo: 'vincular', data: { rep } })}
                onCrearEpisodio={() => setModal({ tipo: 'crearDesde', data: { rep } })}
                onDescartar={() => descartarReporte(rep)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Activas ── */}
      {activos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            Activas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activos.map(ep => (
              <CardEpisodio
                key={ep.id}
                ep={ep}
                reps={reportesDeEpisodio(ep.id)}
                expandido={expandidos.has(ep.id)}
                onToggle={() => toggleExpandido(ep.id)}
                onResolver={() => setModal({ tipo: 'resolver', data: { ep } })}
                onEditar={() => setModal({ tipo: 'editar', data: { ep } })}
                sesionMap={sesionMap}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Anteriores / Resueltas ── */}
      {resueltos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            Anteriores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resueltos.map(ep => (
              <CardEpisodioResuelto
                key={ep.id}
                ep={ep}
                reps={reportesDeEpisodio(ep.id)}
                expandido={expandidos.has(ep.id)}
                onToggle={() => toggleExpandido(ep.id)}
                onReabrir={() => reabrirEpisodio(ep)}
                onEditar={() => setModal({ tipo: 'editar', data: { ep } })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Información declarada al inicio ── */}
      {lesionesIniciales.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            Información declarada al inicio
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontStyle: 'italic' }}>
            Declarado en el cuestionario inicial · Solo lectura · Convierte en episodio para hacer seguimiento
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lesionesIniciales.map(l => (
              <CardLesionInicial
                key={l.idx}
                lesion={l}
                onCrear={() => setModal({ tipo: 'cuestionario', data: { lesion: l } })}
              />
            ))}
          </div>
        </div>
      )}

      {!hayAlgo && (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>No hay molestias registradas.</p>
      )}

      {/* ── Modals ── */}
      {modal?.tipo === 'nueva' && (
        <ModalFormEpisodio
          titulo="Nueva molestia"
          clienteId={clienteId}
          onGuardar={cargar}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.tipo === 'resolver' && (
        <ModalResolver
          episodio={modal.data.ep}
          onGuardar={(fecha, nota) => resolverEpisodio(modal.data.ep, fecha, nota)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.tipo === 'vincular' && (
        <ModalVincular
          reporte={modal.data.rep}
          episodios={episodios}
          onVincular={(ep) => vincularReporte(modal.data.rep.id, ep)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.tipo === 'crearDesde' && (
        <ModalFormEpisodio
          titulo="Crear episodio"
          clienteId={clienteId}
          reporteVinculado={modal.data.rep}
          inicial={{ detalle: modal.data.rep.detalle, fecha_inicio: modal.data.rep.fecha }}
          onGuardar={cargar}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.tipo === 'editar' && (
        <ModalEditarEpisodio
          episodio={modal.data.ep}
          onGuardar={ep => {
            setEpisodios(prev => prev.map(e => e.id === ep.id ? ep : e))
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.tipo === 'cuestionario' && (
        <ModalFormEpisodio
          titulo="Crear episodio desde cuestionario"
          clienteId={clienteId}
          cuestionarioRef={{ id: cuestionario?.id, idx: modal.data.lesion.idx }}
          inicial={{
            zona:         modal.data.lesion.zona || '',
            diagnostico:  modal.data.lesion.diagnostico || '',
            limitaciones: modal.data.lesion.limitaciones || '',
            intensidad:   modal.data.lesion.intensidad ?? '',
            detalle:      modal.data.lesion.antiguedad ? `Antigüedad: ${modal.data.lesion.antiguedad}` : '',
          }}
          origenOverride="cuestionario_inicial"
          onGuardar={cargar}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ══════════════════════════════════════════════════════════════════════════════

function SaludHeader({ onNueva }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 14 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>5. Salud y molestias</span>
      <button className="btn btn-ghost btn-sm" onClick={onNueva} style={{ fontSize: 12 }}>+ Añadir molestia</button>
    </div>
  )
}

function CardPendiente({ rep, sesionInfo, onVincular, onCrearEpisodio, onDescartar }) {
  const fechaLabel = rep.fecha ? format(parseISO(rep.fecha), 'd MMM yyyy', { locale: es }) : '—'
  const sesionFecha = sesionInfo?.sesion_fecha ? format(parseISO(sesionInfo.sesion_fecha), 'd MMM yyyy', { locale: es }) : fechaLabel
  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: '3px solid #f59e0b', borderRadius: 8, padding: '12px 14px', background: 'var(--surface)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        Molestia sin gestionar
      </div>

      {/* Sesión de origen */}
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: rep.detalle ? 8 : 4 }}>
        {sesionInfo ? (
          <><strong>{sesionInfo.sesion_titulo || 'Sesión'}</strong> · {sesionFecha}</>
        ) : (
          fechaLabel
        )}
        {rep.intensidad != null && (
          <span style={{ marginLeft: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
            background: rep.intensidad >= 7 ? '#fee2e2' : rep.intensidad >= 4 ? '#fff3cd' : '#dcfce7',
            color: rep.intensidad >= 7 ? '#b91c1c' : rep.intensidad >= 4 ? '#92400e' : '#166534' }}>
            {rep.intensidad}/10
          </span>
        )}
      </div>

      {/* Lo que escribió la clienta */}
      {rep.detalle && (
        <div style={{ fontSize: 13, color: 'var(--text1)', fontStyle: 'italic', background: 'var(--bg)', borderRadius: 7, padding: '8px 10px', marginBottom: 10, borderLeft: '2px solid var(--border)' }}>
          "{rep.detalle}"
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={onCrearEpisodio}>+ Abrir como episodio</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onVincular}>Vincular a episodio existente</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--text3)' }} onClick={onDescartar}>Descartar</button>
      </div>
    </div>
  )
}

function CardEpisodio({ ep, reps, expandido, onToggle, onResolver, onEditar, sesionMap }) {
  const ultimoRep = reps.length ? reps[reps.length - 1] : null
  const fechaInicio = ep.fecha_inicio ? format(parseISO(ep.fecha_inicio), 'd MMM yyyy', { locale: es }) : '—'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: 'var(--surface)' }}>
      {/* Cabecera */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text1)' }}>
                {ep.zona}{ep.lateralidad && ep.lateralidad !== 'no especificada' ? ` · ${ep.lateralidad}` : ''}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>
                Activa
              </span>
              {ultimoRep?.intensidad != null && (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: ultimoRep.intensidad >= 7 ? '#fee2e2' : ultimoRep.intensidad >= 4 ? '#fff3cd' : '#dcfce7', color: ultimoRep.intensidad >= 7 ? '#b91c1c' : ultimoRep.intensidad >= 4 ? '#92400e' : '#166534' }}>
                  {ultimoRep.intensidad}/10
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              Desde {fechaInicio}
              {ultimoRep && (
                <span> · Último reporte: {format(parseISO(ultimoRep.fecha), 'd MMM', { locale: es })}</span>
              )}
              {reps.length > 0 && <span> · {reps.length} {reps.length === 1 ? 'reporte' : 'reportes'}</span>}
            </div>
            {ep.diagnostico && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{ep.diagnostico}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onToggle}>
            {expandido ? 'Ocultar evolución ↑' : 'Ver evolución ↓'}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onEditar}>Editar</button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onResolver}>Resolver</button>
        </div>
      </div>

      {/* Evolución */}
      {expandido && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg)' }}>
          {reps.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Sin reportes de evolución.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reps.map(r => (
                  <FilaEvolucion key={r.id} rep={r} sesionInfo={sesionMap[r.sesion_feedback_id]} />
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

function CardEpisodioResuelto({ ep, reps, expandido, onToggle, onReabrir, onEditar }) {
  const fechaRes = ep.fecha_resolucion ? format(parseISO(ep.fecha_resolucion), 'd MMM yyyy', { locale: es }) : null
  const ultimoRep = reps.length ? reps[reps.length - 1] : null
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', opacity: 0.8 }}>
      <div style={{ padding: '9px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>
              {ep.zona}{ep.lateralidad && ep.lateralidad !== 'no especificada' ? ` · ${ep.lateralidad}` : ''}
            </span>
            {ultimoRep?.intensidad != null && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                {ultimoRep.intensidad}/10
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Resuelta{fechaRes ? ` · ${fechaRes}` : ''}
              {reps.length > 0 && ` · ${reps.length} ${reps.length === 1 ? 'reporte' : 'reportes'}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {reps.length > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onToggle}>
                {expandido ? '↑' : 'Historial'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onEditar}>Editar</button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onReabrir}>Reabrir</button>
          </div>
        </div>
      </div>
      {expandido && reps.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reps.map(r => <FilaEvolucion key={r.id} rep={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function FilaEvolucion({ rep, sesionInfo }) {
  const fecha = rep.fecha ? format(parseISO(rep.fecha), 'd MMMM', { locale: es }) : '—'
  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500, color: 'var(--text1)' }}>{fecha}</span>
        {rep.intensidad != null && (
          <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{rep.intensidad}/10</span>
        )}
        <span style={{ color: 'var(--text3)', fontSize: 11 }}>
          {ORIGEN_LABEL[rep.origen] || rep.origen}
          {sesionInfo?.sesion_titulo ? ` · ${sesionInfo.sesion_titulo}` : ''}
        </span>
      </div>
      {rep.detalle && (
        <div style={{ color: 'var(--text2)', marginTop: 2, fontStyle: 'italic', paddingLeft: 4 }}>
          "{rep.detalle}"
        </div>
      )}
    </div>
  )
}

function CardLesionInicial({ lesion, onCrear }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>
          {lesion.zona || 'Zona no especificada'}
        </div>
        {lesion.diagnostico && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lesion.diagnostico}</div>}
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
          {[lesion.antiguedad && `Antigüedad: ${lesion.antiguedad}`, lesion.intensidad != null && `Intensidad: ${lesion.intensidad}/10`].filter(Boolean).join(' · ')}
        </div>
        {lesion.limitaciones && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Limitaciones: {lesion.limitaciones}</div>}
      </div>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, flexShrink: 0 }} onClick={onCrear}>Crear episodio</button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════════

// Modal genérico — crear/registrar episodio (nuevo, desde reporte, desde cuestionario)
function ModalFormEpisodio({ titulo, clienteId, inicial = {}, reporteVinculado, cuestionarioRef, origenOverride, onGuardar, onClose }) {
  const [form, setForm] = useState({
    zona:         inicial.zona         || '',
    lateralidad:  inicial.lateralidad  || '',
    fecha_inicio: inicial.fecha_inicio || HOY(),
    intensidad:   inicial.intensidad   ?? '',
    detalle:      inicial.detalle      || '',
    diagnostico:  inicial.diagnostico  || '',
    limitaciones: inicial.limitaciones || '',
    observaciones:'',
  })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.zona.trim()) return alert('La zona es obligatoria.')
    setSaving(true)
    const origen = origenOverride || (reporteVinculado ? reporteVinculado.origen : 'entrenadora')

    const episodioData = {
      cliente_id:   clienteId,
      zona:         form.zona.trim(),
      lateralidad:  form.lateralidad || null,
      fecha_inicio: form.fecha_inicio || HOY(),
      diagnostico:  form.diagnostico.trim() || null,
      limitaciones: form.limitaciones.trim() || null,
      observaciones:form.observaciones.trim() || null,
      origen,
      estado:       'activo',
      ...(cuestionarioRef ? {
        cuestionario_inicial_id: cuestionarioRef.id,
        cuestionario_lesion_idx: cuestionarioRef.idx,
      } : {}),
    }

    const { data: ep } = await supabase
      .from('molestia_episodios').insert(episodioData).select().single()

    if (ep) {
      const intensidad = form.intensidad !== '' ? parseInt(form.intensidad, 10) : null

      // Si viene de un reporte existente → vincular
      if (reporteVinculado) {
        await supabase.from('molestia_reportes').update({
          episodio_id: ep.id,
          estado: 'vinculado',
        }).eq('id', reporteVinculado.id)
      } else {
        // Crear primer reporte manual
        await supabase.from('molestia_reportes').insert({
          cliente_id:   clienteId,
          episodio_id:  ep.id,
          fecha:        form.fecha_inicio || HOY(),
          intensidad:   intensidad != null && !isNaN(intensidad) ? intensidad : null,
          detalle:      form.detalle.trim() || null,
          origen,
          estado:       'vinculado',
        })
      }

      // Si viene del cuestionario → crear reporte inicial también con datos
      if (cuestionarioRef && (form.detalle.trim() || form.intensidad !== '')) {
        const intVal = form.intensidad !== '' ? parseInt(form.intensidad, 10) : null
        await supabase.from('molestia_reportes').insert({
          cliente_id:   clienteId,
          episodio_id:  ep.id,
          fecha:        form.fecha_inicio || HOY(),
          intensidad:   intVal != null && !isNaN(intVal) ? intVal : null,
          detalle:      form.detalle.trim() || null,
          origen:       'cuestionario_inicial',
          estado:       'vinculado',
        })
      }
    }

    setSaving(false)
    onGuardar()
    onClose()
  }

  return (
    <ModalWrapper titulo={titulo} onClose={onClose}>

      {/* Contexto del feedback — solo cuando viene de un reporte de sesión */}
      {reporteVinculado?.detalle && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', marginBottom: 4 }}>Lo que escribió la clienta</div>
          <div style={{ fontSize: 13, color: 'var(--text1)', fontStyle: 'italic' }}>"{reporteVinculado.detalle}"</div>
          {reporteVinculado.intensidad != null && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Intensidad reportada: {reporteVinculado.intensidad}/10</div>
          )}
        </div>
      )}

      <Campo label="Zona *">
        <input className="input" value={form.zona} onChange={e => f('zona', e.target.value)} placeholder="p.ej. Aquiles, Rodilla, Isquio…" />
      </Campo>
      <Campo label="Lateralidad">
        <select className="input" value={form.lateralidad} onChange={e => f('lateralidad', e.target.value)}>
          <option value="">No especificada</option>
          {LATERALIDAD.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
        </select>
      </Campo>
      <Campo label="Fecha de inicio de la molestia">
        <input className="input" type="date" value={form.fecha_inicio} onChange={e => f('fecha_inicio', e.target.value)} />
      </Campo>
      <Campo label="Intensidad (0–10)">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
            const on = String(form.intensidad) === String(n)
            return (
              <button key={n} type="button" onClick={() => f('intensidad', on ? '' : n)}
                style={{ width: 34, height: 34, borderRadius: 7, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {n}
              </button>
            )
          })}
        </div>
      </Campo>
      <Campo label="Detalle / notas">
        <textarea className="input" rows={2} value={form.detalle} onChange={e => f('detalle', e.target.value)} placeholder="Descripción o notas adicionales…" style={{ resize: 'vertical' }} />
      </Campo>
      <Campo label="Diagnóstico (opcional)">
        <input className="input" value={form.diagnostico} onChange={e => f('diagnostico', e.target.value)} placeholder="p.ej. Tendinopatía, sobrecarga…" />
      </Campo>
      <Campo label="Limitaciones (opcional)">
        <textarea className="input" rows={2} value={form.limitaciones} onChange={e => f('limitaciones', e.target.value)} placeholder="Limitaciones funcionales…" style={{ resize: 'vertical' }} />
      </Campo>
      <Campo label="Observaciones (opcional)">
        <textarea className="input" rows={2} value={form.observaciones} onChange={e => f('observaciones', e.target.value)} style={{ resize: 'vertical' }} />
      </Campo>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </ModalWrapper>
  )
}

function ModalEditarEpisodio({ episodio, onGuardar, onClose }) {
  const ep = episodio
  const [primerReporteId, setPrimerReporteId] = useState(null)
  const [form, setForm] = useState({
    zona:          ep.zona          || '',
    lateralidad:   ep.lateralidad   || '',
    fecha_inicio:  ep.fecha_inicio  || HOY(),
    intensidad:    '',
    diagnostico:   ep.diagnostico   || '',
    limitaciones:  ep.limitaciones  || '',
    observaciones: ep.observaciones || '',
  })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Cargar intensidad del primer reporte del episodio
  useEffect(() => {
    supabase
      .from('molestia_reportes')
      .select('id, intensidad')
      .eq('episodio_id', ep.id)
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrimerReporteId(data.id)
          setForm(p => ({ ...p, intensidad: data.intensidad ?? '' }))
        }
      })
  }, [ep.id])

  async function guardar() {
    if (!form.zona.trim()) return alert('La zona es obligatoria.')
    setSaving(true)

    const { data, error } = await supabase
      .from('molestia_episodios')
      .update({
        zona:          form.zona.trim(),
        lateralidad:   form.lateralidad || null,
        fecha_inicio:  form.fecha_inicio,
        diagnostico:   form.diagnostico.trim() || null,
        limitaciones:  form.limitaciones.trim() || null,
        observaciones: form.observaciones.trim() || null,
      })
      .eq('id', ep.id)
      .select()
      .single()

    if (error) { setSaving(false); alert('Error al guardar: ' + error.message); return }

    // Actualizar intensidad en el primer reporte si existe
    if (primerReporteId) {
      const intensidad = form.intensidad !== '' ? parseInt(form.intensidad, 10) : null
      await supabase
        .from('molestia_reportes')
        .update({ intensidad: !isNaN(intensidad) ? intensidad : null })
        .eq('id', primerReporteId)
    }

    setSaving(false)
    onGuardar(data)
  }

  return (
    <ModalWrapper titulo="Editar episodio" onClose={onClose}>
      <Campo label="Zona *">
        <input className="input" value={form.zona} onChange={e => f('zona', e.target.value)} placeholder="p.ej. Isquiotibiales izquierdo…" />
      </Campo>
      <Campo label="Lateralidad">
        <select className="input" value={form.lateralidad} onChange={e => f('lateralidad', e.target.value)}>
          <option value="">No especificada</option>
          {LATERALIDAD.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
        </select>
      </Campo>
      <Campo label="Fecha de inicio">
        <input className="input" type="date" value={form.fecha_inicio} onChange={e => f('fecha_inicio', e.target.value)} />
      </Campo>
      <Campo label="Intensidad actual (0–10)">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
            const on = String(form.intensidad) === String(n)
            return (
              <button key={n} type="button"
                onClick={() => f('intensidad', on ? '' : n)}
                style={{ width: 34, height: 34, borderRadius: 7, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {n}
              </button>
            )
          })}
        </div>
        {form.intensidad === '' && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Sin seleccionar — se dejará vacío</div>}
      </Campo>
      <Campo label="Diagnóstico">
        <input className="input" value={form.diagnostico} onChange={e => f('diagnostico', e.target.value)} placeholder="Dejar vacío para quitar el diagnóstico" />
      </Campo>
      <Campo label="Limitaciones">
        <textarea className="input" rows={2} value={form.limitaciones} onChange={e => f('limitaciones', e.target.value)} style={{ resize: 'vertical' }} placeholder="Limitaciones funcionales…" />
      </Campo>
      <Campo label="Observaciones">
        <textarea className="input" rows={2} value={form.observaciones} onChange={e => f('observaciones', e.target.value)} style={{ resize: 'vertical' }} />
      </Campo>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </ModalWrapper>
  )
}

function ModalResolver({ episodio, onGuardar, onClose }) {
  const [fecha, setFecha] = useState(HOY())
  const [nota, setNota]   = useState('')
  return (
    <ModalWrapper titulo="Resolver molestia" onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        {episodio.zona}{episodio.lateralidad && episodio.lateralidad !== 'no especificada' ? ` · ${episodio.lateralidad}` : ''}
      </p>
      <Campo label="Fecha de resolución">
        <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </Campo>
      <Campo label="Nota opcional">
        <textarea className="input" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Cómo se resolvió, observaciones…" style={{ resize: 'vertical' }} />
      </Campo>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={() => onGuardar(fecha, nota)}>Resolver</button>
      </div>
    </ModalWrapper>
  )
}

function ModalVincular({ reporte, episodios, onVincular, onClose }) {
  const [seleccionado, setSeleccionado] = useState(null)
  const activos   = episodios.filter(e => e.estado === 'activo')
  const resueltos = episodios.filter(e => e.estado === 'resuelto')

  return (
    <ModalWrapper titulo="Vincular a episodio" onClose={onClose}>
      {episodios.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>No hay episodios para vincular. Crea uno nuevo desde el reporte.</p>
      ) : (
        <>
          {activos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 6 }}>Activos</div>
              {activos.map(ep => (
                <label key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', cursor: 'pointer', borderRadius: 6 }}>
                  <input type="radio" name="ep" value={ep.id} checked={seleccionado?.id === ep.id} onChange={() => setSeleccionado(ep)} />
                  <span style={{ fontSize: 13 }}>{ep.zona}{ep.lateralidad && ep.lateralidad !== 'no especificada' ? ` · ${ep.lateralidad}` : ''}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>desde {format(parseISO(ep.fecha_inicio), 'd MMM', { locale: es })}</span>
                </label>
              ))}
            </div>
          )}
          {resueltos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 6 }}>Anteriores — se reabrirán</div>
              {resueltos.map(ep => (
                <label key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', cursor: 'pointer', borderRadius: 6 }}>
                  <input type="radio" name="ep" value={ep.id} checked={seleccionado?.id === ep.id} onChange={() => setSeleccionado(ep)} />
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{ep.zona}{ep.lateralidad && ep.lateralidad !== 'no especificada' ? ` · ${ep.lateralidad}` : ''}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Reabrir</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={() => seleccionado && onVincular(seleccionado)} disabled={!seleccionado}>Vincular</button>
      </div>
    </ModalWrapper>
  )
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function ModalWrapper({ titulo, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: '22px 24px',
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{titulo}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

