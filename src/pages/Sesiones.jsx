import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, ChevronDown, ChevronRight, Trash2, Copy } from 'lucide-react'

const COLORES = ['#E29A2E', '#4C82E8', '#2FAE76', '#8B6CE0', '#34AEB8', '#DD6F97']

const EMPTY_SESION = { titulo: '', fecha: '', objetivo: '', duracion_min: '' }
const EMPTY_BLOQUE = { nombre: '', color: COLORES[0], nota: '' }
const EMPTY_EJERCICIO = { nombre: '', series: '', reps: '', rpe: '', notas: '', media_tipo: 'youtube', media_url: '', video_url: '' }

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
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
  const [modalBloque, setModalBloque] = useState(null)
  const [formBloque, setFormBloque] = useState(EMPTY_BLOQUE)
  const [modalEjercicio, setModalEjercicio] = useState(null)
  const [formEjercicio, setFormEjercicio] = useState(EMPTY_EJERCICIO)
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
    } else {
      const { data } = await supabase.from('sesiones').insert({ ...datos, cliente_id: clienteSeleccionado }).select().single()
      if (data) setSesionAbierta(data)
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

  function abrirNuevoBloque() {
    setFormBloque({ ...EMPTY_BLOQUE, color: COLORES[bloques.length % COLORES.length] })
    setModalBloque({})
  }

  function abrirEditarBloque(b) {
    setFormBloque({ nombre: b.nombre, color: b.color || COLORES[0], nota: b.nota || '' })
    setModalBloque(b)
  }

  async function guardarBloque() {
    if (!formBloque.nombre) return
    setSaving(true)
    const datos = { nombre: formBloque.nombre, color: formBloque.color, nota: formBloque.nota || null }
    if (modalBloque?.id) {
      await supabase.from('sesion_bloques').update(datos).eq('id', modalBloque.id)
    } else {
      await supabase.from('sesion_bloques').insert({ ...datos, sesion_id: sesionAbierta.id, orden: bloques.length })
    }
    setSaving(false); setModalBloque(null); cargarDetalle(sesionAbierta.id)
  }

  async function eliminarBloque(id) {
    if (!window.confirm('¿Eliminar este bloque y sus ejercicios?')) return
    await supabase.from('sesion_bloques').delete().eq('id', id)
    cargarDetalle(sesionAbierta.id)
  }

  function abrirNuevoEjercicio(bloqueId) {
    setFormEjercicio(EMPTY_EJERCICIO)
    setModalEjercicio({ bloque_id: bloqueId })
  }

  function abrirEditarEjercicio(e, bloqueId) {
    setFormEjercicio({ nombre: e.nombre, series: e.series || '', reps: e.reps || '', rpe: e.rpe || '', notas: e.notas || '', media_tipo: e.media_tipo || 'youtube', media_url: e.media_url || '', video_url: e.video_url || '' })
    setModalEjercicio({ ...e, bloque_id: bloqueId })
  }

  async function guardarEjercicio() {
    if (!formEjercicio.nombre) return
    setSaving(true)
    const datos = {
      nombre: formEjercicio.nombre, series: formEjercicio.series || null, reps: formEjercicio.reps || null,
      rpe: formEjercicio.rpe || null, notas: formEjercicio.notas || null,
      media_tipo: formEjercicio.media_tipo, media_url: formEjercicio.media_url || null,
      video_url: formEjercicio.video_url || null,
    }
    if (modalEjercicio?.id) {
      await supabase.from('sesion_ejercicios').update(datos).eq('id', modalEjercicio.id)
    } else {
      const lista = ejercicios[modalEjercicio.bloque_id] || []
      await supabase.from('sesion_ejercicios').insert({ ...datos, bloque_id: modalEjercicio.bloque_id, orden: lista.length })
    }
    setSaving(false); setModalEjercicio(null); cargarDetalle(sesionAbierta.id)
  }

  async function eliminarEjercicio(id) {
    if (!window.confirm('¿Eliminar este ejercicio?')) return
    await supabase.from('sesion_ejercicios').delete().eq('id', id)
    cargarDetalle(sesionAbierta.id)
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
            <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarSesion(sesionAbierta)}>Editar</button>
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
          {sesionAbierta.objetivo && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Objetivo</div>
              <div style={{ fontSize: 13 }}>{sesionAbierta.objetivo}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bloques.map((b, idx) => (
              <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || COLORES[0]}` }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: b.color || COLORES[0], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{String(idx + 1).padStart(2, '0')}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{b.nombre}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarBloque(b)}>Editar</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarBloque(b.id)}><Trash2 size={12} /></button>
                </div>
                {b.nota && (
                  <div style={{ padding: '0 16px 12px', fontSize: 12.5, color: 'var(--text2)' }}>{b.nota}</div>
                )}
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(ejercicios[b.id] || []).map(e => {
                    const id = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
                    const thumb = e.media_tipo === 'youtube' && id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : (e.media_tipo !== 'youtube' ? e.media_url : null)
                    return (
                      <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        {thumb && <img src={thumb} alt={e.nombre} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{e.nombre}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            {e.series && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>Series: {e.series}</span>}
                            {e.reps && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>Reps: {e.reps}</span>}
                            {e.rpe && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>RPE: {e.rpe}</span>}
                          </div>
                          {e.notas && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{e.notas}</div>}
                        </div>
                        <div className="flex gap-1" style={{ flexShrink: 0 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarEjercicio(e, b.id)}>Editar</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarEjercicio(e.id)}><X size={12} /></button>
                        </div>
                      </div>
                    )
                  })}
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirNuevoEjercicio(b.id)} style={{ alignSelf: 'flex-start' }}>
                    <Plus size={12} /> Ejercicio
                  </button>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={abrirNuevoBloque} style={{ alignSelf: 'flex-start' }}>
              <Plus size={13} /> Bloque
            </button>
          </div>
        </div>
      )}

      {/* Modal sesión */}
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
            <div className="form-group"><label className="form-label">Objetivo general</label><textarea className="form-textarea" value={formSesion.objetivo} onChange={e => setFormSesion(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Seguir construyendo base de movilidad y fuerza general..." /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSesion(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSesion} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal bloque */}
      {modalBloque && (
        <div className="modal-backdrop" onClick={() => setModalBloque(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalBloque?.id ? 'Editar bloque' : 'Nuevo bloque'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalBloque(null)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formBloque.nombre} onChange={e => setFormBloque(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Activación, Fuerza general..." autoFocus /></div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {COLORES.map(c => <div key={c} onClick={() => setFormBloque(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: formBloque.color === c ? '3px solid var(--text)' : '3px solid transparent' }} />)}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Nota del bloque (opcional)</label><textarea className="form-textarea" value={formBloque.nota} onChange={e => setFormBloque(f => ({ ...f, nota: e.target.value }))} placeholder="Ej: Usa pesos que permitan mantener buena técnica..." /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalBloque(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarBloque} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ejercicio */}
      {modalEjercicio && (
        <div className="modal-backdrop" onClick={() => setModalEjercicio(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modalEjercicio?.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEjercicio(null)}><X size={14} /></button>
            </div>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formEjercicio.nombre} onChange={e => setFormEjercicio(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Wall sit con disco" autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Series</label><input className="form-input" value={formEjercicio.series} onChange={e => setFormEjercicio(f => ({ ...f, series: e.target.value }))} placeholder="Ej: 2" /></div>
              <div className="form-group"><label className="form-label">Reps</label><input className="form-input" value={formEjercicio.reps} onChange={e => setFormEjercicio(f => ({ ...f, reps: e.target.value }))} placeholder="Ej: 12, 8/lado, 15''" /></div>
              <div className="form-group"><label className="form-label">RPE</label><input className="form-input" value={formEjercicio.rpe} onChange={e => setFormEjercicio(f => ({ ...f, rpe: e.target.value }))} placeholder="Ej: 7" /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de media</label>
              <select className="form-select" value={formEjercicio.media_tipo} onChange={e => setFormEjercicio(f => ({ ...f, media_tipo: e.target.value }))}>
                <option value="youtube">Enlace de YouTube</option>
                <option value="imagen">Imagen propia (URL)</option>
                <option value="video">Vídeo propio (URL)</option>
                <option value="gif">GIF (URL)</option>
              </select>
            </div>
            {formEjercicio.media_tipo === 'youtube' ? (
              <div className="form-group">
                <label className="form-label">Enlace de YouTube</label>
                <input className="form-input" value={formEjercicio.media_url} onChange={e => setFormEjercicio(f => ({ ...f, media_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
                {ytId(formEjercicio.media_url) && <img src={`https://img.youtube.com/vi/${ytId(formEjercicio.media_url)}/hqdefault.jpg`} alt="preview" style={{ width: 100, borderRadius: 8, marginTop: 8 }} />}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">URL de la {formEjercicio.media_tipo === 'imagen' ? 'imagen' : formEjercicio.media_tipo === 'gif' ? 'GIF' : 'vídeo'}</label>
                <input className="form-input" value={formEjercicio.media_url} onChange={e => setFormEjercicio(f => ({ ...f, media_url: e.target.value }))} placeholder="https://..." />
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Enlace "Ver vídeo" (opcional)</label>
                  <input className="form-input" value={formEjercicio.video_url} onChange={e => setFormEjercicio(f => ({ ...f, video_url: e.target.value }))} placeholder="Si quieres un enlace adicional para ver el vídeo completo" />
                </div>
              </div>
            )}
            <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formEjercicio.notas} onChange={e => setFormEjercicio(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: Contrae abdomen con la intención de que no haya espacio..." /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalEjercicio(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEjercicio} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
