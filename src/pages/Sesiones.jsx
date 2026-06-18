import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Trash2, Copy } from 'lucide-react'

const COLORES = ['#E29A2E', '#4C82E8', '#2FAE76', '#8B6CE0', '#34AEB8', '#DD6F97']
const EMPTY_SESION = { titulo: '', fecha: '', objetivo: '', duracion_min: '' }

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
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

export default function Sesiones() {
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(false)
  const [sesionAbierta, setSesionAbierta] = useState(null)
  const [bloques, setBloques] = useState([])
  const [ejercicios, setEjercicios] = useState({})

  const [modalSesion, setModalSesion] = useState(null)
  const [formSesion, setFormSesion] = useState(EMPTY_SESION)
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargarClientes() }, [])
  useEffect(() => { if (clienteSeleccionado) cargarSesiones() }, [clienteSeleccionado])
  useEffect(() => { if (sesionAbierta) cargarDetalle(sesionAbierta.id) }, [sesionAbierta])

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  async function cargarSesiones() {
    setLoading(true)
    const { data } = await supabase.from('sesiones').select('*').eq('cliente_id', clienteSeleccionado).order('fecha', { ascending: false })
    setSesiones(data || [])
    setSesionAbierta(null)
    setLoading(false)
  }

  async function cargarDetalle(sesionId) {
    const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', sesionId).order('orden')
    setBloques(bls || [])
    if (bls && bls.length > 0) {
      const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').in('bloque_id', bls.map(b => b.id)).order('orden')
      const map = {}
      ;(ejs || []).forEach(e => { if (!map[e.bloque_id]) map[e.bloque_id] = []; map[e.bloque_id].push(e) })
      setEjercicios(map)
    } else {
      setEjercicios({})
    }
  }

  function abrirNuevaSesion() {
    setFormSesion({ ...EMPTY_SESION, fecha: format(new Date(), 'yyyy-MM-dd') })
    setModalSesion('nueva')
  }

  function abrirEditarSesion(s) {
    setFormSesion({ titulo: s.titulo, fecha: s.fecha, objetivo: s.objetivo || '', duracion_min: s.duracion_min || '' })
    setModalSesion(s)
  }

  async function guardarSesion() {
    if (!formSesion.titulo || !formSesion.fecha) return
    setSaving(true)
    const datos = { titulo: formSesion.titulo, fecha: formSesion.fecha, objetivo: formSesion.objetivo || null, duracion_min: formSesion.duracion_min ? parseInt(formSesion.duracion_min) : null }
    if (modalSesion?.id) {
      await supabase.from('sesiones').update(datos).eq('id', modalSesion.id)
      setSaving(false); setModalSesion(null); cargarSesiones()
      return
    }
    // Nueva sesión: crear con 4 bloques x 3 ejercicios por defecto
    const { data: nueva } = await supabase.from('sesiones').insert({ ...datos, cliente_id: clienteSeleccionado }).select().single()
    if (nueva) {
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

  async function duplicarSesion(s) {
    setSaving(true)
    const { data: nuevaSesion } = await supabase.from('sesiones').insert({
      cliente_id: s.cliente_id, titulo: s.titulo + ' (copia)', fecha: format(new Date(), 'yyyy-MM-dd'),
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
        sesiones.length === 0 ? (
          <div className="empty"><p>No hay sesiones para este cliente.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sesiones.map(s => (
              <div key={s.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setSesionAbierta(s)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                    {format(parseISO(s.fecha), 'dd MMM yyyy', { locale: es })}{s.duracion_min ? ` · ${s.duracion_min} min` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); duplicarSesion(s) }} title="Duplicar"><Copy size={13} /></button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); eliminarSesion(s.id) }}><X size={13} /></button>
              </div>
            ))}
          </div>
        )
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  {(ejercicios[b.id] || []).map(e => {
                    const id = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
                    const thumb = e.media_tipo === 'youtube' && id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : (e.media_tipo !== 'youtube' ? e.media_url : null)
                    return (
                      <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, background: 'var(--bg2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {thumb ? <img src={thumb} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 9, color: 'var(--text3)' }}>sin media</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <InlineInput value={e.nombre} placeholder="Nombre del ejercicio" fontSize={13} style={{ fontWeight: 600 }}
                            onSave={v => actualizarEjercicio(b.id, e.id, 'nombre', v)} />
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
                              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>RPE</span>
                              <div style={{ width: 36 }}><InlineInput value={e.rpe} placeholder="—" fontSize={11} onSave={v => actualizarEjercicio(b.id, e.id, 'rpe', v)} /></div>
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
                                onSave={v => actualizarEjercicio(b.id, e.id, 'media_url', v)} />
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
          </div>
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
            <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={formSesion.titulo} onChange={e => setFormSesion(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Sesión 5 - Fuerza general" autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={formSesion.fecha} onChange={e => setFormSesion(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Duración (min)</label><input className="form-input" type="number" value={formSesion.duracion_min} onChange={e => setFormSesion(f => ({ ...f, duracion_min: e.target.value }))} placeholder="Ej: 45" /></div>
            </div>
            {modalSesion === 'nueva' && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Se crearán 4 bloques con 3 ejercicios de ejemplo, listos para editar directamente.</p>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSesion(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSesion} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
