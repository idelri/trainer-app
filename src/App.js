import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { exportarTodo } from './lib/export'
import { useGenerarPagosMensuales } from './hooks/useGenerarPagosMensuales'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Pagos from './pages/Pagos'
import Planificacion from './pages/Planificacion'
import Sesiones from './pages/Sesiones'
import PlanPublica from './pages/PlanPublica'
import SesionPublica from './pages/SesionPublica'
import CheckinSemanal from './pages/CheckinSemanal'
import Login from './pages/Login'
import VistaSemanalCliente from './pages/VistaSemanalCliente'
import PackPublico from './pages/PackPublico'
import './index.css'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'clientes',  label: 'Clientes',  icon: UsersIcon },
  { id: 'pagos',     label: 'Pagos',     icon: EuroIcon },
  { id: 'planificacion', label: 'Plan.', icon: CalendarIcon },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [clientePlanificacion, setClientePlanificacion] = useState(null)
  const [sesionesContext, setSesionesContext] = useState({ clienteId: null, sesionId: null })
  const [authLoading, setAuthLoading] = useState(true)
  const [publicToken, setPublicToken] = useState(null)
  const [publicSesionToken, setPublicSesionToken] = useState(null)
  const [publicCheckinToken, setPublicCheckinToken] = useState(null)
  const [publicSemanaToken, setPublicSemanaToken] = useState(null)
  const [publicPackToken, setPublicPackToken] = useState(null)
  useEffect(() => {
    // Detectar si es una URL pública /plan/TOKEN o /sesion/TOKEN
    const path = window.location.pathname
    const matchPlan = path.match(/^\/plan\/([a-f0-9]+)$/)
    if (matchPlan) {
      setPublicToken(matchPlan[1])
      setAuthLoading(false)
      return
    }
   const matchSesion = path.match(/^\/sesion\/([a-f0-9-]+)$/)
    if (matchSesion) {
      setPublicSesionToken(matchSesion[1])
      setAuthLoading(false)
      return
    }
    const matchCheckin = path.match(/^\/checkin\/([a-f0-9-]+)$/)
    if (matchCheckin) {
      setPublicCheckinToken(matchCheckin[1])
      setAuthLoading(false)
      return
    }
    const matchSemana = path.match(/^\/semana\/([a-f0-9-]+)$/)
    if (matchSemana) {
      setPublicSemanaToken(matchSemana[1])
      setAuthLoading(false)
      return
    }
    const matchPack = path.match(/^\/pack\/([a-f0-9-]+)$/)
    if (matchPack) {
      setPublicPackToken(matchPack[1])
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useGenerarPagosMensuales()

  if (authLoading) return null

 // Vista pública
  if (publicToken) return <PlanPublica token={publicToken} />
 if (publicSesionToken) return <SesionPublica token={publicSesionToken} />
  if (publicCheckinToken) return <CheckinSemanal token={publicCheckinToken} />
  if (publicSemanaToken) return <VistaSemanalCliente />
  if (publicPackToken) return <PackPublico token={publicPackToken} />
  if (!session) return <Login />

 return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Trainer App</h1>
          <p>gestión personal</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center', marginBottom: 8 }} onClick={exportarTodo}>
            ↓ Exportar CSV
          </button>
          <button className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}
            onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">
        {page === 'dashboard'      && <Dashboard setPage={setPage} setClientePlanificacion={setClientePlanificacion} clientePlanificacion={clientePlanificacion} />}
        {page === 'clientes'       && <Clientes setPage={setPage} setClientePlanificacion={setClientePlanificacion} clientePlanificacion={clientePlanificacion} />}
        {page === 'pagos'          && <Pagos setPage={setPage} setClientePlanificacion={setClientePlanificacion} clientePlanificacion={clientePlanificacion} />}
        {page === 'planificacion'  && <Planificacion setPage={setPage} setClientePlanificacion={setClientePlanificacion} clientePlanificacion={clientePlanificacion} setSesionesContext={setSesionesContext} />}
        {page === 'sesiones'       && <Sesiones clienteInicial={sesionesContext.clienteId} sesionInicialId={sesionesContext.sesionId} setPage={setPage} />}
      </main>
    </div>
  )
}

function HomeIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function UsersIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function EuroIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M14.5 8.5a4 4 0 100 7"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="15" x2="13" y2="15"/></svg>
}
function CheckIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
}
function CalendarIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
