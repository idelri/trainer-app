import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { SECCIONES_CLASIFICACION, CAMPOS_CLASIFICACION, PATRON_MOVIMIENTO, derivarComplejos, COMPLEJOS, estadoGrupo, toggleGrupo, toggleEstructura, labelDeId, colorDeId, idsHojaDeEstructura, labelDePatronId } from '../lib/taxonomia'
import { format, parseISO } from 'date-fns'
import EmojiPicker from '../components/EmojiPicker'
import { es } from 'date-fns/locale'
import { Plus, X, Trash2, Copy, Check, Play } from 'lucide-react'

const COLORES = ['#E29A2E', '#4C82E8', '#2FAE76', '#8B6CE0', '#34AEB8', '#DD6F97']
const BORG_RPE = { 1: 'Muy, muy suave', 2: 'Suave', 3: 'Moderado', 4: 'Algo duro', 5: 'Duro', 6: 'Duro', 7: 'Muy duro', 8: 'Muy duro', 9: 'Muy, muy duro', 10: 'Máximo esfuerzo' }
const EMPTY_SESION = { titulo: '', fecha: '', objetivo: '', duracion_min: '', sinFecha: false, tipo_sesion: 'programada', estado: 'pendiente', tipo_editor: 'fuerza', con_feedback: true, icono: '' }
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
function InlineInput({ value, onSave, placeholder, style, textarea, fontSize, type }) {
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
      type={textarea ? undefined : (type || 'text')}
      value={v}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      min={type === 'number' ? 0 : undefined}
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
export default function Sesiones({ clienteInicial, sesionInicialId, esPlantilla, setPage, setClientePlanificacion, setRecargarPlan }) {
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(clienteInicial || null)
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(false)
  const [sesionAbierta, setSesionAbierta] = useState(null)
  const sesionInicialCargada = useRef(false)
  const [bloques, setBloques] = useState([])

  const FORM_CREAR_EJ_EMPTY = { nombre: '', descripcion: '', notas: '', ejecucion_tipo: '', media_tipo: 'youtube', media_url: '', video_url: '', complejo_articular: [], estructura_anatomica: [], familia: [], patron_movimiento: [], posicion_ejercicio: [], plano_movimiento: [], tipo_contraccion: [], material: [] }
  const [modalCrearEj, setModalCrearEj] = useState(null) // { bloqueId, variablesDefault }
  const [formCrearEj, setFormCrearEj] = useState(FORM_CREAR_EJ_EMPTY)
  const [guardandoCrearEj, setGuardandoCrearEj] = useState(false)
  const [errorCrearEj, setErrorCrearEj] = useState(null)
  const [ejercicios, setEjercicios] = useState({})

  const [dirty, setDirty] = useState(false)
  const [avisoSinGuardar, setAvisoSinGuardar] = useState(false)
  const [modalSesion, setModalSesion] = useState(null)
  const [formSesion, setFormSesion] = useState(EMPTY_SESION)
  const [saving, setSaving] = useState(false)
  const [draggingEj, setDraggingEj] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(false)
  const [menuVariableAbierto, setMenuVariableAbierto] = useState(null)
  const [menuVariablePos, setMenuVariablePos] = useState({ x: 0, y: 0 })
  const [modalBiblioteca, setModalBiblioteca] = useState(null) // { bloqueId, variablesDefault }
  const [biblioteca, setBiblioteca] = useState(null) // null = no cargada aún
  const [panelBiblioteca, setPanelBiblioteca] = useState(false)
  const [guardandoEnBib, setGuardandoEnBib] = useState(false)
  const [busquedaBiblioteca, setBusquedaBiblioteca] = useState('')
  const [bibFiltros, setBibFiltros] = useState({}) // { [campo]: subvariable | null } — campos activos
  const [guardadoOk, setGuardadoOk] = useState(false)
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
  const [packs, setPacks] = useState([])
  const [modalPack, setModalPack] = useState(null)
  const [formPack, setFormPack] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' })
  const [savingPack, setSavingPack] = useState(false)
  useEffect(() => { cargarClientes() }, [])
  useEffect(() => { if (clienteSeleccionado) cargarSesiones() }, [clienteSeleccionado])
  useEffect(() => { if (sesionAbierta) { cargarDetalle(sesionAbierta.id); setDirty(false); setAvisoSinGuardar(false) } }, [sesionAbierta])
  useEffect(() => {
    if (esPlantilla && sesionInicialId && !sesionInicialCargada.current) {
      sesionInicialCargada.current = true
      supabase.from('sesiones').select('*').eq('id', sesionInicialId).single().then(({ data }) => {
        if (data) setSesionAbierta(data)
      })
    }
  }, [esPlantilla, sesionInicialId])
  useEffect(() => {
    if (!menuVariableAbierto) return
    function handler(ev) {
      if (ev.target.closest('[data-var-menu]')) return
      setMenuVariableAbierto(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuVariableAbierto])

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
  const [carritoItems, setCarritoItems] = useState([]) // lista combinada fases sueltas + grupos para editor carrera
  const [draggingCarrito, setDraggingCarrito] = useState(null) // { idx, grupoId?, innerIdx? }
  const [ctxCarrito, setCtxCarrito] = useState(null) // { x, y, item, grupoId?, innerIdx? }
  const [clipboardBloque, setClipboardBloque] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('idelri_clipboardBloque') || 'null') } catch { return null }
  })
  const [toastCopiado, setToastCopiado] = useState(null)
  const [tabBiblioteca, setTabBiblioteca] = useState('ejercicios')
  const [bloquesBiblioteca, setBloquesBiblioteca] = useState(null)
  const [libDragActive, setLibDragActive] = useState(false)
  const [dragOverBloqueId, setDragOverBloqueId] = useState(null)
  const [draggingBloqueId, setDraggingBloqueId] = useState(null)

  // ── PORTAPAPELES DE BLOQUES ──
  function guardarEnPortapapeles(data) {
    setClipboardBloque(data)
    try { sessionStorage.setItem('idelri_clipboardBloque', JSON.stringify(data)) } catch {}
    setToastCopiado(data.nombre)
    setTimeout(() => setToastCopiado(null), 2200)
  }
  function limpiarPortapapeles() {
    setClipboardBloque(null)
    try { sessionStorage.removeItem('idelri_clipboardBloque') } catch {}
  }
  // Helpers de clonado — excluyen IDs y resultados del cliente
  function cloneEjercicioPayload(e) {
    const { id, bloque_id, valores_reales, ...p } = e
    return p
  }
  function cloneBloquePayload(b) {
    const { id, sesion_id, ...p } = b
    return p
  }
  function cloneFasePayload(f) {
    const { id, sesion_id, grupo_id, ...p } = f
    return p
  }
  // Copy
  function copiarFase(fase) {
    guardarEnPortapapeles({ tipo: 'bloque_carrera', nombre: fase.nombre || 'Bloque', payload: { fase: cloneFasePayload(fase) } })
  }
  function copiarGrupo(grupo) {
    guardarEnPortapapeles({ tipo: 'grupo_carrera', nombre: `${grupo.repeticiones}× grupo`, payload: { grupo: { repeticiones: grupo.repeticiones }, fases: grupo.fases.map(f => cloneFasePayload(f)) } })
  }
  function copiarBloqueFuerza(bloque) {
    const ejs = (ejercicios[bloque.id] || []).map(e => cloneEjercicioPayload(e))
    guardarEnPortapapeles({ tipo: 'bloque_fuerza', nombre: bloque.nombre || 'Bloque', payload: { bloque: cloneBloquePayload(bloque), ejercicios: ejs } })
  }
  // Paste
  async function pegarDesdePortapapeles() {
    if (!clipboardBloque || !sesionAbierta) return
    const { tipo, payload } = clipboardBloque
    if (tipo === 'bloque_carrera') {
      const orden = nextCarritoOrden(carritoItems)
      const { data } = await supabase.from('sesion_fases').insert({ ...payload.fase, sesion_id: sesionAbierta.id, orden, grupo_id: null }).select().single()
      if (data) { setCarritoItems(ci => [...ci, { type: 'fase', ...data }]); setDirty(true) }
    } else if (tipo === 'grupo_carrera') {
      const orden = nextCarritoOrden(carritoItems)
      const { data: grp } = await supabase.from('sesion_fase_grupos').insert({ sesion_id: sesionAbierta.id, repeticiones: payload.grupo.repeticiones, orden }).select().single()
      if (!grp) return
      const fases = []
      for (let i = 0; i < payload.fases.length; i++) {
        const { data: f } = await supabase.from('sesion_fases').insert({ ...payload.fases[i], sesion_id: sesionAbierta.id, orden: i, grupo_id: grp.id }).select().single()
        if (f) fases.push(f)
      }
      setCarritoItems(ci => [...ci, { type: 'grupo', ...grp, fases }]); setDirty(true)
    } else if (tipo === 'bloque_fuerza') {
      const orden = bloques.length
      const { data: nb } = await supabase.from('sesion_bloques').insert({ ...payload.bloque, sesion_id: sesionAbierta.id, orden }).select().single()
      if (!nb) return
      const nuevosEjs = []
      for (let i = 0; i < payload.ejercicios.length; i++) {
        const { data: e } = await supabase.from('sesion_ejercicios').insert({ ...payload.ejercicios[i], bloque_id: nb.id, orden: i }).select().single()
        if (e) nuevosEjs.push(e)
      }
      setBloques(bs => [...bs, nb]); setEjercicios(ej => ({ ...ej, [nb.id]: nuevosEjs })); setDirty(true)
    }
  }

  // ── BIBLIOTECA DE BLOQUES ──────────────────────────────────────────────
  async function cargarBloquesBiblioteca() {
    if (bloquesBiblioteca !== null) return
    const { data } = await supabase.from('bloques_biblioteca').select('*, bloques_biblioteca_ejercicios(*)').order('nombre')
    setBloquesBiblioteca((data || []).map(b => ({ ...b, ejercicios: (b.bloques_biblioteca_ejercicios || []).sort((a, z) => a.orden - z.orden) })))
  }

  async function guardarBloqueEnBiblioteca(bloque) {
    const ejs = ejercicios[bloque.id] || []
    const { data: nb } = await supabase.from('bloques_biblioteca').insert({
      nombre: bloque.nombre || 'Bloque sin nombre',
      descripcion: bloque.nota || null,
      color: bloque.color || '#2d6a4f',
    }).select().single()
    if (!nb) { alert('Error al guardar en biblioteca'); return }
    for (let i = 0; i < ejs.length; i++) {
      const { id, bloque_id, valores_reales, ...p } = ejs[i]
      await supabase.from('bloques_biblioteca_ejercicios').insert({ ...p, bloque_bib_id: nb.id, orden: i })
    }
    setBloquesBiblioteca(null) // forzar recarga la próxima vez
    setToastCopiado('guardado en biblioteca')
    setTimeout(() => setToastCopiado(null), 2200)
  }

  async function insertarEjercicioDesdePanel(libEj, bloqueId) {
    const lista = ejercicios[bloqueId] || []
    const { data: e } = await supabase.from('sesion_ejercicios').insert({
      bloque_id: bloqueId, nombre: libEj.nombre,
      series: '', reps: '', rpe: '', notas: '',
      media_tipo: libEj.media_tipo || 'youtube',
      media_url: libEj.media_url || '',
      video_url: libEj.video_url || '',
      orden: lista.length, variables_activas: [],
      biblioteca_id: libEj.id || null,
    }).select().single()
    if (e) { setEjercicios(ej => ({ ...ej, [bloqueId]: [...(ej[bloqueId] || []), e] })); setDirty(true) }
  }

  async function insertarBloqueDesdePanel(bibBloque) {
    const { data: nb } = await supabase.from('sesion_bloques').insert({
      sesion_id: sesionAbierta.id,
      nombre: bibBloque.nombre,
      color: bibBloque.color || COLORES[0],
      nota: bibBloque.descripcion || '',
      orden: bloques.length,
    }).select().single()
    if (!nb) return
    const bibEjs = bibBloque.ejercicios || []
    const nuevosEjs = []
    for (let i = 0; i < bibEjs.length; i++) {
      const { id, bloque_bib_id, ...p } = bibEjs[i]
      const { data: e } = await supabase.from('sesion_ejercicios').insert({ ...p, bloque_id: nb.id, orden: i, valores_reales: null }).select().single()
      if (e) nuevosEjs.push(e)
    }
    setBloques(bs => [...bs, nb])
    setEjercicios(ej => ({ ...ej, [nb.id]: nuevosEjs }))
    setDirty(true)
  }

  async function reordenarBloques(fromId, toId) {
    if (fromId === toId) return
    const lista = [...bloques]
    const fromIdx = lista.findIndex(b => b.id === fromId)
    const toIdx = lista.findIndex(b => b.id === toId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = lista.splice(fromIdx, 1)
    lista.splice(toIdx, 0, moved)
    const actualizados = lista.map((b, i) => ({ ...b, orden: i }))
    setBloques(actualizados)
    await Promise.all(actualizados.map(b => supabase.from('sesion_bloques').update({ orden: b.orden }).eq('id', b.id)))
    setDirty(true)
  }

  // Cerrar menú contextual del carrito al hacer clic fuera
  useEffect(() => {
    if (!ctxCarrito) return
    function handler() { setCtxCarrito(null) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ctxCarrito])

  async function cargarSesiones() {
    setLoading(true)
    const [{ data: ses }, { data: nots }, { data: comps }, { data: ctrls }, { data: plan }, { data: pks }] = await Promise.all([
      supabase.from('sesiones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha', { ascending: false }),
      supabase.from('sesion_notas').select('*').eq('cliente_id', clienteSeleccionado).order('fecha'),
      supabase.from('competiciones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha'),
      supabase.from('controles').select('*').eq('cliente_id', clienteSeleccionado).order('fecha'),
      supabase.from('planificaciones').select('id, fecha_inicio').eq('cliente_id', clienteSeleccionado).order('fecha_inicio', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('packs_flexibles').select('*').eq('cliente_id', clienteSeleccionado).order('fecha_inicio'),
    ])
    setSesiones(ses || [])
    setNotas(nots || [])
    setCompeticionesCal(comps || [])
    setControlesCal(ctrls || [])
    setPacks(pks || [])
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
    const [{ data: bls }, { data: fs }, { data: grps }] = await Promise.all([
      supabase.from('sesion_bloques').select('*').eq('sesion_id', sesionId).order('orden'),
      supabase.from('sesion_fases').select('*').eq('sesion_id', sesionId).order('orden'),
      supabase.from('sesion_fase_grupos').select('*').eq('sesion_id', sesionId).order('orden'),
    ])
    setBloques(bls || [])
    setFases(fs || [])
    // Construir lista combinada para editor carrera
    const gruposMap = {}
    ;(grps || []).forEach(g => { gruposMap[g.id] = { type: 'grupo', ...g, fases: [] } })
    const fasesLibres = []
    ;(fs || []).forEach(f => {
      if (f.grupo_id && gruposMap[f.grupo_id]) gruposMap[f.grupo_id].fases.push(f)
      else fasesLibres.push({ type: 'fase', ...f })
    })
    const combined = [...fasesLibres, ...Object.values(gruposMap)].sort((a, b) => a.orden - b.orden)
    setCarritoItems(combined)
    if (bls && bls.length > 0) {
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').in('bloque_id', bls.map(b => b.id)).order('orden')
      const map = {}
      ;(ejs || []).forEach(e => { if (!map[e.bloque_id]) map[e.bloque_id] = []; map[e.bloque_id].push(e) })
      setEjercicios(map)
    } else {
      setEjercicios({})
    }
  }

  // ── Carrito helpers ──────────────────────────────────────────────────
  function nextCarritoOrden(ci) {
    return ci.reduce((m, it) => Math.max(m, it.orden ?? 0), -1) + 1
  }

  async function añadirBloqueSuelto() {
    const orden = nextCarritoOrden(carritoItems)
    const { data } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: '', orden, grupo_id: null }).select().single()
    if (data) setCarritoItems(ci => [...ci, { type: 'fase', ...data }])
    setDirty(true)
  }

  async function añadirGrupoCarrera() {
    const orden = nextCarritoOrden(carritoItems)
    const { data: grp } = await supabase.from('sesion_fase_grupos').insert({ sesion_id: sesionAbierta.id, repeticiones: 3, orden }).select().single()
    if (!grp) return
    const { data: f1 } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: '', orden: 0, grupo_id: grp.id }).select().single()
    const { data: f2 } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: '', orden: 1, grupo_id: grp.id }).select().single()
    setCarritoItems(ci => [...ci, { type: 'grupo', ...grp, fases: [f1, f2].filter(Boolean) }])
    setDirty(true)
  }

  async function eliminarBloqueCarrito(id) {
    setCarritoItems(ci => ci.filter(it => it.id !== id))
    await supabase.from('sesion_fases').delete().eq('id', id)
    setDirty(true)
  }

  async function eliminarGrupoCarrito(id) {
    setCarritoItems(ci => ci.filter(it => it.id !== id))
    await supabase.from('sesion_fase_grupos').delete().eq('id', id)
    setDirty(true)
  }

  async function actualizarBloqueCarrito(id, campo, valor, grupoId) {
    setCarritoItems(ci => ci.map(it => {
      if (grupoId) return it.id === grupoId ? { ...it, fases: it.fases.map(f => f.id === id ? { ...f, [campo]: valor } : f) } : it
      return it.id === id ? { ...it, [campo]: valor } : it
    }))
    await supabase.from('sesion_fases').update({ [campo]: valor }).eq('id', id)
    setDirty(true)
  }

  async function cambiarRepeticionesGrupo(grupoId, delta) {
    const grupo = carritoItems.find(it => it.id === grupoId && it.type === 'grupo')
    if (!grupo) return
    const next = Math.max(2, grupo.repeticiones + delta)
    await supabase.from('sesion_fase_grupos').update({ repeticiones: next }).eq('id', grupoId)
    setCarritoItems(ci => ci.map(it => it.id === grupoId && it.type === 'grupo' ? { ...it, repeticiones: next } : it))
    setDirty(true)
  }

  async function añadirFaseAGrupoCarrito(grupoId) {
    const grp = carritoItems.find(it => it.id === grupoId)
    if (!grp) return
    const { data } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: '', orden: grp.fases.length, grupo_id: grupoId }).select().single()
    if (data) setCarritoItems(ci => ci.map(it => it.id === grupoId ? { ...it, fases: [...it.fases, data] } : it))
    setDirty(true)
  }

  async function eliminarFaseDeGrupoCarrito(faseId, grupoId) {
    setCarritoItems(ci => ci.map(it => it.id === grupoId ? { ...it, fases: it.fases.filter(f => f.id !== faseId) } : it))
    await supabase.from('sesion_fases').delete().eq('id', faseId)
    setDirty(true)
  }

  async function duplicarBloqueCarrito(id, grupoId) {
    if (grupoId) {
      const grp = carritoItems.find(it => it.id === grupoId)
      if (!grp) return
      const src = grp.fases.find(f => f.id === id)
      if (!src) return
      const { data } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: src.nombre, descripcion: src.descripcion, volumen_min: src.volumen_min, volumen_km: src.volumen_km, fc_zona: src.fc_zona, ritmo_inicio: src.ritmo_inicio, ritmo_fin: src.ritmo_fin, rpe: src.rpe, orden: grp.fases.length, grupo_id: grupoId }).select().single()
      if (data) setCarritoItems(ci => ci.map(it => {
        if (it.id !== grupoId) return it
        const idx = it.fases.findIndex(f => f.id === id)
        const nf = [...it.fases]; nf.splice(idx + 1, 0, data)
        return { ...it, fases: nf }
      }))
    } else {
      const src = carritoItems.find(it => it.id === id)
      if (!src) return
      const { data } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: src.nombre, descripcion: src.descripcion, volumen_min: src.volumen_min, volumen_km: src.volumen_km, fc_zona: src.fc_zona, ritmo_inicio: src.ritmo_inicio, ritmo_fin: src.ritmo_fin, rpe: src.rpe, orden: nextCarritoOrden(carritoItems), grupo_id: null }).select().single()
      if (data) setCarritoItems(ci => { const idx = ci.findIndex(it => it.id === id); const n = [...ci]; n.splice(idx + 1, 0, { type: 'fase', ...data }); return n })
    }
    setDirty(true)
  }

  async function duplicarGrupoCarrito(grupoId) {
    const src = carritoItems.find(it => it.id === grupoId)
    if (!src) return
    const { data: newGrp } = await supabase.from('sesion_fase_grupos').insert({ sesion_id: sesionAbierta.id, repeticiones: src.repeticiones, orden: nextCarritoOrden(carritoItems) }).select().single()
    if (!newGrp) return
    const newFases = []
    for (const f of src.fases) {
      const { data: nf } = await supabase.from('sesion_fases').insert({ sesion_id: sesionAbierta.id, nombre: f.nombre, descripcion: f.descripcion, volumen_min: f.volumen_min, volumen_km: f.volumen_km, fc_zona: f.fc_zona, ritmo_inicio: f.ritmo_inicio, ritmo_fin: f.ritmo_fin, rpe: f.rpe, orden: f.orden, grupo_id: newGrp.id }).select().single()
      if (nf) newFases.push(nf)
    }
    setCarritoItems(ci => { const idx = ci.findIndex(it => it.id === grupoId); const n = [...ci]; n.splice(idx + 1, 0, { type: 'grupo', ...newGrp, fases: newFases }); return n })
    setDirty(true)
  }

  async function reordenarCarrito(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    setCarritoItems(ci => {
      const n = [...ci]; const [m] = n.splice(fromIdx, 1); n.splice(toIdx, 0, m)
      n.forEach((it, i) => {
        if (it.type === 'fase') supabase.from('sesion_fases').update({ orden: i }).eq('id', it.id)
        else supabase.from('sesion_fase_grupos').update({ orden: i }).eq('id', it.id)
      })
      return n
    })
    setDirty(true)
  }

  async function reordenarFasesEnGrupo(grupoId, fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    setCarritoItems(ci => ci.map(it => {
      if (it.id !== grupoId) return it
      const f = [...it.fases]; const [m] = f.splice(fromIdx, 1); f.splice(toIdx, 0, m)
      f.forEach((fase, i) => supabase.from('sesion_fases').update({ orden: i }).eq('id', fase.id))
      return { ...it, fases: f }
    }))
    setDirty(true)
  }

  // legacy (kept for compatibility with old sessions that call actualizarFase directly)
  async function añadirFase() {
    await añadirBloqueSuelto()
  }
  async function actualizarFase(id, campo, valor) {
    await actualizarBloqueCarrito(id, campo, valor, null)
  }
  async function eliminarFase(id) {
    await eliminarBloqueCarrito(id)
  }

  function abrirNuevaSesion() {
    setFormSesion({ ...EMPTY_SESION, fecha: format(new Date(), 'yyyy-MM-dd') })
    setModalSesion('nueva')
  }

  function abrirEditarSesion(s) {
    setFormSesion({ titulo: s.titulo, fecha: s.fecha || '', sinFecha: !s.fecha, objetivo: s.objetivo || '', duracion_min: s.duracion_min || '', tipo_sesion: s.tipo_sesion || 'programada', estado: s.estado || 'pendiente', tipo_editor: s.tipo_editor || 'fuerza', con_feedback: s.con_feedback !== false, icono: s.icono || '' })
    setModalSesion(s)
  }

  async function guardarEnBiblioteca(sesion) {
    if (!sesion) return
    setGuardandoEnBib(true)
    const { data: nueva } = await supabase.from('sesiones').insert({
      titulo: sesion.titulo, objetivo: sesion.objetivo, duracion_min: sesion.duracion_min,
      icono: sesion.icono, tipo_editor: sesion.tipo_editor || 'fuerza',
      es_plantilla: true, cliente_id: null,
    }).select().single()
    if (nueva) {
      const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', sesion.id).order('orden')
      for (const b of bls || []) {
        const { data: nb } = await supabase.from('sesion_bloques').insert({ sesion_id: nueva.id, nombre: b.nombre, color: b.color, nota: b.nota, orden: b.orden }).select().single()
        const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').eq('bloque_id', b.id).order('orden')
        for (const e of ejs || []) {
          await supabase.from('sesion_ejercicios').insert({ bloque_id: nb.id, nombre: e.nombre, series: e.series, reps: e.reps, rpe: e.rpe, notas: e.notas, media_tipo: e.media_tipo, media_url: e.media_url, video_url: e.video_url, orden: e.orden })
        }
      }
    }
    setGuardandoEnBib(false)
    alert('✅ Sesión guardada en la biblioteca.')
  }

