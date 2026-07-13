import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Search } from 'lucide-react'

const ICONOS = ['💪','🏃','🚶','🧘','🚴','🏊','⚽','🏀','🎾','🏋️','🤸','🥊','🔥','⚡','🌟','🎽','🦵','🫀','🧠','🎯']
const ETIQUETAS_SESION = ['Fuerza', 'Resistencia', 'Movilidad', 'Activación', 'HIIT', 'Recuperación', 'Core', 'Potencia', 'Técnica', 'Preventivo']

async function copiarPlantillaASesion({ plantilla, clienteId, fecha }) {
  const { data: nueva } = await supabase.from('sesiones').insert({
    cliente_id: clienteId, titulo: plantilla.titulo, fecha,
    objetivo: plantilla.objetivo, duracion_min: plantilla.duracion_min,
    icono: plantilla.icono, tipo_editor: plantilla.tipo_editor || 'fuerza',
    tipo_sesion: 'programada', es_plantilla: false,
  }).select().single()
  if (!nueva) return
  const { data: bls } = await supabase.from('sesion_bloques').select('*').eq('sesion_id', plantilla.id).order('orden')
  for (const b of bls || []) {
    const { data: nb } = await supabase.from('sesion_bloques').insert({
      sesion_id: nueva.id, nombre: b.nombre, color: b.color, nota: b.nota, orden: b.orden,
    }).select().single()
    const { data: ejs } = await supabase.from('sesion_ejercicios').select('*').eq('bloque_id', b.id).order('orden')
    for (const e of ejs || []) {
      await supabase.from('sesion_ejercicios').insert({
        bloque_id: nb.id, nombre: e.nombre, series: e.series, reps: e.reps,
        rpe: e.rpe, notas: e.notas, media_tipo: e.media_tipo,
        media_url: e.media_url, video_url: e.video_url, orden: e.orden,
      })
    }
  }
  return nueva
}

