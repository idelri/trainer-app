import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Trash2, Copy, GripVertical } from 'lucide-react'

const COLORES = ['#E29A2E', '#4C82E8', '#2FAE76', '#8B6CE0', '#34AEB8', '#DD6F97']
const EMPTY_SESION = { titulo: '', fecha: '', objetivo: '', duracion_min: '', sinFecha: false, tipo_sesion: 'programada', tipo_actividad: 'fuerza' }

const TIPOS_ACTIVIDAD = [
  { value: 'fuerza', label: 'Fuerza', icono: '💪' },
  { value: 'correr', label: 'Correr', icono: '🏃' },
  { value: 'caminar', label: 'Caminar', icono: '🚶' },
  { value: 'bicicleta', label: 'Bicicleta', icono: '🚴' },
  { value: 'nadar', label: 'Nadar', icono: '🏊' },
  { value: 'movilidad', label: 'Movilidad', icono: '🤸' },
  { value: 'futbol', label: 'Fútbol', icono: '⚽' },
  { value: 'padel', label: 'Pádel', icono: '🎾' },
]
const ICONO_ACTIVIDAD = Object.fromEntries(TIPOS_ACTIVIDAD.map(t => [t.value, t.icono]))
function iconoSesion(s) { return ICONO_ACTIVIDAD[s?.tipo_actividad] || '💪' }

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
  } catch { return null }
}

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
  function handleBlur() { clearTimeout(timer.current); onSave(v) }
  const Comp = textarea ? 'textarea' : 'input'
  return (
    <Comp value={v} onChange={handleChange} onBlur={handleBlur} placeholder={placeholder}
      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontFamily: 'inherit', fontSize: fontSize || 13, color: 'inherit', padding: 0, resize: textarea ? 'vertical' : 'none', ...style }}
      rows={textarea ? 2 : undefined} />
  )
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

