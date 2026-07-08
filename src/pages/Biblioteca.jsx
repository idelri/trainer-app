import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Plus, X, Pencil, Trash2, ChevronDown, ChevronUp, LayoutGrid, List, Table2, Check } from 'lucide-react'

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const ETIQUETAS = {
  zona_corporal: {
    label: 'Zona corporal',
    grupos: [
      { grupo: 'Cadenas principales', items: ['Cadena Anterior', 'Cadena Posterior', 'Estabilizadores de Cadera', 'Cadena Medial / Aductores'] },
      { grupo: 'CORE / Tronco', items: ['Lumbo-pélvico', 'Abdominal', 'Dorsal / Torácico', 'Cervical'] },
      { grupo: 'Pie / Tobillo', items: ['Gemelos / Sóleos', 'Tibial anterior', 'Peroneos', 'Intrínsecos del pie'] },
    ],
  },
  patron_movimiento: {
    label: 'Patrón de movimiento',
    grupos: [
      { grupo: 'Tren inferior', items: ['Dominante de rodilla', 'Dominante de cadera', 'Dominante de tobillo', 'Abducción / Rotación externa', 'Aducción / Plano medial', 'Pliometría y salto', 'Carrera y locomoción', 'Cambio de dirección / Desaceleración'] },
      { grupo: 'Tren superior', items: ['Empuje horizontal', 'Empuje vertical', 'Tracción horizontal', 'Tracción vertical', 'Estabilidad escapular'] },
      { grupo: 'Core', items: ['Anti-extensión', 'Anti-rotación', 'Anti-flexión lateral', 'Anti-flexión frontal', 'Rotación', 'Flexión de tronco', 'Control lumbopélvico'] },
    ],
  },
  lateralidad_apoyo: {
    label: 'Lateralidad y apoyo',
    grupos: [
      { grupo: 'Tipo de apoyo', items: ['Bilateral', 'Monopodal', 'Asimétrico (Split)', 'Cuadrupedia', 'Plancha / Suspensión', 'Decúbito prono', 'Decúbito supino', 'Decúbito lateral', 'Sentado'] },
      { grupo: 'Ejecución y carga', items: ['Carga bilateral', 'Carga unilateral', 'Unilateral alterno', 'Contralateral', 'Ipsilateral'] },
    ],
  },
  objetivo: {
    label: 'Objetivo',
    grupos: [
      { grupo: '', items: ['Fuerza base', 'Fuerza específica', 'Potencia / Velocidad', 'Técnica / Control motor', 'Movilidad / Flexibilidad'] },
    ],
  },
  tipo_contraccion: {
    label: 'Tipo de contracción',
    grupos: [
      { grupo: '', items: ['Dinámica (Concéntrica + Excéntrica)', 'Excéntrica acentuada', 'Isométrica', 'Isoinercial / Isocinética'] },
    ],
  },
}

const TAG_COLORS = { zona_corporal: '#0369a1', patron_movimiento: '#7c3aed', lateralidad_apoyo: '#065f46', objetivo: '#b45309', tipo_contraccion: '#be185d' }

const SORT_OPTIONS = [
  { value: 'nombre', label: 'Nombre' },
  { value: 'zona_corporal', label: 'Zona corporal' },
  { value: 'patron_movimiento', label: 'Patrón' },
  { value: 'objetivo', label: 'Objetivo' },
  { value: 'tipo_contraccion', label: 'Contracción' },
]

const EMPTY = { nombre: '', descripcion: '', media_tipo: '', media_url: '', video_url: '', notas: '', zona_corporal: [], patron_movimiento: [], lateralidad_apoyo: [], objetivo: [], tipo_contraccion: [] }