export default function BibliotecaSesiones({ setPage, setSesionesContext }) {
  const [tab, setTab] = useState('lista')
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEtiqueta, setFiltroEtiqueta] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ titulo: '', objetivo: '', icono: '', duracion_min: '', etiquetas: [] })
  const [saving, setSaving] = useState(false)

  // Vista calendario
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [semana, setSemana] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [sesionesCliente, setSesionesCliente] = useState([])
  const [dragging, setDragging] = useState(null)
  const [copiando, setCopiando] = useState(false)
  const [dragOver, setDragOver] = useState(null)

  // Modal copiar
  const [modalCopiar, setModalCopiar] = useState(null)
  const [copiarClienteId, setCopiarClienteId] = useState('')
  const [copiarFecha, setCopiarFecha] = useState('')

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (clientes.length === 0) cargarClientes() }, [tab])
  useEffect(() => { if (clienteId) cargarSesionesCliente() }, [clienteId, semana])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('sesiones').select('*').eq('es_plantilla', true).order('titulo')
    setPlantillas(data || [])
    setLoading(false)
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes(data || [])
  }

  async function cargarSesionesCliente() {
    if (!clienteId) return
    const ini = format(semana, 'yyyy-MM-dd')
    const fin = format(addDays(semana, 7), 'yyyy-MM-dd')
    const { data } = await supabase.from('sesiones').select('*').eq('cliente_id', clienteId).eq('es_plantilla', false).gte('fecha', ini).lt('fecha', fin).order('fecha')
    setSesionesCliente(data || [])
  }

  async function guardar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    const datos = {
      titulo: form.titulo.trim(), objetivo: form.objetivo || null,
      icono: form.icono || null, duracion_min: form.duracion_min ? parseInt(form.duracion_min) : null,
      etiquetas: form.etiquetas, es_plantilla: true, tipo_editor: 'fuerza',
    }
    if (modal?.id) {
      await supabase.from('sesiones').update(datos).eq('id', modal.id)
    } else {
      const { data } = await supabase.from('sesiones').insert(datos).select().single()
      if (data) {
        await supabase.from('sesion_bloques').insert([
          { sesion_id: data.id, nombre: 'Calentamiento', color: '#E29A2E', orden: 0 },
          { sesion_id: data.id, nombre: 'Bloque principal', color: '#2d6a4f', orden: 1 },
          { sesion_id: data.id, nombre: 'Vuelta a la calma', color: '#6b7280', orden: 2 },
        ])
      }
    }
    setSaving(false); setModal(null); cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta sesión de la biblioteca?')) return
    await supabase.from('sesiones').delete().eq('id', id)
    cargar()
  }

  async function copiarACliente() {
    if (!copiarClienteId || !copiarFecha || !modalCopiar) return
    setCopiando(true)
    await copiarPlantillaASesion({ plantilla: modalCopiar, clienteId: copiarClienteId, fecha: copiarFecha })
    setCopiando(false); setModalCopiar(null)
    if (clienteId === copiarClienteId) cargarSesionesCliente()
  }

  async function soltarEnDia(fecha) {
    if (!dragging || !clienteId) return
    setCopiando(true)
    await copiarPlantillaASesion({ plantilla: dragging, clienteId, fecha })
    setCopiando(false); setDragging(null); setDragOver(null)
    cargarSesionesCliente()
  }

  const filtradas = plantillas.filter(p => {
    if (busqueda && !p.titulo.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (filtroEtiqueta && !(p.etiquetas || []).includes(filtroEtiqueta)) return false
    return true
  })

  const todasEtiquetas = [...new Set(plantillas.flatMap(p => p.etiquetas || []))]
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(semana, i))

  function abrirEditorSesion(p) {
    if (setSesionesContext) setSesionesContext({ clienteId: null, sesionId: p.id, esPlantilla: true })
    if (setPage) setPage('sesiones')
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['lista', '📋 Lista de sesiones'], ['calendario', '📅 Vista con calendario']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ fontSize: 13, padding: '8px 18px', border: 'none', background: 'transparent', borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`, color: tab === id ? 'var(--accent)' : 'var(--text2)', fontWeight: tab === id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      {tab === 'lista' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input className="form-input" placeholder="Buscar sesión..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
            <button className="btn btn-primary" onClick={() => { setForm({ titulo: '', objetivo: '', icono: '', duracion_min: '', etiquetas: [] }); setModal('nueva') }}>
              <Plus size={14} /> Nueva sesión
            </button>
          </div>

          {todasEtiquetas.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setFiltroEtiqueta(null)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${!filtroEtiqueta ? 'var(--accent)' : 'var(--border)'}`, background: !filtroEtiqueta ? 'var(--accent-light,#e8f5f0)' : 'transparent', color: !filtroEtiqueta ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>
                Todas
              </button>
              {todasEtiquetas.map(et => (
                <button key={et} onClick={() => setFiltroEtiqueta(filtroEtiqueta === et ? null : et)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${filtroEtiqueta === et ? 'var(--accent)' : 'var(--border)'}`, background: filtroEtiqueta === et ? 'var(--accent-light,#e8f5f0)' : 'transparent', color: filtroEtiqueta === et ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>
                  {et}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="empty"><p>Cargando...</p></div>
          ) : filtradas.length === 0 ? (
            <div className="empty"><p>No hay sesiones en la biblioteca. Crea la primera con el botón "Nueva sesión".</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filtradas.map(p => (
                <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e8f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {p.icono || '💪'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{p.titulo}</div>
                      {p.duracion_min && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.duracion_min} min</div>}
                    </div>
                  </div>
                  {p.objetivo && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{p.objetivo}</div>}
                  {(p.etiquetas || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.etiquetas.map(et => (
                        <span key={et} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{et}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ titulo: p.titulo, objetivo: p.objetivo || '', icono: p.icono || '', duracion_min: p.duracion_min || '', etiquetas: p.etiquetas || [] }); setModal(p) }}>
                      Editar info
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => abrirEditorSesion(p)}>
                      Editar bloques
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setModalCopiar(p); setCopiarClienteId(''); setCopiarFecha(format(new Date(), 'yyyy-MM-dd')) }}>
                      Copiar a cliente
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => eliminar(p.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA CALENDARIO ── */}
      {tab === 'calendario' && (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
          {/* Calendario */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <select className="form-select" style={{ maxWidth: 220 }} value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSemana(s => subWeeks(s, 1))}>‹</button>
                <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 150, textAlign: 'center' }}>
                  {format(semana, 'dd MMM', { locale: es })} – {format(addDays(semana, 6), 'dd MMM yyyy', { locale: es })}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setSemana(s => addWeeks(s, 1))}>›</button>
              </div>
              {copiando && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Copiando sesión...</span>}
            </div>

            {!clienteId ? (
              <div className="empty"><p>Selecciona un cliente para ver su calendario.</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, flex: 1, overflowY: 'auto' }}>
                {diasSemana.map(dia => {
                  const fechaStr = format(dia, 'yyyy-MM-dd')
                  const sesionesDia = sesionesCliente.filter(s => s.fecha === fechaStr)
                  const isOver = dragOver === fechaStr
                  return (
                    <div key={fechaStr}
                      onDragOver={e => { e.preventDefault(); setDragOver(fechaStr) }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => { soltarEnDia(fechaStr) }}
                      style={{ background: isOver ? '#e8f5f0' : 'var(--bg2)', borderRadius: 10, padding: '8px 6px', minHeight: 100, border: `1.5px ${isOver ? 'dashed #2d6a4f' : 'solid var(--border)'}`, display: 'flex', flexDirection: 'column', gap: 5, transition: 'background 0.1s, border 0.1s' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                        {format(dia, 'EEE', { locale: es })}
                        <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{format(dia, 'd')}</span>
                      </div>
                      {sesionesDia.map(s => (
                        <div key={s.id} style={{ background: '#2d6a4f', color: '#fff', borderRadius: 6, padding: '4px 7px', fontSize: 11, fontWeight: 500, lineHeight: 1.3 }}>
                          {s.icono || '💪'} {s.titulo}
                        </div>
                      ))}
                      {isOver && dragging && (
                        <div style={{ background: '#bbf7d0', borderRadius: 6, padding: '4px 7px', fontSize: 11, color: '#14532d', fontWeight: 500 }}>
                          {dragging.icono || '💪'} {dragging.titulo}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Panel biblioteca */}
          <div style={{ width: 268, flexShrink: 0, borderLeft: '1px solid var(--border)', paddingLeft: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Biblioteca · arrastra al calendario</div>
            <input className="form-input" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ marginBottom: 8, fontSize: 12 }} />
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {filtradas.map(p => (
                <div key={p.id} draggable
                  onDragStart={() => setDragging(p)}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  style={{ background: dragging?.id === p.id ? '#e8f5f0' : 'var(--bg)', border: `1px solid ${dragging?.id === p.id ? '#2d6a4f' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{p.icono || '💪'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</div>
                    {p.duracion_min && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.duracion_min} min</div>}
                  </div>
                  <span style={{ color: 'var(--text3)', fontSize: 16, flexShrink: 0 }}>⠿</span>
                </div>
              ))}
              {filtradas.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>Sin sesiones</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar info plantilla */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modal === 'nueva' ? 'Nueva sesión en biblioteca' : 'Editar sesión'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus placeholder="Ej: Activación cadena posterior" />
            </div>
            <div className="form-group">
              <label className="form-label">Icono</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ICONOS.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icono: f.icono === ic ? '' : ic }))}
                    style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${form.icono === ic ? 'var(--accent)' : 'var(--border)'}`, background: form.icono === ic ? 'var(--accent-light,#e8f5f0)' : 'var(--bg)', fontSize: 17, cursor: 'pointer' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duración (min)</label>
                <input className="form-input" type="number" value={form.duracion_min} onChange={e => setForm(f => ({ ...f, duracion_min: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo / descripción</label>
              <textarea className="form-textarea" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Etiquetas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ETIQUETAS_SESION.map(et => {
                  const sel = form.etiquetas.includes(et)
                  return (
                    <button key={et} type="button"
                      onClick={() => setForm(f => ({ ...f, etiquetas: sel ? f.etiquetas.filter(x => x !== et) : [...f.etiquetas, et] }))}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent-light,#e8f5f0)' : 'transparent', color: sel ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontWeight: sel ? 600 : 400 }}>
                      {et}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !form.titulo.trim()} onClick={guardar}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal copiar a cliente */}
      {modalCopiar && (
        <div className="modal-backdrop" onClick={() => setModalCopiar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Copiar a cliente</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCopiar(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
              "{modalCopiar.titulo}" se copiará con todos sus bloques y ejercicios.
            </p>
            <div className="form-group">
              <label className="form-label">Cliente *</label>
              <select className="form-select" value={copiarClienteId} onChange={e => setCopiarClienteId(e.target.value)}>
                <option value="">Selecciona...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input className="form-input" type="date" value={copiarFecha} onChange={e => setCopiarFecha(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCopiar(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={copiando || !copiarClienteId || !copiarFecha} onClick={copiarACliente}>
                {copiando ? 'Copiando...' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