function Calendario({ sesiones, competiciones = [], controles = [], notas = [], bloquesPlan, subbloquesPlan, onAbrirSesion, onNuevaSesion, onNuevaCompeticion, onNuevaValoracion, onNuevaNota, onEliminar, onMoverSesion, clipboard, onCopiar, onPegar, onPegarOtroCliente, clipboardSemana, onCopiarSemana, onPegarSemana, onPegarSemanaOtroCliente }) {
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
            <button className="btn btn-ghost btn-sm" onClick={onPegarOtroCliente}>→ Otro cliente</button>
          </>
        )}
        {clipboardSemana && (
          <>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', background: 'var(--accent-light)', padding: '3px 8px', borderRadius: 6 }}>📅 Semana copiada ({clipboardSemana.items.length})</span>
            <button className="btn btn-ghost btn-sm" onClick={onPegarSemanaOtroCliente}>→ Otro cliente</button>
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
                    <button title="Copiar semana" onClick={e => { e.stopPropagation(); onCopiarSemana(diasSem) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5, padding: '0 2px', lineHeight: 1 }}>📋</button>
                    {clipboardSemana && (
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
                  return (
                    <div key={i}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (arrastrando) { onMoverSesion(arrastrando, key); setArrastrando(null) } }}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, fecha: key }) }}
                      style={{ background: 'var(--bg)', minHeight: vista === 'mes' ? 80 : 140, padding: '4px', boxSizing: 'border-box', borderTop: colorLinea ? `2px solid ${colorLinea}` : '2px solid transparent', display: 'flex', flexDirection: 'column', gap: 3, opacity: esMesActual ? 1 : 0.35 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: esHoy ? 700 : 400, fontFamily: 'var(--mono)', color: esHoy ? 'var(--accent)' : 'var(--text3)', background: esHoy ? 'var(--accent-light)' : 'transparent', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {dia.getDate()}
                        </span>
                       <DiaMenu fecha={key} onNuevaSesion={onNuevaSesion} onNuevaCompeticion={onNuevaCompeticion} onNuevaValoracion={onNuevaValoracion} onNuevaNota={onNuevaNota} />
                      </div>
                    {sesDia.map(item => {
                        const tipoEstilo = {
                          sesion: { background: 'var(--accent-light)', color: 'var(--accent)' },
                          competicion: { background: 'var(--danger-light)', color: 'var(--danger)' },
                          control: { background: '#eff6ff', color: '#3b82f6' },
                          nota: { background: '#fefce8', color: '#854d0e' },
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

export default function SesionesPlan({ clienteId, bloquesPlan, subbloquesPlan, clientes = [] }) {
  const [sesiones, setSesiones] = useState([])
  const [sesionAbierta, setSesionAbierta] = useState(null)
  const [bloques, setBloques] = useState([])
  const [ejercicios, setEjercicios] = useState({})
  const [modalSesion, setModalSesion] = useState(null)
  const [formSesion, setFormSesion] = useState(EMPTY_SESION)
  const [saving, setSaving] = useState(false)
  const [objetivoDraft, setObjetivoDraft] = useState('')
  const [savingObjetivo, setSavingObjetivo] = useState(false)
  const [objetivoGuardado, setObjetivoGuardado] = useState(false)
  const [draggingEj, setDraggingEj] = useState(null)
  const [draggingBloque, setDraggingBloque] = useState(null)
  const fileInputRef = useRef(null)
  const [archivoTarget, setArchivoTarget] = useState(null)
  const [subiendoId, setSubiendoId] = useState(null)

  useEffect(() => {
    if (!draggingEj && !draggingBloque) return
    const MARGEN = 90
    const VELOCIDAD = 22
    function autoScroll(ev) {
      if (ev.clientY < MARGEN) window.scrollBy(0, -VELOCIDAD)
      else if (ev.clientY > window.innerHeight - MARGEN) window.scrollBy(0, VELOCIDAD)
    }
    window.addEventListener('dragover', autoScroll)
    return () => window.removeEventListener('dragover', autoScroll)
  }, [draggingEj, draggingBloque])
  const [clipboard, setClipboard] = useState(null)
  const [modalPegarOtro, setModalPegarOtro] = useState(false)
  const [formPegarOtro, setFormPegarOtro] = useState({ clienteDestino: '', fecha: format(new Date(), 'yyyy-MM-dd'), sinFecha: false })
  const [clipboardSemana, setClipboardSemana] = useState(null)
  const [modalPegarSemanaOtro, setModalPegarSemanaOtro] = useState(false)
  const [formPegarSemanaOtro, setFormPegarSemanaOtro] = useState({ clienteDestino: '', fecha: format(new Date(), 'yyyy-MM-dd') })
  const [clipboardLista, setClipboardLista] = useState(null)
  const [draggingSinFecha, setDraggingSinFecha] = useState(null)
  const [modalPegarListaOtro, setModalPegarListaOtro] = useState(false)
  const [clienteDestinoLista, setClienteDestinoLista] = useState('')
  const [competiciones, setCompeticiones] = useState([])
  const [controles, setControles] = useState([])
  const [notas, setNotas] = useState([])
  const [modalComp, setModalComp] = useState(false)
  const [formComp, setFormComp] = useState({ nombre: '', fecha: '', tipo: '', objetivo: '', notas: '' })
  const [modalControl, setModalControl] = useState(false)
  const [formControl, setFormControl] = useState({ nombre: '', fecha: '', tipo: '', notas: '' })
  const [modalNota, setModalNota] = useState(false)
  const [formNota, setFormNota] = useState({ texto: '', fecha: '' })
  useEffect(() => { if (clienteId) cargarSesiones() }, [clienteId])
  useEffect(() => {
    if (!sesionAbierta) return
    cargarDetalle(sesionAbierta.id)
    setObjetivoDraft(sesionAbierta.objetivo || '')
    setObjetivoGuardado(false)
    // Refresca datos de la sesión desde DB para evitar estado obsoleto
    supabase.from('sesiones').select('*').eq('id', sesionAbierta.id).single().then(({ data }) => {
      if (data) { setSesionAbierta(data); setObjetivoDraft(data.objetivo || '') }
    })
  }, [sesionAbierta?.id])

  async function cargarSesiones() {
    const { data } = await supabase.from('sesiones').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }).order('orden', { ascending: true })
    setSesiones(data || [])
    const { data: comps } = await supabase.from('competiciones').select('*').eq('cliente_id', clienteId).order('fecha')
    setCompeticiones(comps || [])
    const { data: ctrls } = await supabase.from('controles').select('*').eq('cliente_id', clienteId).order('fecha')
    setControles(ctrls || [])
    const { data: nts } = await supabase.from('sesion_notas').select('*').eq('cliente_id', clienteId).order('fecha')
    setNotas(nts || [])
  }

  async function cargarDetalle(sesionId) {
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', sesionId).order('orden')
    setBloques(bls || [])
    if (bls && bls.length > 0) {
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').in('bloque_id', bls.map(b => b.id)).order('orden')
      const map = {}
      ;(ejs || []).forEach(e => { if (!map[e.bloque_id]) map[e.bloque_id] = []; map[e.bloque_id].push(e) })
      setEjercicios(map)
    } else { setEjercicios({}) }
  }

  async function siguienteOrdenSinFecha(clienteDestino) {
    if (clienteDestino === clienteId) {
      const sinFecha = sesiones.filter(s => !s.fecha)
      return sinFecha.length ? Math.max(...sinFecha.map(s => s.orden ?? 0)) + 1 : 0
    }
    const { data } = await supabase.from('sesiones').select('orden').eq('cliente_id', clienteDestino).is('fecha', null).order('orden', { ascending: false }).limit(1)
    return data && data.length ? (data[0].orden ?? 0) + 1 : 0
  }

  async function guardarSesion() {
    if (!formSesion.titulo) return
    if (!formSesion.sinFecha && !formSesion.fecha) return
    setSaving(true)
    const datos = { titulo: formSesion.titulo, fecha: formSesion.sinFecha ? null : formSesion.fecha, objetivo: formSesion.objetivo || null, duracion_min: formSesion.duracion_min ? parseInt(formSesion.duracion_min) : null, tipo_sesion: formSesion.tipo_sesion || 'programada', tipo_actividad: formSesion.tipo_actividad || 'fuerza', ...(formSesion.sinFecha && !modalSesion?.id ? { orden: await siguienteOrdenSinFecha(clienteId) } : {}) }
    if (modalSesion?.id) {
      await supabase.from('sesiones').update(datos).eq('id', modalSesion.id)
    } else {
      const { data: nueva } = await supabase.from('sesiones').insert({ ...datos, cliente_id: clienteId }).select().single()
      if (nueva && !formSesion.sinFecha) {
        for (let i = 0; i < 4; i++) {
          const { data: b } = await supabase.from('sesion_bloques').insert({ sesion_id: nueva.id, nombre: `Bloque ${i + 1}`, color: COLORES[i % COLORES.length], nota: '', orden: i }).select().single()
          if (b) for (let j = 0; j < 3; j++) await supabase.from('sesion_ejercicios').insert({ bloque_id: b.id, nombre: '', series: '', reps: '', rpe: '', notas: '', media_tipo: 'youtube', media_url: '', video_url: '', orden: j })
          if (!formSesion.sinFecha) setSesionAbierta(nueva)
        }
      }
    }
    setSaving(false); setModalSesion(null); cargarSesiones()
  }

  async function eliminarSesion(id) {
    if (!window.confirm('¿Eliminar esta sesión?')) return
    await supabase.from('sesiones').delete().eq('id', id)
    if (sesionAbierta?.id === id) setSesionAbierta(null)
    cargarSesiones()
  }

  const TABLA_POR_TIPO = { competicion: 'competiciones', control: 'controles', nota: 'sesion_notas' }

  async function eliminarItem(item) {
    if (item._tipo === 'sesion') return eliminarSesion(item.id)
    if (!window.confirm('¿Eliminar este elemento?')) return
    await supabase.from(TABLA_POR_TIPO[item._tipo]).delete().eq('id', item.id)
    cargarSesiones()
  }

  async function moverItem(item, nuevaFecha) {
    const tabla = item._tipo === 'sesion' ? 'sesiones' : TABLA_POR_TIPO[item._tipo]
    await supabase.from(tabla).update({ fecha: nuevaFecha }).eq('id', item.id)
    cargarSesiones()
  }

  function copiarEnlace(s) {
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
    const orden = bloques.length ? Math.max(...bloques.map(b => b.orden ?? 0)) + 1 : 0
    const { data: b } = await supabase.from('sesion_bloques').insert({ sesion_id: sesionAbierta.id, nombre: `Bloque ${bloques.length + 1}`, color: COLORES[bloques.length % COLORES.length], nota: '', orden }).select().single()
    if (b) { setBloques(bs => [...bs, b]); setEjercicios(e => ({ ...e, [b.id]: [] })) }
  }

  async function eliminarBloque(id) {
    if (!window.confirm('¿Eliminar este bloque y sus ejercicios?')) return
    await supabase.from('sesion_bloques').delete().eq('id', id)
    const restantes = bloques.filter(b => b.id !== id).map((b, i) => ({ ...b, orden: i }))
    setBloques(restantes)
    await Promise.all(restantes.map(b => supabase.from('sesion_bloques').update({ orden: b.orden }).eq('id', b.id)))
  }

  async function reordenarBloque(destinoId) {
    if (!draggingBloque || draggingBloque.id === destinoId) return
    const lista = [...bloques]
    const fromIdx = lista.findIndex(x => x.id === draggingBloque.id)
    const toIdx = lista.findIndex(x => x.id === destinoId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = lista.splice(fromIdx, 1)
    lista.splice(toIdx, 0, moved)
    const final = lista.map((x, i) => ({ ...x, orden: i }))
    setBloques(final)
    setDraggingBloque(null)
    await Promise.all(final.map(x => supabase.from('sesion_bloques').update({ orden: x.orden }).eq('id', x.id)))
  }

  async function añadirEjercicio(bloqueId) {
    const lista = ejercicios[bloqueId] || []
    const orden = lista.length ? Math.max(...lista.map(e => e.orden ?? 0)) + 1 : 0
    const { data: e } = await supabase.from('sesion_ejercicios').insert({ bloque_id: bloqueId, nombre: '', series: '', reps: '', rpe: '', notas: '', media_tipo: 'youtube', media_url: '', video_url: '', orden }).select().single()
    if (e) setEjercicios(ej => ({ ...ej, [bloqueId]: [...(ej[bloqueId] || []), e] }))
  }

  async function actualizarEjercicio(bloqueId, id, campo, valor) {
    await supabase.from('sesion_ejercicios').update({ [campo]: valor }).eq('id', id)
    setEjercicios(ej => ({ ...ej, [bloqueId]: (ej[bloqueId] || []).map(e => e.id === id ? { ...e, [campo]: valor } : e) }))
  }

  const ACCEPT_POR_TIPO = { imagen: 'image/jpeg,image/png,image/webp', gif: 'image/gif', video: 'video/mp4' }
  const LIMITE_MB_POR_TIPO = { imagen: 10, gif: 200, video: 50 }

  function abrirSelectorArchivo(bloqueId, id, tipo) {
    setArchivoTarget({ bloqueId, id, tipo })
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPT_POR_TIPO[tipo] || ''
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  async function handleArchivoSeleccionado(ev) {
    const file = ev.target.files?.[0]
    const target = archivoTarget
    if (!file || !target) return
    const limiteMb = LIMITE_MB_POR_TIPO[target.tipo] || 10
    if (file.size > limiteMb * 1024 * 1024) { alert(`El archivo no puede superar ${limiteMb} MB`); return }
    setSubiendoId(target.id)
    try {
      const nombreSanitizado = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const filename = `${Date.now()}-${nombreSanitizado}`
      const { error } = await supabase.storage.from('media-ejercicios').upload(filename, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('media-ejercicios').getPublicUrl(filename)
      await actualizarEjercicio(target.bloqueId, target.id, 'media_url', data.publicUrl)
    } catch {
      alert('Error al subir el archivo. Inténtalo de nuevo.')
    } finally {
      setSubiendoId(null)
      setArchivoTarget(null)
    }
  }

  async function eliminarEjercicio(bloqueId, id) {
    await supabase.from('sesion_ejercicios').delete().eq('id', id)
    const restantes = (ejercicios[bloqueId] || []).filter(e => e.id !== id).map((e, i) => ({ ...e, orden: i }))
    setEjercicios(ej => ({ ...ej, [bloqueId]: restantes }))
    await Promise.all(restantes.map(e => supabase.from('sesion_ejercicios').update({ orden: e.orden }).eq('id', e.id)))
  }

  async function pegarSesion(s, fecha, clienteDestino = clienteId, recargar = true, ordenOverride = null) {
    setSaving(true)
    const orden = fecha ? null : (ordenOverride != null ? ordenOverride : await siguienteOrdenSinFecha(clienteDestino))
    const { data: nueva } = await supabase.from('sesiones').insert({ cliente_id: clienteDestino, titulo: s.titulo, fecha, objetivo: s.objetivo, duracion_min: s.duracion_min, tipo_actividad: s.tipo_actividad || 'fuerza', ...(orden != null ? { orden } : {}) }).select().single()
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', s.id).order('orden')
    for (const b of bls || []) {
      const { data: nb } = await supabase.from('sesion_bloques').insert({ sesion_id: nueva.id, nombre: b.nombre, color: b.color, nota: b.nota, orden: b.orden }).select().single()
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').eq('bloque_id', b.id).order('orden')
      for (const e of ejs || []) await supabase.from('sesion_ejercicios').insert({ bloque_id: nb.id, nombre: e.nombre, series: e.series, reps: e.reps, rpe: e.rpe, notas: e.notas, media_tipo: e.media_tipo, media_url: e.media_url, video_url: e.video_url, orden: e.orden })
    }
    setSaving(false)
    if (recargar && clienteDestino === clienteId) cargarSesiones()
  }

  async function pegarItem(item, fecha, clienteDestino = clienteId, recargar = true) {
    if (item._tipo === 'sesion') return pegarSesion(item, fecha, clienteDestino, recargar)
    setSaving(true)
    if (item._tipo === 'competicion') {
      await supabase.from('competiciones').insert({ cliente_id: clienteDestino, nombre: item.nombre, fecha, tipo: item.tipo, objetivo: item.objetivo, notas: item.notas })
    } else if (item._tipo === 'control') {
      await supabase.from('controles').insert({ cliente_id: clienteDestino, nombre: item.nombre, fecha, tipo: item.tipo, notas: item.notas })
    } else if (item._tipo === 'nota') {
      await supabase.from('sesion_notas').insert({ cliente_id: clienteDestino, texto: item.texto, fecha })
    }
    setSaving(false)
    if (recargar && clienteDestino === clienteId) cargarSesiones()
  }

  function copiarSemana(diasSem) {
    const claves = diasSem.map(d => format(d, 'yyyy-MM-dd'))
    const items = [
      ...sesiones.filter(s => claves.includes(s.fecha)).map(s => ({ ...s, _tipo: 'sesion' })),
      ...competiciones.filter(c => claves.includes(c.fecha)).map(c => ({ ...c, _tipo: 'competicion' })),
      ...controles.filter(c => claves.includes(c.fecha)).map(c => ({ ...c, _tipo: 'control' })),
      ...notas.filter(n => claves.includes(n.fecha)).map(n => ({ ...n, _tipo: 'nota' })),
    ]
    if (items.length === 0) { alert('No hay elementos esta semana para copiar'); return }
    setClipboardSemana({ lunes: diasSem[0], items })
  }

  async function pegarSemana(lunesDestino, clienteDestino = clienteId) {
    if (!clipboardSemana) return
    const diffDias = Math.round((lunesDestino - clipboardSemana.lunes) / 86400000)
    setSaving(true)
    for (const item of clipboardSemana.items) {
      const nuevaFecha = format(addDays(parseISO(item.fecha), diffDias), 'yyyy-MM-dd')
      await pegarItem(item, nuevaFecha, clienteDestino, false)
    }
    setSaving(false)
    if (clienteDestino === clienteId) cargarSesiones()
  }

  function copiarListaSinFecha() {
    const sinFecha = sesiones.filter(s => !s.fecha)
    if (sinFecha.length === 0) return
    setClipboardLista(sinFecha.map(s => ({ ...s, _tipo: 'sesion' })))
  }

  async function pegarListaSinFecha(clienteDestino = clienteId) {
    if (!clipboardLista) return
    setSaving(true)
    const base = await siguienteOrdenSinFecha(clienteDestino)
    let i = 0
    for (const item of clipboardLista) {
      await pegarSesion(item, null, clienteDestino, false, base + i)
      i++
    }
    setSaving(false)
    if (clienteDestino === clienteId) cargarSesiones()
  }

  async function reordenarSinFecha(destinoId) {
    if (!draggingSinFecha || draggingSinFecha === destinoId) return
    const sinFecha = sesiones.filter(s => !s.fecha)
    const resto = sesiones.filter(s => s.fecha)
    const fromIdx = sinFecha.findIndex(s => s.id === draggingSinFecha)
    const toIdx = sinFecha.findIndex(s => s.id === destinoId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = sinFecha.splice(fromIdx, 1)
    sinFecha.splice(toIdx, 0, moved)
    const final = sinFecha.map((s, i) => ({ ...s, orden: i }))
    setSesiones([...resto, ...final])
    setDraggingSinFecha(null)
    await Promise.all(final.map(s => supabase.from('sesiones').update({ orden: s.orden }).eq('id', s.id)))
  }

  return (
    <div>
      {!sesionAbierta && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setFormSesion({ ...EMPTY_SESION, fecha: format(new Date(), 'yyyy-MM-dd') }); setModalSesion('nueva') }}>
              <Plus size={13} /> Nueva sesión
            </button>
          </div>

          {sesiones.filter(s => !s.fecha).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sin fecha asignada — {sesiones.filter(s => !s.fecha).length}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={copiarListaSinFecha}>📋 Copiar todas</button>
                  {clipboardLista && (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', background: 'var(--accent-light)', padding: '3px 8px', borderRadius: 6 }}>📋 {clipboardLista.length} copiadas</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => pegarListaSinFecha()}>📌 Pegar aquí</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setClienteDestinoLista(''); setModalPegarListaOtro(true) }}>→ Otro cliente</button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sesiones.filter(s => !s.fecha).map(s => (
                  <div key={s.id}
                    draggable
                    onDragStart={ev => { ev.stopPropagation(); setDraggingSinFecha(s.id) }}
                    onDragEnd={ev => { ev.stopPropagation(); setDraggingSinFecha(null) }}
                    onDragOver={ev => { ev.preventDefault(); ev.stopPropagation() }}
                    onDrop={ev => { ev.preventDefault(); ev.stopPropagation(); reordenarSinFecha(s.id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12.5, cursor: 'grab', opacity: draggingSinFecha === s.id ? 0.5 : 1 }}>
                    <GripVertical size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                    <span onClick={() => setSesionAbierta(s)} style={{ cursor: 'pointer' }}>{iconoSesion(s)} {s.titulo}</span>
                    <span title="Copiar" onClick={() => setClipboard({ ...s, _tipo: 'sesion' })} style={{ opacity: 0.5, cursor: 'pointer' }}>📋</span>
                    <span title="Duplicar aquí" onClick={() => pegarSesion(s, null, clienteId)} style={{ opacity: 0.5, cursor: 'pointer' }}>⧉</span>
                    <span title="Eliminar" onClick={() => eliminarSesion(s.id)} style={{ opacity: 0.5, cursor: 'pointer' }}>×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        <Calendario
            sesiones={sesiones}
            competiciones={competiciones}
            controles={controles}
            notas={notas}
            bloquesPlan={bloquesPlan || []}
            subbloquesPlan={subbloquesPlan || {}}
            onAbrirSesion={setSesionAbierta}
         onNuevaSesion={(fecha) => { setFormSesion({ ...EMPTY_SESION, fecha }); setModalSesion('nueva') }}
            onNuevaCompeticion={(fecha) => { setFormComp({ nombre: '', fecha, tipo: '', objetivo: '', notas: '' }); setModalComp(true) }}
            onNuevaValoracion={(fecha) => { setFormControl({ nombre: '', fecha, tipo: '', notas: '' }); setModalControl(true) }}
            onNuevaNota={(fecha) => { setFormNota({ texto: '', fecha }); setModalNota(true) }}
            onEliminar={eliminarItem}
            onMoverSesion={moverItem}
            clipboard={clipboard}
            onCopiar={setClipboard}
            onPegar={pegarItem}
            onPegarOtroCliente={() => { setFormPegarOtro({ clienteDestino: '', fecha: format(new Date(), 'yyyy-MM-dd'), sinFecha: false }); setModalPegarOtro(true) }}
            clipboardSemana={clipboardSemana}
            onCopiarSemana={copiarSemana}
            onPegarSemana={pegarSemana}
            onPegarSemanaOtroCliente={() => { setFormPegarSemanaOtro({ clienteDestino: '', fecha: format(clipboardSemana.lunes, 'yyyy-MM-dd') }); setModalPegarSemanaOtro(true) }}
          />
        </>
      )}

      {sesionAbierta && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => copiarEnlace(sesionAbierta)}>🔗 Compartir</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setFormSesion({ titulo: sesionAbierta.titulo, fecha: sesionAbierta.fecha || '', objetivo: sesionAbierta.objetivo || '', duracion_min: sesionAbierta.duracion_min || '', sinFecha: !sesionAbierta.fecha, tipo_sesion: sesionAbierta.tipo_sesion || 'programada', tipo_actividad: sesionAbierta.tipo_actividad || 'fuerza' }); setModalSesion(sesionAbierta) }}>Fecha / duración</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSesionAbierta(null)}>← Volver</button>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Objetivo general</div>
              {objetivoDraft !== (sesionAbierta.objetivo || '') && (
                <button
                  onClick={async () => {
                    setSavingObjetivo(true)
                    await supabase.from('sesiones').update({ objetivo: objetivoDraft || null }).eq('id', sesionAbierta.id)
                    setSesionAbierta(s => ({ ...s, objetivo: objetivoDraft }))
                    setSesiones(list => list.map(s => s.id === sesionAbierta.id ? { ...s, objetivo: objetivoDraft } : s))
                    setSavingObjetivo(false)
                    setObjetivoGuardado(true)
                    setTimeout(() => setObjetivoGuardado(false), 2000)
                  }}
                  disabled={savingObjetivo}
                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                  {savingObjetivo ? 'Guardando...' : 'Guardar'}
                </button>
              )}
              {objetivoGuardado && objetivoDraft === (sesionAbierta.objetivo || '') && (
                <span style={{ fontSize: 11, color: '#2FAE76', fontWeight: 600 }}>✓ Guardado</span>
              )}
            </div>
            <textarea
              value={objetivoDraft}
              onChange={e => setObjetivoDraft(e.target.value)}
              placeholder="Ej: Seguir construyendo base de movilidad..."
              rows={2}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontFamily: 'inherit', fontSize: 13, color: 'inherit', padding: 0, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bloques.map((b, idx) => (
              <div key={b.id} className="card"
                draggable
                onDragStart={() => setDraggingBloque(b)}
                onDragEnd={() => setDraggingBloque(null)}
                onDragOver={ev => ev.preventDefault()}
                onDrop={ev => { ev.preventDefault(); reordenarBloque(b.id) }}
                style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || COLORES[0]}`, opacity: draggingBloque?.id === b.id ? 0.5 : 1, cursor: 'grab' }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <GripVertical size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {COLORES.map(c => <div key={c} onClick={() => cambiarColorBloque(b.id, c)} style={{ width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer', border: b.color === c ? '2px solid var(--text)' : '2px solid transparent' }} />)}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                    <InlineInput value={b.nombre} placeholder={`Bloque ${idx + 1}`} fontSize={14} style={{ fontWeight: 600 }} onSave={v => actualizarBloque(b.id, 'nombre', v)} />
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><Trash2 size={12} /></button>
                </div>
                <div style={{ padding: '0 16px 10px', fontSize: 12.5, color: 'var(--text2)' }}>
                  <InlineInput value={b.nota} placeholder="Nota del bloque (opcional)..." textarea fontSize={12.5} onSave={v => actualizarBloque(b.id, 'nota', v)} />
                </div>
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(ejercicios[b.id] || []).map((e, eIdx) => {
                    const id = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
                    const thumb = e.media_tipo === 'youtube' && id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ((e.media_tipo === 'imagen' || e.media_tipo === 'gif') ? e.media_url : null)
                    const esVideoArchivo = e.media_tipo === 'video' && e.media_url
                    return (
                     <div key={e.id}
                        draggable
                        onDragStart={ev => { ev.stopPropagation(); setDraggingEj({ e, bloqueId: b.id }) }}
                        onDragEnd={ev => { ev.stopPropagation(); setDraggingEj(null) }}
                        onDragOver={ev => { ev.preventDefault(); ev.stopPropagation() }}
                        onDrop={async ev => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          if (!draggingEj || draggingEj.e.id === e.id) return
                          const bloqueOrigen = draggingEj.bloqueId
                          const bloqueDestino = b.id
                          const listaOrigenOriginal = ejercicios[bloqueOrigen] || []
                          const fromIdx = listaOrigenOriginal.findIndex(x => x.id === draggingEj.e.id)
                          if (fromIdx === -1) return
                          const movingDown = bloqueOrigen === bloqueDestino && listaOrigenOriginal.findIndex(x => x.id === e.id) > fromIdx
                          const ejOrigen = [...listaOrigenOriginal]
                          const [moved] = ejOrigen.splice(fromIdx, 1)
                          const ejDestinoBase = bloqueOrigen === bloqueDestino ? ejOrigen : [...(ejercicios[bloqueDestino] || [])]
                          let toIdx = ejDestinoBase.findIndex(x => x.id === e.id)
                          if (toIdx === -1) toIdx = ejDestinoBase.length
                          else if (movingDown) toIdx += 1
                          ejDestinoBase.splice(toIdx, 0, { ...moved, bloque_id: bloqueDestino })
                          const origenFinal = ejOrigen.map((x, i) => ({ ...x, orden: i }))
                          const destinoFinal = bloqueOrigen === bloqueDestino ? origenFinal : ejDestinoBase.map((x, i) => ({ ...x, orden: i }))
                          const newEj = { ...ejercicios }
                          newEj[bloqueOrigen] = origenFinal
                          newEj[bloqueDestino] = destinoFinal
                          setEjercicios(newEj)
                          await supabase.from('sesion_ejercicios').update({ bloque_id: bloqueDestino, orden: toIdx }).eq('id', moved.id)
                          await Promise.all(origenFinal.map(x => supabase.from('sesion_ejercicios').update({ orden: x.orden }).eq('id', x.id)))
                          if (bloqueOrigen !== bloqueDestino) await Promise.all(destinoFinal.map(x => supabase.from('sesion_ejercicios').update({ orden: x.orden }).eq('id', x.id)))
                          setDraggingEj(null)
                        }}
                        style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '10px', background: draggingEj?.e?.id === e.id ? 'var(--bg2)' : 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'grab' }}>
                        <div style={{ width: 130, height: 130, borderRadius: 8, flexShrink: 0, background: 'var(--bg2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {esVideoArchivo ? (
                            <video src={e.media_url} controls muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : thumb ? (
                            <img src={thumb} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: 9, color: 'var(--text3)' }}>sin media</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{idx + 1}.{eIdx + 1}.</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <InlineInput value={e.nombre} placeholder="Nombre del ejercicio" fontSize={13} style={{ fontWeight: 600 }} onSave={v => actualizarEjercicio(b.id, e.id, 'nombre', v)} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                            {[['series','Series',36],['reps','Reps',60],['rpe','RPE',36]].map(([campo, label, w]) => (
                              <div key={campo} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{label}</span>
                                <div style={{ width: w }}><InlineInput value={e[campo]} placeholder="—" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, campo, v)} /></div>
                              </div>
                            ))}
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
                            {e.media_tipo !== 'youtube' && (
                              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '3px 7px', flexShrink: 0 }}
                                disabled={subiendoId === e.id} onClick={() => abrirSelectorArchivo(b.id, e.id, e.media_tipo)}>
                                {subiendoId === e.id ? 'Subiendo...' : '↑ Subir archivo'}
                              </button>
                            )}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <InlineInput value={e.notas} placeholder="Notas (opcional)..." textarea fontSize={11.5} style={{ color: 'var(--text2)' }} onSave={v => actualizarEjercicio(b.id, e.id, 'notas', v)} />
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => eliminarEjercicio(b.id, e.id)}><X size={12} /></button>
                      </div>
                    )
                  })}
                  <button className="btn btn-ghost btn-sm" onClick={() => añadirEjercicio(b.id)} style={{ alignSelf: 'flex-start' }}><Plus size={12} /> Ejercicio</button>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={añadirBloque} style={{ alignSelf: 'flex-start' }}><Plus size={13} /> Bloque</button>
          </div>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleArchivoSeleccionado} />
        </div>
      )}

      {modalSesion && (
        <div className="modal-backdrop" onClick={() => setModalSesion(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalSesion === 'nueva' ? 'Nueva sesión' : 'Editar sesión'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSesion(null)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={formSesion.titulo} onChange={e => setFormSesion(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Sesión 5 - Fuerza general" autoFocus /></div>
           <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={formSesion.fecha} disabled={formSesion.sinFecha} onChange={e => setFormSesion(f => ({ ...f, fecha: e.target.value }))} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                  <input type="checkbox" checked={formSesion.sinFecha} onChange={e => setFormSesion(f => ({ ...f, sinFecha: e.target.checked, fecha: e.target.checked ? '' : f.fecha }))} />
                  Sin fecha asignada
                </label>
              </div>
              <div className="form-group"><label className="form-label">Duración (min)</label><input className="form-input" type="number" value={formSesion.duracion_min} onChange={e => setFormSesion(f => ({ ...f, duracion_min: e.target.value }))} placeholder="Ej: 45" /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de sesión</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['programada','📅 Programada'],['flexible','🔄 Flexible'],['opcional','⭐ Opcional']].map(([val, label]) => (
                  <button key={val} onClick={() => setFormSesion(f => ({ ...f, tipo_sesion: val }))}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${(formSesion.tipo_sesion || 'programada') === val ? 'var(--accent)' : 'var(--border)'}`, background: (formSesion.tipo_sesion || 'programada') === val ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 11, fontWeight: (formSesion.tipo_sesion || 'programada') === val ? 600 : 400, color: (formSesion.tipo_sesion || 'programada') === val ? 'var(--accent)' : 'var(--text2)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de actividad</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {TIPOS_ACTIVIDAD.map(t => (
                  <button key={t.value} onClick={() => setFormSesion(f => ({ ...f, tipo_actividad: t.value }))}
                    style={{ padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${(formSesion.tipo_actividad || 'fuerza') === t.value ? 'var(--accent)' : 'var(--border)'}`, background: (formSesion.tipo_actividad || 'fuerza') === t.value ? 'var(--accent-light)' : 'var(--bg)', cursor: 'pointer', fontSize: 11, fontWeight: (formSesion.tipo_actividad || 'fuerza') === t.value ? 600 : 400, color: (formSesion.tipo_actividad || 'fuerza') === t.value ? 'var(--accent)' : 'var(--text2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 16 }}>{t.icono}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSesion(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSesion} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
       </div>
      )}

      {modalComp && (
        <div className="modal-backdrop" onClick={() => setModalComp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nueva competición</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalComp(false)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formComp.nombre} onChange={e => setFormComp(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Media Maratón Barcelona" autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={formComp.fecha} onChange={e => setFormComp(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Tipo</label><input className="form-input" value={formComp.tipo} onChange={e => setFormComp(f => ({ ...f, tipo: e.target.value }))} placeholder="Ej: Carrera, Hyrox..." /></div>
            </div>
            <div className="form-group"><label className="form-label">Objetivo</label><input className="form-input" value={formComp.objetivo} onChange={e => setFormComp(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Bajar de 1h45min" /></div>
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formComp.notas} onChange={e => setFormComp(f => ({ ...f, notas: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalComp(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!formComp.nombre || !formComp.fecha) return
                await supabase.from('competiciones').insert({ cliente_id: clienteId, nombre: formComp.nombre, fecha: formComp.fecha, tipo: formComp.tipo || null, objetivo: formComp.objetivo || null, notas: formComp.notas || null })
                setModalComp(false)
              }}>Añadir competición</button>
            </div>
          </div>
        </div>
      )}

      {modalControl && (
        <div className="modal-backdrop" onClick={() => setModalControl(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nueva valoración / control</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalControl(false)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formControl.nombre} onChange={e => setFormControl(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Test de fuerza, Valoración HRV..." autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={formControl.fecha} onChange={e => setFormControl(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Tipo</label>
                <select className="form-select" value={formControl.tipo} onChange={e => setFormControl(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  <option value="Fuerza">Fuerza</option>
                  <option value="Resistencia">Resistencia</option>
                  <option value="Movilidad">Movilidad</option>
                  <option value="Composición corporal">Composición corporal</option>
                  <option value="HRV / Recuperación">HRV / Recuperación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formControl.notas} onChange={e => setFormControl(f => ({ ...f, notas: e.target.value }))} placeholder="Protocolo, resultados, observaciones..." /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalControl(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!formControl.nombre || !formControl.fecha) return
                await supabase.from('controles').insert({ cliente_id: clienteId, nombre: formControl.nombre, fecha: formControl.fecha, tipo: formControl.tipo || null, notas: formControl.notas || null })
                setModalControl(false)
              }}>Añadir control</button>
            </div>
          </div>
        </div>
      )}

      {modalNota && (
        <div className="modal-backdrop" onClick={() => setModalNota(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nueva nota</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalNota(false)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formNota.fecha} onChange={e => setFormNota(f => ({ ...f, fecha: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Nota *</label><textarea className="form-textarea" style={{ minHeight: 100 }} value={formNota.texto} onChange={e => setFormNota(f => ({ ...f, texto: e.target.value }))} placeholder="Ej: Semana de viaje, ajustar volumen..." autoFocus /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalNota(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!formNota.texto) return
                await supabase.from('sesion_notas').insert({ cliente_id: clienteId, texto: formNota.texto, fecha: formNota.fecha || null })
                setModalNota(false)
              }}>Guardar nota</button>
            </div>
          </div>
        </div>
      )}

      {modalPegarOtro && clipboard && (
        <div className="modal-backdrop" onClick={() => setModalPegarOtro(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Pegar en otro cliente</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPegarOtro(false)}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
              📋 {clipboard.titulo || clipboard.nombre || clipboard.texto}
            </div>
            <div className="form-group">
              <label className="form-label">Cliente destino *</label>
              <select className="form-select" value={formPegarOtro.clienteDestino} onChange={e => setFormPegarOtro(f => ({ ...f, clienteDestino: e.target.value }))} autoFocus>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha {clipboard._tipo === 'sesion' ? '' : '*'}</label>
              <input className="form-input" type="date" value={formPegarOtro.fecha} disabled={formPegarOtro.sinFecha} onChange={e => setFormPegarOtro(f => ({ ...f, fecha: e.target.value }))} />
              {clipboard._tipo === 'sesion' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                  <input type="checkbox" checked={formPegarOtro.sinFecha} onChange={e => setFormPegarOtro(f => ({ ...f, sinFecha: e.target.checked }))} />
                  Sin fecha asignada
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPegarOtro(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !formPegarOtro.clienteDestino || (!formPegarOtro.sinFecha && !formPegarOtro.fecha)} onClick={async () => {
                await pegarItem(clipboard, formPegarOtro.sinFecha ? null : formPegarOtro.fecha, formPegarOtro.clienteDestino)
                setModalPegarOtro(false)
                const nombreDestino = clientes.find(c => c.id === formPegarOtro.clienteDestino)?.nombre || 'el cliente seleccionado'
                alert(`Copiado en ${nombreDestino}`)
              }}>{saving ? 'Pegando...' : 'Pegar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalPegarSemanaOtro && clipboardSemana && (
        <div className="modal-backdrop" onClick={() => setModalPegarSemanaOtro(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Pegar semana en otro cliente</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPegarSemanaOtro(false)}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
              📅 Semana con {clipboardSemana.items.length} elemento{clipboardSemana.items.length === 1 ? '' : 's'}
            </div>
            <div className="form-group">
              <label className="form-label">Cliente destino *</label>
              <select className="form-select" value={formPegarSemanaOtro.clienteDestino} onChange={e => setFormPegarSemanaOtro(f => ({ ...f, clienteDestino: e.target.value }))} autoFocus>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Lunes de la semana destino *</label>
              <input className="form-input" type="date" value={formPegarSemanaOtro.fecha} onChange={e => setFormPegarSemanaOtro(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPegarSemanaOtro(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !formPegarSemanaOtro.clienteDestino || !formPegarSemanaOtro.fecha} onClick={async () => {
                await pegarSemana(parseISO(formPegarSemanaOtro.fecha), formPegarSemanaOtro.clienteDestino)
                setModalPegarSemanaOtro(false)
                const nombreDestino = clientes.find(c => c.id === formPegarSemanaOtro.clienteDestino)?.nombre || 'el cliente seleccionado'
                alert(`Semana copiada en ${nombreDestino}`)
              }}>{saving ? 'Pegando...' : 'Pegar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalPegarListaOtro && clipboardLista && (
        <div className="modal-backdrop" onClick={() => setModalPegarListaOtro(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Pegar sesiones en otro cliente</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPegarListaOtro(false)}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
              📋 {clipboardLista.length} sesión{clipboardLista.length === 1 ? '' : 'es'} sin fecha asignada
            </div>
            <div className="form-group">
              <label className="form-label">Cliente destino *</label>
              <select className="form-select" value={clienteDestinoLista} onChange={e => setClienteDestinoLista(e.target.value)} autoFocus>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPegarListaOtro(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !clienteDestinoLista} onClick={async () => {
                await pegarListaSinFecha(clienteDestinoLista)
                setModalPegarListaOtro(false)
                const nombreDestino = clientes.find(c => c.id === clienteDestinoLista)?.nombre || 'el cliente seleccionado'
                alert(`Sesiones copiadas en ${nombreDestino}`)
              }}>{saving ? 'Pegando...' : 'Pegar'}</button>
            </div>
          </div>
        </div>
      )}
      </div>
  )
}

