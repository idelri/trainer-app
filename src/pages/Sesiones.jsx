import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Trash2, Copy } from 'lucide-react'

const COLORES = ['#E29A2E', '#4C82E8', '#2FAE76', '#8B6CE0', '#34AEB8', '#DD6F97']
const EMPTY_SESION = { titulo: '', fecha: '', objetivo: '', duracion_min: '', sinFecha: false, tipo_editor: 'fuerza', con_feedback: true }

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

async function ytTitulo(url) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
    const data = await res.json()
    return data.title || null
  } catch {
    return null
  }
}

/* input que guarda solo, sin botones, al perder el foco o tras una pausa */
function InlineInput({ value, onSave, placeholder, style, textarea, fontSize }) {
  const [v, setV] = useState(value || '')
  const timer = useRef(null)
  useEffect(() => { setV(value || '') }, [value])
  function handleChange(e) {
    const val = e.target.value
    setV(val)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave(val), 700)
  }
  function handleBlur() {
    clearTimeout(timer.current)
    onSave(v)
  }
  const Comp = textarea ? 'textarea' : 'input'
  return (
    <Comp
      value={v}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        border: 'none', background: 'transparent', outline: 'none', width: '100%',
        fontFamily: 'inherit', fontSize: fontSize || 13, color: 'inherit', padding: 0,
        resize: textarea ? 'vertical' : 'none', ...style,
      }}
      rows={textarea ? 2 : undefined}
    />
  )
}

