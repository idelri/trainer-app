/**
 * TabSeguimientoCliente.jsx — Pestaña Seguimiento de ClienteFicha (Fase 5)
 *
 * Auto-carga sus datos vía seguimientoService.
 * Usa el motor central (seguimientoMotor) para calcular items normalizados.
 * Marcar revisado persiste en feedback_alertas_revisadas (BD), no localStorage.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { calcularSeguimiento, CAT, CAT_LABEL } from '../lib/seguimientoMotor'
import { cargarSeguimientoCliente, marcarRevisado, crearNota, SEMANAS_DISPLAY } from '../lib/seguimientoService'
import { supabase } from '../lib/supabase'
import { ModalFormEpisodio, ModalVincular } from './ModalMolestia'

const HOY = () => new Date().toISOString().slice(0, 10)

const FILTROS_PRINCIPALES = [
  { id: 'todos',     label: 'Todos' },
  { id: CAT.MOLESTIA,  label: 'Molestias' },
  { id: CAT.TECNICA,   label: 'Técnica' },
  { id: CAT.RPE,       label: 'RPE' },
  { id: CAT.COMENTARIO,label: 'Comentarios' },
]
const FILTROS_EXTRA = [
  CAT.RECUPERACION, CAT.CUMPLIMIENTO, CAT.SUENO, CAT.DURACION, CAT.MATERIAL, CAT.COMPRENSION, 'notas',
]
const EXTRA_LABEL = { ...CAT_LABEL, notas: 'Notas' }

const MOLESTIA_ESTADO_LABEL = { pendiente: 'Pendiente en Salud', vinculado: 'Vinculada a episodio', descartado: 'Descartada en Salud' }
const STATUS_BADGE = {
  completed: { txt: '✓ Completada', bg: '#dcfce7', color: '#15803d' },
  partial:   { txt: '~ Parcial',    bg: '#fef9c3', color: '#713f12' },
  missed:    { txt: '✗ No realizada', bg: '#fee2e2', color: '#991b1b' },
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

// ── Chips de filtro reutilizables ─────────────────────────────────────────────
// FILTROS_EXTRA_PEND: sin 'notas' (las notas no generan pendientes)
const FILTROS_EXTRA_PEND = [
  CAT.RECUPERACION, CAT.CUMPLIMIENTO, CAT.SUENO, CAT.DURACION, CAT.MATERIAL, CAT.COMPRENSION,
]

function FiltroChips({ filtro, setFiltro, filtroExtra, setFiltroExtra, extrasDisp = FILTROS_EXTRA }) {
  const [mostrarExtra, setMostrarExtra] = useState(false)
  const filtroActivo = filtroExtra || (filtro !== 'todos' ? filtro : null)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {FILTROS_PRINCIPALES.map(f => (
        <button key={f.id} onClick={() => { setFiltro(f.id); setFiltroExtra(null) }}
          className={`btn btn-sm ${(f.id === 'todos' ? !filtroActivo : filtroActivo === f.id) ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12 }}>
          {f.label}
        </button>
      ))}
      <div style={{ position: 'relative' }}>
        <button className={`btn btn-sm ${filtroExtra && extrasDisp.includes(filtroExtra) ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12 }}
          onClick={() => setMostrarExtra(v => !v)}>
          + Filtros {filtroExtra && extrasDisp.includes(filtroExtra) ? `· ${EXTRA_LABEL[filtroExtra]}` : ''}
        </button>
        {mostrarExtra && (
          <>
            <div onClick={() => setMostrarExtra(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, minWidth: 160, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              {extrasDisp.map(cat => (
                <button key={cat} onClick={() => { setFiltroExtra(filtroExtra === cat ? null : cat); setFiltro('todos'); setMostrarExtra(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12.5, background: filtroExtra === cat ? 'var(--accent-light)' : 'none', color: filtroExtra === cat ? 'var(--accent-text)' : 'var(--text2)', border: 'none', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {EXTRA_LABEL[cat]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TabSeguimientoCliente({ clienteId, onNavSalud }) {
  const [datos,   setDatos]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(null)

  // Filtros de Pendientes (independientes de Historial)
  const [filtroPend,      setFiltroPend]      = useState('todos')
  const [filtroPendExtra, setFiltroPendExtra] = useState(null)
  // Filtros de Historial
  const [filtroHist,      setFiltroHist]      = useState('todos')
  const [filtroHistExtra, setFiltroHistExtra] = useState(null)

  const [expandidos, setExpandidos] = useState(new Set())
  const [modalNota,  setModalNota]  = useState(false)

  // Estado para modales de acción de molestia desde Seguimiento
  // modalMolestia: null | { tipo: 'abrir'|'vincular', reporte: {...} }
  const [modalMolestia,  setModalMolestia]  = useState(null)
  const [episodiosCache, setEpisodiosCache] = useState([])

  const cargar = useCallback(async () => {
    setLoading(true)
    const resultado = await cargarSeguimientoCliente(clienteId)
    setDatos(resultado)
    setLoading(false)
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])

  // Motor: todos los items
  const items = useMemo(() => {
    if (!datos) return []
    return calcularSeguimiento({
      feedbacks:    datos.feedbacks,
      sesiones:     datos.sesiones,
      revisadas:    datos.revisadas,
      molestiaReps: datos.molestiaReps,
    })
  }, [datos])

  const pendientes = useMemo(() => items.filter(i => i.isPendiente), [items])
  // Historial = TODOS los items (pendientes + revisados + sin aspectos)
  const todosItems = items

  // Filtro activo de pendientes
  const filtroPendActivo = filtroPendExtra || (filtroPend !== 'todos' ? filtroPend : null)
  const pendientesFiltrados = filtroPendActivo
    ? pendientes.filter(i => i.aspectos.some(a => a.categoria === filtroPendActivo))
    : pendientes

  // Filtro activo de historial
  const filtroHistActivo = filtroHistExtra || (filtroHist !== 'todos' ? filtroHist : null)

  // Notas como cronología
  const notasComoCronologia = useMemo(() => (datos?.notas || []).map(n => ({
    id: `nota_${n.id}`, tipo: 'nota',
    fecha: n.fecha, texto: n.texto, categoria: n.categoria,
  })), [datos?.notas])

  // Timeline del historial (TODOS los items del motor + notas manuales)
  const timeline = useMemo(() => {
    const incluirNotas = !filtroHistActivo || filtroHistActivo === 'notas'
    const sesItems = filtroHistActivo === 'notas'
      ? []
      : filtroHistActivo
        ? todosItems.filter(i => i.aspectos.some(a => a.categoria === filtroHistActivo))
        : todosItems
    const notaItems = incluirNotas ? notasComoCronologia : []
    const todo = [...sesItems, ...notaItems]
    todo.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    return todo
  }, [todosItems, notasComoCronologia, filtroHistActivo])

  // Resumen 7 días
  const hace7dias = format(addDays(new Date(), -7), 'yyyy-MM-dd')
  const nSesiones = items.filter(i => i.tipo === 'sesion' && i.fecha >= hace7dias).length
  const rpeVals   = (datos?.feedbacks || []).filter(fb => {
    const ses = datos?.sesiones?.find(s => s.id === fb.sesion_id)
    return ses?.fecha >= hace7dias && fb.data?.rpe?.value != null
  }).map(fb => fb.data.rpe.value)
  const rpeMedio  = rpeVals.length ? (rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1) : null

  async function handleRevisar(item) {
    if (!item.categoriasPendientes.length) return
    setSaving(item.id)
    await marcarRevisado(clienteId, item.sesionFeedbackId, item.categoriasPendientes)
    await cargar()
    setSaving(null)
  }

  async function handleAccionMolestia(sesionFeedbackId, accion, aspecto) {
    if (accion === 'descartado') {
      // Actualiza el reporte directamente y refresca
      if (aspecto?.molestiaReporteId) {
        await supabase
          .from('molestia_reportes')
          .update({ estado: 'descartado' })
          .eq('id', aspecto.molestiaReporteId)
      } else {
        await supabase
          .from('molestia_reportes')
          .update({ estado: 'descartado' })
          .eq('sesion_feedback_id', sesionFeedbackId)
          .eq('estado', 'pendiente')
      }
      await cargar()
    } else if (accion === 'abrir' || accion === 'vincular') {
      // Cargar episodios del cliente si no los tenemos
      const { data: eps } = await supabase
        .from('molestia_episodios')
        .select('id, zona, lateralidad, fecha_inicio, diagnostico, estado')
        .eq('cliente_id', clienteId)
        .order('fecha_inicio', { ascending: false })
      setEpisodiosCache(eps || [])

      // Construir objeto reporte para pasar al modal
      const reporte = {
        id:         aspecto?.molestiaReporteId,
        detalle:    aspecto?.detalle || '',
        intensidad: aspecto?.intensity ?? null,
        origen:     'feedback_sesion',
        fecha:      null, // Se determinará por la fecha del episodio
      }

      setModalMolestia({ tipo: accion, reporte, sesionFeedbackId })
    }
  }

  async function handleVincularEpisodio(ep) {
    if (!modalMolestia?.reporte?.id) return
    // Solo se vincula a episodios activos (ModalVincular ya filtra resueltos)
    if (ep.estado !== 'activo') return
    await supabase.from('molestia_reportes').update({
      episodio_id: ep.id,
      estado:      'vinculado',
    }).eq('id', modalMolestia.reporte.id)
    setModalMolestia(null)
    await cargar()
  }

  function toggleExpand(id) {
    setExpandidos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  if (loading) return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Cargando seguimiento…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── RESUMEN — separación semántica 7 días vs pendientes ── */}
      {(nSesiones > 0 || pendientes.length > 0) && (
        <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
          {nSesiones > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Últimos 7 días
            </div>
          )}
          {nSesiones > 0 && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, marginBottom: pendientes.length > 0 ? 10 : 0 }}>
              <span><strong style={{ color: 'var(--text)' }}>{nSesiones}</strong> <span style={{ color: 'var(--text2)' }}>{nSesiones === 1 ? 'sesión' : 'sesiones'}</span></span>
              {rpeMedio && <span><span style={{ color: 'var(--text2)' }}>RPE medio</span> <strong style={{ color: 'var(--text)' }}>{rpeMedio}</strong></span>}
            </div>
          )}
          {pendientes.length > 0 && (
            <div style={{ borderTop: nSesiones > 0 ? '1px solid var(--border)' : 'none', paddingTop: nSesiones > 0 ? 8 : 0, fontSize: 13.5, fontWeight: 600, color: '#b45309' }}>
              {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''} de revisión
            </div>
          )}
        </div>
      )}

      {/* ── PENDIENTES ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
          Pendientes de revisión{pendientes.length > 0 ? ` · ${pendientes.length}` : ''}
        </div>
        {pendientes.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <FiltroChips
              filtro={filtroPend} setFiltro={setFiltroPend}
              filtroExtra={filtroPendExtra} setFiltroExtra={setFiltroPendExtra}
              extrasDisp={FILTROS_EXTRA_PEND}
            />
          </div>
        )}
        {pendientesFiltrados.length === 0 && pendientes.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sin aspectos pendientes de revisión.</p>
        )}
        {pendientesFiltrados.length === 0 && pendientes.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sin pendientes en esta categoría.</p>
        )}
        {pendientesFiltrados.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendientesFiltrados.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                expandido={expandidos.has(item.id)}
                onToggle={() => toggleExpand(item.id)}
                onRevisar={() => handleRevisar(item)}
                saving={saving === item.id}
                onNavSalud={onNavSalud}
                onAccionMolestia={handleAccionMolestia}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── HISTORIAL ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>
            Historial de seguimiento
          </div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setModalNota(true)}>
            + Añadir nota
          </button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <FiltroChips
            filtro={filtroHist} setFiltro={setFiltroHist}
            filtroExtra={filtroHistExtra} setFiltroExtra={setFiltroHistExtra}
            extrasDisp={FILTROS_EXTRA}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {timeline.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sin registros en el historial.</p>
          )}
          {timeline.map(item => {
            if (item.tipo === 'nota') return <NotaLine key={item.id} nota={item} />
            return (
              <HistorialLine
                key={item.id}
                item={item}
                expandido={expandidos.has(item.id + '_h')}
                onToggle={() => toggleExpand(item.id + '_h')}
              />
            )
          })}
        </div>
      </div>

      {/* Modal nota */}
      {modalNota && (
        <ModalNota
          onGuardar={async (nota) => { await crearNota(clienteId, nota); await cargar(); setModalNota(false) }}
          onClose={() => setModalNota(false)}
        />
      )}

      {/* Modal: Abrir como episodio desde Seguimiento */}
      {modalMolestia?.tipo === 'abrir' && (
        <ModalFormEpisodio
          titulo="Abrir como episodio"
          clienteId={clienteId}
          reporteVinculado={modalMolestia.reporte}
          inicial={{
            detalle:    modalMolestia.reporte.detalle || '',
            intensidad: modalMolestia.reporte.intensidad ?? '',
          }}
          onGuardar={async () => {
            setModalMolestia(null)
            await cargar()
          }}
          onClose={() => setModalMolestia(null)}
        />
      )}

      {/* Modal: Vincular a episodio existente desde Seguimiento */}
      {modalMolestia?.tipo === 'vincular' && (
        <ModalVincular
          reporte={modalMolestia.reporte}
          episodios={episodiosCache}
          onVincular={handleVincularEpisodio}
          onClose={() => setModalMolestia(null)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ══════════════════════════════════════════════════════════════════════════════

function ItemCard({ item, expandido, onToggle, onRevisar, saving, onNavSalud, onAccionMolestia }) {
  const fechaLabel = item.fecha ? format(parseISO(item.fecha), 'd MMM', { locale: es }) : '—'
  const badge = item.status ? STATUS_BADGE[item.status] : null
  const nAspectos = item.aspectos.length

  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: '3px solid #f59e0b', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text1)' }}>{item.sesionTitulo}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fechaLabel}</span>
          {badge && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: badge.bg, color: badge.color }}>{badge.txt}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
          {nAspectos} {nAspectos === 1 ? 'aspecto' : 'aspectos'} a revisar · {item.categoriasPendientes.map(c => CAT_LABEL[c] || c).join(', ')}
        </div>

        {/* Aspectos (expandibles) */}
        {expandido && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            {item.aspectos.map((a, i) => (
              <AspectoLine key={i} aspecto={a} onNavSalud={onNavSalud} sesionFeedbackId={item.sesionFeedbackId} onAccionMolestia={onAccionMolestia} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onToggle}>
            {expandido ? 'Ocultar ↑' : 'Ver detalle ↓'}
          </button>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={onRevisar} disabled={saving}>
            {saving ? 'Revisando…' : 'Marcar revisado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Categorías que pueden tener nulo legítimo y necesitan fallback explícito
const CAT_DETALLE_REQUERIDO = new Set([CAT.TECNICA, CAT.COMPRENSION, CAT.MATERIAL])

function AspectoLine({ aspecto, onNavSalud, sesionFeedbackId, onAccionMolestia }) {
  const a = aspecto
  const mostrarSinDetalle = !a.detalle && CAT_DETALLE_REQUERIDO.has(a.categoria)
  const [descartando, setDescartando] = useState(false)
  const esMolestiaPendiente = a.categoria === CAT.MOLESTIA && a.molestiaEstado === 'pendiente'

  async function handleDescartar() {
    if (!onAccionMolestia) return
    setDescartando(true)
    await onAccionMolestia(sesionFeedbackId, 'descartado', a)
    setDescartando(false)
  }

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{a.label}</span>
        {a.categoria === CAT.MOLESTIA && a.molestiaEstado && a.molestiaEstado !== 'pendiente' && (
          <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 8, border: '1px solid var(--border)' }}>
            {MOLESTIA_ESTADO_LABEL[a.molestiaEstado] || a.molestiaEstado}
          </span>
        )}
        {a.categoria === CAT.MOLESTIA && onNavSalud && !esMolestiaPendiente && (
          <button onClick={onNavSalud} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            Ver en Salud →
          </button>
        )}
      </div>
      {a.detalle ? (
        <div style={{ color: 'var(--text2)', marginTop: 2, lineHeight: 1.4, fontStyle: a.categoria === CAT.COMENTARIO ? 'italic' : 'normal', paddingLeft: 4, borderLeft: a.categoria === CAT.COMENTARIO ? '2px solid var(--border)' : 'none' }}>
          {a.categoria === CAT.COMENTARIO ? `"${a.detalle}"` : a.detalle}
        </div>
      ) : mostrarSinDetalle ? (
        <div style={{ color: 'var(--text3)', marginTop: 2, fontSize: 12, fontStyle: 'italic', paddingLeft: 4 }}>
          Sin detalle añadido.
        </div>
      ) : null}

      {/* Botones de acción: solo para molestias pendientes */}
      {esMolestiaPendiente && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => onAccionMolestia && onAccionMolestia(sesionFeedbackId, 'abrir', a)}
            style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #15803d', background: '#dcfce7', color: '#15803d', cursor: 'pointer' }}>
            + Abrir como episodio
          </button>
          <button
            onClick={() => onAccionMolestia && onAccionMolestia(sesionFeedbackId, 'vincular', a)}
            style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer' }}>
            Vincular a episodio existente
          </button>
          <button
            onClick={handleDescartar}
            disabled={descartando}
            style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer', opacity: descartando ? 0.6 : 1 }}>
            {descartando ? 'Descartando…' : 'Descartar'}
          </button>
        </div>
      )}
    </div>
  )
}

function HistorialLine({ item, expandido, onToggle }) {
  const fechaLabel  = item.fecha ? format(parseISO(item.fecha), 'd MMM', { locale: es }) : '—'
  const badge       = item.status ? STATUS_BADGE[item.status] : null
  const hayAspectos = item.aspectos.length > 0
  const isPendiente = item.categoriasPendientes?.length > 0
  const isRevisado  = !isPendiente && item.categoriasRevisadas?.length > 0
  const sinAspectos = !hayAspectos

  return (
    <div style={{ padding: '7px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 44, flexShrink: 0 }}>{fechaLabel}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sesionTitulo}</span>
        {badge && item.status !== 'completed' && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.txt}</span>
        )}
        {hayAspectos && (
          <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} onClick={onToggle}>
            {item.aspectos.map(a => CAT_LABEL[a.categoria] || a.categoria).join(' · ')} {expandido ? '↑' : '↓'}
          </span>
        )}
        {/* Estado semántico correcto */}
        {sinAspectos  && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0 }}>Sin aspectos</span>}
        {isPendiente  && <span style={{ fontSize: 11, color: '#d97706',      marginLeft: 'auto', flexShrink: 0 }}>● Pendiente</span>}
        {isRevisado   && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0 }}>✓ Revisado</span>}
      </div>
      {expandido && hayAspectos && (
        <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {item.aspectos.map((a, i) => <AspectoLine key={i} aspecto={a} />)}
        </div>
      )}
    </div>
  )
}

