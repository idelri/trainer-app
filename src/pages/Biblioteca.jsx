import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Plus, X, Pencil, Trash2 } from 'lucide-react'

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const EMPTY = { nombre: '', descripcion: '', media_tipo: '', media_url: '', video_url: '', notas: '' }

export default function Biblioteca() {
  const [ejercicios, setEjercicios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuevo' | ejercicio
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandido, setExpandido] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('ejercicios_biblioteca').select('*').order('nombre')
    setEjercicios(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setModal('nuevo')
  }

  function abrirEditar(e) {
    setForm({ nombre: e.nombre || '', descripcion: e.descripcion || '', media_tipo: e.media_tipo || '', media_url: e.media_url || '', video_url: e.video_url || '', notas: e.notas || '' })
    setModal(e)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const datos = { nombre: form.nombre.trim(), descripcion: form.descripcion || null, media_tipo: form.media_tipo || null, media_url: form.media_url || null, video_url: form.video_url || null, notas: form.notas || null }
    if (modal === 'nuevo') {
      await supabase.from('ejercicios_biblioteca').insert(datos)
    } else {
      await supabase.from('ejercicios_biblioteca').update(datos).eq('id', modal.id)
    }
    setSaving(false)
    setModal(null)
    cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este ejercicio de la biblioteca?')) return
    await supabase.from('ejercicios_biblioteca').delete().eq('id', id)
    cargar()
  }

  const filtrados = ejercicios.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (e.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Biblioteca de ejercicios</h2>
          <p className="page-subtitle">{ejercicios.length} ejercicios</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}><Plus size={14} /> Nuevo ejercicio</button>
      </div>

      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar ejercicio..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={13} /></button>}
      </div>

      {loading ? (
        <div className="empty"><p>Cargando...</p></div>
      ) : filtrados.length === 0 ? (
        <div className="empty"><p>No hay ejercicios{busqueda ? ' con ese nombre' : ''}.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtrados.map(e => {
            const ytid = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
            const thumb = ytid ? `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` : (e.media_url && e.media_tipo !== 'youtube' ? e.media_url : null)
            const abierto = expandido === e.id
            return (
              <div key={e.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {thumb && (
                  <div style={{ position: 'relative', paddingBottom: '40%', background: '#000', cursor: ytid ? 'pointer' : 'default' }}
                    onClick={() => ytid && window.open(`https://www.youtube.com/watch?v=${ytid}`, '_blank')}>
                    <img src={thumb} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                    {ytid && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>
                    </div>}
                  </div>
                )}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>{e.nombre}</div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)} style={{ padding: '2px 6px' }}><Pencil size={11} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => eliminar(e.id)} style={{ padding: '2px 6px', color: 'var(--danger)' }}><Trash2 size={11} /></button>
                    </div>
                  </div>
                  {e.descripcion && (
                    <div style={{ marginTop: 5 }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, overflow: abierto ? 'visible' : 'hidden', display: abierto ? 'block' : '-webkit-box', WebkitLineClamp: abierto ? undefined : 2, WebkitBoxOrient: 'vertical' }}>
                        {e.descripcion}
                      </div>
                      {e.descripcion.length > 80 && (
                        <button onClick={() => setExpandido(abierto ? null : e.id)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
                          {abierto ? 'Ver menos' : 'Ver más'}
                        </button>
                      )}
                    </div>
                  )}
                  {e.video_url && (
                    <a href={e.video_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--accent)' }}>▶ Ver vídeo</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modal === 'nuevo' ? 'Nuevo ejercicio' : 'Editar ejercicio'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Sentadilla búlgara" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea className="form-input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Explicación del ejercicio..." rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de media</label>
              <select className="form-select" value={form.media_tipo} onChange={e => setForm(f => ({ ...f, media_tipo: e.target.value, media_url: '' }))}>
                <option value="">Sin media</option>
                <option value="youtube">YouTube</option>
                <option value="imagen">Imagen</option>
                <option value="video">Vídeo</option>
                <option value="gif">GIF</option>
              </select>
            </div>
            {form.media_tipo && (
              <div className="form-group">
                <label className="form-label">{form.media_tipo === 'youtube' ? 'Enlace de YouTube' : 'URL'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" value={form.media_url} onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))} placeholder={form.media_tipo === 'youtube' ? 'https://youtube.com/...' : 'https://...'} style={{ flex: 1 }} />
                  {form.media_tipo !== 'youtube' && (
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="image/*,video/*,.gif" style={{ display: 'none' }}
                        onChange={async ev => {
                          const file = ev.target.files?.[0]
                          if (!file) return
                          const ext = file.name.split('.').pop()
                          const path = `biblioteca/${Date.now()}.${ext}`
                          const { error } = await supabase.storage.from('media-ejercicios').upload(path, file, { upsert: true })
                          if (error) { alert('Error al subir: ' + error.message); return }
                          const { data: { publicUrl } } = supabase.storage.from('media-ejercicios').getPublicUrl(path)
                          setForm(f => ({ ...f, media_url: publicUrl }))
                          ev.target.value = ''
                        }} />
                      <span className="btn btn-ghost btn-sm">📁 Subir</span>
                    </label>
                  )}
                </div>
              </div>
            )}
            {form.media_tipo && form.media_tipo !== 'youtube' && (
              <div className="form-group">
                <label className="form-label">Enlace "Ver vídeo" (opcional)</label>
                <input className="form-input" value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <textarea className="form-input" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Apuntes, cuidados, variantes..." rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !form.nombre.trim()} onClick={guardar}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