async function guardarSesion() {
    if (!formSesion.titulo) return
    if (!formSesion.sinFecha && !formSesion.fecha) return
    setSaving(true)
    const datos = { titulo: formSesion.titulo, fecha: formSesion.sinFecha ? null : formSesion.fecha, objetivo: formSesion.objetivo || null, duracion_min: formSesion.duracion_min ? parseInt(formSesion.duracion_min) : null, tipo_sesion: formSesion.tipo_sesion || 'programada', estado: formSesion.estado || 'pendiente', tipo_editor: formSesion.tipo_editor || 'fuerza', con_feedback: formSesion.con_feedback !== false, icono: formSesion.icono || null }
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

  function volverAlCalendario() {
    localStorage.setItem('planVista', 'calendario')
    if (setRecargarPlan) setRecargarPlan(r => r + 1)
    if (setClientePlanificacion && clienteSeleccionado) setClientePlanificacion(clienteSeleccionado)
    if (setPage) setPage('planificacion')
    else setSesionAbierta(null)
  }

  async function actualizarBloque(id, campo, valor) {
    await supabase.from('sesion_bloques').update({ [campo]: valor }).eq('id', id)
    setBloques(bs => bs.map(b => b.id === id ? { ...b, [campo]: valor } : b))
    setDirty(true)
  }

  async function cambiarColorBloque(id, color) {
    await supabase.from('sesion_bloques').update({ color }).eq('id', id)
    setBloques(bs => bs.map(b => b.id === id ? { ...b, color } : b))
    setDirty(true)
  }

  async function añadirBloque() {
    const { data: b } = await supabase.from('sesion_bloques').insert({
      sesion_id: sesionAbierta.id, nombre: `Bloque ${bloques.length + 1}`, color: COLORES[bloques.length % COLORES.length], nota: '', orden: bloques.length,
    }).select().single()
    if (b) {
      setBloques(bs => [...bs, b])
      setEjercicios(e => ({ ...e, [b.id]: [] }))
      setDirty(true)
    }
  }

  async function eliminarBloque(id) {
    if (!window.confirm('¿Eliminar este bloque y sus ejercicios?')) return
    await supabase.from('sesion_bloques').delete().eq('id', id)
    setBloques(bs => bs.filter(b => b.id !== id))
    setDirty(true)
  }

  function abrirCrearEjercicio(bloqueId, variablesDefault = []) {
    setFormCrearEj(FORM_CREAR_EJ_EMPTY)
    setErrorCrearEj(null)
    setModalCrearEj({ bloqueId, variablesDefault })
  }

  async function abrirBiblioteca(bloqueId, variablesDefault = []) {
    setModalBiblioteca({ bloqueId, variablesDefault })
    setBusquedaBiblioteca('')
    setBibFiltros({})
    if (!biblioteca) {
      const { data } = await supabase.from('ejercicios_biblioteca').select('*').order('nombre')
      setBiblioteca(data || [])
    }
  }

  async function añadirDesdeBiblioteca(item, bloqueIdOverride, variablesDefaultOverride) {
    const bloqueId = bloqueIdOverride || modalBiblioteca?.bloqueId
    const variablesDefault = variablesDefaultOverride !== undefined ? variablesDefaultOverride : (modalBiblioteca?.variablesDefault || [])
    if (!bloqueId) return
    const lista = ejercicios[bloqueId] || []
    const { data: e } = await supabase.from('sesion_ejercicios').insert({
      bloque_id: bloqueId,
      nombre: item.nombre,
      series: '', reps: '', rpe: '', notas: '',
      media_tipo: item.media_tipo || 'youtube',
      media_url: item.media_url || '',
      video_url: item.video_url || '',
      orden: lista.length,
      variables_activas: variablesDefault,
      biblioteca_id: item.id || null,
    }).select().single()
    if (e) { setEjercicios(ej => ({ ...ej, [bloqueId]: [...(ej[bloqueId] || []), e] })); setDirty(true) }
    if (!bloqueIdOverride) setModalBiblioteca(null)
  }

  async function actualizarEjercicio(bloqueId, id, campo, valor) {
    await supabase.from('sesion_ejercicios').update({ [campo]: valor }).eq('id', id)
    setEjercicios(ej => ({ ...ej, [bloqueId]: (ej[bloqueId] || []).map(e => e.id === id ? { ...e, [campo]: valor } : e) }))
    setDirty(true)
  }

  async function guardarEjercicioPersonalizado() {
    if (!formCrearEj.nombre?.trim()) return
    setGuardandoCrearEj(true)
    setErrorCrearEj(null)
    const { bloqueId } = modalCrearEj

    const camposTags = {}
    for (const campo of CAMPOS_CLASIFICACION) {
      const val = formCrearEj[campo]
      if (val && val.length > 0) camposTags[campo] = val
    }

    const insertBib = {
      nombre: formCrearEj.nombre.trim(),
      ...(formCrearEj.descripcion ? { descripcion: formCrearEj.descripcion } : {}),
      ...(formCrearEj.notas ? { notas: formCrearEj.notas } : {}),
      ...(formCrearEj.ejecucion_tipo ? { ejecucion_tipo: formCrearEj.ejecucion_tipo } : {}),
      ...(formCrearEj.media_tipo ? { media_tipo: formCrearEj.media_tipo } : {}),
      ...(formCrearEj.media_url ? { media_url: formCrearEj.media_url } : {}),
      ...(formCrearEj.video_url ? { video_url: formCrearEj.video_url } : {}),
      ...camposTags,
    }

    const { data: bib, error: bibError } = await supabase
      .from('ejercicios_biblioteca')
      .insert(insertBib)
      .select('id')
      .single()

    if (bibError || !bib) {
      setErrorCrearEj(bibError?.message || 'Error al crear ejercicio en Biblioteca')
      setGuardandoCrearEj(false)
      return
    }

    const orden = (ejercicios[bloqueId] || []).length
    const { data: ejRow, error: ejError } = await supabase
      .from('sesion_ejercicios')
      .insert({
        bloque_id: bloqueId,
        nombre: formCrearEj.nombre.trim(),
        biblioteca_id: bib.id,
        orden,
        ...(formCrearEj.media_tipo ? { media_tipo: formCrearEj.media_tipo } : {}),
        ...(formCrearEj.media_url ? { media_url: formCrearEj.media_url } : {}),
        ...(formCrearEj.video_url ? { video_url: formCrearEj.video_url } : {}),
        ...(formCrearEj.notas ? { notas: formCrearEj.notas } : {}),
        ...(formCrearEj.ejecucion_tipo ? { ejecucion_tipo: formCrearEj.ejecucion_tipo } : {}),
      })
      .select()
      .single()

    if (ejError || !ejRow) {
      await supabase.from('ejercicios_biblioteca').delete().eq('id', bib.id)
      setErrorCrearEj(ejError?.message || 'Error al añadir ejercicio a la sesión')
      setGuardandoCrearEj(false)
      return
    }

    setEjercicios(ej => ({ ...ej, [bloqueId]: [...(ej[bloqueId] || []), ejRow] }))
    setDirty(true)
    setModalCrearEj(null)
    setGuardandoCrearEj(false)
  }

  async function eliminarEjercicio(bloqueId, id) {
    await supabase.from('sesion_ejercicios').delete().eq('id', id)
    setEjercicios(ej => ({ ...ej, [bloqueId]: (ej[bloqueId] || []).filter(e => e.id !== id) }))
    setDirty(true)
  }

  async function pegarSesion(sesionOrigen, fechaDestino, clienteDestino) {
    setSaving(true)
    const { data: nuevaSesion, error: errSesion } = await supabase.from('sesiones').insert({
      cliente_id: clienteDestino,
      titulo: sesionOrigen.titulo,
      fecha: fechaDestino,
      objetivo: sesionOrigen.objetivo,
      duracion_min: sesionOrigen.duracion_min,
      material: sesionOrigen.material,
      indicaciones: sesionOrigen.indicaciones,
      tipo_sesion: sesionOrigen.tipo_sesion || 'programada',
      tipo_editor: sesionOrigen.tipo_editor || 'fuerza',
      con_feedback: sesionOrigen.con_feedback !== false,
      icono: sesionOrigen.icono,
    }).select().single()
    if (errSesion || !nuevaSesion) { alert('Error: ' + (errSesion?.message || errSesion?.code || JSON.stringify(errSesion))); setSaving(false); return }
    // Bloques fuerza
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', sesionOrigen.id).order('orden')
    for (const b of bls || []) {
      const { data: nb } = await supabase.from('sesion_bloques').insert({
        sesion_id: nuevaSesion.id, nombre: b.nombre, color: b.color, nota: b.nota, orden: b.orden,
      }).select().single()
      if (!nb) continue
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').eq('bloque_id', b.id).order('orden')
      for (const e of ejs || []) {
        await supabase.from('sesion_ejercicios').insert({
          bloque_id: nb.id, nombre: e.nombre, series: e.series, reps: e.reps, rpe: e.rpe, notas: e.notas,
          media_tipo: e.media_tipo, media_url: e.media_url, video_url: e.video_url, orden: e.orden,
          variables_activas: e.variables_activas, peso: e.peso, duracion: e.duracion,
          distancia: e.distancia, altura: e.altura, descanso: e.descanso,
          ejecucion_tipo: e.ejecucion_tipo, ejecucion_texto: e.ejecucion_texto,
          peso_der: e.peso_der, peso_izq: e.peso_izq, reps_por_lado: e.reps_por_lado,
        })
      }
    }
    // Bloques carrera (fases sueltas y grupos con repeticiones)
    const { data: grupos, error: errGrupos } = await supabase.from('sesion_fase_grupos').select('*').eq('sesion_id', sesionOrigen.id).order('orden')

    const gruposMap = {}
    for (const g of grupos || []) {
      const { data: ng, error: errNg } = await supabase.from('sesion_fase_grupos').insert({
        sesion_id: nuevaSesion.id, repeticiones: g.repeticiones, orden: g.orden,
      }).select().single()

      if (ng) gruposMap[g.id] = ng.id
    }
    const { data: fasesSrc, error: errFases } = await supabase.from('sesion_fases').select('*').eq('sesion_id', sesionOrigen.id).order('orden')

    for (const f of fasesSrc || []) {
      const { error: errF } = await supabase.from('sesion_fases').insert({
        sesion_id: nuevaSesion.id,
        grupo_id: f.grupo_id ? (gruposMap[f.grupo_id] ?? null) : null,
        nombre: f.nombre, descripcion: f.descripcion,
        volumen_min: f.volumen_min, volumen_km: f.volumen_km,
        fc_zona: f.fc_zona, ritmo_inicio: f.ritmo_inicio, ritmo_fin: f.ritmo_fin,
        rpe: f.rpe, orden: f.orden,
      })
      if (errF) console.error('[copy] error fase insert:', errF)
    }
    setSaving(false)
    if (clienteDestino !== clienteSeleccionado) setClienteSeleccionado(clienteDestino)
    else cargarSesiones()
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
    // Bloques carrera
    const { data: grupos } = await supabase.from('sesion_fase_grupos').select('*').eq('sesion_id', s.id).order('orden')
    const gruposMap = {}
    for (const g of grupos || []) {
      const { data: ng } = await supabase.from('sesion_fase_grupos').insert({
        sesion_id: nuevaSesion.id, repeticiones: g.repeticiones, orden: g.orden,
      }).select().single()
      if (ng) gruposMap[g.id] = ng.id
    }
    const { data: fasesSrc } = await supabase.from('sesion_fases').select('*').eq('sesion_id', s.id).order('orden')
    for (const f of fasesSrc || []) {
      await supabase.from('sesion_fases').insert({
        sesion_id: nuevaSesion.id,
        grupo_id: f.grupo_id ? (gruposMap[f.grupo_id] ?? null) : null,
        nombre: f.nombre, descripcion: f.descripcion,
        volumen_min: f.volumen_min, volumen_km: f.volumen_km,
        fc_zona: f.fc_zona, ritmo_inicio: f.ritmo_inicio, ritmo_fin: f.ritmo_fin,
        rpe: f.rpe, orden: f.orden,
      })
    }
    setSaving(false)
    cargarSesiones()
  }

  async function guardarPack() {
    setSavingPack(true)
    if (modalPack?.id) {
      await supabase.from('packs_flexibles').update({ nombre: formPack.nombre, fecha_inicio: formPack.fecha_inicio, fecha_fin: formPack.fecha_fin, descripcion: formPack.descripcion || null }).eq('id', modalPack.id)
    } else {
      await supabase.from('packs_flexibles').insert({ cliente_id: clienteSeleccionado, nombre: formPack.nombre, fecha_inicio: formPack.fecha_inicio, fecha_fin: formPack.fecha_fin, descripcion: formPack.descripcion || null })
    }
    setSavingPack(false); setModalPack(null); cargarSesiones()
  }

  function copiarEnlacePack(pack) {
    const url = `${window.location.origin}/pack/${pack.token_publico}`
    navigator.clipboard.writeText(url).catch(() => {})
    alert(`Enlace del pack copiado:\n${url}`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Sesiones</h2>
          {sesionAbierta && <p className="page-subtitle">{sesionAbierta.titulo}</p>}
        </div>
        {clienteSeleccionado && !sesionAbierta && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => { setFormPack({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' }); setModalPack('nuevo') }}>📦 Nuevo pack flexible</button>
            <button className="btn btn-primary" onClick={abrirNuevaSesion}><Plus size={13} /> Nueva sesión</button>
          </div>
        )}
        {sesionAbierta && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setVistaPrevia(v => !v)}>{vistaPrevia ? '✏️ Editor' : '👁 Vista cliente'}</button>
            <button className="btn btn-ghost btn-sm" style={{ color: panelBiblioteca ? 'var(--accent)' : undefined }} onClick={async () => { if (!biblioteca) { const { data } = await supabase.from('ejercicios_biblioteca').select('*').order('nombre'); setBiblioteca(data || []) } if (!panelBiblioteca && bloquesBiblioteca === null) cargarBloquesBiblioteca(); setPanelBiblioteca(v => !v) }}>📚 Biblioteca</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setModalDuplicar(sesionAbierta); setFechaDuplicar(format(new Date(), 'yyyy-MM-dd')) }}>📋 Duplicar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => guardarEnBiblioteca(sesionAbierta)} disabled={guardandoEnBib} title="Guardar una copia en la biblioteca de sesiones">
              {guardandoEnBib ? '⏳' : '📚'} {guardandoEnBib ? 'Guardando...' : 'Guardar en biblioteca'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarSesion(sesionAbierta)}>Editar sesión</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              if (dirty) { setAvisoSinGuardar(true) }
              else { volverAlCalendario() }
            }}>← Volver</button>
            <button className="btn btn-primary btn-sm" style={{ minWidth: 90, background: guardadoOk ? '#16a34a' : undefined, borderColor: guardadoOk ? '#16a34a' : undefined }} onClick={() => { setDirty(false); setAvisoSinGuardar(false); setGuardadoOk(true); setTimeout(() => setGuardadoOk(false), 2500) }}>{guardadoOk ? '✓ Guardado' : 'Guardar'}</button>
          </div>
        )}
        {avisoSinGuardar && (
          <div style={{ margin: '8px 0 0', padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#713f12' }}>
            <span>⚠️ Tienes cambios sin guardar. Pulsa <strong>Guardar</strong> para confirmarlos.</span>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#713f12' }} onClick={() => { setAvisoSinGuardar(false); volverAlCalendario() }}>Salir sin guardar</button>
            <button className="btn btn-primary btn-sm" style={{ minWidth: 90, background: guardadoOk ? '#16a34a' : undefined, borderColor: guardadoOk ? '#16a34a' : undefined }} onClick={() => { setDirty(false); setAvisoSinGuardar(false); setGuardadoOk(true); setTimeout(() => setGuardadoOk(false), 2500) }}>{guardadoOk ? '✓ Guardado' : 'Guardar'}</button>
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
          {packs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Packs flexibles</div>
              {packs.map(pack => (
                <div key={pack.id} className="card" style={{ marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📦</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{pack.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pack.fecha_inicio} – {pack.fecha_fin}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" title="Compartir con cliente" onClick={() => copiarEnlacePack(pack)}>🔗 Compartir</button>
                  <button className="btn btn-ghost btn-sm" title="Editar pack" onClick={() => { setFormPack({ nombre: pack.nombre, fecha_inicio: pack.fecha_inicio, fecha_fin: pack.fecha_fin, descripcion: pack.descripcion || '' }); setModalPack(pack) }}>✏️</button>
                </div>
              ))}
            </div>
          )}
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

      {toastCopiado && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#065f46', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
          📋 Bloque copiado: "{toastCopiado}"
        </div>
      )}

      {sesionAbierta && (
        <div style={{ paddingRight: panelBiblioteca ? 306 : 0, transition: 'padding-right 0.2s' }}>
        <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Objetivo general</div>
            <InlineInput
              value={sesionAbierta.objetivo}
              placeholder="Ej: Seguir construyendo base de movilidad y fuerza general..."
              textarea
              fontSize={13}
              onSave={async v => { await supabase.from('sesiones').update({ objetivo: v || null }).eq('id', sesionAbierta.id); setSesionAbierta(s => ({ ...s, objetivo: v })); setDirty(true) }}
            />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>🎒 Material necesario</div>
            <InlineInput
              value={sesionAbierta.material}
              placeholder="Ej: Esterilla, discos y mancuernas, goma (resistencia baja)..."
              textarea
              fontSize={13}
              onSave={async v => { await supabase.from('sesiones').update({ material: v || null }).eq('id', sesionAbierta.id); setSesionAbierta(s => ({ ...s, material: v })); setDirty(true) }}
            />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>✏️ Indicaciones generales</div>
            <InlineInput
              value={sesionAbierta.indicaciones}
              placeholder="Ej: Realiza los ejercicios del bloque en orden, las series que toquen y pasa al siguiente..."
              textarea
              fontSize={13}
              onSave={async v => { await supabase.from('sesiones').update({ indicaciones: v || null }).eq('id', sesionAbierta.id); setSesionAbierta(s => ({ ...s, indicaciones: v })); setDirty(true) }}
            />
          </div>

          {/* ── EDITOR CARRERA ── */}
          {sesionAbierta.tipo_editor === 'carrera' && (() => {
            const FC_COLORS = ['#10b981','#84cc16','#f59e0b','#ef4444','#7c3aed']
            function rpeC(r) { return !r ? 'var(--text3)' : r <= 4 ? '#10b981' : r <= 6 ? '#f59e0b' : '#ef4444' }

            // Expanded blocks for chart (repetitions unrolled)
            const expanded = []
            carritoItems.forEach(item => {
              if (item.type === 'fase') expanded.push({ ...item, grupoId: null })
              else for (let r = 0; r < item.repeticiones; r++) item.fases.forEach(f => expanded.push({ ...f, grupoId: item.id }))
            })
            const widths = expanded.map(b => (b.volumen_min || 0) > 0 ? b.volumen_min : (b.volumen_km || 0) > 0 ? b.volumen_km * 2.5 : 2)
            const totalW = widths.reduce((a, b) => a + b, 0) || 1
            const maxH = 60

            // Totals
            const totMin = carritoItems.reduce((acc, it) => it.type === 'fase' ? acc + (it.volumen_min || 0) : acc + it.repeticiones * it.fases.reduce((a, f) => a + (f.volumen_min || 0), 0), 0)
            const totKm  = carritoItems.reduce((acc, it) => it.type === 'fase' ? acc + (it.volumen_km  || 0) : acc + it.repeticiones * it.fases.reduce((a, f) => a + (f.volumen_km  || 0), 0), 0)

            // Group bracket positions
            const groupPos = {}
            let cx = 0
            expanded.forEach((b, i) => {
              const w = Math.max(4, Math.round((widths[i] / totalW) * 560))
              if (b.grupoId) {
                if (!groupPos[b.grupoId]) groupPos[b.grupoId] = { startX: cx, endX: cx + w, grp: carritoItems.find(g => g.id === b.grupoId) }
                else groupPos[b.grupoId].endX = cx + w
              }
              cx += w + 2
            })

            function renderFaseFields(f, grupoId) {
              const rColor = rpeC(f.rpe)
              return (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>Descripción</div>
                    <InlineInput value={f.descripcion || ''} placeholder="Describe este bloque..." textarea fontSize={12.5}
                      onSave={v => actualizarBloqueCarrito(f.id, 'descripcion', v || null, grupoId)} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>Duración / Distancia</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <InlineInput value={f.volumen_min != null ? String(f.volumen_min) : ''} placeholder="min" fontSize={12} style={{ width: 40 }}
                          onSave={v => actualizarBloqueCarrito(f.id, 'volumen_min', v ? parseInt(v) : null, grupoId)} />
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>min</span>
                        <span style={{ fontSize: 11, color: 'var(--border)' }}>/</span>
                        <InlineInput value={f.volumen_km != null ? String(f.volumen_km) : ''} placeholder="km" fontSize={12} style={{ width: 40 }}
                          onSave={v => actualizarBloqueCarrito(f.id, 'volumen_km', v ? parseFloat(v) : null, grupoId)} />
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>km</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>Ritmo (min/km)</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <InlineInput value={f.ritmo_inicio || ''} placeholder="4:00" fontSize={12} style={{ width: 44 }}
                          onSave={v => actualizarBloqueCarrito(f.id, 'ritmo_inicio', v || null, grupoId)} />
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>–</span>
                        <InlineInput value={f.ritmo_fin || ''} placeholder="4:30" fontSize={12} style={{ width: 44 }}
                          onSave={v => actualizarBloqueCarrito(f.id, 'ritmo_fin', v || null, grupoId)} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>FC zona</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1,2,3,4,5].map(z => (
                          <button key={z} title={`Zona ${z}`} onClick={() => actualizarBloqueCarrito(f.id, 'fc_zona', f.fc_zona === z ? null : z, grupoId)}
                            style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${f.fc_zona >= z ? FC_COLORS[z-1] : 'var(--border)'}`, background: f.fc_zona >= z ? FC_COLORS[z-1] : 'var(--bg)', fontSize: 9, fontWeight: 700, color: f.fc_zona >= z ? '#fff' : 'var(--text3)', cursor: 'pointer' }}>{z}</button>
                        ))}
                      </div>
                      {f.fc_zona && <div style={{ fontSize: 10, color: FC_COLORS[f.fc_zona - 1], marginTop: 2 }}>Zona {f.fc_zona}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 4 }}>RPE (1-10)</div>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <button key={n} title={`${n} – ${BORG_RPE[n]}`} onClick={() => actualizarBloqueCarrito(f.id, 'rpe', f.rpe === n ? null : n, grupoId)}
                            style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${f.rpe === n ? rColor : 'var(--border)'}`, background: f.rpe === n ? rColor : 'var(--bg)', color: f.rpe === n ? '#fff' : 'var(--text3)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                        ))}
                      </div>
                      {f.rpe && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: rColor }}>{f.rpe} – {BORG_RPE[f.rpe]}</div>}
                    </div>
                  </div>

                  {/* ── PENDIENTE / DESNIVEL ── */}
                  {(() => {
                    const PEND = {
                      llano:      { label: 'Llano',      ref: '0–1 %',   desc: 'Desplazamiento prácticamente natural. La inclinación apenas condiciona la técnica ni aumenta la exigencia respecto al llano.' },
                      suave:      { label: 'Suave',      ref: '2–4 %',   desc: 'Perceptible pero fluida. Aumenta ligeramente la exigencia muscular y cardiovascular.' },
                      moderado:   { label: 'Moderado',   ref: '5–7 %',   desc: 'Condiciona claramente el desplazamiento. Obliga a reducir algo el ritmo y aumenta de forma clara el trabajo de piernas.' },
                      fuerte:     { label: 'Fuerte',     ref: '8–12 %',  desc: 'Subida exigente. El ritmo debe reducirse claramente y aumenta mucho la demanda muscular y cardiovascular.' },
                      muy_fuerte: { label: 'Muy fuerte', ref: '>12 %',   desc: 'Pendiente muy pronunciada. Adecuada para esfuerzos cortos o trote muy lento. Mantener carrera continua puede ser muy exigente.' },
                    }
                    function inferirNivelPct(min, max) {
                      if (min == null) return null
                      const v = max != null ? (Number(min) + Number(max)) / 2 : Number(min)
                      if (v <= 1) return [{ key: 'llano', label: 'Llano' }]
                      if (v <= 4) return [{ key: 'suave', label: 'Suave' }]
                      if (v <= 7) return [{ key: 'moderado', label: 'Moderado' }]
                      if (v <= 12) return [{ key: 'fuerte', label: 'Fuerte' }]
                      return [{ key: 'muy_fuerte', label: 'Muy fuerte' }]
                    }
                    function inferirNivelRango(min, max) {
                      if (min == null || max == null) return inferirNivelPct(min, max)
                      const lo = inferirNivelPct(min, null)?.[0]?.key
                      const hi = inferirNivelPct(max, null)?.[0]?.key
                      if (lo === hi) return [{ key: lo, label: PEND[lo]?.label }]
                      return [{ key: lo, label: PEND[lo]?.label }, { key: hi, label: PEND[hi]?.label }]
                    }
                    const hasPendiente = f.pendiente_cualitativa || f.pendiente_pct_min != null
                    const [pendOpen, setPendOpen] = [hasPendiente, () => {}] // always open if has value
                    const niveles = inferirNivelRango(f.pendiente_pct_min, f.pendiente_pct_max)
                    const mostrarRefPct = f.pendiente_pct_min != null && niveles
                    const mostrarCueCinta = f.pendiente_pct_min != null && Number(f.pendiente_pct_min) >= 6

                    const [showPendForm, setShowPendForm] = [hasPendiente, (v) => {
                      if (!v) {
                        actualizarBloqueCarrito(f.id, 'pendiente_cualitativa', null, grupoId)
                        actualizarBloqueCarrito(f.id, 'pendiente_pct_min', null, grupoId)
                        actualizarBloqueCarrito(f.id, 'pendiente_pct_max', null, grupoId)
                      }
                    }]

                    return (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasPendiente ? 8 : 0 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Pendiente / Desnivel</div>
                          <div style={{ position: 'relative', display: 'inline-block' }} className="tooltip-parent">
                            <span style={{ fontSize: 11, color: 'var(--text3)', cursor: 'help', border: '1px solid var(--border)', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>i</span>
                            <div className="tooltip-content" style={{ position: 'absolute', left: 0, top: 18, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, width: 240, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', display: 'none' }}>
                              La pendiente indica la inclinación del terreno, no la intensidad total del ejercicio. Una misma pendiente puede resultar muy diferente según el ritmo, la duración y el nivel del deportista. Usa la opción cualitativa para indicar el tipo de terreno y el porcentaje cuando necesites una referencia más precisa, especialmente en cinta.
                            </div>
                          </div>
                          {!hasPendiente && (
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text3)', marginLeft: 4 }}
                              onClick={() => actualizarBloqueCarrito(f.id, 'pendiente_cualitativa', 'moderado', grupoId)}>
                              + Añadir
                            </button>
                          )}
                          {hasPendiente && (
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--text3)', marginLeft: 'auto' }}
                              onClick={() => { actualizarBloqueCarrito(f.id, 'pendiente_cualitativa', null, grupoId); actualizarBloqueCarrito(f.id, 'pendiente_pct_min', null, grupoId); actualizarBloqueCarrito(f.id, 'pendiente_pct_max', null, grupoId) }}>
                              × quitar
                            </button>
                          )}
                        </div>

                        {hasPendiente && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Pills cualitativo */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {Object.entries(PEND).map(([k, p]) => {
                                const sel = f.pendiente_cualitativa === k
                                return (
                                  <button key={k} onClick={() => actualizarBloqueCarrito(f.id, 'pendiente_cualitativa', sel ? null : k, grupoId)}
                                    style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: sel ? 700 : 400, border: `1.5px solid ${sel ? '#6366f1' : 'var(--border)'}`, background: sel ? '#6366f1' : 'var(--bg)', color: sel ? '#fff' : 'var(--text2)', cursor: 'pointer', transition: 'all 0.12s' }}>
                                    {p.label}
                                  </button>
                                )
                              })}
                            </div>
                            {/* Descripción del nivel seleccionado */}
                            {f.pendiente_cualitativa && PEND[f.pendiente_cualitativa] && (
                              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, fontStyle: 'italic', paddingLeft: 2 }}>
                                Ref. {PEND[f.pendiente_cualitativa].ref} — {PEND[f.pendiente_cualitativa].desc}
                              </div>
                            )}
                            {/* Porcentaje */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>%</span>
                              <InlineInput value={f.pendiente_pct_min != null ? String(f.pendiente_pct_min) : ''} placeholder="min" fontSize={12} style={{ width: 38 }}
                                onSave={v => actualizarBloqueCarrito(f.id, 'pendiente_pct_min', v !== '' && v != null ? parseFloat(v) : null, grupoId)} />
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>–</span>
                              <InlineInput value={f.pendiente_pct_max != null ? String(f.pendiente_pct_max) : ''} placeholder="max" fontSize={12} style={{ width: 38 }}
                                onSave={v => actualizarBloqueCarrito(f.id, 'pendiente_pct_max', v !== '' && v != null ? parseFloat(v) : null, grupoId)} />
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>%</span>
                            </div>
                            {/* Referencia orientativa del % */}
                            {mostrarRefPct && !f.pendiente_cualitativa && (
                              <div style={{ fontSize: 11, color: '#6366f1', fontStyle: 'italic', paddingLeft: 2 }}>
                                Referencia orientativa: {niveles.map(n => n.label).join('–').toLowerCase()}
                              </div>
                            )}
                            {/* Cue cinta */}
                            {mostrarCueCinta && (
                              <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.5, paddingLeft: 2, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                                💡 Selecciona una pendiente que puedas mantener con técnica estable y sin agarrarte a la cinta.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            }

            // Summary text
            function fmtV(it) { const p = []; if (it.volumen_min) p.push(`${it.volumen_min}'`); if (it.volumen_km) p.push(`${it.volumen_km}km`); return p.join('+') || '—' }
            function fmtR(it) { return it.ritmo_inicio ? (it.ritmo_fin ? ` @${it.ritmo_inicio}–${it.ritmo_fin}` : ` @${it.ritmo_inicio}`) : '' }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ── GRÁFICA ── */}
                <div className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    Estructura de la sesión
                    <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text3)' }}>Clic dcho. → opciones</span>
                  </div>
                  <div style={{ position: 'relative', height: 86, display: 'flex', alignItems: 'flex-end', gap: 2, paddingBottom: 26 }}
                    onContextMenu={e => e.preventDefault()}>
                    {expanded.map((b, i) => {
                      const zona = b.fc_zona || 1
                      const h = Math.round((zona / 5) * maxH)
                      const w = Math.max(4, Math.round((widths[i] / totalW) * 560))
                      const color = FC_COLORS[zona - 1]
                      return (
                        <div key={i} style={{ position: 'relative', flexShrink: 0, width: w, height: h, background: color, opacity: b.grupoId ? 0.72 : 0.92, borderRadius: '3px 3px 0 0', cursor: 'context-menu', transition: 'opacity 0.12s' }}
                          title={`${b.nombre || 'Bloque'} — Z${zona}${b.volumen_min ? ` · ${b.volumen_min}min` : ''}${b.volumen_km ? ` · ${b.volumen_km}km` : ''}`}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = b.grupoId ? '0.72' : '0.92'}
                          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxCarrito({ x: e.clientX, y: e.clientY, item: b, grupoId: b.grupoId }) }} />
                      )
                    })}
                    {/* Group brackets */}
                    {Object.entries(groupPos).map(([gid, pos]) => (
                      <div key={gid} style={{ position: 'absolute', bottom: 0, left: pos.startX, width: pos.endX - pos.startX, pointerEvents: 'none' }}>
                        <div style={{ height: 6, border: '1.5px solid #4C82E8', borderTop: 'none', borderRadius: '0 0 4px 4px', marginBottom: 2 }} />
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#4C82E8', textAlign: 'center', fontFamily: 'var(--mono)' }}>{pos.grp?.repeticiones}×</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[['#10b981','Z1'],['#84cc16','Z2'],['#f59e0b','Z3'],['#ef4444','Z4'],['#7c3aed','Z5']].map(([c, l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}
                      </div>
                    ))}
                    {(totMin > 0 || totKm > 0) && <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                      {totMin > 0 && `${totMin} min`}{totMin > 0 && totKm > 0 && ' · '}{totKm > 0 && `${totKm.toFixed(1)} km`}
                    </div>}
                  </div>
                </div>

                {/* ── BLOQUES ── */}
                {carritoItems.map((item, idx) => {
                  if (item.type === 'fase') {
                    const zColor = item.fc_zona ? FC_COLORS[item.fc_zona - 1] : 'var(--border)'
                    return (
                      <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${zColor}`, cursor: 'default' }}
                        draggable onDragStart={() => setDraggingCarrito({ idx })} onDragEnd={() => setDraggingCarrito(null)}
                        onDragOver={e => e.preventDefault()} onDrop={() => { if (draggingCarrito && draggingCarrito.idx !== idx) reordenarCarrito(draggingCarrito.idx, idx) }}>
                        <div style={{ padding: '10px 14px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text3)', cursor: 'grab', fontSize: 14, userSelect: 'none' }}>⠿</span>
                          <div style={{ flex: 1 }}>
                            <InlineInput value={item.nombre || ''} placeholder="Nombre del bloque..." fontSize={13} style={{ fontWeight: 600 }}
                              onSave={v => actualizarBloqueCarrito(item.id, 'nombre', v, null)} />
                          </div>
                          <button className="btn btn-ghost btn-sm" title="Duplicar" onClick={() => duplicarBloqueCarrito(item.id, null)} style={{ color: 'var(--text3)' }}><Copy size={12} /></button>
                          <button className="btn btn-ghost btn-sm" title="Copiar bloque a otra sesión" onClick={() => copiarFase(item)} style={{ color: 'var(--text3)', fontSize: 11 }}>📋</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloqueCarrito(item.id)}><Trash2 size={12} /></button>
                        </div>
                        {renderFaseFields(item, null)}
                      </div>
                    )
                  }
                  // GRUPO
                  return (
                    <div key={item.id} style={{ border: '2px solid #4C82E8', borderRadius: 12, background: '#f5f8ff', overflow: 'hidden' }}
                      draggable onDragStart={() => setDraggingCarrito({ idx })} onDragEnd={() => setDraggingCarrito(null)}
                      onDragOver={e => e.preventDefault()} onDrop={() => { if (draggingCarrito && draggingCarrito.idx !== idx) reordenarCarrito(draggingCarrito.idx, idx) }}>
                      {/* Group header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#eef2ff', borderBottom: '1px solid #dde6ff' }}>
                        <span style={{ color: '#8fa8e8', cursor: 'grab', fontSize: 14, userSelect: 'none' }}>⠿</span>
                        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#4C82E8', flex: 1 }}>Repetir</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => cambiarRepeticionesGrupo(item.id, -1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1.5px solid #4C82E8', background: '#fff', color: '#4C82E8', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>−</button>
                          <span style={{ fontSize: 18, fontWeight: 900, color: '#4C82E8', minWidth: 24, textAlign: 'center', fontFamily: 'var(--mono)' }}>{item.repeticiones}</span>
                          <button onClick={() => cambiarRepeticionesGrupo(item.id, +1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1.5px solid #4C82E8', background: '#fff', color: '#4C82E8', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                          <span style={{ fontSize: 11, color: '#7a98d8', fontWeight: 600 }}>veces</span>
                        </div>
                        <button className="btn btn-ghost btn-sm" title="Duplicar grupo" onClick={() => duplicarGrupoCarrito(item.id)} style={{ color: '#4C82E8' }}><Copy size={12} /></button>
                        <button className="btn btn-ghost btn-sm" title="Copiar grupo a otra sesión" onClick={() => copiarGrupo(item)} style={{ color: '#4C82E8', fontSize: 11 }}>📋</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarGrupoCarrito(item.id)}><Trash2 size={12} /></button>
                      </div>
                      {/* Fases dentro del grupo */}
                      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {item.fases.map((f, fi) => {
                          const zColor = f.fc_zona ? FC_COLORS[f.fc_zona - 1] : '#dde6ff'
                          return (
                            <div key={f.id} style={{ background: '#fff', border: '1.5px solid #dde6ff', borderLeft: `4px solid ${zColor}`, borderRadius: 10, overflow: 'hidden' }}
                              draggable onDragStart={e => { e.stopPropagation(); setDraggingCarrito({ idx, grupoId: item.id, innerIdx: fi }) }}
                              onDragEnd={() => setDraggingCarrito(null)}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.stopPropagation(); if (draggingCarrito?.grupoId === item.id && draggingCarrito.innerIdx !== fi) reordenarFasesEnGrupo(item.id, draggingCarrito.innerIdx, fi) }}>
                              <div style={{ padding: '8px 12px', background: '#f5f8ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#8fa8e8', cursor: 'grab', fontSize: 12, userSelect: 'none' }}>⠿</span>
                                <div style={{ flex: 1 }}>
                                  <InlineInput value={f.nombre || ''} placeholder="Nombre..." fontSize={12.5} style={{ fontWeight: 600 }}
                                    onSave={v => actualizarBloqueCarrito(f.id, 'nombre', v, item.id)} />
                                </div>
                                <button className="btn btn-ghost btn-sm" title="Duplicar" onClick={() => duplicarBloqueCarrito(f.id, item.id)} style={{ color: 'var(--text3)' }}><Copy size={11} /></button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarFaseDeGrupoCarrito(f.id, item.id)}><Trash2 size={11} /></button>
                              </div>
                              {renderFaseFields(f, item.id)}
                            </div>
                          )
                        })}
                        <button className="btn btn-ghost btn-sm" onClick={() => añadirFaseAGrupoCarrito(item.id)} style={{ border: '1.5px dashed #a8bcf0', borderRadius: 8, color: '#7a98d8', alignSelf: 'stretch', justifyContent: 'center' }}>
                          <Plus size={12} /> Añadir bloque al grupo
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* ── BOTONES AÑADIR ── */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" onClick={añadirBloqueSuelto} style={{ flex: 1, justifyContent: 'center', border: '1.5px dashed var(--border)' }}>
                    <Plus size={13} /> Añadir bloque
                  </button>
                  <button className="btn btn-ghost" onClick={añadirGrupoCarrera} style={{ flex: 1, justifyContent: 'center', border: '1.5px solid #c8d8f8', background: '#eef2ff', color: '#4C82E8' }}>
                    <Plus size={13} /> Añadir grupo de repeticiones
                  </button>
                  {clipboardBloque && (
                    <button className="btn btn-ghost" onClick={pegarDesdePortapapeles} style={{ flex: 1, justifyContent: 'center', border: '1.5px solid #d1fae5', background: '#ecfdf5', color: '#065f46', minWidth: 160 }}
                      title={`Pegar: "${clipboardBloque.nombre}"`}>
                      📋 Pegar: <em style={{ marginLeft: 4, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clipboardBloque.nombre}</em>
                      <button onClick={e => { e.stopPropagation(); limpiarPortapapeles() }} style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#065f46', lineHeight: 1 }}>×</button>
                    </button>
                  )}
                </div>

                {/* ── RESUMEN ── */}
                {carritoItems.length > 0 && (
                  <div className="card" style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Resumen</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.9 }}>
                      {carritoItems.map((it, i) => it.type === 'fase'
                        ? <div key={i}>{fmtV(it)}{fmtR(it)}{it.fc_zona ? ` Z${it.fc_zona}` : ''}{it.rpe ? ` RPE${it.rpe}` : ''}</div>
                        : <div key={i}>
                            <span style={{ color: '#4C82E8', fontWeight: 700 }}>{it.repeticiones} × (</span>
                            {it.fases.map((f, fi) => <div key={fi} style={{ paddingLeft: 16, color: 'var(--text3)' }}>+ {fmtV(f)}{fmtR(f)}{f.fc_zona ? ` Z${f.fc_zona}` : ''}{f.rpe ? ` RPE${f.rpe}` : ''}</div>)}
                            <span style={{ color: '#4C82E8', fontWeight: 700 }}>)</span>
                          </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── MENÚ CONTEXTUAL (gráfica) ── */}
                {ctxCarrito && (
                  <div style={{ position: 'fixed', top: ctxCarrito.y, left: ctxCarrito.x, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.15)', zIndex: 9999, minWidth: 170, overflow: 'hidden' }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '5px 14px 3px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {ctxCarrito.item.nombre || 'Bloque'}
                    </div>
                    {[
                      { label: '⎘ Duplicar bloque', action: () => { duplicarBloqueCarrito(ctxCarrito.item.id, ctxCarrito.grupoId); setCtxCarrito(null) } },
                      ctxCarrito.grupoId ? { label: '⎘ Duplicar grupo', action: () => { duplicarGrupoCarrito(ctxCarrito.grupoId); setCtxCarrito(null) } } : null,
                      ctxCarrito.grupoId ? { label: '+ Más repeticiones', action: () => { cambiarRepeticionesGrupo(ctxCarrito.grupoId, +1); setCtxCarrito(null) } } : null,
                      ctxCarrito.grupoId ? { label: '− Menos repeticiones', action: () => { cambiarRepeticionesGrupo(ctxCarrito.grupoId, -1); setCtxCarrito(null) } } : null,
                      { sep: true },
                      { label: '× Eliminar bloque', danger: true, action: () => { ctxCarrito.grupoId ? eliminarFaseDeGrupoCarrito(ctxCarrito.item.id, ctxCarrito.grupoId) : eliminarBloqueCarrito(ctxCarrito.item.id); setCtxCarrito(null) } },
                      ctxCarrito.grupoId ? { label: '× Eliminar grupo', danger: true, action: () => { eliminarGrupoCarrito(ctxCarrito.grupoId); setCtxCarrito(null) } } : null,
                    ].filter(Boolean).map((opt, i) => opt.sep
                      ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
                      : <button key={i} onClick={opt.action} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '9px 14px', fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer', color: opt.danger ? 'var(--danger)' : 'var(--text)', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>{opt.label}</button>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── EDITOR FUERZA ── */}
          {sesionAbierta.tipo_editor !== 'carrera' && !vistaPrevia && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bloques.map((b, idx) => {
              const VARS_MENU = [
                { grupo: 'Carga', items: ['Peso','Peso/lado','Duración','RIR','Distancia','Altura'] },
                { grupo: 'Ejecución', items: ['Descanso','Forma de ejecución'] },
                { grupo: 'Notas', items: ['Indicaciones'] },
              ]
              async function toggleVariable(ej, varName) {
                const current = ej.variables_activas || []
                const next = current.includes(varName)
                  ? current.filter(v => v !== varName)
                  : [...current, varName]
                await actualizarEjercicio(b.id, ej.id, 'variables_activas', next)
              }
              const varsDefault = b.variables_default || []
              const TODAS_VARS = ['Peso','Peso/lado','Duración','RIR','Distancia','Altura','Descanso','Forma de ejecución','Indicaciones']
              return (
              <div key={b.id} className="card" draggable
                onDragStart={e => { setDraggingBloqueId(b.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { setDraggingBloqueId(null); setDragOverBloqueId(null) }}
                style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || COLORES[0]}`, opacity: draggingBloqueId === b.id ? 0.45 : 1, outline: dragOverBloqueId === b.id ? `2px solid ${b.color || 'var(--accent)'}` : 'none', outlineOffset: 2, transition: 'opacity 0.15s' }}
                onDragOver={e => { e.preventDefault(); if (libDragActive) { e.dataTransfer.dropEffect = 'copy'; setDragOverBloqueId(b.id) } else if (draggingBloqueId && draggingBloqueId !== b.id) { e.dataTransfer.dropEffect = 'move'; setDragOverBloqueId(b.id) } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverBloqueId(null) }}
                onDrop={e => {
                  e.preventDefault(); setDragOverBloqueId(null)
                  if (libDragActive) {
                    try { const d = JSON.parse(e.dataTransfer.getData('application/json')); if (d.tipo === 'ejercicio_bib') insertarEjercicioDesdePanel(d.item, b.id) } catch {}
                  } else if (draggingBloqueId && draggingBloqueId !== b.id) {
                    reordenarBloques(draggingBloqueId, b.id)
                  }
                }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--text3)', cursor: 'grab', fontSize: 14, userSelect: 'none', flexShrink: 0 }}>⠿</span>
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
                  <button className="btn btn-ghost btn-sm" title="Guardar en biblioteca de bloques" onClick={() => guardarBloqueEnBiblioteca(b)} style={{ color: 'var(--text3)', fontSize: 11 }}>🧱</button>
                  <button className="btn btn-ghost btn-sm" title="Copiar bloque a otra sesión" onClick={() => copiarBloqueFuerza(b)} style={{ color: 'var(--text3)', fontSize: 11 }}>📋</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><Trash2 size={12} /></button>
                </div>
                <div style={{ padding: '0 16px 8px', fontSize: 12.5, color: 'var(--text2)' }}>
                  <InlineInput value={b.nota} placeholder="Nota del bloque (opcional)..." textarea fontSize={12.5}
                    onSave={v => actualizarBloque(b.id, 'nota', v)} />
                </div>
                <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 2 }}>Variables por defecto:</span>
                  {TODAS_VARS.map(v => {
                    const activa = varsDefault.includes(v)
                    return (
                      <button key={v} onClick={async () => {
                        const next = activa ? varsDefault.filter(x => x !== v) : [...varsDefault, v]
                        await actualizarBloque(b.id, 'variables_default', next)
                        setBloques(bs => bs.map(bl => bl.id === b.id ? { ...bl, variables_default: next } : bl))
                      }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: `1.5px solid ${activa ? b.color || COLORES[0] : 'var(--border)'}`, background: activa ? (b.color || COLORES[0]) + '22' : 'transparent', color: activa ? b.color || COLORES[0] : 'var(--text3)', cursor: 'pointer', fontWeight: activa ? 600 : 400 }}>
                        {v}
                      </button>
                    )
                  })}
                </div>
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(ejercicios[b.id] || []).map((e, eIdx) => {
                    const ytid = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
                    const thumb = e.media_tipo === 'youtube' && ytid ? `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` : (e.media_tipo !== 'youtube' ? e.media_url : null)
                    const activas = e.variables_activas || []
                    const menuKey = `${b.id}-${e.id}`
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
                        style={{ padding: '10px', background: draggingEj?.e?.id === e.id ? 'var(--bg2)' : 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'grab' }}>
                        {/* ROW: drag handle + name + delete */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{idx + 1}.{eIdx + 1}.</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <InlineInput value={e.nombre} placeholder="Nombre del ejercicio" fontSize={13} style={{ fontWeight: 600 }}
                                onSave={v => actualizarEjercicio(b.id, e.id, 'nombre', v)} />
                            </div>
                          </div>
                          {thumb && (
                            <div style={{ width: 48, height: 48, borderRadius: 7, flexShrink: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                              <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => eliminarEjercicio(b.id, e.id)}><X size={12} /></button>
                        </div>

                        {/* Series + Reps (siempre visibles) */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Series</span>
                            <div style={{ width: 36 }}><InlineInput value={e.series} placeholder="—" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, 'series', v)} /></div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Reps</span>
                            <div style={{ width: 60 }}><InlineInput value={e.reps} placeholder="—" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, 'reps', v)} /></div>
                            <button
                              onClick={() => actualizarEjercicio(b.id, e.id, 'reps_por_lado', !e.reps_por_lado)}
                              title={e.reps_por_lado ? 'Unilateral (reps/lado) — clic para cambiar a bilateral' : 'Bilateral — clic para marcar como reps/lado'}
                              style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: `1px solid ${e.reps_por_lado ? 'var(--accent)' : 'var(--border)'}`, background: e.reps_por_lado ? 'var(--accent)' : 'transparent', color: e.reps_por_lado ? '#fff' : 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                              /lado
                            </button>
                          </div>
                        </div>

                        {/* Variables activas */}
                        {activas.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                            {activas.includes('RIR') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>RIR</span>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  {[['4+','#16a34a','#dcfce7','4+ reps en reserva'],['2-3','#ca8a04','#fef9c3','2-3 reps en reserva'],['1-0','#dc2626','#fee2e2','0-1 reps en reserva']].map(([val, color, bg, tip]) => (
                                    <button key={val} title={tip} onClick={() => actualizarEjercicio(b.id, e.id, 'rpe', e.rpe === val ? '' : val)}
                                      style={{ padding: '2px 6px', borderRadius: 8, border: `1.5px solid ${e.rpe === val ? color : 'var(--border)'}`, background: e.rpe === val ? bg : 'var(--bg)', color: e.rpe === val ? color : 'var(--text3)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                      {val}
                                    </button>
                                  ))}
                                </div>
                                <button onClick={() => toggleVariable(e, 'RIR')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Peso') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>Peso</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <InlineInput value={e.peso} placeholder="80" fontSize={11} type="number" onSave={v => actualizarEjercicio(b.id, e.id, 'peso', v)} />
                                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>kg</span>
                                </div>
                                <button onClick={() => toggleVariable(e, 'Peso')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Peso/lado') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>Peso/lado</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                                  <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>D</span>
                                  <InlineInput value={e.peso_der} placeholder="20" fontSize={11} type="number" onSave={v => actualizarEjercicio(b.id, e.id, 'peso_der', v)} style={{ width: 36 }} />
                                  <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>I</span>
                                  <InlineInput value={e.peso_izq} placeholder="15" fontSize={11} type="number" onSave={v => actualizarEjercicio(b.id, e.id, 'peso_izq', v)} style={{ width: 36 }} />
                                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>kg</span>
                                </div>
                                <button onClick={() => toggleVariable(e, 'Peso/lado')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Duración') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>Duración</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <InlineInput value={e.duracion} placeholder="45" fontSize={11} type="number" onSave={v => actualizarEjercicio(b.id, e.id, 'duracion', v)} />
                                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>s</span>
                                </div>
                                <button onClick={() => toggleVariable(e, 'Duración')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Distancia') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>Distancia</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <InlineInput value={e.distancia} placeholder="20" fontSize={11} type="number" onSave={v => actualizarEjercicio(b.id, e.id, 'distancia', v)} />
                                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>m</span>
                                </div>
                                <button onClick={() => toggleVariable(e, 'Distancia')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Altura') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>Altura</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <InlineInput value={e.altura} placeholder="40" fontSize={11} type="number" onSave={v => actualizarEjercicio(b.id, e.id, 'altura', v)} />
                                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>cm</span>
                                </div>
                                <button onClick={() => toggleVariable(e, 'Altura')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Descanso') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>Descanso</span>
                                <div style={{ flex: 1 }}><InlineInput value={e.descanso} placeholder="30 s · 60 s · 2 min" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, 'descanso', v)} /></div>
                                <button onClick={() => toggleVariable(e, 'Descanso')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Forma de ejecución') && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60, paddingTop: 2 }}>Ejecución</span>
                                <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <select className="form-select" style={{ fontSize: 11, padding: '2px 6px', width: 'auto' }}
                                    value={e.ejecucion_tipo || ''} onChange={ev => actualizarEjercicio(b.id, e.id, 'ejecucion_tipo', ev.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {['Explosiva','Controlada','Control excéntrico','Con pausa','Técnica prioritaria','Máxima estabilidad','Rango completo','Personalizado'].map(op => (
                                      <option key={op} value={op}>{op}</option>
                                    ))}
                                  </select>
                                  <div style={{ flex: 1, minWidth: 80 }}>
                                    <InlineInput value={e.ejecucion_texto} placeholder="Texto libre..." fontSize={11}
                                      onSave={v => actualizarEjercicio(b.id, e.id, 'ejecucion_texto', v)} />
                                  </div>
                                </div>
                                <button onClick={() => toggleVariable(e, 'Forma de ejecución')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                            {activas.includes('Indicaciones') && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60, paddingTop: 2 }}>Notas</span>
                                <div style={{ flex: 1 }}>
                                  <InlineInput value={e.notas} placeholder="Indicaciones para el ejercicio..." textarea fontSize={11.5} style={{ color: 'var(--text2)' }}
                                    onSave={v => actualizarEjercicio(b.id, e.id, 'notas', v)} />
                                </div>
                                <button onClick={() => toggleVariable(e, 'Indicaciones')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }}>×</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Botón + Variable con menú */}
                        <div style={{ display: 'inline-block', marginTop: 6 }}>
                          <button onClick={ev => { ev.stopPropagation(); const r = ev.currentTarget.getBoundingClientRect(); setMenuVariablePos({ x: r.left, y: r.bottom + 4 }); setMenuVariableAbierto(menuVariableAbierto === menuKey ? null : menuKey) }}
                            style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                            ＋ Variable
                          </button>
                          {menuVariableAbierto === menuKey && (
                            <div data-var-menu="1"
                              style={{ position: 'fixed', top: menuVariablePos.y, left: menuVariablePos.x, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 180, overflow: 'hidden' }}>
                              {VARS_MENU.map(({ grupo, items }) => (
                                <div key={grupo}>
                                  <div style={{ padding: '5px 10px 2px', fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>{grupo}</div>
                                  {items.map(item => {
                                    const isActive = activas.includes(item)
                                    return (
                                      <button key={item} onClick={() => { toggleVariable(e, item); setMenuVariableAbierto(null) }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'var(--accent)' : 'var(--text)' }}
                                        onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg2)'}
                                        onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>
                                        <span style={{ width: 14, flexShrink: 0 }}>{isActive ? '✓' : ''}</span>
                                        {item}
                                      </button>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Media */}
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
                          {e.media_tipo !== 'youtube' && (
                            <label style={{ cursor: 'pointer', flexShrink: 0 }} title="Subir archivo desde tu ordenador">
                              <input type="file" accept="image/*,video/*,.gif" style={{ display: 'none' }}
                                onChange={async ev => {
                                  const file = ev.target.files?.[0]
                                  if (!file) return
                                  const ext = file.name.split('.').pop()
                                  const path = `ejercicios/${e.id}_${Date.now()}.${ext}`
                                  const { error } = await supabase.storage.from('media-ejercicios').upload(path, file, { upsert: true })
                                  if (error) { alert('Error al subir: ' + error.message); return }
                                  const { data: { publicUrl } } = supabase.storage.from('media-ejercicios').getPublicUrl(path)
                                  await actualizarEjercicio(b.id, e.id, 'media_url', publicUrl)
                                  ev.target.value = ''
                                }} />
                              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', whiteSpace: 'nowrap' }}>📁 Subir</span>
                            </label>
                          )}
                        </div>
                        {e.media_tipo !== 'youtube' && (
                          <div style={{ marginTop: 4 }}>
                            <InlineInput value={e.video_url} placeholder="Enlace 'Ver vídeo' (opcional)..." fontSize={11}
                              onSave={v => actualizarEjercicio(b.id, e.id, 'video_url', v)} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirCrearEjercicio(b.id, b.variables_default || [])}>
                      <Plus size={12} /> Ejercicio
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirBiblioteca(b.id, b.variables_default || [])} style={{ color: 'var(--accent)' }}>
                      📚 Desde biblioteca
                    </button>
                  </div>
                </div>
              </div>
              )
            })}
            {/* Drop zone para bloque completo desde biblioteca */}
            {libDragActive && (
              <div
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                onDrop={e => {
                  e.preventDefault(); setLibDragActive(false)
                  try {
                    const d = JSON.parse(e.dataTransfer.getData('application/json'))
                    if (d.tipo === 'bloque_bib') insertarBloqueDesdePanel(d.item)
                  } catch {}
                }}
                style={{ border: '2px dashed #6ee7b7', borderRadius: 10, padding: '14px', textAlign: 'center', fontSize: 12, color: '#065f46', background: '#ecfdf5', fontWeight: 600 }}>
                ↓ Suelta aquí para añadir el bloque completo
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
              <button className="btn btn-ghost" onClick={añadirBloque}>
                <Plus size={13} /> Bloque
              </button>
              {clipboardBloque && clipboardBloque.tipo === 'bloque_fuerza' && (
                <button className="btn btn-ghost" onClick={pegarDesdePortapapeles}
                  style={{ border: '1.5px solid #d1fae5', background: '#ecfdf5', color: '#065f46' }}
                  title={`Pegar: "${clipboardBloque.nombre}"`}>
                  📋 Pegar: <em style={{ marginLeft: 4 }}>{clipboardBloque.nombre}</em>
                  <span onClick={e => { e.stopPropagation(); limpiarPortapapeles() }} style={{ marginLeft: 6, cursor: 'pointer' }}>×</span>
                </button>
              )}
            </div>
          </div>}

          {/* ── VISTA PREVIA CLIENTE (modo lectura) ── */}
          {sesionAbierta.tipo_editor !== 'carrera' && vistaPrevia && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#856404' }}>
                👁 Vista previa — así verá el cliente la sesión
              </div>
              {bloques.map((b, idx) => (
                <div key={b.id} style={{ background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderLeft: `4px solid ${b.color || COLORES[0]}`, fontWeight: 700, fontSize: 14 }}>
                    {b.nombre || `Bloque ${idx + 1}`}
                  </div>
                  {b.nota && <div style={{ padding: '0 14px 8px', fontSize: 12.5, color: 'var(--text2)' }}>{b.nota}</div>}
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(ejercicios[b.id] || []).map((e, eIdx) => {
                      const activas = e.variables_activas || []
                      const rirColors = { '4+': '#16a34a', '2-3': '#ca8a04', '1-0': '#dc2626' }
                      return (
                        <div key={e.id} style={{ background: '#fff', borderRadius: 9, border: '1px solid var(--border)', padding: '10px 12px', borderLeft: `3px solid ${b.color || COLORES[0]}` }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginRight: 5 }}>{idx + 1}.{eIdx + 1}.</span>
                            {e.nombre || 'Sin nombre'}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {e.series && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>SERIES</span>{e.series}</span>}
                            {e.reps && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>REPS</span>{e.reps}{e.reps_por_lado ? '/lado' : ''}</span>}
                            {activas.includes('Peso') && e.peso && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>PESO</span>{e.peso} kg</span>}
                            {activas.includes('Peso/lado') && (e.peso_der || e.peso_izq) && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>PESO/LADO</span>D: {e.peso_der || '—'} · I: {e.peso_izq || '—'} kg</span>}
                            {activas.includes('Duración') && e.duracion && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>DURACIÓN</span>{e.duracion} s</span>}
                            {activas.includes('RIR') && e.rpe && <span style={{ background: rirColors[e.rpe] + '22', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: rirColors[e.rpe] }}><span style={{ fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>RIR</span>{e.rpe}</span>}
                            {activas.includes('Distancia') && e.distancia && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>DISTANCIA</span>{e.distancia} m</span>}
                            {activas.includes('Altura') && e.altura && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>ALTURA</span>{e.altura} cm</span>}
                            {activas.includes('Descanso') && e.descanso && <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}><span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>DESCANSO</span>{e.descanso}</span>}
                            {activas.includes('Forma de ejecución') && e.ejecucion_tipo && (
                              <span style={{ background: 'var(--bg2)', borderRadius: 7, padding: '4px 9px', fontSize: 11 }}>
                                <span style={{ color: 'var(--text3)', fontSize: 9, fontFamily: 'var(--mono)', marginRight: 4 }}>EJECUCIÓN</span>
                                {e.ejecucion_tipo !== 'Personalizado' ? e.ejecucion_tipo : ''}{e.ejecucion_texto ? (e.ejecucion_tipo !== 'Personalizado' ? ` — ${e.ejecucion_texto}` : e.ejecucion_texto) : ''}
                              </span>
                            )}
                          </div>
                          {activas.includes('Indicaciones') && e.notas && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>📝 {e.notas}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <div className="form-group">
              <label className="form-label">Icono de sesión</label>
              <EmojiPicker value={formSesion.icono || ''} onChange={v => setFormSesion(f => ({ ...f, icono: v }))} />
            </div>
            <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={formSesion.titulo} onChange={e => setFormSesion(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Sesión 5 - Fuerza general" autoFocus /></div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input className="form-input" type="date" value={formSesion.fecha} disabled={formSesion.sinFecha} style={{ flex: 1, opacity: formSesion.sinFecha ? 0.4 : 1 }} onChange={e => setFormSesion(f => ({ ...f, fecha: e.target.value }))} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={!!formSesion.sinFecha} onChange={e => {
                    const checked = e.target.checked
                    setFormSesion(f => ({ ...f, sinFecha: checked, fecha: checked ? '' : f.fecha, tipo_sesion: checked ? (f.tipo_sesion === 'programada' ? 'flexible' : f.tipo_sesion) : (f.tipo_sesion === 'flexible' ? 'programada' : f.tipo_sesion) }))
                  }} />
                  Sin fecha asignada
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de sesión</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(formSesion.sinFecha
                  ? [['flexible', '🔄 Flexible'], ['opcional', '⭐ Opcional']]
                  : [['programada', '📅 Programada'], ['opcional', '⭐ Opcional']]
                ).map(([val, label]) => {
                  const active = (formSesion.tipo_sesion || 'programada') === val
                  return (
                    <button key={val} type="button" onClick={() => setFormSesion(f => ({ ...f, tipo_sesion: val }))}
                      style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text2)' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            {modalSesion !== 'nueva' && (
              <div className="form-group">
                <label className="form-label">Estado</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[['pendiente','Pendiente','#f3f4f6','#6b7280','#d1d5db'],['realizada','○ Realizada','#dbeafe','#1d4ed8','#3b82f6'],['completada','✓ Completada','#dcfce7','#166534','#16a34a'],['parcial','〜 Parcial','#fef9c3','#713f12','#ca8a04'],['no_realizada','✗ No realizada','#fee2e2','#7f1d1d','#dc2626']].map(([val, label, bg, color, border]) => {
                    const active = (formSesion.estado || 'pendiente') === val
                    return (
                      <button key={val} type="button" onClick={() => setFormSesion(f => ({ ...f, estado: val }))}
                        style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? border : 'var(--border)'}`, background: active ? bg : 'var(--bg)', color: active ? color : 'var(--text3)', fontSize: 11, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <textarea className="form-textarea" value={formSesion.objetivo} onChange={e => setFormSesion(f => ({ ...f, objetivo: e.target.value }))} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Duración (min)</label>
              <input className="form-input" type="number" min="1" value={formSesion.duracion_min} onChange={e => setFormSesion(f => ({ ...f, duracion_min: e.target.value }))} style={{ maxWidth: 120 }} placeholder="Ej: 45" />
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
      {modalPack && (
        <div className="modal-backdrop" onClick={() => setModalPack(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalPack === 'nuevo' ? 'Nuevo pack flexible' : 'Editar pack'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPack(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del pack *</label>
              <input className="form-input" value={formPack.nombre} onChange={e => setFormPack(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Plan de vacaciones" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={formPack.fecha_inicio} onChange={e => setFormPack(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha fin *</label>
                <input className="form-input" type="date" value={formPack.fecha_fin} onChange={e => setFormPack(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descripción para el cliente</label>
              <textarea className="form-input" value={formPack.descripcion} onChange={e => setFormPack(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Durante estos días puedes realizar estas sesiones de forma flexible según disponibilidad..." rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPack(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={savingPack || !formPack.nombre || !formPack.fecha_inicio || !formPack.fecha_fin} onClick={guardarPack}>{savingPack ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalBiblioteca && (() => {
        const BIB_VARS = SECCIONES_CLASIFICACION.filter(s => s.tipo !== 'complejos')

        const hayFiltrosBib = Object.keys(bibFiltros).length > 0

        // AND entre variables: ejercicio debe cumplir todas las variables activas
        const bibFiltrada = !biblioteca ? [] : biblioteca.filter(item => {
          if (busquedaBiblioteca && !item.nombre.toLowerCase().includes(busquedaBiblioteca.toLowerCase())) return false
          for (const [campo, sub] of Object.entries(bibFiltros)) {
            if (!sub) continue // variable activa pero sin subvariable seleccionada: no filtra por sub
            const vals = item[campo] || []
            if (!vals.includes(sub)) return false
          }
          return true
        })

        const varsActivas = BIB_VARS.filter(v => v.campo in bibFiltros)

        return (
          <div className="modal-backdrop" onClick={() => setModalBiblioteca(null)}>
            <div className="modal" style={{ maxWidth: 860, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">📚 Biblioteca de ejercicios</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalBiblioteca(null)}>✕</button>
              </div>

              {/* Búsqueda */}
              <div style={{ padding: '0 0 10px' }}>
                <input className="form-input" autoFocus placeholder="Buscar ejercicio..." value={busquedaBiblioteca} onChange={e => setBusquedaBiblioteca(e.target.value)} />
              </div>

              {/* Variables principales — selección múltiple */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {BIB_VARS.map(v => {
                  const activa = v.campo in bibFiltros
                  return (
                    <button key={v.campo} type="button"
                      onClick={() => setBibFiltros(f => {
                        const next = { ...f }
                        if (activa) delete next[v.campo]
                        else next[v.campo] = null
                        return next
                      })}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${activa ? v.color : 'var(--border)'}`, background: activa ? v.color + '22' : 'transparent', color: activa ? v.color : 'var(--text2)', cursor: 'pointer', fontWeight: activa ? 700 : 400, transition: 'all 0.1s' }}>
                      {v.label}{activa && bibFiltros[v.campo] ? ` · ${bibFiltros[v.campo].split('/')[0].trim()}` : ''}
                    </button>
                  )
                })}
                {hayFiltrosBib && (
                  <button type="button" onClick={() => setBibFiltros({})}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}>
                    ✕ Limpiar
                  </button>
                )}
              </div>

              {/* Layout dos columnas cuando hay filtros activos, una columna si no */}
              <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>

                {/* Columna izquierda: subvariables (solo si hay filtros activos) */}
                {varsActivas.length > 0 && (
                  <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                    {varsActivas.map(v => {
                      const getLabel = v.tipo === 'patron' ? labelDePatronId : (v.labelFn || (id => id))
                      const allItems = v.tipo === 'patron'
                        ? PATRON_MOVIMIENTO.flatMap(b => b.grupos.flatMap(g => g.children.map(c => c.id)))
                        : v.tipo === 'chips'
                          ? v.items
                          : v.grupos.flatMap(g => g.items)
                      return (
                        <div key={v.campo} style={{ padding: '8px 10px', background: v.color + '0a', borderRadius: 8, border: `1px solid ${v.color}33` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: v.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{v.label}</div>
                          {(v.tipo === 'chips' || v.tipo === 'patron') ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {allItems.map(item => {
                                const activo = bibFiltros[v.campo] === item
                                return (
                                  <button key={item} type="button"
                                    onClick={() => setBibFiltros(f => ({ ...f, [v.campo]: activo ? null : item }))}
                                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1.5px solid ${activo ? v.color : 'var(--border)'}`, background: activo ? v.color : 'transparent', color: activo ? '#fff' : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400, transition: 'all 0.1s' }}>
                                    {getLabel(item)}
                                  </button>
                                )
                              })}
                            </div>
                          ) : v.grupos.map(({ grupo, items }) => (
                            <div key={grupo} style={{ marginBottom: grupo ? 6 : 0 }}>
                              {grupo && <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>{grupo}</div>}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {items.map(item => {
                                  const activo = bibFiltros[v.campo] === item
                                  return (
                                    <button key={item} type="button"
                                      onClick={() => setBibFiltros(f => ({ ...f, [v.campo]: activo ? null : item }))}
                                      style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1.5px solid ${activo ? v.color : 'var(--border)'}`, background: activo ? v.color : 'transparent', color: activo ? '#fff' : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400, transition: 'all 0.1s' }}>
                                      {item}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Columna derecha: lista de ejercicios */}
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {varsActivas.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                      {bibFiltrada.length} ejercicio{bibFiltrada.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {!biblioteca ? (
                    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Cargando...</div>
                  ) : bibFiltrada.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Sin resultados</div>
                  ) : bibFiltrada.map(item => {
                  const ytid = item.media_tipo === 'youtube' && item.media_url ? item.media_url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/)?.[1] : null
                  const thumb = ytid ? `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` : (item.media_url && item.media_tipo !== 'youtube' ? item.media_url : null)
                  return (
                    <div key={item.id} onClick={() => añadirDesdeBiblioteca(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
                      {thumb
                        ? <img src={thumb} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
                        : <div style={{ width: 48, height: 36, borderRadius: 5, background: 'var(--bg2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💪</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{item.nombre}</div>
                        {item.descripcion && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descripcion}</div>}
                        {varsActivas.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                            {varsActivas.flatMap(v => (item[v.campo] || []).map(tag => {
                              const label = v.tipo === 'patron' ? labelDePatronId(tag) : v.labelFn ? v.labelFn(tag) : tag
                              return (
                                <span key={v.campo + tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: v.color + '18', color: v.color, border: `1px solid ${v.color}33`, fontWeight: 500 }}>{label}</span>
                              )
                            }))}
                          </div>
                        )}
                      </div>
                      {item.media_tipo && <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{item.media_tipo === 'youtube' ? '▶' : '🖼'}</span>}
                    </div>
                  )
                })}
              </div>{/* fin columna derecha */}
              </div>{/* fin dos columnas */}
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const { bloqueId, variablesDefault } = modalBiblioteca
                  setModalBiblioteca(null)
                  abrirCrearEjercicio(bloqueId, variablesDefault)
                }}>
                  <Plus size={12} /> Crear ejercicio personalizado
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Panel lateral biblioteca (fixed) */}
      {panelBiblioteca && sesionAbierta && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 294, height: '100vh', background: 'var(--bg)', borderLeft: '1px solid var(--border)', zIndex: 400, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.08)' }}>
          {/* Header */}
          <div style={{ padding: '12px 14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>📚 Biblioteca</span>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setPanelBiblioteca(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              {[['ejercicios', '🏋️ Ejercicios'], ['bloques', '🧱 Bloques']].map(([id, label]) => (
                <button key={id} onClick={() => { setTabBiblioteca(id); if (id === 'bloques' && bloquesBiblioteca === null) cargarBloquesBiblioteca() }}
                  style={{ flex: 1, fontSize: 12, padding: '6px 4px', border: 'none', background: 'transparent', borderBottom: `2px solid ${tabBiblioteca === id ? 'var(--accent)' : 'transparent'}`, color: tabBiblioteca === id ? 'var(--accent)' : 'var(--text2)', fontWeight: tabBiblioteca === id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab ejercicios */}
          {tabBiblioteca === 'ejercicios' && (
            <>
              <div style={{ padding: '10px 14px 0' }}>
                <input className="form-input" autoFocus placeholder="Buscar ejercicio..." value={busquedaBiblioteca} onChange={e => setBusquedaBiblioteca(e.target.value)} style={{ marginBottom: 6, fontSize: 12 }} />
                <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>Arrastra al bloque destino</p>
              </div>
              {!biblioteca ? (
                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {biblioteca.filter(item => !busquedaBiblioteca || item.nombre.toLowerCase().includes(busquedaBiblioteca.toLowerCase())).map(item => (
                    <div key={item.id} draggable
                      onDragStart={e => { setLibDragActive(true); e.dataTransfer.setData('application/json', JSON.stringify({ tipo: 'ejercicio_bib', item })); e.dataTransfer.effectAllowed = 'copy' }}
                      onDragEnd={() => { setLibDragActive(false); setDragOverBloqueId(null) }}
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', cursor: 'grab', fontSize: 12, color: 'var(--text)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light,#e8f5f0)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}>
                      <div style={{ fontWeight: 500 }}>{item.nombre}</div>
                      {item.patron_movimiento?.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{item.patron_movimiento.slice(0, 2).join(' · ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Tab bloques */}
          {tabBiblioteca === 'bloques' && (
            <>
              <div style={{ padding: '10px 14px 0' }}>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>Arrastra a la sesión para insertar</p>
              </div>
              {bloquesBiblioteca === null ? (
                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
              ) : bloquesBiblioteca.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 14px' }}>No hay bloques guardados. Usa 🧱 en un bloque de sesión para guardar.</p>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bloquesBiblioteca.map(bb => (
                    <div key={bb.id} draggable
                      onDragStart={e => { setLibDragActive(true); e.dataTransfer.setData('application/json', JSON.stringify({ tipo: 'bloque_bib', item: bb })); e.dataTransfer.effectAllowed = 'copy' }}
                      onDragEnd={() => { setLibDragActive(false) }}
                      style={{ background: 'var(--bg2)', border: `1.5px solid ${bb.color || 'var(--border)'}22`, borderLeft: `4px solid ${bb.color || 'var(--accent)'}`, borderRadius: 8, padding: '8px 10px', cursor: 'grab', fontSize: 12 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light,#e8f5f0)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{bb.nombre}</div>
                      {bb.descripcion && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{bb.descripcion}</div>}
                      {bb.ejercicios?.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                          {bb.ejercicios.slice(0, 3).map(e => e.nombre).filter(Boolean).join(' · ')}
                          {bb.ejercicios.length > 3 ? ` +${bb.ejercicios.length - 3}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: Crear ejercicio personalizado */}
      {modalCrearEj && (() => {
        const seccionesFiltradas = SECCIONES_CLASIFICACION.filter(s => s.tipo !== 'complejos')
        const principal = seccionesFiltradas.slice(0, 2)   // familia + patron
        const caracteristicas = seccionesFiltradas.slice(2) // posicion, plano, contraccion, material
        const labelFromId = id => id.split(':').pop().replace(/_/g, ' ')
        const renderListaItems = (seccion) => {
          const seleccionados = formCrearEj[seccion.campo] || []
          const getLabel = seccion.tipo === 'patron' ? labelDePatronId : (seccion.labelFn || labelFromId)
          const allItems = seccion.tipo === 'patron'
            ? PATRON_MOVIMIENTO.flatMap(b => b.grupos.flatMap(g => g.children.map(c => c.id)))
            : seccion.tipo === 'chips' ? seccion.items
            : seccion.grupos.flatMap(g => g.items)
          const grupos = seccion.tipo === 'grupos' ? seccion.grupos : null
          const toggle = item => setFormCrearEj(f => {
            const actual = f[seccion.campo] || []
            const activo = actual.includes(item)
            return { ...f, [seccion.campo]: activo ? actual.filter(v => v !== item) : [...actual, item] }
          })
          if (grupos) {
            return grupos.map(({ grupo, items }) => (
              <div key={grupo} style={{ marginBottom: 6 }}>
                {grupo && <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{grupo}</div>}
                {items.map(item => {
                  const activo = seleccionados.includes(item)
                  return (
                    <div key={item} onClick={() => toggle(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', background: activo ? '#f0fdf4' : 'transparent' }}>
                      <span style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${activo ? '#2d6a4f' : 'var(--border-strong, #cbd5e1)'}`, background: activo ? '#2d6a4f' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {activo && <Check size={8} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{ fontSize: 11.5, color: activo ? '#065f46' : 'var(--text2)', fontWeight: activo ? 500 : 400 }}>{item}</span>
                    </div>
                  )
                })}
              </div>
            ))
          }
          return allItems.map(item => {
            const activo = seleccionados.includes(item)
            return (
              <div key={item} onClick={() => toggle(item)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', background: activo ? '#f0fdf4' : 'transparent' }}>
                <span style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${activo ? '#2d6a4f' : 'var(--border-strong, #cbd5e1)'}`, background: activo ? '#2d6a4f' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activo && <Check size={8} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ fontSize: 11.5, color: activo ? '#065f46' : 'var(--text2)', fontWeight: activo ? 500 : 400 }}>{getLabel(item)}</span>
              </div>
            )
          })
        }
        return (
          <div className="modal-backdrop" onClick={() => setModalCrearEj(null)}>
            <div className="modal" style={{ maxWidth: 'min(96vw, 1100px)', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">Crear ejercicio personalizado</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalCrearEj(null)}>✕</button>
              </div>

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Columna izquierda */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" autoFocus placeholder="Nombre del ejercicio" value={formCrearEj.nombre}
                      onChange={e => setFormCrearEj(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea className="form-input" placeholder="Descripción del ejercicio" value={formCrearEj.descripcion}
                      onChange={e => setFormCrearEj(f => ({ ...f, descripcion: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
                  </div>

                  {/* Clasificación principal */}
                  <div style={{ borderLeft: '3px solid #2d6a4f', paddingLeft: 10, marginBottom: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)' }}>Clasificación principal</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {principal.map((s, i) => (
                      <div key={s.campo} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#1e293b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</span>
                        </div>
                        <div style={{ padding: 10, flex: 1 }}>{renderListaItems(s)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Características */}
                  <div style={{ borderLeft: '3px solid #64748b', paddingLeft: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)' }}>Características del ejercicio</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {caracteristicas.map((s, i) => (
                      <div key={s.campo} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{3 + i}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</span>
                        </div>
                        <div style={{ padding: 10, flex: 1 }}>{renderListaItems(s)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Columna derecha */}
                <div style={{ width: 264, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>

                  {/* Vista previa 16:9 */}
                  <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: '#0f172a', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(!formCrearEj.media_url || !formCrearEj.media_tipo) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#334155' }}>
                        <Play size={30} strokeWidth={1.5} />
                        <span style={{ fontSize: 11 }}>Vista previa</span>
                      </div>
                    ) : formCrearEj.media_tipo === 'imagen' ? (
                      <img src={formCrearEj.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : formCrearEj.media_tipo === 'gif' ? (
                      <img src={formCrearEj.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : formCrearEj.media_tipo === 'video' ? (
                      <video src={formCrearEj.media_url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : formCrearEj.media_tipo === 'youtube' ? (() => {
                      const yId = formCrearEj.media_url.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1]
                      return yId
                        ? <iframe src={`https://www.youtube.com/embed/${yId}`} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" allowFullScreen />
                        : <span style={{ fontSize: 11, color: '#475569', padding: 12, textAlign: 'center' }}>URL no válida</span>
                    })() : null}
                  </div>

                  {/* Archivo */}
                  <div style={{ marginBottom: 10 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Archivo</div>
                    <select className="form-select" value={formCrearEj.media_tipo}
                      onChange={e => setFormCrearEj(f => ({ ...f, media_tipo: e.target.value, media_url: '', video_url: '' }))}
                      style={{ marginBottom: 6 }}>
                      <option value="">Sin media</option>
                      <option value="youtube">YouTube</option>
                      <option value="imagen">Imagen</option>
                      <option value="video">Vídeo</option>
                      <option value="gif">GIF</option>
                    </select>
                    {formCrearEj.media_tipo && (
                      <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                          <input className="form-input" value={formCrearEj.media_url}
                            onChange={e => setFormCrearEj(f => ({ ...f, media_url: e.target.value }))}
                            placeholder={formCrearEj.media_tipo === 'youtube' ? 'https://youtube.com/...' : 'https://...'}
                            style={{ flex: 1, fontSize: 12 }} />
                          {formCrearEj.media_tipo !== 'youtube' && (
                            <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                              <input type="file" accept="image/*,video/*,.gif" style={{ display: 'none' }}
                                onChange={async ev => {
                                  const file = ev.target.files?.[0]; if (!file) return
                                  const path = `biblioteca/${Date.now()}.${file.name.split('.').pop()}`
                                  const { error } = await supabase.storage.from('media-ejercicios').upload(path, file, { upsert: true })
                                  if (error) { alert('Error: ' + error.message); return }
                                  const { data: { publicUrl } } = supabase.storage.from('media-ejercicios').getPublicUrl(path)
                                  setFormCrearEj(f => ({ ...f, media_url: publicUrl }))
                                  ev.target.value = ''
                                }} />
                              <span className="btn btn-ghost btn-sm">📁</span>
                            </label>
                          )}
                        </div>
                        {formCrearEj.media_tipo !== 'youtube' && (
                          <input className="form-input" value={formCrearEj.video_url}
                            onChange={e => setFormCrearEj(f => ({ ...f, video_url: e.target.value }))}
                            placeholder='Enlace "Ver vídeo" (opcional)' style={{ fontSize: 12 }} />
                        )}
                      </>
                    )}
                  </div>

                  {/* Notas de ejecución */}
                  <div style={{ marginBottom: 8 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Notas de ejecución</div>
                    <textarea className="form-input" placeholder="Indicaciones técnicas..." value={formCrearEj.notas}
                      onChange={e => setFormCrearEj(f => ({ ...f, notas: e.target.value }))} rows={2} style={{ resize: 'vertical', fontSize: 12 }} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Tipo de ejecución</div>
                    <input className="form-input" placeholder="Ej: Excéntrico lento, pausa..." value={formCrearEj.ejecucion_tipo}
                      onChange={e => setFormCrearEj(f => ({ ...f, ejecucion_tipo: e.target.value }))} style={{ fontSize: 12 }} />
                  </div>

                  {/* Resumen etiquetas */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Resumen</div>
                    {(() => {
                      const conValores = seccionesFiltradas.filter(s => (formCrearEj[s.campo] || []).length > 0)
                      if (!conValores.length) return <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Sin etiquetas seleccionadas</div>
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {conValores.map(s => {
                            const getLabel = s.tipo === 'patron' ? labelDePatronId : (s.labelFn || labelFromId)
                            return (
                              <div key={s.campo}>
                                <div style={{ fontSize: 9.5, fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{s.label}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {(formCrearEj[s.campo] || []).map(v => (
                                    <span key={v} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 12, background: s.color + '18', color: s.color, border: `1px solid ${s.color}33`, fontWeight: 500 }}>
                                      {getLabel(v)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {errorCrearEj && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 8 }}>{errorCrearEj}</p>}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModalCrearEj(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={guardandoCrearEj || !formCrearEj.nombre?.trim()} onClick={guardarEjercicioPersonalizado}>
                  {guardandoCrearEj ? 'Guardando...' : 'Guardar ejercicio'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Zona de drop para bloques de biblioteca (cuando la sesión es fuerza) */}
      {libDragActive && sesionAbierta?.tipo_editor !== 'carrera' && (
        <div style={{ position: 'fixed', bottom: 24, right: 310, background: '#1e3a2f', color: '#6ee7b7', border: '2px dashed #6ee7b7', borderRadius: 12, padding: '10px 18px', fontSize: 12, fontWeight: 600, zIndex: 500, pointerEvents: 'none' }}>
          ↓ Suelta sobre un bloque (ejercicio) o aquí (bloque completo)
        </div>
      )}
    </div>
  )
}
