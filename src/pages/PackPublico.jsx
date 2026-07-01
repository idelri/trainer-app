import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const T = {
  bg: '#f8f7f4', card: '#ffffff', text: '#1a1a1a', text2: '#6b6b6b', text3: '#9b9b9b',
  border: '#e8e5e0', accent: '#0369a1', accentLight: '#f0f9ff', accentBorder: '#bae6fd',
}

const ICONO_ACTIVIDAD = {
  fuerza: '💪', correr: '🏃', caminar: '🚶', bicicleta: '🚴',
  nadar: '🏊', movilidad: '🤸', futbol: '⚽', padel: '🎾',
}
function iconoSesion(s) {
  const tipos = s?.tipos_actividad?.length > 0 ? s.tipos_actividad : (s?.tipo_actividad ? [s.tipo_actividad] : ['fuerza'])
  return tipos.map(t => ICONO_ACTIVIDAD[t] || '💪').join(' ')
}

export default function PackPublico({ token }) {
  const [pack, setPack] = useState(null)
  const [sesiones, setSesiones] = useState([])
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { cargar() }, [token])

  async function cargar() {
    const { data: p } = await supabase
      .from('packs_flexibles')
      .select('*')
      .eq('token_publico', token)
      .single()
    if (!p) { setError(true); setLoading(false); return }
    setPack(p)

    const { data: cli } = await supabase.from('clientes').select('nombre').eq('id', p.cliente_id).single()
    setCliente(cli)

    const { data: sess } = await supabase.from('sesiones').select('*').eq('pack_id', p.id).order('orden')
    setSesiones(sess || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: T.text3 }}>Cargando...</p>
    </div>
  )
  if (error || !pack) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#dc2626' }}>Enlace no válido o plan no encontrado.</p>
    </div>
  )

  const fechaInicio = format(new Date(pack.fecha_inicio + 'T12:00:00'), "d 'de' MMMM", { locale: es })
  const fechaFin = format(new Date(pack.fecha_fin + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 48px' }}>

        {/* Cabecera */}
        <div style={{ background: '#0c4a6e', padding: '24px 20px 28px', borderRadius: '0 0 20px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{cliente?.nombre}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>📦</span>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#fff', margin: 0 }}>{pack.nombre}</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 0', textTransform: 'capitalize' }}>
            {fechaInicio} – {fechaFin}
          </p>

          {pack.descripcion && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', marginTop: 16 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>{pack.descripcion}</p>
            </div>
          )}
        </div>

        {/* Sesiones */}
        <div style={{ padding: '0 12px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.text3, margin: '0 0 10px 4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sesiones disponibles · {sesiones.length}
          </p>
          {sesiones.map(s => (
            <div key={s.id} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                  {iconoSesion(s)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.titulo}</p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {s.duracion_min && <span style={{ fontSize: 11, color: T.text3 }}>{s.duracion_min} min</span>}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: T.accentLight, color: T.accent, fontWeight: 500 }}>Flexible</span>
                  </div>
                </div>
                {s.token_publico && (
                  <a href={`/sesion/${s.token_publico}`}
                    style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0, fontFamily: 'inherit' }}>
                    Ver
                  </a>
                )}
              </div>
              {s.objetivo && (
                <div style={{ padding: '0 14px 12px 68px' }}>
                  <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>{s.objetivo}</p>
                </div>
              )}
            </div>
          ))}
          {sesiones.length === 0 && (
            <p style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '20px 0' }}>No hay sesiones añadidas aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}
