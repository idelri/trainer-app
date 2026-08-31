/**
 * ModalMolestia.jsx — Componentes de modal compartidos para molestias
 *
 * Exporta:
 *   ModalWrapper       — contenedor genérico de modal
 *   Campo              — field con label
 *   ModalFormEpisodio  — crear episodio (desde cero, desde reporte, desde cuestionario)
 *   ModalVincular      — vincular reporte a episodio existente
 *
 * Usados por SaludMolestias.jsx y TabSeguimientoCliente.jsx.
 * Toda lógica de BD permanece aquí para no duplicarla.
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const HOY = () => new Date().toISOString().slice(0, 10)
const LATERALIDAD = ['derecha', 'izquierda', 'bilateral', 'no especificada']

// ─────────────────────────────────────────────────────────────
// ModalWrapper
// ─────────────────────────────────────────────────────────────
export function ModalWrapper({ titulo, onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
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

// ─────────────────────────────────────────────────────────────
// Campo
// ─────────────────────────────────────────────────────────────
export function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ModalFormEpisodio
//
// Props:
//   titulo          string
//   clienteId       uuid
//   inicial         object — valores pre-rellenados
//   reporteVinculado  object | null — { id, detalle, intensidad, origen, fecha }
//   cuestionarioRef   object | null — { id, idx }
//   origenOverride    string | null
//   onGuardar       () => void  — se llama al guardar (para refrescar el padre)
//   onClose         () => void
// ─────────────────────────────────────────────────────────────
export function ModalFormEpisodio({
  titulo,
  clienteId,
  inicial = {},
  reporteVinculado,
  cuestionarioRef,
  origenOverride,
  onGuardar,
  onClose,
}) {
  const [form, setForm] = useState({
    zona:          inicial.zona         || '',
    lateralidad:   inicial.lateralidad  || '',
    fecha_inicio:  inicial.fecha_inicio || HOY(),
    intensidad:    inicial.intensidad   ?? '',
    detalle:       inicial.detalle      || '',
    diagnostico:   inicial.diagnostico  || '',
    limitaciones:  inicial.limitaciones || '',
    observaciones: '',
  })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.zona.trim()) return alert('La zona es obligatoria.')
    setSaving(true)
    const origen = origenOverride || (reporteVinculado ? reporteVinculado.origen : 'entrenadora')

    const episodioData = {
      cliente_id:    clienteId,
      zona:          form.zona.trim(),
      lateralidad:   form.lateralidad || null,
      fecha_inicio:  form.fecha_inicio || HOY(),
      diagnostico:   form.diagnostico.trim()  || null,
      limitaciones:  form.limitaciones.trim() || null,
      observaciones: form.observaciones.trim() || null,
      origen,
      estado: 'activo',
      ...(cuestionarioRef ? {
        cuestionario_inicial_id: cuestionarioRef.id,
        cuestionario_lesion_idx: cuestionarioRef.idx,
      } : {}),
    }

    const { data: ep } = await supabase
      .from('molestia_episodios').insert(episodioData).select().single()

    if (ep) {
      const intensidad = form.intensidad !== '' ? parseInt(form.intensidad, 10) : null

      if (reporteVinculado) {
        // Vincular reporte existente al nuevo episodio
        await supabase.from('molestia_reportes').update({
          episodio_id: ep.id,
          estado:      'vinculado',
          // Actualizar intensidad/detalle si se ha editado en el modal
          intensidad:  intensidad != null && !isNaN(intensidad) ? intensidad : reporteVinculado.intensidad,
          detalle:     form.detalle.trim() || reporteVinculado.detalle || null,
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

      // Cuestionario → reporte adicional con datos del cuestionario
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
    onGuardar(ep)
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
                style={{
                  width: 34, height: 34, borderRadius: 7,
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-light)' : 'transparent',
                  color: on ? 'var(--accent-text)' : 'var(--text2)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                {n}
              </button>
            )
          })}
        </div>
      </Campo>
      <Campo label="Detalle / notas">
        <textarea className="input" rows={2} value={form.detalle}
          onChange={e => f('detalle', e.target.value)}
          placeholder="Descripción o notas adicionales…"
          style={{ resize: 'vertical' }} />
      </Campo>
      <Campo label="Diagnóstico (opcional)">
        <input className="input" value={form.diagnostico} onChange={e => f('diagnostico', e.target.value)} placeholder="p.ej. Tendinopatía, sobrecarga…" />
      </Campo>
      <Campo label="Limitaciones (opcional)">
        <textarea className="input" rows={2} value={form.limitaciones}
          onChange={e => f('limitaciones', e.target.value)}
          placeholder="Limitaciones funcionales…"
          style={{ resize: 'vertical' }} />
      </Campo>
      <Campo label="Observaciones (opcional)">
        <textarea className="input" rows={2} value={form.observaciones}
          onChange={e => f('observaciones', e.target.value)}
          style={{ resize: 'vertical' }} />
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

// ─────────────────────────────────────────────────────────────
// ModalVincular
//
// Props:
//   reporte     object — { id, ... }
//   episodios   array  — episodios del cliente (se filtra para mostrar solo activos)
//   onVincular  (episodio) => void
//   onClose     () => void
//
// Solo muestra episodios ACTIVOS. Los resueltos no aparecen y no se reabren.
// Si no hay activos, sugiere crear uno nuevo.
// ─────────────────────────────────────────────────────────────
export function ModalVincular({ reporte, episodios, onVincular, onClose }) {
  const [seleccionado, setSeleccionado] = useState(null)
  const activos = episodios.filter(e => e.estado === 'activo')

  return (
    <ModalWrapper titulo="Vincular a episodio activo" onClose={onClose}>
      {activos.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          No hay episodios activos. Para vincular este reporte, crea primero un episodio usando «Abrir como episodio».
        </p>
      ) : (
        <div>
          {activos.map(ep => (
            <label key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', cursor: 'pointer', borderRadius: 6 }}>
              <input type="radio" name="ep" value={ep.id} checked={seleccionado?.id === ep.id} onChange={() => setSeleccionado(ep)} />
              <span style={{ fontSize: 13 }}>
                {ep.zona}{ep.lateralidad && ep.lateralidad !== 'no especificada' ? ` · ${ep.lateralidad}` : ''}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                desde {format(parseISO(ep.fecha_inicio), 'd MMM', { locale: es })}
              </span>
            </label>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        {activos.length > 0 && (
          <button className="btn btn-primary btn-sm"
            onClick={() => seleccionado && onVincular(seleccionado)}
            disabled={!seleccionado}>
            Vincular
          </button>
        )}
      </div>
    </ModalWrapper>
  )
}