function TagSelector({ campo, value = [], onChange }) {
  const config = ETIQUETAS[campo]
  return (
    <div>
      {config.grupos.map(({ grupo, items }) => (
        <div key={grupo} style={{ marginBottom: 8 }}>
          {grupo && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{grupo}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {items.map(item => {
              const activo = value.includes(item)
              return (
                <button key={item} type="button"
                  onClick={() => onChange(activo ? value.filter(v => v !== item) : [...value, item])}
                  style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1.5px solid ${activo ? 'var(--accent)' : 'var(--border)'}`, background: activo ? 'var(--accent-light)' : 'transparent', color: activo ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400, transition: 'all 0.1s' }}>
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniChips({ values = [], color }) {
  if (!values?.length) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {values.map(v => (
        <span key={v} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}33`, fontWeight: 500, whiteSpace: 'nowrap' }}>{v}</span>
      ))}
    </div>
  )
}

// Etiquetas editables: con × para quitar y + para añadir
function InlineTags({ campo, values = [], onChange }) {
  const color = TAG_COLORS[campo]
  const [abierto, setAbierto] = useState(false)
  const ref = useRef()
  const todosItems = ETIQUETAS[campo].grupos.flatMap(g => g.items)
  const disponibles = todosItems.filter(i => !values.includes(i))

  useEffect(() => {
    if (!abierto) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 4, position: 'relative' }} ref={ref}>
      {values.map(v => (
        <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 6px 2px 8px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}55`, fontWeight: 500 }}>
          {v}
          <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color, display: 'flex', alignItems: 'center', opacity: 0.7, lineHeight: 1 }}>
            <X size={9} />
          </button>
        </span>
      ))}
      {disponibles.length > 0 && (
        <button type="button" onClick={() => setAbierto(o => !o)}
          style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, border: `1px dashed ${color}88`, background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Plus size={9} /> añadir
        </button>
      )}
      {abierto && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200, maxWidth: 320 }}>
          {ETIQUETAS[campo].grupos.map(({ grupo, items }) => {
            const disp = items.filter(i => !values.includes(i))
            if (!disp.length) return null
            return (
              <div key={grupo} style={{ marginBottom: 6 }}>
                {grupo && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{grupo}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {disp.map(item => (
                    <button key={item} type="button"
                      onClick={() => { onChange([...values, item]); setAbierto(false) }}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}55`, background: color + '10', color, cursor: 'pointer', fontWeight: 500 }}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Panel de edición inline de etiquetas de un ejercicio
function InlineTagsPanel({ ej, onChange }) {
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Object.keys(ETIQUETAS).map(campo => (
        <div key={campo}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TAG_COLORS[campo], textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{ETIQUETAS[campo].label}</div>
          <InlineTags campo={campo} values={ej[campo] || []} onChange={v => onChange(campo, v)} />
        </div>
      ))}
    </div>
  )
}

export default function Biblioteca() {
  const [ejercicios, setEjercicios] = useState([])
  const [busquedaTexto, setBusquedaTexto] = useState('')
  const [filtros, setFiltros] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [filtroAbierto, setFiltroAbierto] = useState(false)
  const [vista, setVista] = useState('cards')
  const [sortBy, setSortBy] = useState('nombre')
  const [sortDir, setSortDir] = useState('asc')
  const [inlineEj, setInlineEj] = useState(null) // { id, nombre, ...campos } ejercicio en edición inline
  const [inlineSaving, setInlineSaving] = useState(false)
  const [toast, setToast] = useState(null) // 'ok' | 'error'

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('ejercicios_biblioteca').select('*').order('nombre')
    setEjercicios(data || [])
    setLoading(false)
  }

  function mostrarToast(tipo) {
    setToast(tipo)
    setTimeout(() => setToast(null), 2200)
  }

  function abrirNuevo() { setForm(EMPTY); setModal('nuevo') }

  function abrirEditar(e) {
    setInlineEj(null)
    setForm({
      nombre: e.nombre || '', descripcion: e.descripcion || '',
      media_tipo: e.media_tipo || '', media_url: e.media_url || '',
      video_url: e.video_url || '', notas: e.notas || '',
      zona_corporal: e.zona_corporal || [], patron_movimiento: e.patron_movimiento || [],
      lateralidad_apoyo: e.lateralidad_apoyo || [], objetivo: e.objetivo || [],
      tipo_contraccion: e.tipo_contraccion || [],
    })
    setModal(e)
  }

  function activarInline(e) {
    setInlineEj({
      id: e.id, nombre: e.nombre || '',
      zona_corporal: [...(e.zona_corporal || [])], patron_movimiento: [...(e.patron_movimiento || [])],
      lateralidad_apoyo: [...(e.lateralidad_apoyo || [])], objetivo: [...(e.objetivo || [])],
      tipo_contraccion: [...(e.tipo_contraccion || [])],
    })
  }

  function cancelarInline() { setInlineEj(null) }

  function fd(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  async function guardar() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const datos = {
      nombre: form.nombre.trim(), descripcion: form.descripcion || null,
      media_tipo: form.media_tipo || null, media_url: form.media_url || null,
      video_url: form.video_url || null, notas: form.notas || null,
      zona_corporal: form.zona_corporal, patron_movimiento: form.patron_movimiento,
      lateralidad_apoyo: form.lateralidad_apoyo, objetivo: form.objetivo,
      tipo_contraccion: form.tipo_contraccion,
    }
    const { error } = modal === 'nuevo'
      ? await supabase.from('ejercicios_biblioteca').insert(datos)
      : await supabase.from('ejercicios_biblioteca').update(datos).eq('id', modal.id)
    setSaving(false)
    if (error) { mostrarToast('error'); return }
    setModal(null)
    mostrarToast('ok')
    cargar()
  }

  async function guardarInline() {
    if (!inlineEj || !inlineEj.nombre.trim()) return
    setInlineSaving(true)
    const { error } = await supabase.from('ejercicios_biblioteca').update({
      nombre: inlineEj.nombre.trim(),
      zona_corporal: inlineEj.zona_corporal,
      patron_movimiento: inlineEj.patron_movimiento,
      lateralidad_apoyo: inlineEj.lateralidad_apoyo,
      objetivo: inlineEj.objetivo,
      tipo_contraccion: inlineEj.tipo_contraccion,
    }).eq('id', inlineEj.id)
    setInlineSaving(false)
    if (error) { mostrarToast('error'); return }
    setInlineEj(null)
    mostrarToast('ok')
    cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este ejercicio de la biblioteca?')) return
    await supabase.from('ejercicios_biblioteca').delete().eq('id', id)
    if (inlineEj?.id === id) setInlineEj(null)
    cargar()
  }

  function toggleFiltro(campo, valor) {
    setFiltros(f => {
      const prev = f[campo] || []
      const next = prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]
      return { ...f, [campo]: next }
    })
  }

  function toggleSort(campo) {
    if (sortBy === campo) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(campo); setSortDir('asc') }
  }

  const hayFiltros = Object.values(filtros).some(v => v.length > 0)

  const filtrados = ejercicios.filter(e => {
    if (busquedaTexto && !e.nombre.toLowerCase().includes(busquedaTexto.toLowerCase()) && !(e.descripcion || '').toLowerCase().includes(busquedaTexto.toLowerCase())) return false
    for (const [campo, vals] of Object.entries(filtros)) {
      if (!vals.length) continue
      const ejVals = e[campo] || []
      if (!vals.some(v => ejVals.includes(v))) return false
    }
    return true
  }).sort((a, b) => {
    let va = a[sortBy]; let vb = b[sortBy]
    if (Array.isArray(va)) va = (va[0] || '')
    if (Array.isArray(vb)) vb = (vb[0] || '')
    va = (va || '').toLowerCase(); vb = (vb || '').toLowerCase()
    return sortDir === 'asc' ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es')
  })

  const SortArrow = ({ campo }) => {
    if (sortBy !== campo) return <span style={{ color: 'var(--text3)', fontSize: 10 }}>↕</span>
    return <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Renderiza acciones de edición inline (botones guardar/cancelar)
  function InlineActions() {
    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={guardarInline} disabled={inlineSaving || !inlineEj?.nombre?.trim()}>
          {inlineSaving ? 'Guardando...' : <><Check size={12} /> Guardar</>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={cancelarInline}>Cancelar</button>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: toast === 'ok' ? '#166534' : '#991b1b', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s' }}>
          {toast === 'ok' ? <><Check size={15} /> Guardado</> : '✕ Error al guardar'}
        </div>
      )}

      <div className="page-header">
        <div>
          <h2 className="page-title">Biblioteca de ejercicios</h2>
          <p className="page-subtitle">{filtrados.length} de {ejercicios.length} ejercicios</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}><Plus size={14} /> Nuevo ejercicio</button>
      </div>

      {/* Búsqueda, filtros y selector de vista */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar ejercicio..." value={busquedaTexto} onChange={e => setBusquedaTexto(e.target.value)} />
            {busquedaTexto && <button onClick={() => setBusquedaTexto('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={13} /></button>}
          </div>
          <button className="btn btn-ghost" onClick={() => setFiltroAbierto(o => !o)} style={{ gap: 5, color: hayFiltros ? 'var(--accent)' : undefined, borderColor: hayFiltros ? 'var(--accent)' : undefined }}>
            Filtros {hayFiltros ? `(activos)` : ''} {filtroAbierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {hayFiltros && <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({})}>Limpiar</button>}

          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', background: 'var(--bg2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
            {[
              { id: 'cards', icon: <LayoutGrid size={14} />, title: 'Cards' },
              { id: 'lista', icon: <List size={14} />, title: 'Lista' },
              { id: 'tabla', icon: <Table2 size={14} />, title: 'Tabla' },
            ].map(({ id, icon, title }) => (
              <button key={id} title={title} onClick={() => setVista(id)}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: vista === id ? 'var(--bg)' : 'transparent', color: vista === id ? 'var(--accent)' : 'var(--text3)', boxShadow: vista === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.1s', display: 'flex', alignItems: 'center' }}>
                {icon}
              </button>
            ))}
          </div>
        </div>

        {vista === 'lista' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ordenar por:</span>
            {SORT_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => toggleSort(value)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${sortBy === value ? 'var(--accent)' : 'var(--border)'}`, background: sortBy === value ? 'var(--accent-light)' : 'transparent', color: sortBy === value ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontWeight: sortBy === value ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                {label} {sortBy === value && <SortArrow campo={value} />}
              </button>
            ))}
          </div>
        )}

        {filtroAbierto && (
          <div style={{ padding: 16, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(ETIQUETAS).map(([campo, config]) => (
              <div key={campo}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TAG_COLORS[campo], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{config.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {config.grupos.flatMap(g => g.items).map(item => {
                    const activo = (filtros[campo] || []).includes(item)
                    return (
                      <button key={item} type="button" onClick={() => toggleFiltro(campo, item)}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1.5px solid ${activo ? TAG_COLORS[campo] : 'var(--border)'}`, background: activo ? TAG_COLORS[campo] + '18' : 'transparent', color: activo ? TAG_COLORS[campo] : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400 }}>
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty"><p>Cargando...</p></div>
      ) : filtrados.length === 0 ? (
        <div className="empty"><p>No hay ejercicios{busquedaTexto || hayFiltros ? ' con esos filtros' : ''}.</p></div>
      ) : vista === 'cards' ? (
        /* ── VISTA CARDS ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtrados.map(e => {
            const ytid = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
            const thumb = ytid ? `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` : (e.media_url && e.media_tipo !== 'youtube' ? e.media_url : null)
            const abierto = expandido === e.id
            const editando = inlineEj?.id === e.id
            return (
              <div key={e.id} className="card" style={{ padding: 0, overflow: 'hidden', border: editando ? '2px solid var(--accent)' : undefined }}>
                {thumb && !editando && (
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
                    {editando ? (
                      <input className="form-input" value={inlineEj.nombre} autoFocus
                        onChange={ev => setInlineEj(ie => ({ ...ie, nombre: ev.target.value }))}
                        style={{ flex: 1, fontWeight: 600, fontSize: 13, padding: '3px 8px' }} />
                    ) : (
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1, cursor: 'text' }}
                        onDoubleClick={() => activarInline(e)}
                        title="Doble clic para editar">
                        {e.nombre}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {!editando && <button className="btn btn-ghost btn-sm" onClick={() => activarInline(e)} style={{ padding: '2px 6px' }} title="Edición rápida"><Pencil size={11} /></button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)} style={{ padding: '2px 6px' }} title="Editar todo">⚙</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => eliminar(e.id)} style={{ padding: '2px 6px', color: 'var(--danger)' }}><Trash2 size={11} /></button>
                    </div>
                  </div>

                  {!editando && e.descripcion && (
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

                  {editando ? (
                    <>
                      <InlineTagsPanel ej={inlineEj} onChange={(campo, v) => setInlineEj(ie => ({ ...ie, [campo]: v }))} />
                      <InlineActions />
                    </>
                  ) : (
                    <>
                      {e.video_url && <a href={e.video_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--accent)' }}>▶ Ver vídeo</a>}
                      {Object.keys(ETIQUETAS).map(campo => {
                        const vals = e[campo] || []
                        if (!vals.length) return null
                        return (
                          <div key={campo} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                            {vals.map(v => (
                              <span key={v} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: TAG_COLORS[campo] + '18', color: TAG_COLORS[campo], border: `1px solid ${TAG_COLORS[campo]}33`, fontWeight: 500 }}>{v}</span>
                            ))}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : vista === 'lista' ? (
        /* ── VISTA LISTA ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtrados.map(e => {
            const ytid = e.media_tipo === 'youtube' ? ytId(e.media_url) : null
            const thumb = ytid ? `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` : (e.media_url && e.media_tipo !== 'youtube' ? e.media_url : null)
            const abierto = expandido === e.id
            const editando = inlineEj?.id === e.id
            return (
              <div key={e.id} className="card" style={{ padding: '10px 14px', border: editando ? '2px solid var(--accent)' : undefined }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {thumb && !editando && (
                    <div style={{ width: 56, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#000', cursor: ytid ? 'pointer' : 'default', position: 'relative' }}
                      onClick={() => ytid && window.open(`https://www.youtube.com/watch?v=${ytid}`, '_blank')}>
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                      {ytid && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="white" width="10" height="10"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      {editando ? (
                        <input className="form-input" value={inlineEj.nombre} autoFocus
                          onChange={ev => setInlineEj(ie => ({ ...ie, nombre: ev.target.value }))}
                          style={{ flex: 1, fontWeight: 600, fontSize: 13, padding: '3px 8px' }} />
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', cursor: 'text' }}
                          onDoubleClick={() => activarInline(e)} title="Doble clic para editar">
                          {e.nombre}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {!editando && <button className="btn btn-ghost btn-sm" onClick={() => activarInline(e)} style={{ padding: '2px 6px' }} title="Edición rápida"><Pencil size={11} /></button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)} style={{ padding: '2px 6px' }} title="Editar todo">⚙</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => eliminar(e.id)} style={{ padding: '2px 6px', color: 'var(--danger)' }}><Trash2 size={11} /></button>
                      </div>
                    </div>

                    {!editando && e.descripcion && (
                      <div style={{ marginTop: 3 }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4, overflow: abierto ? 'visible' : 'hidden', display: abierto ? 'inline' : '-webkit-box', WebkitLineClamp: abierto ? undefined : 1, WebkitBoxOrient: 'vertical' }}>
                          {e.descripcion}
                        </span>
                        {e.descripcion.length > 60 && (
                          <button onClick={() => setExpandido(abierto ? null : e.id)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                            {abierto ? 'menos' : 'más'}
                          </button>
                        )}
                      </div>
                    )}

                    {editando ? (
                      <>
                        <InlineTagsPanel ej={inlineEj} onChange={(campo, v) => setInlineEj(ie => ({ ...ie, [campo]: v }))} />
                        <InlineActions />
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {Object.keys(ETIQUETAS).map(campo => {
                          const vals = e[campo] || []
                          if (!vals.length) return null
                          return <MiniChips key={campo} values={vals} color={TAG_COLORS[campo]} />
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── VISTA TABLA ── */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {[
                  { campo: 'nombre', label: 'Ejercicio' },
                  { campo: 'zona_corporal', label: 'Zona corporal' },
                  { campo: 'patron_movimiento', label: 'Patrón' },
                  { campo: 'lateralidad_apoyo', label: 'Apoyo' },
                  { campo: 'objetivo', label: 'Objetivo' },
                  { campo: 'tipo_contraccion', label: 'Contracción' },
                ].map(({ campo, label }) => (
                  <th key={campo} onClick={() => toggleSort(campo)}
                    style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: sortBy === campo ? 'var(--accent)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    {label} <SortArrow campo={campo} />
                  </th>
                ))}
                <th style={{ padding: '8px 10px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e, i) => {
                const editando = inlineEj?.id === e.id
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: editando ? 'var(--accent-light)' : i % 2 === 0 ? 'transparent' : 'var(--bg2)', verticalAlign: 'top' }}>
                    <td style={{ padding: '8px 10px', minWidth: 180 }}>
                      {editando ? (
                        <input className="form-input" value={inlineEj.nombre} autoFocus
                          onChange={ev => setInlineEj(ie => ({ ...ie, nombre: ev.target.value }))}
                          style={{ fontWeight: 600, fontSize: 13, padding: '3px 8px', width: '100%' }} />
                      ) : (
                        <>
                          <span style={{ fontWeight: 600, color: 'var(--text)', cursor: 'text' }}
                            onDoubleClick={() => activarInline(e)} title="Doble clic para editar">
                            {e.nombre}
                          </span>
                          {e.descripcion && <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text3)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.descripcion}</div>}
                        </>
                      )}
                    </td>
                    {['zona_corporal', 'patron_movimiento', 'lateralidad_apoyo', 'objetivo', 'tipo_contraccion'].map(campo => (
                      <td key={campo} style={{ padding: '8px 10px', maxWidth: 180 }}>
                        {editando
                          ? <InlineTags campo={campo} values={inlineEj[campo] || []} onChange={v => setInlineEj(ie => ({ ...ie, [campo]: v }))} />
                          : <MiniChips values={e[campo]} color={TAG_COLORS[campo]} />
                        }
                      </td>
                    ))}
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      {editando ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-primary btn-sm" onClick={guardarInline} disabled={inlineSaving}><Check size={11} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={cancelarInline}><X size={11} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => activarInline(e)} style={{ padding: '2px 6px' }} title="Edición rápida"><Pencil size={11} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)} style={{ padding: '2px 6px' }} title="Editar todo">⚙</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => eliminar(e.id)} style={{ padding: '2px 6px', color: 'var(--danger)' }}><Trash2 size={11} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modal === 'nuevo' ? 'Nuevo ejercicio' : 'Editar ejercicio'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Sentadilla búlgara" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea className="form-input" value={form.descripcion} onChange={e => fd('descripcion', e.target.value)} placeholder="Explicación del ejercicio..." rows={3} style={{ resize: 'vertical' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de media</label>
              <select className="form-select" value={form.media_tipo} onChange={e => fd('media_tipo', e.target.value)}>
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
                  <input className="form-input" value={form.media_url} onChange={e => fd('media_url', e.target.value)} placeholder={form.media_tipo === 'youtube' ? 'https://youtube.com/...' : 'https://...'} style={{ flex: 1 }} />
                  {form.media_tipo !== 'youtube' && (
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="image/*,video/*,.gif" style={{ display: 'none' }}
                        onChange={async ev => {
                          const file = ev.target.files?.[0]; if (!file) return
                          const path = `biblioteca/${Date.now()}.${file.name.split('.').pop()}`
                          const { error } = await supabase.storage.from('media-ejercicios').upload(path, file, { upsert: true })
                          if (error) { alert('Error: ' + error.message); return }
                          const { data: { publicUrl } } = supabase.storage.from('media-ejercicios').getPublicUrl(path)
                          fd('media_url', publicUrl); ev.target.value = ''
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
                <input className="form-input" value={form.video_url} onChange={e => fd('video_url', e.target.value)} placeholder="https://..." />
              </div>
            )}

            {Object.entries(ETIQUETAS).map(([campo, config]) => (
              <div key={campo} className="form-group">
                <label className="form-label" style={{ color: TAG_COLORS[campo] }}>{config.label}</label>
                <TagSelector campo={campo} value={form[campo]} onChange={v => fd(campo, v)} />
              </div>
            ))}

            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <textarea className="form-input" value={form.notas} onChange={e => fd('notas', e.target.value)} placeholder="Apuntes, cuidados, variantes..." rows={2} style={{ resize: 'vertical' }} />
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !form.nombre.trim()} onClick={guardar}>{saving ? 'Guardando...' : <><Check size={13} /> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