function NotaLine({ nota }) {
  const fechaLabel = nota.fecha ? format(parseISO(nota.fecha), 'd MMM', { locale: es }) : '—'
  return (
    <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', borderLeft: '3px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 48, flexShrink: 0, marginTop: 1 }}>{fechaLabel}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Nota · Irene{nota.categoria ? ` · ${nota.categoria}` : ''}</div>
          <div style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.4, fontStyle: 'italic' }}>"{nota.texto}"</div>
        </div>
      </div>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ModalNota({ onGuardar, onClose }) {
  const [fecha,   setFecha]   = useState(HOY())
  const [texto,   setTexto]   = useState('')
  const [cat,     setCat]     = useState('')
  const [saving,  setSaving]  = useState(false)

  async function guardar() {
    if (!texto.trim()) return
    setSaving(true)
    await onGuardar({ fecha, texto, categoria: cat || null })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '22px 24px', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Añadir nota</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' }}>×</button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Fecha</label>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Nota *</label>
          <textarea className="input" rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Observación, conversación, decisión…" style={{ resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Categoría (opcional)</label>
          <input className="input" value={cat} onChange={e => setCat(e.target.value)} placeholder="p.ej. volumen, motivación, viaje…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving || !texto.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function promedio(arr) {
  const vals = arr.filter(v => v != null && !isNaN(v))
  if (!vals.length) return null
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}
