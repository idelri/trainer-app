import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPOS_ACTIVIDAD = [
  { value: 'fuerza',     label: 'Fuerza',     icono: '💪' },
  { value: 'correr',     label: 'Correr',     icono: '🏃' },
  { value: 'caminar',    label: 'Caminar',    icono: '🚶' },
  { value: 'bicicleta',  label: 'Bicicleta',  icono: '🚴' },
  { value: 'nadar',      label: 'Nadar',      icono: '🏊' },
  { value: 'movilidad',  label: 'Movilidad',  icono: '🤸' },
  { value: 'futbol',     label: 'Fútbol',     icono: '⚽' },
  { value: 'padel',      label: 'Pádel',      icono: '🎾' },
]
const ICONO_ACTIVIDAD = Object.fromEntries(TIPOS_ACTIVIDAD.map(t => [t.value, t.icono]))
function iconoSesion(s) {
  if (s?.icono) return s.icono
  const tipos = s?.tipos_actividad?.length > 0 ? s.tipos_actividad : (s?.tipo_actividad ? [s.tipo_actividad] : ['fuerza'])
  return tipos.map(t => ICONO_ACTIVIDAD[t] || '💪').join(' ')
}

function DiaMenu({ fecha, onNuevaSesion, onNuevaCompeticion, onNuevaValoracion, onNuevaNota }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1, padding: '0 2px', borderRadius: 4 }}>+</button>
      {open && (
        <div style={{ position: 'absolute', top: 20, right: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 130, overflow: 'hidden' }}>
          <button onClick={() => { onNuevaSesion(fecha); setOpen(false) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            💪 Sesión
          </button>
          <button onClick={() => { onNuevaCompeticion(fecha); setOpen(false) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            🏆 Competición
          </button>
          <button onClick={() => { onNuevaValoracion(fecha); setOpen(false) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            🔬 Valoración / Control
          </button>
          <button onClick={() => { onNuevaNota(fecha); setOpen(false) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            📝 Nota
          </button>
        </div>
      )}
    </div>
  )
}

export default function CalendarioSesiones({
  sesiones, competiciones = [], controles = [], notas = [],
  bloquesPlan, subbloquesPlan, packs = [],
  onAbrirSesion, onNuevaSesion, onNuevaCompeticion, onNuevaValoracion, onNuevaNota,
  onEliminar, onMoverSesion,
  clipboard, onCopiar, onPegar, onPegarOtroCliente,
  clipboardSemana, onCopiarSemana, onPegarSemana, onPegarSemanaOtroCliente,
  arrastrando: arrastandoExterno, setArrastrando: setArrastrandoExterno,
}) {
  const [vista, setVista] = useState('mes')
  const [cursor, setCursor] = useState(new Date())
  const [arrastandoInterno, setArrastrandoInterno] = useState(null)
  const arrastrando = arrastandoExterno !== undefined ? arrastandoExterno : arrastandoInterno
  const setArrastrando = setArrastrandoExterno || setArrastrandoInterno
  const [menu, setMenu] = useState(null)

  const inicioMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const inicioSemana = new Date(cursor)
  inicioSemana.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))

  const diasMes = () => {
    const dias = []
    const inicio = new Date(inicioMes)
    inicio.setDate(1 - ((inicioMes.getDay() + 6) % 7))
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i); dias.push(d)
    }
    return dias
  }

  const diasSemana = () => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana); d.setDate(inicioSemana.getDate() + i); return d
  })

  const dias = vista === 'mes' ? diasMes() : diasSemana()
  const hoy = new Date()
  const fKey = d => format(d, 'yyyy-MM-dd')

  function bloqueDeFecha(fecha) {
    for (const b of (bloquesPlan || [])) {
      const inicio = new Date(b.fecha_inicio + 'T12:00:00')
      const fin = new Date(inicio); fin.setDate(fin.getDate() + b.semanas * 7 - 1)
      if (fecha >= inicio && fecha <= fin) {
        const diasDesdeInicio = Math.floor((fecha - inicio) / 86400000)
        const semanaNum = Math.floor(diasDesdeInicio / 7) + 1
        const subs = (subbloquesPlan || {})[b.id] || []
        const sub = subs.find(s => semanaNum >= s.semana_inicio && semanaNum <= s.semana_fin)
        const subIdx = subs.findIndex(s => s.id === sub?.id)
        const bloqueIdx = (bloquesPlan || []).findIndex(bb => bb.id === b.id)
        return { bloque: b, sub, bloqueNum: bloqueIdx + 1, subNum: subIdx + 1, semanaNum }
      }
    }
    return null
  }

  function infoSemana(lunes) {
    const jueves = new Date(lunes); jueves.setDate(jueves.getDate() + 3)
    return bloqueDeFecha(jueves)
  }

  const sesionPorDia = {}
  sesiones.filter(s => s.fecha).forEach(s => {
    if (!sesionPorDia[s.fecha]) sesionPorDia[s.fecha] = []
    sesionPorDia[s.fecha].push({ ...s, _tipo: 'sesion' })
  })
  competiciones.filter(c => c.fecha).forEach(c => {
    if (!sesionPorDia[c.fecha]) sesionPorDia[c.fecha] = []
    sesionPorDia[c.fecha].push({ ...c, _tipo: 'competicion' })
  })
  controles.filter(c => c.fecha).forEach(c => {
    if (!sesionPorDia[c.fecha]) sesionPorDia[c.fecha] = []
    sesionPorDia[c.fecha].push({ ...c, _tipo: 'control' })
  })
  notas.filter(n => n.fecha).forEach(n => {
    if (!sesionPorDia[n.fecha]) sesionPorDia[n.fecha] = []
    sesionPorDia[n.fecha].push({ ...n, _tipo: 'nota' })
  })

  const navPrev = () => {
    if (vista === 'mes') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
    else { const d = new Date(cursor); d.setDate(d.getDate() - 7); setCursor(d) }
  }
  const navNext = () => {
    if (vista === 'mes') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
    else { const d = new Date(cursor); d.setDate(d.getDate() + 7); setCursor(d) }
  }

  const titulo = vista === 'mes'
    ? format(cursor, 'MMMM yyyy', { locale: es })
    : `${format(inicioSemana, 'dd MMM', { locale: es })} — ${format(dias[6], 'dd MMM yyyy', { locale: es })}`

  function cerrarMenu() { setMenu(null) }

  return (
    <div onClick={cerrarMenu}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={navPrev}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', minWidth: 160, textAlign: 'center' }}>{titulo}</span>
        <button className="btn btn-ghost btn-sm" onClick={navNext}>›</button>
        {clipboard && (
          <>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', background: 'var(--accent-light)', padding: '3px 8px', borderRadius: 6 }}>📋 {clipboard.titulo || clipboard.nombre || clipboard.texto} copiada</span>
            {onPegarOtroCliente && <button className="btn btn-ghost btn-sm" onClick={onPegarOtroCliente}>→ Otro cliente</button>}
          </>
        )}
        {clipboardSemana && (
          <>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', background: 'var(--accent-light)', padding: '3px 8px', borderRadius: 6 }}>📅 Semana copiada ({clipboardSemana.items.length})</span>
            {onPegarSemanaOtroCliente && <button className="btn btn-ghost btn-sm" onClick={onPegarSemanaOtroCliente}>→ Otro cliente</button>}
          </>
        )}
        <div className="flex gap-1" style={{ marginLeft: 'auto' }}>
          {['mes', 'semana'].map(v => (
            <button key={v} className="btn btn-ghost btn-sm" style={vista === v ? { background: 'var(--bg2)', fontWeight: 600 } : {}} onClick={() => setVista(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--border)' }}>
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} style={{ background: 'var(--bg)', padding: '6px 0', textAlign: 'center', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {Array.from({ length: Math.ceil(dias.length / 7) }, (_, semIdx) => {
          const diasSem = dias.slice(semIdx * 7, semIdx * 7 + 7)
          const lunes = diasSem[0]
          const info = infoSemana(lunes)
          return (
            <div key={semIdx}>
              {info && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                    <strong style={{ fontWeight: 600, color: 'var(--text)' }}>Semana {info.semanaNum}</strong>
                    {info.sub && <> · SB{info.bloqueNum}.{info.subNum} {info.sub.nombre}</>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: (info.bloque.color || '#2d6a4f') + '1a', color: info.bloque.color || '#2d6a4f' }}>
                      B{info.bloqueNum} {info.bloque.nombre}
                    </span>
                    <button title="Compartir semana con cliente" onClick={async e => {
                      e.stopPropagation()
                      const { data: semsBloque } = await supabase.from('semanas').select('token_publico, numero').eq('bloque_id', info.bloque.id).eq('numero', info.semanaNum).maybeSingle()
                      let token = semsBloque?.token_publico
                      if (!token) {
                        const { data: nueva } = await supabase.from('semanas').insert({ bloque_id: info.bloque.id, numero: info.semanaNum, carga: 'media' }).select('token_publico').single()
                        token = nueva?.token_publico
                      }
                      if (token) {
                        navigator.clipboard.writeText(`${window.location.origin}/semana/${token}`)
                        alert('Enlace de la semana copiado')
                      }
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5, padding: '0 2px', lineHeight: 1 }}>🔗</button>
                    {onCopiarSemana && (
                      <button title="Copiar semana" onClick={e => { e.stopPropagation(); onCopiarSemana(diasSem) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5, padding: '0 2px', lineHeight: 1 }}>📋</button>
                    )}
                    {clipboardSemana && onPegarSemana && (
                      <button title="Pegar semana aquí" onClick={e => { e.stopPropagation(); onPegarSemana(diasSem[0]) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5, padding: '0 2px', lineHeight: 1 }}>📌</button>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--border)' }}>
                {diasSem.map((dia, i) => {
                  const key = fKey(dia)
                  const esMesActual = vista === 'semana' || dia.getMonth() === cursor.getMonth()
                  const esHoy = fKey(dia) === fKey(hoy)
                  const sesDia = sesionPorDia[key] || []
                  const colorLinea = info?.bloque?.color || null
                  const packDia = packs.find(p => key >= p.fecha_inicio && key <= p.fecha_fin)
                  return (
                    <div key={i}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (arrastrando) { onMoverSesion(arrastrando, key); setArrastrando(null) } }}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key }) }}
                      style={{ background: packDia ? '#f0f9ff' : 'var(--bg)', minHeight: vista === 'mes' ? 80 : 140, padding: '4px', boxSizing: 'border-box', borderTop: colorLinea ? `2px solid ${colorLinea}` : '2px solid transparent', display: 'flex', flexDirection: 'column', gap: 3, opacity: esMesActual ? 1 : 0.35 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: esHoy ? 700 : 400, fontFamily: 'var(--mono)', color: esHoy ? 'var(--accent)' : 'var(--text3)', background: esHoy ? 'var(--accent-light)' : 'transparent', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {dia.getDate()}
                        </span>
                        <DiaMenu fecha={key} onNuevaSesion={onNuevaSesion} onNuevaCompeticion={onNuevaCompeticion} onNuevaValoracion={onNuevaValoracion} onNuevaNota={onNuevaNota} />
                      </div>
                      {packDia && <span style={{ fontSize: 8, color: '#0369a1', fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1, paddingBottom: 1 }}>📦 {packDia.nombre}</span>}
                      {sesDia.map(item => {
                        const estadoColor = item._tipo === 'sesion' ? (item._estadoColor || null) : null
                        const tipoEstilo = estadoColor
                          ? { background: estadoColor + '22', color: estadoColor, border: `1px solid ${estadoColor}55` }
                          : {
                              sesion:      { background: 'var(--accent-light)', color: 'var(--accent)' },
                              competicion: { background: 'var(--danger-light)', color: 'var(--danger)' },
                              control:     { background: '#eff6ff', color: '#3b82f6' },
                              nota:        { background: '#fefce8', color: '#854d0e' },
                            }[item._tipo]
                        const icono = item._tipo === 'sesion' ? iconoSesion(item) : { competicion: '🏆', control: '🔬', nota: '📝' }[item._tipo]
                        const texto = item._tipo === 'nota' ? item.texto : (item.nombre || item.titulo)
                        return (
                          <div key={item.id}
                            draggable
                            onDragStart={() => setArrastrando(item)}
                            onDragEnd={() => setArrastrando(null)}
                            onClick={() => { if (item._tipo === 'sesion') onAbrirSesion(item) }}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key, item }) }}
                            style={{ fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 5, ...tipoEstilo, cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{icono} {texto}</span>
                            <span onClick={e => { e.stopPropagation(); onEliminar(item) }} style={{ flexShrink: 0, opacity: 0.6, cursor: 'pointer' }}>×</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {menu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: menu.y, left: menu.x, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.18)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
          {menu.item && (
            <button onClick={() => { onCopiar(menu.item); cerrarMenu() }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              📋 Copiar
            </button>
          )}
          {clipboard && (
            <button onClick={() => { onPegar(clipboard, menu.fecha); cerrarMenu() }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              📌 Pegar aquí
            </button>
          )}
        </div>
      )}
    </div>
  )
}
