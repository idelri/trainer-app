import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [vistaRecuperar, setVistaRecuperar] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loadingRecuperar, setLoadingRecuperar] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setLoadingRecuperar(true)
    await supabase.auth.resetPasswordForEmail(emailRecuperar, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    })
    setEnviado(true)
    setLoadingRecuperar(false)
  }

  const wrapperStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', padding: 20,
  }
  const innerStyle = { width: '100%', maxWidth: 360 }
  const headerStyle = { marginBottom: 32, textAlign: 'center' }

  if (vistaRecuperar) {
    return (
      <div style={wrapperStyle}>
        <div style={innerStyle}>
          <div style={headerStyle}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🏋️</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px' }}>IdelRi App</h1>
            <p style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 4 }}>Recuperar contraseña</p>
          </div>
          <div className="card">
            {enviado ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
                  ✅ Revisa tu correo. Si el email está registrado, recibirás un enlace para restablecer la contraseña.
                </p>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
                  onClick={() => { setVistaRecuperar(false); setEnviado(false); setEmailRecuperar('') }}>
                  ← Volver al login
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecuperar}>
                <div className="form-group">
                  <label className="form-label">Tu email</label>
                  <input className="form-input" type="email" value={emailRecuperar}
                    onChange={e => setEmailRecuperar(e.target.value)}
                    autoComplete="email" autoFocus required />
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={loadingRecuperar}
                  style={{ justifyContent: 'center', marginTop: 4 }}>
                  {loadingRecuperar ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm w-full"
                  style={{ justifyContent: 'center', marginTop: 10, color: 'var(--text3)' }}
                  onClick={() => setVistaRecuperar(false)}>
                  ← Volver al login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapperStyle}>
      <div style={innerStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🏋️</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px' }}>IdelRi App</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 4 }}>Planificación, seguimiento y gestión del entrenamiento</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary w-full" type="submit" disabled={loading}
              style={{ justifyContent: 'center', marginTop: 4 }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" onClick={() => setVistaRecuperar(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
              ¿Has olvidado tu contraseña?
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
