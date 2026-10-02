/**
 * ModalComentarioEntrenadora — modal para escribir/editar el comentario
 * de la entrenadora sobre una sesión. Reutilizable desde cualquier vista.
 *
 * Props:
 *   sesionId       uuid
 *   sesionTitulo   string
 *   clienteEmail   string | null
 *   inicial        string | null  — comentario existente
 *   onGuardado     () => void
 *   onClose        () => void
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModalComentarioEntrenadora({
  sesionId,
  sesionTitulo,
  clienteEmail,
  inicial,
  onGuardado,
  onClose,
}) {
  const [texto, setTexto] = useState(inicial || '')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!texto.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('sesiones')
      .update({
        comentario_entrenadora: texto.trim(),
        comentario_entrenadora_at: new Date().toISOString(),
        comentario_visto_at: null, // resetear visto al editar
      })
      .eq('id', sesionId)

    if (error) {
      console.error('[ModalComentarioEntrenadora] error:', error)
      alert('Error al guardar el comentario.')
      setSaving(false)
      return
    }

    // Enviar email si el cliente tiene email
    if (clienteEmail) {
      try {
        await supabase.functions.invoke('enviar-comentario-sesion', {
          body: { sesionId, sesionTitulo, comentario: texto.trim(), clienteEmail },
        })
      } catch (e) {
        console.warn('[ModalComentarioEntrenadora] email no enviado:', e)
        // No bloqueamos si el email falla
      }
    }

    setSaving(false)
    onGuardado()
    onClose()
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar el comentario?')) return
    setSaving(true)
    await supabase
      .from('sesiones')
      .update({ comentario_entrenadora: null, comentario_entrenadora_at: null, comentario_visto_at: null })
      .eq('id', sesionId)
    setSaving(false)
    onGuardado()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '22px 24px', width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Comentario de la entrenadora</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text3)' }}>
          {sesionTitulo}
          {clienteEmail
            ? ' · Se enviará un email al cliente al guardar'
            : ' · Este cliente no tiene email — no se enviará notificación'}
        </p>

        <textarea
          className="input"
          rows={5}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe tu comentario sobre esta sesión…"
          style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
          autoFocus
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <div>
            {inicial && (
              <button className="btn btn-ghost btn-sm" onClick={eliminar} disabled={saving} style={{ color: '#ef4444' }}>
                Eliminar
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving || !texto.trim()}>
              {saving ? 'Guardando…' : clienteEmail ? 'Guardar y enviar' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
