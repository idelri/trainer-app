import { useState } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_CONFIG = {
  mostrar_semana: true,
  mostrar_calendario: true,
  mostrar_plan: true,
}

function normalizar(config) {
  return {
    mostrar_semana:    config?.mostrar_semana    ?? true,
    mostrar_calendario: config?.mostrar_calendario ?? true,
    mostrar_plan:      config?.mostrar_plan       ?? true,
  }
}

export default function PortalClienteModal({ cliente, abierto, onCerrar, onGuardado }) {
  const [config, setConfig] = useState(() => normalizar(cliente?.portal_config))
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  if (!abierto || !cliente) return null

  const url = `${window.location.origin}/cliente/${cliente.token_cliente}`
  const activos = Object.values(config).filter(Boolean).length
  const sinCambios =
    config.mostrar_semana    === normalizar(cliente.portal_config).mostrar_semana &&
    config.mostrar_calendario === normalizar(cliente.portal_config).mostrar_calendario &&
    config.mostrar_plan      === normalizar(cliente.portal_config).mostrar_plan

  function toggle(key) {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
    setMensaje('')
  }

  async function guardar() {
    if (activos === 0) {
      setMensaje('Debe haber al menos un apartado visible.')
      return false
    }
    setGuardando(true)
    const { error } = await supabase.from('clientes').update({ portal_config: config }).eq('id', cliente.id)
    setGuardando(false)
    if (error) {
      setMensaje('Error al guardar. Inténtalo de nuevo.')
      return false
    }
    if (onGuardado) onGuardado(config)
    return true
  }

  function copiarEnlace() {
    navigator.clipboard.writeText(url).catch(() => {})
    setMensaje('Enlace copiado.')
  }

  async function handleGuardar() {
    const ok = await guardar()
    if (ok) setMensaje('Configuración guardada.')
  }

  async function handleGuardarYCopiar() {
    const ok = await guardar()
    if (ok) {
      navigator.clipboard.writeText(url).catch(() => {})
      setMensaje('Guardado. Enlace copiado.')
      setTimeout(() => onCerrar(), 1200)
    }
  }

  const opciones = [
    { key: 'mostrar_semana',     label: 'Esta semana' },
    { key: 'mostrar_calendario', label: 'Calendario' },
    { key: 'mostrar_plan',       label: 'Mi plan' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Configurar portal</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 20px' }}>{cliente.nombre}</p>

        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', margin: '0 0 10px' }}>Contenido visible</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {opciones.map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={config[key]} onChange={() => toggle(key)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>

        {activos === 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 12 }}>
            Debe haber al menos un apartado visible.
          </p>
        )}

        {mensaje && (
          <p style={{ fontSize: 12.5, color: mensaje.startsWith('Error') ? 'var(--danger)' : 'var(--accent)', marginBottom: 12 }}>
            {mensaje}
          </p>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 6, padding: '7px 10px', marginBottom: 20, wordBreak: 'break-all' }}>
          {url}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-ghost btn-sm" onClick={copiarEnlace}>🔗 Copiar enlace</button>
          <button className="btn btn-secondary btn-sm" onClick={handleGuardar}
            disabled={guardando || activos === 0}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleGuardarYCopiar}
            disabled={guardando || activos === 0}>
            {guardando ? 'Guardando...' : 'Guardar y copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}
