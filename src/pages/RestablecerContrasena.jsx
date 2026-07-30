import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function RestablecerContrasena() {
  const [listo, setListo] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setListo(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber caducado.')
      return
    }

    setExito(true)
    await supabase.auth.signOut()
    setTimeout(() => { window.location.href = '/' }, 3000)
  }

  const wrapperStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', padding: 20,
  }

  if (exito) {
    return (
      <div style={wrapperStyle}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Contraseña actualizada</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13.5 }}>Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  if (!listo) {
    return (
      <div style={wrapperStyle}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <p style={{ color: 'var(--text2)', fontSize: 13.5 }}>Verificando enlace...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapperStyle}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🏋️</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px' }}>IdelRi App</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 4 }}>Nueva contraseña</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nueva contraseña</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password" autoFocus required />
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>Mínimo 12 caracteres</p>
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <input className="form-input" type="password" value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                autoComplete="new-password" required />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary w-full" type="submit" disabled={loading}
              style={{ justifyContent: 'center', marginTop: 4 }}>
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