function DiaMenu({ fecha, onNuevaSesion, onNuevaCompeticion, onNuevaNota }) {
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
          {[
            { label: '📝 Nota', action: () => { onNuevaNota(fecha); setOpen(false) } },
            { label: '🏆 Competición', action: () => { onNuevaCompeticion(fecha); setOpen(false) } },
            { label: '💪 Sesión', action: () => { onNuevaSesion(fecha); setOpen(false) } },
          ].map(({ label, action }) => (
            <button key={label} onClick={action}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
function Calendario({ sesiones, notas, competiciones, controles, bloquesPlan, subbloquesPlan, onAbrirSesion, onNuevaSesion, onNuevaCompeticion, onEditarCompeticion, onEliminarCompeticion, onNuevaNota, onEditarNota, onEliminarNota, onDuplicar, onEliminar, onMoverItem, clipboard, onCopiar, onPegar, clientes, clienteSeleccionado }) {
  const [vista, setVista] = useState('mes')
  const [cursor, setCursor] = useState(new Date())
  const [arrastrando, setArrastrando] = useState(null)
  const [menu, setMenu] = useState(null)

  const inicioMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const inicioSemana = new Date(cursor)
  inicioSemana.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))

  const diasMes = () => {
    const dias = []
    const inicio = new Date(inicioMes)
    inicio.setDate(1 - ((inicioMes.getDay() + 6) % 7))
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      dias.push(d)
    }
    return dias
  }

  const diasSemana = () => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    return d
  })

  const dias = vista === 'mes' ? diasMes() : diasSemana()
  const hoy = new Date()
  const fKey = d => format(d, 'yyyy-MM-dd')

  function bloqueDeFecha(fecha) {
    for (const b of bloquesPlan) {
      const inicio = new Date(b.fecha_inicio + 'T12:00:00')
      const fin = new Date(inicio); fin.setDate(fin.getDate() + b.semanas * 7 - 1)
      if (fecha >= inicio && fecha <= fin) {
        const diasDesdeInicio = Math.floor((fecha - inicio) / 86400000)
        const semanaNum = Math.floor(diasDesdeInicio / 7) + 1
        const subs = subbloquesPlan[b.id] || []
        const sub = subs.find(s => semanaNum >= s.semana_inicio && semanaNum <= s.semana_fin)
        const subIdx = subs.findIndex(s => s.id === sub?.id)
        const bloqueIdx = bloquesPlan.findIndex(bb => bb.id === b.id)
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
  ;(notas || []).forEach(n => {
    if (!sesionPorDia[n.fecha]) sesionPorDia[n.fecha] = []
    sesionPorDia[n.fecha].push({ ...n, _tipo: 'nota' })
  })
  ;(competiciones || []).forEach(c => {
    if (!sesionPorDia[c.fecha]) sesionPorDia[c.fecha] = []
    sesionPorDia[c.fecha].push({ ...c, _tipo: 'competicion' })
  })
  ;(controles || []).forEach(c => {
    if (!sesionPorDia[c.fecha]) sesionPorDia[c.fecha] = []
    sesionPorDia[c.fecha].push({ ...c, _tipo: 'control' })
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
          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', background: 'var(--accent-light)', padding: '3px 8px', borderRadius: 6 }}>
            📋 {clipboard.titulo} copiada
          </span>
        )}
        <div className="flex gap-1" style={{ marginLeft: 'auto' }}>
          {['mes', 'semana'].map(v => (
            <button key={v} className="btn btn-ghost btn-sm"
              style={vista === v ? { background: 'var(--bg2)', fontWeight: 600 } : {}}
              onClick={() => setVista(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

     <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--border)' }}>
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} style={{ background: 'var(--bg)', padding: '6px 0', textAlign: 'center', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 600, minWidth: 0 }}>{d}</div>
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
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: (info.bloque.color || '#2d6a4f') + '1a', color: info.bloque.color || '#2d6a4f' }}>
                    B{info.bloqueNum} {info.bloque.nombre}
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--border)' }}>
                {diasSem.map((dia, i) => {
                  const key = fKey(dia)
                  const esMesActual = vista === 'semana' || dia.getMonth() === cursor.getMonth()
                  const esHoy = fKey(dia) === fKey(hoy)
                  const sesDia = sesionPorDia[key] || []
                  const colorLinea = info?.bloque?.color || null
                  return (
                    <div key={i}
                      onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (arrastrando) { onMoverItem(arrastrando, key); setArrastrando(null) } }}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key }) }}
                      style={{ background: 'var(--bg)', minHeight: vista === 'mes' ? 80 : 140, padding: '4px', boxSizing: 'border-box', borderTop: colorLinea ? `2px solid ${colorLinea}` : '2px solid transparent', display: 'flex', flexDirection: 'column', gap: 3, opacity: esMesActual ? 1 : 0.35 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: esHoy ? 700 : 400, fontFamily: 'var(--mono)', color: esHoy ? 'var(--accent)' : 'var(--text3)', background: esHoy ? 'var(--accent-light)' : 'transparent', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {dia.getDate()}
                        </span>
                        <DiaMenu fecha={key} onNuevaSesion={onNuevaSesion} onNuevaCompeticion={onNuevaCompeticion} onNuevaNota={onNuevaNota} />
                      </div>
                      {sesDia.map(item => {
                       if (item._tipo === 'nota') return (
                          <div key={item.id}
                            draggable
                            onDragStart={() => setArrastrando(item)}
                            onDragEnd={() => setArrastrando(null)}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key, item }) }}
                            style={{ fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 5, background: '#fef9c3', color: '#854d0e', cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                            onClick={() => onEditarNota(item)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                              <span style={{ flexShrink: 0 }}>📝</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.texto.slice(0, 30)}</span>
                            </span>
                            <span onClick={e => { e.stopPropagation(); onEliminarNota(item.id) }} style={{ flexShrink: 0, opacity: 0.6, cursor: 'pointer' }}>×</span>
                          </div>
                        )
                        if (item._tipo === 'competicion') return (
                          <div key={item.id}
                            draggable
                            onDragStart={() => setArrastrando(item)}
                            onDragEnd={() => setArrastrando(null)}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key, item }) }}
                            style={{ fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 5, background: '#fbe9e6', color: '#c0392b', cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                            onClick={() => onEditarCompeticion(item)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                              <span style={{ flexShrink: 0 }}>🏆</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.nombre}</span>
                            </span>
                            <span onClick={e => { e.stopPropagation(); onEliminarCompeticion(item.id) }} style={{ flexShrink: 0, opacity: 0.6, cursor: 'pointer' }}>×</span>
                          </div>
                        )
                        if (item._tipo === 'control') return (
                          <div key={item.id}
                            draggable
                            onDragStart={() => setArrastrando(item)}
                            onDragEnd={() => setArrastrando(null)}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key, item }) }}
                            style={{ fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 5, background: '#eff6ff', color: '#3b82f6', cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                              <span style={{ flexShrink: 0 }}>🔬</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.nombre}</span>
                            </span>
                          </div>
                        )
                        return (
                          <div key={item.id}
                            draggable
                            onDragStart={() => setArrastrando(item)}
                            onDragEnd={() => setArrastrando(null)}
                            onClick={() => onAbrirSesion(item)}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key, item }) }}
                            style={{ fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 5, background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>💪 {item.titulo}</span>
                            <span onClick={e => { e.stopPropagation(); onEliminar(item.id) }} style={{ flexShrink: 0, opacity: 0.6, cursor: 'pointer' }}>×</span>
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
              📋 Copiar sesión
            </button>
          )}
          {clipboard && (
            <button onClick={() => { onPegar(clipboard, menu.fecha, clienteSeleccionado); cerrarMenu() }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              📌 Pegar aquí
            </button>
          )}
          {clipboard && clientes && clientes.length > 1 && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ padding: '6px 14px 2px', fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Pegar en otro cliente</div>
              {clientes.filter(c => c.id !== clienteSeleccionado).map(c => (
                <button key={c.id} onClick={() => { onPegar(clipboard, menu.fecha, c.id); cerrarMenu() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default function Sesiones({ clienteInicial, sesionInicialId }) {
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(clienteInicial || null)
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(false)
  const [sesionAbierta, setSesionAbierta] = useState(null)
  const sesionInicialCargada = useRef(false)
  const [bloques, setBloques] = useState([])
  const [ejercicios, setEjercicios] = useState({})

  const [modalSesion, setModalSesion] = useState(null)
  const [formSesion, setFormSesion] = useState(EMPTY_SESION)
  const [saving, setSaving] = useState(false)
  const [draggingEj, setDraggingEj] = useState(null)
const [modalDuplicar, setModalDuplicar] = useState(null)
  const [fechaDuplicar, setFechaDuplicar] = useState('')
  const [clipboard, setClipboard] = useState(null)
  const [menuContextual, setMenuContextual] = useState(null)
  const [modalCompCal, setModalCompCal] = useState(false)
  const [formCompCal, setFormCompCal] = useState({ nombre: '', fecha: '', tipo: '', objetivo: '', notas: '' })
  const [editandoComp, setEditandoComp] = useState(null)
  const [modalNotaCal, setModalNotaCal] = useState(false)
  const [formNotaCal, setFormNotaCal] = useState({ texto: '', fecha: '' })
  const [editandoNota, setEditandoNota] = useState(null)
  useEffect(() => { cargarClientes() }, [])
  useEffect(() => { if (clienteSeleccionado) cargarSesiones() }, [clienteSeleccionado])
  useEffect(() => { if (sesionAbierta) cargarDetalle(sesionAbierta.id) }, [sesionAbierta])

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  const [notas, setNotas] = useState([])
  const [competicionesCal, setCompeticionesCal] = useState([])

  const [bloquesPlan, setBloquesPlan] = useState([])
  const [subbloquesPlan, setSubbloquesPlan] = useState({})

  const [controlesCal, setControlesCal] = useState([])
  const [fases, setFases] = useState([])

  async function cargarSesiones() {
    setLoading(true)
    const [{ data: ses }, { data: nots }, { data: comps }, { data: ctrls }, { data: plan }] = await Promise.all([
      supabase.from('sesiones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha', { ascending: false }),
      supabase.from('sesion_notas').select('*').eq('cliente_id', clienteSeleccionado).order('fecha'),
      supabase.from('competiciones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha'),
      supabase.from('controles').select('*').eq('cliente_id', clienteSeleccionado).order('fecha'),
      supabase.from('planificaciones').select('id, fecha_inicio').eq('cliente_id', clienteSeleccionado).order('fecha_inicio', { ascending: false }).limit(1).maybeSingle(),
    ])
    setSesiones(ses || [])
    setNotas(nots || [])
    setCompeticionesCal(comps || [])
    setControlesCal(ctrls || [])
    if (sesionInicialId && !sesionInicialCargada.current) {
      sesionInicialCargada.current = true
      const sesInicial = (ses || []).find(s => s.id === sesionInicialId)
      setSesionAbierta(sesInicial || null)
    } else {
      setSesionAbierta(null)
    }

    if (plan) {
      const { data: bls } = await supabase.from('bloques').select('*').eq('planificacion_id', plan.id).order('orden')
      setBloquesPlan(bls || [])
      if (bls && bls.length > 0) {
        const { data: subs } = await supabase.from('subbloques').select('*').in('bloque_id', bls.map(b => b.id)).order('semana_inicio')
        const map = {}
        ;(subs || []).forEach(s => { if (!map[s.bloque_id]) map[s.bloque_id] = []; map[s.bloque_id].push(s) })
        setSubbloquesPlan(map)
      }
    } else {
      setBloquesPlan([])
      setSubbloquesPlan({})
    }
    setLoading(false)
  }
  async function cargarDetalle(sesionId) {
    const [{ data: bls }, { data: fs }] = await Promise.all([
      supabase.from('sesion_bloques').select('*').eq('sesion_id', sesionId).order('orden'),
      supabase.from('sesion_fases').select('*').eq('sesion_id', sesionId).order('orden'),
    ])
    setBloques(bls || [])
    setFases(fs || [])
    if (bls && bls.length > 0) {
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').in('bloque_id', bls.map(b => b.id)).order('orden')
      const map = {}
      ;(ejs || []).forEach(e => { if (!map[e.bloque_id]) map[e.bloque_id] = []; map[e.bloque_id].push(e) })
      setEjercicios(map)
    } else {
      setEjercicios({})
    }
  }

  async function añadirFase() {
    const { data } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: `Fase ${fases.length + 1}`, orden: fases.length }).select().single()
    if (data) setFases(f => [...f, data])
  }

  async function actualizarFase(id, campo, valor) {
    setFases(fs => fs.map(f => f.id === id ? { ...f, [campo]: valor } : f))
    await supabase.from('sesion_fases').update({ [campo]: valor }).eq('id', id)
  }

  async function eliminarFase(id) {
    setFases(fs => fs.filter(f => f.id !== id))
    await supabase.from('sesion_fases').delete().eq('id', id)
  }

  function abrirNuevaSesion() {
    setFormSesion({ ...EMPTY_SESION, fecha: format(new Date(), 'yyyy-MM-dd') })
    setModalSesion('nueva')
  }

  function abrirEditarSesion(s) {
    setFormSesion({ titulo: s.titulo, fecha: s.fecha, objetivo: s.objetivo || '', duracion_min: s.duracion_min || '', tipo_editor: s.tipo_editor || 'fuerza', con_feedback: s.con_feedback !== false })
    setModalSesion(s)
  }

async function guardarSesion() {
    if (!formSesion.titulo) return
    if (!formSesion.sinFecha && !formSesion.fecha) return
    setSaving(true)
    const datos = { titulo: formSesion.titulo, fecha: formSesion.sinFecha ? null : formSesion.fecha, objetivo: formSesion.objetivo || null, duracion_min: formSesion.duracion_min ? parseInt(formSesion.duracion_min) : null, tipo_editor: formSesion.tipo_editor || 'fuerza', con_feedback: formSesion.con_feedback !== false }
    if (modalSesion?.id) {
      await supabase.from('sesiones').update(datos).eq('id', modalSesion.id)
      setSesionAbierta(s => s ? { ...s, ...datos } : s)
      setSaving(false); setModalSesion(null); cargarSesiones()
      return
    }
    // Nueva sesión: si es fuerza crear 4 bloques x 3 ejercicios; si es carrera crear 3 fases
    const { data: nueva } = await supabase.from('sesiones').insert({ ...datos, cliente_id: clienteSeleccionado }).select().single()
    if (nueva) {
      if (datos.tipo_editor === 'carrera') {
        await supabase.from('sesion_fases').insert([
          { sesion_id: nueva.id, nombre: 'Calentamiento', orden: 0 },
          { sesion_id: nueva.id, nombre: 'Trabajo principal', orden: 1 },
          { sesion_id: nueva.id, nombre: 'Vuelta a la calma', orden: 2 },
        ])
      } else {
        for (let i = 0; i < 4; i++) {
          const { data: b } = await supabase.from('sesion_bloques').insert({
            sesion_id: nueva.id, nombre: `Bloque ${i + 1}`, color: COLORES[i % COLORES.length], nota: '', orden: i,
          }).select().single()
          if (b) {
            for (let j = 0; j < 3; j++) {
              await supabase.from('sesion_ejercicios').insert({
                bloque_id: b.id, nombre: '', series: '', reps: '', rpe: '', notas: '',
                media_tipo: 'youtube', media_url: '', video_url: '', orden: j,
              })
            }
          }
        }
      }
      setSesionAbierta(nueva)
    }
    setSaving(false); setModalSesion(null); cargarSesiones()
  }

  async function eliminarSesion(id) {
    if (!window.confirm('¿Eliminar esta sesión?')) return
    await supabase.from('sesiones').delete().eq('id', id)
    if (sesionAbierta?.id === id) setSesionAbierta(null)
    cargarSesiones()
  }

  function copiarEnlaceSesion(s) {
    const url = `${window.location.origin}/sesion/${s.token_publico}`
    navigator.clipboard.writeText(url)
    alert(`Enlace copiado:\n${url}`)
  }

  async function actualizarBloque(id, campo, valor) {
    await supabase.from('sesion_bloques').update({ [campo]: valor }).eq('id', id)
    setBloques(bs => bs.map(b => b.id === id ? { ...b, [campo]: valor } : b))
  }

  async function cambiarColorBloque(id, color) {
    await supabase.from('sesion_bloques').update({ color }).eq('id', id)
    setBloques(bs => bs.map(b => b.id === id ? { ...b, color } : b))
  }

  async function añadirBloque() {
    const { data: b } = await supabase.from('sesion_bloques').insert({
      sesion_id: sesionAbierta.id, nombre: `Bloque ${bloques.length + 1}`, color: COLORES[bloques.length % COLORES.length], nota: '', orden: bloques.length,
    }).select().single()
    if (b) {
      setBloques(bs => [...bs, b])
      setEjercicios(e => ({ ...e, [b.id]: [] }))
    }
  }

  async function eliminarBloque(id) {
    if (!window.confirm('¿Eliminar este bloque y sus ejercicios?')) return
    await supabase.from('sesion_bloques').delete().eq('id', id)
    setBloques(bs => bs.filter(b => b.id !== id))
  }

  async function añadirEjercicio(bloqueId) {
    const lista = ejercicios[bloqueId] || []
    const { data: e } = await supabase.from('sesion_ejercicios').insert({
      bloque_id: bloqueId, nombre: '', series: '', reps: '', rpe: '', notas: '',
      media_tipo: 'youtube', media_url: '', video_url: '', orden: lista.length,
    }).select().single()
    if (e) setEjercicios(ej => ({ ...ej, [bloqueId]: [...(ej[bloqueId] || []), e] }))
  }

  async function actualizarEjercicio(bloqueId, id, campo, valor) {
    await supabase.from('sesion_ejercicios').update({ [campo]: valor }).eq('id', id)
    setEjercicios(ej => ({ ...ej, [bloqueId]: (ej[bloqueId] || []).map(e => e.id === id ? { ...e, [campo]: valor } : e) }))
  }

  async function eliminarEjercicio(bloqueId, id) {
    await supabase.from('sesion_ejercicios').delete().eq('id', id)
    setEjercicios(ej => ({ ...ej, [bloqueId]: (ej[bloqueId] || []).filter(e => e.id !== id) }))
  }

  async function pegarSesion(sesionOrigen, fechaDestino, clienteDestino) {
    setSaving(true)
    const { data: nuevaSesion } = await supabase.from('sesiones').insert({
      cliente_id: clienteDestino, titulo: sesionOrigen.titulo, fecha: fechaDestino,
      objetivo: sesionOrigen.objetivo, duracion_min: sesionOrigen.duracion_min,
    }).select().single()
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', sesionOrigen.id).order('orden')
    for (const b of bls || []) {
      const { data: nb } = await supabase.from('sesion_bloques').insert({
        sesion_id: nuevaSesion.id, nombre: b.nombre, color: b.color, nota: b.nota, orden: b.orden,
      }).select().single()
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').eq('bloque_id', b.id).order('orden')
      for (const e of ejs || []) {
        await supabase.from('sesion_ejercicios').insert({
          bloque_id: nb.id, nombre: e.nombre, series: e.series, reps: e.reps, rpe: e.rpe, notas: e.notas,
          media_tipo: e.media_tipo, media_url: e.media_url, video_url: e.video_url, orden: e.orden,
        })
      }
    }
    setSaving(false)
    if (clienteDestino === clienteSeleccionado) cargarSesiones()
  }
  async function duplicarSesion(s, fechaDestino) {
    setSaving(true)
    const { data: nuevaSesion } = await supabase.from('sesiones').insert({
      cliente_id: s.cliente_id, titulo: s.titulo + ' (copia)', fecha: fechaDestino || format(new Date(), 'yyyy-MM-dd'),
      objetivo: s.objetivo, duracion_min: s.duracion_min,
    }).select().single()
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', s.id).order('orden')
    for (const b of bls || []) {
      const { data: nb } = await supabase.from('sesion_bloques').insert({
        sesion_id: nuevaSesion.id, nombre: b.nombre, color: b.color, nota: b.nota, orden: b.orden,
      }).select().single()
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').eq('bloque_id', b.id).order('orden')
      for (const e of ejs || []) {
        await supabase.from('sesion_ejercicios').insert({
          bloque_id: nb.id, nombre: e.nombre, series: e.series, reps: e.reps, rpe: e.rpe, notas: e.notas,
          media_tipo: e.media_tipo, media_url: e.media_url, video_url: e.video_url, orden: e.orden,
        })
      }
    }
    setSaving(false)
    cargarSesiones()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Sesiones</h2>
          {sesionAbierta && <p className="page-subtitle">{sesionAbierta.titulo}</p>}
        </div>
        {clienteSeleccionado && !sesionAbierta && (
          <button className="btn btn-primary" onClick={abrirNuevaSesion}><Plus size={13} /> Nueva sesión</button>
        )}
        {sesionAbierta && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => copiarEnlaceSesion(sesionAbierta)}>🔗 Compartir</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setModalDuplicar(sesionAbierta); setFechaDuplicar(format(new Date(), 'yyyy-MM-dd')) }}>📋 Duplicar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarSesion(sesionAbierta)}>Fecha / duración</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSesionAbierta(null)}>← Volver</button>
          </div>
        )}
      </div>

      {!sesionAbierta && (
        <div className="flex gap-3 items-center" style={{ marginBottom: 20 }}>
          <select className="form-select" style={{ maxWidth: 260 }} value={clienteSeleccionado || ''} onChange={e => setClienteSeleccionado(e.target.value || null)}>
            <option value="">Selecciona un cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      {loading && <div className="empty"><p>Cargando...</p></div>}

     {!loading && clienteSeleccionado && !sesionAbierta && (
        <>
          {sesiones.filter(s => !s.fecha).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                Sin fecha asignada — {sesiones.filter(s => !s.fecha).length}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sesiones.filter(s => !s.fecha).map(s => (
                  <div key={s.id} onClick={() => setSesionAbierta(s)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12.5 }}>
                    💪 {s.titulo}
                    <span onClick={e => { e.stopPropagation(); eliminarSesion(s.id) }} style={{ opacity: 0.5, marginLeft: 4 }}>×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
     <Calendario
          sesiones={sesiones}
          notas={notas}
          competiciones={competicionesCal}
          controles={controlesCal}
          bloquesPlan={bloquesPlan}
          subbloquesPlan={subbloquesPlan}
          clipboard={clipboard}
          clientes={clientes}
          clienteSeleccionado={clienteSeleccionado}
          onCopiar={(item) => setClipboard(item)}
          onPegar={async (item, fecha, clienteDestino) => {
            if (item._tipo === 'sesion') {
              await pegarSesion(item, fecha, clienteDestino)
            } else if (item._tipo === 'competicion') {
              await supabase.from('competiciones').insert({ cliente_id: clienteDestino, nombre: item.nombre, fecha, tipo: item.tipo, objetivo: item.objetivo, notas: item.notas })
            } else if (item._tipo === 'control') {
              await supabase.from('controles').insert({ cliente_id: clienteDestino, nombre: item.nombre, fecha, tipo: item.tipo, notas: item.notas })
            } else if (item._tipo === 'nota') {
              await supabase.from('sesion_notas').insert({ cliente_id: clienteDestino, fecha, texto: item.texto })
            }
            if (clienteDestino === clienteSeleccionado) cargarSesiones()
          }}
          onMoverItem={async (item, nuevaFecha) => {
          const tabla = item._tipo === 'sesion' ? 'sesiones' : item._tipo === 'competicion' ? 'competiciones' : item._tipo === 'control' ? 'controles' : item._tipo === 'nota' ? 'sesion_notas' : null
            if (!tabla) return
            await supabase.from(tabla).update({ fecha: nuevaFecha }).eq('id', item.id)
            cargarSesiones()
          }}
          onAbrirSesion={setSesionAbierta}
          onNuevaSesion={(fecha) => {
            setFormSesion({ ...EMPTY_SESION, fecha })
            setModalSesion('nueva')
          }}
          onNuevaCompeticion={(fecha) => {
            setEditandoComp(null)
            setFormCompCal({ nombre: '', fecha, tipo: '', objetivo: '', notas: '' })
            setModalCompCal(true)
          }}
          onEditarCompeticion={(c) => {
            setEditandoComp(c)
            setFormCompCal({ nombre: c.nombre, fecha: c.fecha, tipo: c.tipo || '', objetivo: c.objetivo || '', notas: c.notas || '' })
            setModalCompCal(true)
          }}
          onNuevaNota={(fecha) => {
            setEditandoNota(null)
            setFormNotaCal({ texto: '', fecha })
            setModalNotaCal(true)
          }}
          onEditarNota={(n) => {
            setEditandoNota(n)
            setFormNotaCal({ texto: n.texto, fecha: n.fecha })
            setModalNotaCal(true)
          }}
         onEliminarCompeticion={async (id) => {
            if (!window.confirm('¿Eliminar esta competición?')) return
            await supabase.from('competiciones').delete().eq('id', id)
            cargarSesiones()
          }}
          onEliminarNota={async (id) => {
            if (!window.confirm('¿Eliminar esta nota?')) return
            await supabase.from('sesion_notas').delete().eq('id', id)
            cargarSesiones()
          }}
         onDuplicar={duplicarSesion}
          onEliminar={eliminarSesion}
        />
        </>
      )}

      {sesionAbierta && (
        <div>
        <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Objetivo general</div>
            <InlineInput
              value={sesionAbierta.objetivo}
              placeholder="Ej: Seguir construyendo base de movilidad y fuerza general..."
              textarea
              fontSize={13}
              onSave={async v => { await supabase.from('sesiones').update({ objetivo: v || null }).eq('id', sesionAbierta.id); setSesionAbierta(s => ({ ...s, objetivo: v })) }}
            />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>🎒 Material necesario</div>
            <InlineInput
              value={sesionAbierta.material}
              placeholder="Ej: Esterilla, discos y mancuernas, goma (resistencia baja)..."
              textarea
              fontSize={13}
              onSave={async v => { await supabase.from('sesiones').update({ material: v || null }).eq('id', sesionAbierta.id); setSesionAbierta(s => ({ ...s, material: v })) }}
            />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>✏️ Indicaciones generales</div>
            <InlineInput
              value={sesionAbierta.indicaciones}
              placeholder="Ej: Realiza los ejercicios del bloque en orden, las series que toquen y pasa al siguiente..."
              textarea
              fontSize={13}
              onSave={async v => { await supabase.from('sesiones').update({ indicaciones: v || null }).eq('id', sesionAbierta.id); setSesionAbierta(s => ({ ...s, indicaciones: v })) }}
            />
          </div>

          {/* ── EDITOR CARRERA ── */}
          {sesionAbierta.tipo_editor === 'carrera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fases.map((f, idx) => {
                const FC_COLORS = ['#10b981','#84cc16','#f59e0b','#ef4444','#7c3aed']
                const rpeColor = !f.rpe ? 'var(--text3)' : f.rpe <= 4 ? '#10b981' : f.rpe <= 6 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={f.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${FC_COLORS[(f.fc_zona || 1) - 1]}` }}>
                    <div style={{ padding: '10px 14px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', minWidth: 52 }}>Fase {idx + 1}</span>
                      <div style={{ flex: 1 }}>
                        <InlineInput value={f.nombre} placeholder="Nombre de la fase..." fontSize={13} style={{ fontWeight: 600 }}
                          onSave={v => actualizarFase(f.id, 'nombre', v)} />
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarFase(f.id)}><Trash2 size={12} /></button>
                    </div>
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>Descripción</div>
                        <InlineInput value={f.descripcion} placeholder="Describe esta fase..." textarea fontSize={12.5}
                          onSave={v => actualizarFase(f.id, 'descripcion', v)} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>Volumen</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <InlineInput value={f.volumen_min != null ? String(f.volumen_min) : ''} placeholder="min" fontSize={12}
                              style={{ width: 40 }} onSave={v => actualizarFase(f.id, 'volumen_min', v ? parseInt(v) : null)} />
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>min</span>
                            <span style={{ fontSize: 11, color: 'var(--border)' }}>/</span>
                            <InlineInput value={f.volumen_km != null ? String(f.volumen_km) : ''} placeholder="km" fontSize={12}
                              style={{ width: 40 }} onSave={v => actualizarFase(f.id, 'volumen_km', v ? parseFloat(v) : null)} />
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>km</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>FC zona</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1,2,3,4,5].map(z => (
                              <button key={z} title={`Zona ${z}`} onClick={() => actualizarFase(f.id, 'fc_zona', f.fc_zona === z ? null : z)}
                                style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${f.fc_zona >= z ? FC_COLORS[z-1] : 'var(--border)'}`, background: f.fc_zona >= z ? FC_COLORS[z-1] : 'var(--bg)', fontSize: 9, fontWeight: 700, color: f.fc_zona >= z ? '#fff' : 'var(--text3)', cursor: 'pointer' }}>
                                {z}
                              </button>
                            ))}
                          </div>
                          {f.fc_zona && <div style={{ fontSize: 10, color: FC_COLORS[f.fc_zona - 1], marginTop: 2 }}>Zona {f.fc_zona}</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>Ritmo (min/km)</div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <InlineInput value={f.ritmo_inicio || ''} placeholder="4:00" fontSize={12} style={{ width: 44 }}
                              onSave={v => actualizarFase(f.id, 'ritmo_inicio', v || null)} />
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>–</span>
                            <InlineInput value={f.ritmo_fin || ''} placeholder="4:30" fontSize={12} style={{ width: 44 }}
                              onSave={v => actualizarFase(f.id, 'ritmo_fin', v || null)} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>RPE (1-10)</div>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <button key={n} onClick={() => actualizarFase(f.id, 'rpe', f.rpe === n ? null : n)}
                                style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${f.rpe === n ? rpeColor : 'var(--border)'}`, background: f.rpe === n ? rpeColor : 'var(--bg)', color: f.rpe === n ? '#fff' : 'var(--text3)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button className="btn btn-ghost" onClick={añadirFase} style={{ alignSelf: 'flex-start' }}>
                <Plus size={13} /> Añadir fase
              </button>
            </div>
          )}

          {/* ── EDITOR FUERZA ── */}
          {sesionAbierta.tipo_editor !== 'carrera' && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bloques.map((b, idx) => (
              <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || COLORES[0]}` }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {COLORES.map(c => (
                      <div key={c} onClick={() => cambiarColorBloque(b.id, c)}
                        style={{ width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer', border: b.color === c ? '2px solid var(--text)' : '2px solid transparent' }} />
                    ))}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                    <InlineInput value={b.nombre} placeholder={`Bloque ${idx + 1}`} fontSize={14}
                      style={{ fontWeight: 600 }}
                      onSave={v => actualizarBloque(b.id, 'nombre', v)} />
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><Trash2 size={12} /></button>
                </div>
                <div style={{ padding: '0 16px 10px', fontSize: 12.5, color: 'var(--text2)' }}>
                  <InlineInput value={b.nota} placeholder="Nota del bloque (opcional)..." textarea fontSize={12.5}
                    onSave={v => actualizarBloque(b.id, 'nota', v)} />
                </div>
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(ejercicios[b.id] || []).map((e, eIdx) => {
                    const id = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
                    const thumb = e.media_tipo === 'youtube' && id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : (e.media_tipo !== 'youtube' ? e.media_url : null)
                    return (
                      <div key={e.id}
                        draggable
                        onDragStart={() => setDraggingEj({ e, bloqueId: b.id })}
                        onDragEnd={() => setDraggingEj(null)}
                        onDragOver={ev => ev.preventDefault()}
                        onDrop={async ev => {
                          ev.preventDefault()
                          if (!draggingEj || draggingEj.e.id === e.id) return
                          const bloqueOrigen = draggingEj.bloqueId
                          const bloqueDestino = b.id
                          const ejOrigen = [...(ejercicios[bloqueOrigen] || [])]
                          const fromIdx = ejOrigen.findIndex(x => x.id === draggingEj.e.id)
                          if (fromIdx === -1) return
                          const [moved] = ejOrigen.splice(fromIdx, 1)
                          const ejDestinoBase = bloqueOrigen === bloqueDestino ? ejOrigen : [...(ejercicios[bloqueDestino] || [])]
                          const toIdx = ejDestinoBase.findIndex(x => x.id === e.id)
                          ejDestinoBase.splice(toIdx >= 0 ? toIdx : ejDestinoBase.length, 0, { ...moved, bloque_id: bloqueDestino })
                          const origenFinal = ejOrigen.map((x, i) => ({ ...x, orden: i }))
                          const destinoFinal = bloqueOrigen === bloqueDestino ? origenFinal : ejDestinoBase.map((x, i) => ({ ...x, orden: i }))
                          const newEj = { ...ejercicios }
                          newEj[bloqueOrigen] = origenFinal
                          newEj[bloqueDestino] = destinoFinal
                          setEjercicios(newEj)
                          await supabase.from('sesion_ejercicios').update({ bloque_id: bloqueDestino, orden: toIdx >= 0 ? toIdx : ejDestinoBase.length - 1 }).eq('id', moved.id)
                          await Promise.all(origenFinal.map(x => supabase.from('sesion_ejercicios').update({ orden: x.orden }).eq('id', x.id)))
                          if (bloqueOrigen !== bloqueDestino) await Promise.all(destinoFinal.map(x => supabase.from('sesion_ejercicios').update({ orden: x.orden }).eq('id', x.id)))
                          setDraggingEj(null)
                        }}
                        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px', background: draggingEj?.e?.id === e.id ? 'var(--bg2)' : 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'grab' }}>
                        <div style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, background: 'var(--bg2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {thumb ? <img src={thumb} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 9, color: 'var(--text3)' }}>sin media</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{idx + 1}.{eIdx + 1}.</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <InlineInput value={e.nombre} placeholder="Nombre del ejercicio" fontSize={13} style={{ fontWeight: 600 }}
                                onSave={v => actualizarEjercicio(b.id, e.id, 'nombre', v)} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Series</span>
                              <div style={{ width: 36 }}><InlineInput value={e.series} placeholder="—" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, 'series', v)} /></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Reps</span>
                              <div style={{ width: 60 }}><InlineInput value={e.reps} placeholder="—" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, 'reps', v)} /></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>RIR</span>
                              <div style={{ display: 'flex', gap: 3 }}>
                                {[['4+','#16a34a','#dcfce7','4 o más reps en reserva — esfuerzo muy bajo'],['2-3','#ca8a04','#fef9c3','2-3 reps en reserva — esfuerzo moderado'],['1-0','#dc2626','#fee2e2','0-1 reps en reserva — al límite o fallo muscular']].map(([val, color, bg, tip]) => (
                                  <button key={val} title={tip} onClick={() => actualizarEjercicio(b.id, e.id, 'rpe', e.rpe === val ? '' : val)}
                                    style={{ padding: '2px 6px', borderRadius: 8, border: `1.5px solid ${e.rpe === val ? color : 'var(--border)'}`, background: e.rpe === val ? bg : 'var(--bg)', color: e.rpe === val ? color : 'var(--text3)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                            <select className="form-select" style={{ fontSize: 11, padding: '3px 6px', width: 'auto' }} value={e.media_tipo} onChange={ev => actualizarEjercicio(b.id, e.id, 'media_tipo', ev.target.value)}>
                              <option value="youtube">YouTube</option>
                              <option value="imagen">Imagen</option>
                              <option value="video">Vídeo</option>
                              <option value="gif">GIF</option>
                            </select>
                            <div style={{ flex: 1 }}>
                              <InlineInput value={e.media_url} placeholder={e.media_tipo === 'youtube' ? 'Enlace de YouTube...' : 'URL de la media...'} fontSize={11}
                                onSave={async v => {
                                  await actualizarEjercicio(b.id, e.id, 'media_url', v)
                                  if (e.media_tipo === 'youtube' && v && !e.nombre) {
                                    const titulo = await ytTitulo(v)
                                    if (titulo) await actualizarEjercicio(b.id, e.id, 'nombre', titulo)
                                  }
                                }} />
                            </div>
                          </div>
                          {e.media_tipo !== 'youtube' && (
                            <div style={{ marginTop: 4 }}>
                              <InlineInput value={e.video_url} placeholder="Enlace 'Ver vídeo' (opcional)..." fontSize={11}
                                onSave={v => actualizarEjercicio(b.id, e.id, 'video_url', v)} />
                            </div>
                          )}
                          <div style={{ marginTop: 6 }}>
                            <InlineInput value={e.notas} placeholder="Notas (opcional)..." textarea fontSize={11.5} style={{ color: 'var(--text2)' }}
                              onSave={v => actualizarEjercicio(b.id, e.id, 'notas', v)} />
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => eliminarEjercicio(b.id, e.id)}><X size={12} /></button>
                      </div>
                    )
                  })}
                  <button className="btn btn-ghost btn-sm" onClick={() => añadirEjercicio(b.id)} style={{ alignSelf: 'flex-start' }}>
                    <Plus size={12} /> Ejercicio
                  </button>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={añadirBloque} style={{ alignSelf: 'flex-start' }}>
              <Plus size={13} /> Bloque
            </button>
          </div>}
        </div>
      )}

      {/* Modal sesión: solo título, fecha, duración (lo mínimo que necesita una identidad) */}
      {modalSesion && (
        <div className="modal-backdrop" onClick={() => setModalSesion(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalSesion === 'nueva' ? 'Nueva sesión' : 'Editar sesión'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSesion(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de editor</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['fuerza','💪','Fuerza / salud'],['carrera','🏃','Carrera / resistencia']].map(([val, ico, label]) => {
                  const active = (formSesion.tipo_editor || 'fuerza') === val
                  return (
                    <button key={val} type="button" onClick={() => setFormSesion(f => ({ ...f, tipo_editor: val }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 9, border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{ico}</span> {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={formSesion.titulo} onChange={e => setFormSesion(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Sesión 5 - Fuerza general" autoFocus /></div>
           <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={formSesion.fecha} disabled={formSesion.sinFecha} onChange={e => setFormSesion(f => ({ ...f, fecha: e.target.value }))} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                  <input type="checkbox" checked={formSesion.sinFecha} onChange={e => setFormSesion(f => ({ ...f, sinFecha: e.target.checked, fecha: e.target.checked ? '' : f.fecha }))} />
                  Sin fecha asignada (plantilla / pendiente de hacer)
                </label>
              </div>
              <div className="form-group"><label className="form-label">Duración (min)</label><input className="form-input" type="number" value={formSesion.duracion_min} onChange={e => setFormSesion(f => ({ ...f, duracion_min: e.target.value }))} placeholder="Ej: 45" /></div>
            </div>
            <div className="form-group" style={{ marginBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div onClick={() => setFormSesion(f => ({ ...f, con_feedback: !f.con_feedback }))}
                  style={{ width: 36, height: 20, borderRadius: 10, background: formSesion.con_feedback !== false ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', top: 2, left: formSesion.con_feedback !== false ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Feedback post-sesión</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formSesion.con_feedback !== false ? 'El cliente verá el cuestionario al terminar' : 'Sin cuestionario (sesión de activación, movilidad...)'}</div>
                </div>
              </label>
            </div>
            {modalSesion === 'nueva' && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{(formSesion.tipo_editor || 'fuerza') === 'carrera' ? 'Se crearán 3 fases de ejemplo (calentamiento, trabajo, vuelta a la calma).' : 'Se crearán 4 bloques con 3 ejercicios de ejemplo, listos para editar.'}</p>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSesion(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSesion} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
     )}

      {/* Modal competición desde calendario */}
      {modalCompCal && (
        <div className="modal-backdrop" onClick={() => setModalCompCal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
            <span className="modal-title">{editandoComp ? 'Editar competición' : 'Nueva competición'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCompCal(false)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formCompCal.nombre} onChange={e => setFormCompCal(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Media maratón Sevilla" autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formCompCal.fecha} onChange={e => setFormCompCal(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Tipo</label><input className="form-input" value={formCompCal.tipo} onChange={e => setFormCompCal(f => ({ ...f, tipo: e.target.value }))} placeholder="Ej: Carrera, Triatlón..." /></div>
            </div>
            <div className="form-group"><label className="form-label">Objetivo</label><input className="form-input" value={formCompCal.objetivo} onChange={e => setFormCompCal(f => ({ ...f, objetivo: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formCompCal.notas} onChange={e => setFormCompCal(f => ({ ...f, notas: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCompCal(false)}>Cancelar</button>
             <button className="btn btn-primary" disabled={saving} onClick={async () => {
                if (!formCompCal.nombre) return
                setSaving(true)
                const datos = { nombre: formCompCal.nombre, fecha: formCompCal.fecha, tipo: formCompCal.tipo || null, objetivo: formCompCal.objetivo || null, notas: formCompCal.notas || null }
                if (editandoComp) {
                  await supabase.from('competiciones').update(datos).eq('id', editandoComp.id)
                } else {
                  await supabase.from('competiciones').insert({ ...datos, cliente_id: clienteSeleccionado })
                }
                setSaving(false); setModalCompCal(false); cargarSesiones()
              }}>{saving ? 'Guardando...' : editandoComp ? 'Guardar cambios' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nota desde calendario */}
      {modalNotaCal && (
        <div className="modal-backdrop" onClick={() => setModalNotaCal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
            <span className="modal-title">{editandoNota ? 'Editar nota' : 'Nueva nota'} · {formNotaCal.fecha}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalNotaCal(false)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nota</label><textarea className="form-textarea" value={formNotaCal.texto} onChange={e => setFormNotaCal(f => ({ ...f, texto: e.target.value }))} placeholder="Escribe aquí tu nota..." style={{ minHeight: 100 }} autoFocus /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalNotaCal(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving} onClick={async () => {
                if (!formNotaCal.texto) return
                setSaving(true)
                if (editandoNota) {
                  await supabase.from('sesion_notas').update({ texto: formNotaCal.texto, fecha: formNotaCal.fecha }).eq('id', editandoNota.id)
                } else {
                  await supabase.from('sesion_notas').insert({ cliente_id: clienteSeleccionado, fecha: formNotaCal.fecha, texto: formNotaCal.texto })
                }
                setSaving(false); setModalNotaCal(false); cargarSesiones()
              }}>{saving ? 'Guardando...' : editandoNota ? 'Guardar cambios' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
   {/* Modal duplicar sesión */}
      {modalDuplicar && (
        <div className="modal-backdrop" onClick={() => setModalDuplicar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Duplicar sesión</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalDuplicar(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>Se duplicará "{modalDuplicar.titulo}" con todos sus bloques y ejercicios.</p>
            <div className="form-group"><label className="form-label">Nueva fecha</label><input className="form-input" type="date" value={fechaDuplicar} onChange={e => setFechaDuplicar(e.target.value)} autoFocus /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalDuplicar(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={async () => {
                await duplicarSesion(modalDuplicar, fechaDuplicar)
                setModalDuplicar(null)
              }}>{saving ? 'Duplicando...' : 'Duplicar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
