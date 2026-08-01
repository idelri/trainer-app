import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  COMPLEJOS, SECCIONES_CLASIFICACION, CAMPOS_CLASIFICACION,
  PATRON_MOVIMIENTO,
  estadoGrupo, toggleGrupo, toggleEstructura, derivarComplejos,
  labelDeId, colorDeId, idsHojaDeEstructura,
  labelDePatronId, colorDePatronId, patronesRecomendadosActivos,
} from '../lib/taxonomia'
import { Search, Plus, X, Pencil, Trash2, ChevronDown, ChevronUp, LayoutGrid, List, Table2, Check, Filter, Play } from 'lucide-react'
import BibliotecaSesiones from './BibliotecaSesiones'

function ytId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const SORT_OPTIONS = [
  { value: 'nombre', label: 'Nombre' },
  { value: 'patron_movimiento', label: 'Patrón' },
  { value: 'material', label: 'Material' },
]

const EMPTY_CLASIFICACION = {
  complejo_articular: [], estructura_anatomica: [],
  familia: [], patron_movimiento: [], posicion_ejercicio: [],
  plano_movimiento: [], tipo_contraccion: [], material: [],
}

const EMPTY = {
  nombre: '', descripcion: '', media_tipo: '', media_url: '', video_url: '', notas: '',
  ...EMPTY_CLASIFICACION,
}

// ── COMPLEX SELECTOR ─────────────────────────────────────────────────────────
function ComplexSelector({ estructura_anatomica, onChange }) {
  const [expandido, setExpandido] = useState(null)

  function handleToggleGrupo(grupo) {
    const nextEst = toggleGrupo(grupo, estructura_anatomica)
    onChange({ estructura_anatomica: nextEst, complejo_articular: derivarComplejos(nextEst) })
  }

  function handleToggleHijo(hijo, grupo) {
    const nextEst = toggleEstructura(hijo.id, grupo, estructura_anatomica)
    onChange({ estructura_anatomica: nextEst, complejo_articular: derivarComplejos(nextEst) })
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {COMPLEJOS.map(c => {
          const tieneSeleccion = estructura_anatomica.some(id => id.startsWith(c.id + ':'))
          const activo = expandido === c.id
          const nHojas = idsHojaDeEstructura(estructura_anatomica.filter(id => id.startsWith(c.id + ':'))).length
          return (
            <button key={c.id} type="button"
              onClick={() => setExpandido(activo ? null : c.id)}
              style={{
                fontSize: 12, padding: '5px 11px', borderRadius: 20,
                border: `1.5px solid ${tieneSeleccion ? c.color : activo ? c.color + '80' : 'var(--border)'}`,
                background: activo ? c.color + '18' : tieneSeleccion ? c.color + '10' : 'transparent',
                color: tieneSeleccion || activo ? c.color : 'var(--text2)',
                cursor: 'pointer', fontWeight: tieneSeleccion ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.1s',
              }}>
              <span>{c.emoji}</span>
              <span>{c.label}</span>
              {nHojas > 0 && (
                <span style={{ fontSize: 9, background: c.color, color: '#fff', borderRadius: 10, padding: '1px 5px', fontWeight: 700 }}>
                  {nHojas}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {expandido && (() => {
        const complejo = COMPLEJOS.find(c => c.id === expandido)
        if (!complejo) return null
        return (
          <div style={{ border: `1.5px solid ${complejo.color}44`, borderRadius: 10, padding: '12px 14px', background: complejo.color + '08', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: complejo.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {complejo.emoji} {complejo.label}
            </div>
            {complejo.grupos.map(grupo => {
              const estado = estadoGrupo(grupo, estructura_anatomica)
              return (
                <div key={grupo.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <button type="button" onClick={() => handleToggleGrupo(grupo)}
                      style={{
                        width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                        border: `1.5px solid ${estado === 'empty' ? 'var(--border)' : complejo.color}`,
                        background: estado === 'full' ? complejo.color : estado === 'partial' ? complejo.color + '44' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {estado === 'full' && <span style={{ color: '#fff', fontSize: 8, lineHeight: 1 }}>✓</span>}
                      {estado === 'partial' && <span style={{ color: complejo.color, fontSize: 10, lineHeight: 1 }}>−</span>}
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {grupo.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 23 }}>
                    {grupo.children.map(hijo => {
                      const sel = estructura_anatomica.includes(hijo.id)
                      return (
                        <button key={hijo.id} type="button"
                          onClick={() => handleToggleHijo(hijo, grupo)}
                          style={{
                            fontSize: 11, padding: '3px 10px', borderRadius: 20,
                            border: `1.5px solid ${sel ? complejo.color : 'var(--border)'}`,
                            background: sel ? complejo.color + '22' : 'transparent',
                            color: sel ? complejo.color : 'var(--text2)',
                            cursor: 'pointer', fontWeight: sel ? 600 : 400, transition: 'all 0.1s',
                          }}>
                          {hijo.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

// ── PATRON SELECTOR ──────────────────────────────────────────────────────────
function PatronSelector({ value = [], onChange, complejosSeleccionados = [], estructurasSeleccionadas = [] }) {
  const [todosAbierto, setTodosAbierto] = useState(false)

  const recomSet = new Set(patronesRecomendadosActivos(complejosSeleccionados, estructurasSeleccionadas))

  // Grupos que contienen al menos un hijo recomendado
  const bloquesRec = PATRON_MOVIMIENTO
    .map(bloque => ({
      ...bloque,
      grupos: bloque.grupos.filter(g => g.children.some(c => recomSet.has(c.id))),
    }))
    .filter(b => b.grupos.length > 0)

  function renderGrupo(grupo, color) {
    const estado = estadoGrupo(grupo, value)
    return (
      <div key={grupo.id} style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <button type="button" onClick={() => onChange(toggleGrupo(grupo, value))}
            style={{
              width: 15, height: 15, borderRadius: 3, flexShrink: 0,
              border: `1.5px solid ${estado === 'empty' ? 'var(--border)' : color}`,
              background: estado === 'full' ? color : estado === 'partial' ? color + '44' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {estado === 'full' && <span style={{ color: '#fff', fontSize: 8, lineHeight: 1 }}>✓</span>}
            {estado === 'partial' && <span style={{ color, fontSize: 10, lineHeight: 1 }}>−</span>}
          </button>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {grupo.label}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 23 }}>
          {grupo.children.map(hijo => {
            const sel = value.includes(hijo.id)
            return (
              <button key={hijo.id} type="button"
                onClick={() => onChange(toggleEstructura(hijo.id, grupo, value))}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  border: `1.5px solid ${sel ? color : 'var(--border)'}`,
                  background: sel ? color + '22' : 'transparent',
                  color: sel ? color : 'var(--text2)',
                  cursor: 'pointer', fontWeight: sel ? 600 : 400, transition: 'all 0.1s',
                }}>
                {hijo.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {bloquesRec.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            💡 Sugeridos según anatomía seleccionada
          </div>
          {bloquesRec.map(bloque => (
            <div key={bloque.id}>
              {bloquesRec.length > 1 && (
                <div style={{ fontSize: 10, color: bloque.color, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{bloque.label}</div>
              )}
              {bloque.grupos.map(grupo => renderGrupo(grupo, bloque.color))}
            </div>
          ))}
        </div>
      )}

      <div>
        <button type="button" onClick={() => setTodosAbierto(o => !o)}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: todosAbierto ? 10 : 0 }}>
          {todosAbierto ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          Todos los patrones
        </button>
        {todosAbierto && (
          <div>
            {PATRON_MOVIMIENTO.map(bloque => (
              <div key={bloque.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: bloque.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{bloque.label}</div>
                {bloque.grupos.map(grupo => renderGrupo(grupo, bloque.color))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TAG SELECTOR (secciones tipo grupos y chips) ──────────────────────────────
function TagSelector({ seccion, value = [], onChange, listMode }) {
  if (seccion.tipo === 'chips') {
    const getLabel = seccion.labelFn || (id => id)
    if (listMode) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {seccion.items.map(item => {
            const activo = value.includes(item)
            return (
              <div key={item}
                onClick={() => onChange(activo ? value.filter(v => v !== item) : [...value, item])}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', background: activo ? '#f0fdf4' : 'transparent', transition: 'background 0.1s' }}>
                <span style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${activo ? '#2d6a4f' : 'var(--border-strong, #cbd5e1)'}`, background: activo ? '#2d6a4f' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activo && <Check size={8} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ fontSize: 11.5, color: activo ? '#065f46' : 'var(--text2)', fontWeight: activo ? 500 : 400 }}>{getLabel(item)}</span>
              </div>
            )
          })}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {seccion.items.map(item => {
          const activo = value.includes(item)
          return (
            <button key={item} type="button"
              onClick={() => onChange(activo ? value.filter(v => v !== item) : [...value, item])}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${activo ? seccion.color : 'var(--border)'}`, background: activo ? seccion.color + '22' : 'transparent', color: activo ? seccion.color : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400, transition: 'all 0.1s' }}>
              {getLabel(item)}
            </button>
          )
        })}
      </div>
    )
  }
  if (listMode) {
    return (
      <div>
        {seccion.grupos.map(({ grupo, items }) => (
          <div key={grupo} style={{ marginBottom: 6 }}>
            {grupo && <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{grupo}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map(item => {
                const activo = value.includes(item)
                return (
                  <div key={item}
                    onClick={() => onChange(activo ? value.filter(v => v !== item) : [...value, item])}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', background: activo ? '#f0fdf4' : 'transparent', transition: 'background 0.1s' }}>
                    <span style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${activo ? '#2d6a4f' : 'var(--border-strong, #cbd5e1)'}`, background: activo ? '#2d6a4f' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activo && <Check size={8} color="#fff" strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize: 11.5, color: activo ? '#065f46' : 'var(--text2)', fontWeight: activo ? 500 : 400 }}>{item}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div>
      {seccion.grupos.map(({ grupo, items }) => (
        <div key={grupo} style={{ marginBottom: 8 }}>
          {grupo && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{grupo}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {items.map(item => {
              const activo = value.includes(item)
              return (
                <button key={item} type="button"
                  onClick={() => onChange(activo ? value.filter(v => v !== item) : [...value, item])}
                  style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1.5px solid ${activo ? seccion.color : 'var(--border)'}`, background: activo ? seccion.color + '22' : 'transparent', color: activo ? seccion.color : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400, transition: 'all 0.1s' }}>
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

// ── MINI CHIPS (display) ──────────────────────────────────────────────────────
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

// Chips de estructura anatómica con color por complejo
function EstructuraChips({ estructuraIds = [] }) {
  const hojas = idsHojaDeEstructura(estructuraIds)
  if (!hojas.length) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {hojas.map(id => {
        const color = colorDeId(id)
        return (
          <span key={id} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}33`, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {labelDeId(id)}
          </span>
        )
      })}
    </div>
  )
}

// ── INLINE TAGS (editable, tabla) ─────────────────────────────────────────────
function InlineTags({ seccion, values = [], onChange }) {
  const color = seccion.color
  const getLabel = seccion.labelFn || (id => id)

  // Para tipo:'patron' extraemos todos los hijos de PATRON_MOVIMIENTO como items planos
  const allItems = seccion.tipo === 'patron'
    ? PATRON_MOVIMIENTO.flatMap(b => b.grupos.flatMap(g => g.children.map(c => c.id)))
    : seccion.tipo === 'chips'
      ? seccion.items
      : seccion.grupos.flatMap(g => g.items)

  const disponibles = allItems.filter(i => !values.includes(i))
  const [abierto, setAbierto] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!abierto) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 4, position: 'relative' }} ref={ref}>
      {values.map(v => {
        const label = seccion.tipo === 'patron' ? labelDePatronId(v) : getLabel(v)
        return (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 6px 2px 8px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}55`, fontWeight: 500 }}>
            {label}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
              <X size={9} />
            </button>
          </span>
        )
      })}
      {disponibles.length > 0 && (
        <button type="button" onClick={() => setAbierto(o => !o)}
          style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, border: `1px dashed ${color}88`, background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Plus size={9} /> añadir
        </button>
      )}
      {abierto && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200, maxWidth: 340, maxHeight: 260, overflowY: 'auto' }}>
          {(seccion.tipo === 'chips' || seccion.tipo === 'patron') ? (
            seccion.tipo === 'patron'
              ? PATRON_MOVIMIENTO.map(bloque => {
                  const dispBloque = bloque.grupos.flatMap(g => g.children.map(c => c.id)).filter(id => !values.includes(id))
                  if (!dispBloque.length) return null
                  return (
                    <div key={bloque.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: bloque.color, textTransform: 'uppercase', marginBottom: 4 }}>{bloque.label}</div>
                      {bloque.grupos.map(grupo => {
                        const dispGrupo = grupo.children.map(c => c.id).filter(id => !values.includes(id))
                        if (!dispGrupo.length) return null
                        return (
                          <div key={grupo.id} style={{ marginBottom: 5 }}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>{grupo.label}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {dispGrupo.map(id => (
                                <button key={id} type="button"
                                  onClick={() => { onChange([...values, id]); setAbierto(false) }}
                                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: `1px solid ${bloque.color}55`, background: bloque.color + '10', color: bloque.color, cursor: 'pointer', fontWeight: 500 }}>
                                  {labelDePatronId(id)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {disponibles.map(item => (
                    <button key={item} type="button"
                      onClick={() => { onChange([...values, item]); setAbierto(false) }}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}55`, background: color + '10', color, cursor: 'pointer', fontWeight: 500 }}>
                      {getLabel(item)}
                    </button>
                  ))}
                </div>
              )
          ) : seccion.grupos.map(({ grupo, items }) => {
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

// ── INLINE TAGS PANEL (dentro de cards/lista en edición rápida) ───────────────
function InlineTagsPanel({ ej, onChange }) {
  // Para estructura_anatomica mostramos chips removibles (sin selector complejo inline)
  const hojas = idsHojaDeEstructura(ej.estructura_anatomica || [])
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {hojas.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Estructura implicada</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {hojas.map(id => {
              const color = colorDeId(id)
              return (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 6px 2px 8px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}55`, fontWeight: 500 }}>
                  {labelDeId(id)}
                  <button type="button" onClick={() => {
                    const nextEst = (ej.estructura_anatomica || []).filter(x => x !== id)
                    const grupoId = ej.estructura_anatomica.find(x => {
                      const prefijo = id.split(':')[0]
                      const nombreGrupo = id.split(':')[1]
                      return x === prefijo + ':' + nombreGrupo.split('_')[0]
                    })
                    onChange('estructura_anatomica', nextEst)
                    onChange('complejo_articular', derivarComplejos(nextEst))
                  }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                    <X size={9} />
                  </button>
                </span>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>Usa ⚙ para editar la jerarquía completa</div>
        </div>
      )}
      {SECCIONES_CLASIFICACION.filter(s => s.tipo !== 'complejos').map(seccion => (
        <div key={seccion.campo}>
          <div style={{ fontSize: 10, fontWeight: 700, color: seccion.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{seccion.label}</div>
          <InlineTags seccion={seccion} values={ej[seccion.campo] || []} onChange={v => onChange(seccion.campo, v)} />
          {seccion.tipo === 'patron' && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>Usa ⚙ para editar la jerarquía completa</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── COLUMN FILTER (tabla) ─────────────────────────────────────────────────────
function ColumnFilter({ seccion, filtros, toggleFiltro, clearFiltro, ejercicios }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const campo = seccion.campo
  const activos = filtros[campo] || []
  const getLabel = seccion.labelFn || (seccion.tipo === 'patron' ? labelDePatronId : (id => id))
  const allItems = seccion.tipo === 'patron'
    ? PATRON_MOVIMIENTO.flatMap(b => b.grupos.flatMap(g => g.children.map(c => c.id)))
    : seccion.tipo === 'chips'
      ? seccion.items
      : seccion.grupos.flatMap(g => g.items)
  const valoresUsados = new Set()
  ejercicios.forEach(e => (e[campo] || []).forEach(v => valoresUsados.add(v)))
  const items = allItems.filter(v => valoresUsados.has(v))

  useEffect(() => {
    if (!abierto) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  if (items.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={e => { e.stopPropagation(); setAbierto(v => !v) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4, color: activos.length ? seccion.color : 'var(--text3)', display: 'flex', alignItems: 'center' }}
        title="Filtrar por esta columna">
        <Filter size={10} style={{ fill: activos.length ? seccion.color : 'none' }} />
        {activos.length > 0 && <span style={{ fontSize: 9, marginLeft: 1, fontWeight: 700 }}>{activos.length}</span>}
      </button>
      {abierto && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 999, minWidth: 200, maxWidth: 280, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 10, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: seccion.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{seccion.label}</span>
            {activos.length > 0 && (
              <button type="button" onClick={() => clearFiltro(campo)} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ limpiar</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
            {items.map(item => {
              const sel = activos.includes(item)
              return (
                <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '3px 4px', borderRadius: 5, background: sel ? seccion.color + '14' : 'transparent' }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleFiltro(campo, item)} style={{ accentColor: seccion.color, cursor: 'pointer', width: 13, height: 13 }} />
                  <span style={{ fontSize: 11.5, color: sel ? seccion.color : 'var(--text2)', fontWeight: sel ? 600 : 400 }}>{getLabel(item)}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── BIBLIOTECA BLOQUES (sin cambios) ─────────────────────────────────────────
function BibliotecaBloques() {
  const [bloques, setBloques] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuevo' | bloque-obj
  const [form, setForm] = useState({ nombre: '', descripcion: '', foco: '', color: '#2d6a4f' })
  const [formEjs, setFormEjs] = useState([])
  const [saving, setSaving] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('bloques_biblioteca').select('*, bloques_biblioteca_ejercicios(*)').order('nombre')
    setBloques((data || []).map(b => ({ ...b, ejercicios: (b.bloques_biblioteca_ejercicios || []).sort((a, z) => a.orden - z.orden) })))
    setLoading(false)
  }

  function abrirNuevo() {
    setForm({ nombre: '', descripcion: '', foco: '', color: '#2d6a4f' })
    setFormEjs([{ nombre: '', series: '', reps: '', rpe: '', notas: '', _key: Date.now() }])
    setModal('nuevo')
  }

  function abrirEditar(b) {
    setForm({ nombre: b.nombre || '', descripcion: b.descripcion || '', foco: b.foco || '', color: b.color || '#2d6a4f' })
    setFormEjs(b.ejercicios.map(e => ({ ...e, _key: e.id })))
    setModal(b)
  }

  function addEjRow() {
    setFormEjs(ejs => [...ejs, { nombre: '', series: '', reps: '', rpe: '', notas: '', _key: Date.now() }])
  }

  function removeEjRow(key) {
    setFormEjs(ejs => ejs.filter(e => e._key !== key))
  }

  function updateEjRow(key, campo, valor) {
    setFormEjs(ejs => ejs.map(e => e._key === key ? { ...e, [campo]: valor } : e))
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    if (modal === 'nuevo') {
      const { data: nb } = await supabase.from('bloques_biblioteca').insert({ nombre: form.nombre.trim(), descripcion: form.descripcion || null, foco: form.foco || null, color: form.color || '#2d6a4f' }).select().single()
      if (nb) {
        for (let i = 0; i < formEjs.length; i++) {
          const { _key, id, bloque_bib_id, ...p } = formEjs[i]
          if (p.nombre?.trim()) await supabase.from('bloques_biblioteca_ejercicios').insert({ ...p, bloque_bib_id: nb.id, orden: i })
        }
      }
    } else {
      await supabase.from('bloques_biblioteca').update({ nombre: form.nombre.trim(), descripcion: form.descripcion || null, foco: form.foco || null, color: form.color || '#2d6a4f' }).eq('id', modal.id)
      await supabase.from('bloques_biblioteca_ejercicios').delete().eq('bloque_bib_id', modal.id)
      for (let i = 0; i < formEjs.length; i++) {
        const { _key, id, bloque_bib_id, ...p } = formEjs[i]
        if (p.nombre?.trim()) await supabase.from('bloques_biblioteca_ejercicios').insert({ ...p, bloque_bib_id: modal.id, orden: i })
      }
    }
    setSaving(false); setModal(null); cargar()
  }

  async function eliminar(id) {
    await supabase.from('bloques_biblioteca').delete().eq('id', id)
    setConfirmEliminar(null); cargar()
  }

  const COLORES_BIB = ['#2d6a4f', '#4C82E8', '#E29A2E', '#8B6CE0', '#DD6F97', '#34AEB8']

  if (loading) return <p style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0' }}>Cargando...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>{bloques.length} bloques guardados</p>
        <button className="btn btn-primary" onClick={abrirNuevo}><Plus size={14} /> Nuevo bloque</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bloques.map(b => (
          <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${b.color || '#2d6a4f'}` }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpandido(expandido === b.id ? null : b.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{b.nombre}</div>
                {b.descripcion && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{b.descripcion}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{b.ejercicios.length} ejercicios{b.foco ? ` · ${b.foco}` : ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); abrirEditar(b) }}><Pencil size={13} /></button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); setConfirmEliminar(b) }}><Trash2 size={13} /></button>
              {expandido === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
            {expandido === b.id && b.ejercicios.length > 0 && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.ejercicios.map((e, i) => (
                  <div key={e.id} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 18, marginTop: 1 }}>{i + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{e.nombre || 'Sin nombre'}</div>
                      <div style={{ color: 'var(--text3)', marginTop: 2 }}>
                        {[e.series && `${e.series} series`, e.reps && `${e.reps} reps`, e.rpe && `RPE ${e.rpe}`].filter(Boolean).join(' · ')}
                        {e.notas && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>{e.notas}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {bloques.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>No hay bloques guardados. Usa 🧱 en un bloque de sesión para guardarlo aquí.</p>}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modal === 'nuevo' ? 'Nuevo bloque' : 'Editar bloque'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Activación glútea" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción / foco</label>
              <input className="form-input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Activación de cadena posterior..." />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORES_BIB.map(c => (
                  <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--text)' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Ejercicios</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {formEjs.map(e => (
                  <div key={e._key} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <input className="form-input" style={{ flex: 3, fontSize: 12 }} placeholder="Nombre del ejercicio" value={e.nombre} onChange={ev => updateEjRow(e._key, 'nombre', ev.target.value)} />
                    <input className="form-input" style={{ flex: 1, fontSize: 12 }} placeholder="Series" value={e.series} onChange={ev => updateEjRow(e._key, 'series', ev.target.value)} />
                    <input className="form-input" style={{ flex: 1, fontSize: 12 }} placeholder="Reps" value={e.reps} onChange={ev => updateEjRow(e._key, 'reps', ev.target.value)} />
                    <input className="form-input" style={{ flex: 1, fontSize: 12 }} placeholder="RPE" value={e.rpe} onChange={ev => updateEjRow(e._key, 'rpe', ev.target.value)} />
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => removeEjRow(e._key)}><X size={13} /></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={addEjRow} style={{ alignSelf: 'flex-start' }}><Plus size={13} /> Ejercicio</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmEliminar && (
        <div className="modal-backdrop" onClick={() => setConfirmEliminar(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Eliminar bloque</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmEliminar(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>¿Eliminar <strong>{confirmEliminar.nombre}</strong> de la biblioteca? Esta acción no afecta las sesiones existentes.</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmEliminar(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => eliminar(confirmEliminar.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── BIBLIOTECA PRINCIPAL ──────────────────────────────────────────────────────
export default function Biblioteca({ setPage, setSesionesContext }) {
  const [tabPrincipal, setTabPrincipal] = useState('ejercicios')
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
  const [inlineEj, setInlineEj] = useState(null)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [videoConflicto, setVideoConflicto] = useState(null)

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

  function extraerYtId(url) {
    if (!url) return null
    const m = url.match(/(?:[?&]v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)
    return m ? m[1] : null
  }

  async function comprobarVideoConflicto(url, idActual) {
    setVideoConflicto(null)
    const id = extraerYtId(url)
    if (!id) return
    const { data } = await supabase.from('ejercicios_biblioteca').select('id, nombre, media_url').ilike('media_url', `%${id}%`)
    if (!data) return
    const conflicto = data.find(e => e.id !== idActual)
    setVideoConflicto(conflicto || null)
  }

  function abrirNuevo() { setForm(EMPTY); setModal('nuevo'); setVideoConflicto(null) }

  function abrirEditar(e) {
    setInlineEj(null)
    setVideoConflicto(null)
    setForm({
      nombre: e.nombre || '', descripcion: e.descripcion || '',
      media_tipo: e.media_tipo || '', media_url: e.media_url || '',
      video_url: e.video_url || '', notas: e.notas || '',
      complejo_articular: e.complejo_articular || [],
      estructura_anatomica: e.estructura_anatomica || [],
      familia: e.familia || [],
      patron_movimiento: e.patron_movimiento || [],
      posicion_ejercicio: e.posicion_ejercicio || [],
      plano_movimiento: e.plano_movimiento || [],
      tipo_contraccion: e.tipo_contraccion || [],
      material: e.material || [],
    })
    setModal(e)
  }

  function activarInline(e) {
    setInlineEj({
      id: e.id, nombre: e.nombre || '',
      complejo_articular: [...(e.complejo_articular || [])],
      estructura_anatomica: [...(e.estructura_anatomica || [])],
      familia: [...(e.familia || [])],
      patron_movimiento: [...(e.patron_movimiento || [])],
      posicion_ejercicio: [...(e.posicion_ejercicio || [])],
      plano_movimiento: [...(e.plano_movimiento || [])],
      tipo_contraccion: [...(e.tipo_contraccion || [])],
      material: [...(e.material || [])],
    })
  }

  function cancelarInline() { setInlineEj(null) }

  function fd(campo, valor) {
    if (campo === 'estructura_anatomica') {
      setForm(f => ({ ...f, estructura_anatomica: valor, complejo_articular: derivarComplejos(valor) }))
    } else if (campo === 'complejo_articular') {
      setForm(f => ({ ...f, complejo_articular: valor }))
    } else {
      setForm(f => ({ ...f, [campo]: valor }))
    }
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const datos = {
      nombre: form.nombre.trim(), descripcion: form.descripcion || null,
      media_tipo: form.media_tipo || null, media_url: form.media_url || null,
      video_url: form.video_url || null, notas: form.notas || null,
      complejo_articular: form.complejo_articular,
      estructura_anatomica: form.estructura_anatomica,
      familia: form.familia,
      patron_movimiento: form.patron_movimiento,
      posicion_ejercicio: form.posicion_ejercicio,
      plano_movimiento: form.plano_movimiento,
      tipo_contraccion: form.tipo_contraccion,
      material: form.material,
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
      complejo_articular: inlineEj.complejo_articular,
      estructura_anatomica: inlineEj.estructura_anatomica,
      familia: inlineEj.familia,
      patron_movimiento: inlineEj.patron_movimiento,
      posicion_ejercicio: inlineEj.posicion_ejercicio,
      plano_movimiento: inlineEj.plano_movimiento,
      tipo_contraccion: inlineEj.tipo_contraccion,
      material: inlineEj.material,
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

  function clearFiltro(campo) {
    setFiltros(f => ({ ...f, [campo]: [] }))
  }

  function toggleSort(campo) {
    if (sortBy === campo) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(campo); setSortDir('asc') }
  }

  const hayFiltros = Object.values(filtros).some(v => v.length > 0)

  // Secciones de filtro (solo las que tienen campo plano, no complejos)
  const seccionesFiltro = SECCIONES_CLASIFICACION.filter(s => s.tipo !== 'complejos')

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

  // Columnas tabla (excluye estructura_anatomica compleja, usa patron+material)
  const TABLA_COLUMNAS = [
    { campo: 'nombre', label: 'Ejercicio', filtrable: false },
    { campo: 'familia', label: 'Familia', filtrable: true, seccion: seccionesFiltro.find(s => s.campo === 'familia') },
    { campo: 'patron_movimiento', label: 'Patrón', filtrable: true, seccion: seccionesFiltro.find(s => s.campo === 'patron_movimiento') },
    { campo: 'posicion_ejercicio', label: 'Posición', filtrable: true, seccion: seccionesFiltro.find(s => s.campo === 'posicion_ejercicio') },
    { campo: 'material', label: 'Material', filtrable: true, seccion: seccionesFiltro.find(s => s.campo === 'material') },
  ]

  return (
    <div className="page">
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: toast === 'ok' ? '#166534' : '#991b1b', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s' }}>
          {toast === 'ok' ? <><Check size={15} /> Guardado</> : '✕ Error al guardar'}
        </div>
      )}

      <div className="page-header">
        <h2 className="page-title">Biblioteca</h2>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['ejercicios', '🏋️ Ejercicios'], ['bloques', '🧱 Bloques'], ['sesiones', '📋 Sesiones']].map(([id, label]) => (
          <button key={id} onClick={() => setTabPrincipal(id)}
            style={{ fontSize: 14, padding: '8px 22px', border: 'none', background: 'transparent', borderBottom: `2px solid ${tabPrincipal === id ? 'var(--accent)' : 'transparent'}`, color: tabPrincipal === id ? 'var(--accent)' : 'var(--text2)', fontWeight: tabPrincipal === id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {tabPrincipal === 'sesiones' && <BibliotecaSesiones setPage={setPage} setSesionesContext={setSesionesContext} />}
      {tabPrincipal === 'bloques' && <BibliotecaBloques />}

      {tabPrincipal === 'ejercicios' && (<>
        <div className="page-header" style={{ marginTop: 0, paddingTop: 0 }}>
          <p className="page-subtitle">{filtrados.length} de {ejercicios.length} ejercicios</p>
          <button className="btn btn-primary" onClick={abrirNuevo}><Plus size={14} /> Nuevo ejercicio</button>
        </div>

        {/* Búsqueda, filtros y vista */}
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar ejercicio..." value={busquedaTexto} onChange={e => setBusquedaTexto(e.target.value)} />
              {busquedaTexto && <button onClick={() => setBusquedaTexto('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={13} /></button>}
            </div>
            <button className="btn btn-ghost" onClick={() => setFiltroAbierto(o => !o)} style={{ gap: 5, color: hayFiltros ? 'var(--accent)' : undefined, borderColor: hayFiltros ? 'var(--accent)' : undefined }}>
              Filtros {hayFiltros ? '(activos)' : ''} {filtroAbierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {hayFiltros && <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({})}>Limpiar</button>}
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', background: 'var(--bg2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
              {[{ id: 'cards', icon: <LayoutGrid size={14} />, title: 'Cards' }, { id: 'lista', icon: <List size={14} />, title: 'Lista' }, { id: 'tabla', icon: <Table2 size={14} />, title: 'Tabla' }].map(({ id, icon, title }) => (
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
            <div style={{ padding: 16, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '0 0 12px', fontStyle: 'italic' }}>
                Distintas categorías filtran con AND. Dentro de la misma categoría, con OR.
              </p>
              {seccionesFiltro.map((seccion, idx, arr) => (
                <div key={seccion.campo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: seccion.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{seccion.label}</div>
                    {(filtros[seccion.campo] || []).length > 0 && (
                      <button type="button" onClick={() => setFiltros(f => ({ ...f, [seccion.campo]: [] }))}
                        style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕ limpiar</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 0 }}>
                    {(seccion.tipo === 'patron'
                      ? PATRON_MOVIMIENTO.flatMap(b => b.grupos.flatMap(g => g.children.map(c => c.id)))
                      : seccion.tipo === 'chips'
                        ? seccion.items
                        : seccion.grupos.flatMap(g => g.items)
                    ).map(item => {
                      const activo = (filtros[seccion.campo] || []).includes(item)
                      const label = seccion.tipo === 'patron'
                        ? labelDePatronId(item)
                        : seccion.labelFn
                          ? seccion.labelFn(item)
                          : item
                      return (
                        <button key={item} type="button" onClick={() => toggleFiltro(seccion.campo, item)}
                          style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1.5px solid ${activo ? seccion.color : 'var(--border)'}`, background: activo ? seccion.color + '18' : 'transparent', color: activo ? seccion.color : 'var(--text2)', cursor: 'pointer', fontWeight: activo ? 600 : 400 }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      {(filtros[seccion.campo] || []).length > 0 && Object.entries(filtros).some(([k, v]) => k !== seccion.campo && v.length > 0)
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', padding: '1px 8px', borderRadius: 20, background: 'var(--accent-light)', border: '1px solid var(--accent)' }}>AND</span>
                        : <span style={{ fontSize: 10, color: 'var(--text3)', padding: '1px 8px' }}>+</span>}
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
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
          /* ── CARDS ── */
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
                          onDoubleClick={() => activarInline(e)} title="Doble clic para editar">
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
                        <EstructuraChips estructuraIds={e.estructura_anatomica || []} />
                        {seccionesFiltro.map(seccion => {
                          const vals = e[seccion.campo] || []
                          if (!vals.length) return null
                          const labels = seccion.tipo === 'patron'
                            ? vals.map(id => labelDePatronId(id))
                            : seccion.labelFn
                              ? vals.map(id => seccion.labelFn(id))
                              : vals
                          return <MiniChips key={seccion.campo} values={labels} color={seccion.color} />
                        })}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : vista === 'lista' ? (
          /* ── LISTA ── */
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
                          <EstructuraChips estructuraIds={e.estructura_anatomica || []} />
                          {seccionesFiltro.map(seccion => {
                            const vals = e[seccion.campo] || []
                            if (!vals.length) return null
                            const labels = seccion.tipo === 'patron'
                              ? vals.map(id => labelDePatronId(id))
                              : seccion.labelFn
                                ? vals.map(id => seccion.labelFn(id))
                                : vals
                            return <MiniChips key={seccion.campo} values={labels} color={seccion.color} />
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
          /* ── TABLA ── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {TABLA_COLUMNAS.map(({ campo, label, filtrable, seccion }) => (
                    <th key={campo}
                      style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: sortBy === campo ? 'var(--accent)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span onClick={() => toggleSort(campo)} style={{ cursor: 'pointer' }}>{label} <SortArrow campo={campo} /></span>
                        {filtrable && seccion && <ColumnFilter seccion={seccion} filtros={filtros} toggleFiltro={toggleFiltro} clearFiltro={clearFiltro} ejercicios={ejercicios} />}
                      </div>
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
                      {TABLA_COLUMNAS.slice(1).map(({ campo, seccion: col }) => (
                        <td key={campo} style={{ padding: '8px 10px', maxWidth: 180 }}>
                          {editando
                            ? col && <InlineTags seccion={col} values={inlineEj[campo] || []} onChange={v => setInlineEj(ie => ({ ...ie, [campo]: v }))} />
                            : <MiniChips values={e[campo]} color={col?.color || '#6b7280'} />
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

        {/* ── MODAL NUEVO/EDITAR ── */}
        {modal && (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <div className="modal" style={{ maxWidth: 'min(96vw, 1160px)', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{modal === 'nuevo' ? 'Nuevo ejercicio' : 'Editar ejercicio'}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
              </div>

              {/* ── Cuerpo en dos columnas ── */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Columna izquierda: nombre + descripción + clasificación */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" value={form.nombre} onChange={e => fd('nombre', e.target.value)} placeholder="Ej: Sentadilla búlgara" autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea className="form-input" value={form.descripcion} onChange={e => fd('descripcion', e.target.value)} placeholder="Explicación del ejercicio..." rows={2} style={{ resize: 'vertical' }} />
                  </div>

                  {/* ── Clasificación principal ─────────────────────────────────── */}
                  <div style={{ borderLeft: '3px solid #2d6a4f', paddingLeft: 10, marginBottom: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)' }}>Clasificación principal</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[0, 1, 2].map((idx, i) => {
                      const s = SECCIONES_CLASIFICACION[idx]
                      return (
                        <div key={s.tipo === 'complejos' ? 'complejos' : s.campo} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#1e293b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</span>
                          </div>
                          <div style={{ padding: 10, flex: 1 }}>
                            {s.tipo === 'complejos' ? (
                              <ComplexSelector estructura_anatomica={form.estructura_anatomica} onChange={({ estructura_anatomica, complejo_articular }) => setForm(f => ({ ...f, estructura_anatomica, complejo_articular }))} />
                            ) : s.tipo === 'patron' ? (
                              <PatronSelector value={form.patron_movimiento} onChange={v => fd('patron_movimiento', v)} complejosSeleccionados={form.complejo_articular} estructurasSeleccionadas={form.estructura_anatomica} />
                            ) : (
                              <TagSelector seccion={s} value={form[s.campo]} onChange={v => fd(s.campo, v)} listMode />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Características del ejercicio ──────────────────────────────── */}
                  <div style={{ borderLeft: '3px solid #64748b', paddingLeft: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)' }}>Características del ejercicio</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {SECCIONES_CLASIFICACION.slice(3).map((s, i) => (
                      <div key={s.campo} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{4 + i}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</span>
                        </div>
                        <div style={{ padding: 10, flex: 1 }}>
                          <TagSelector seccion={s} value={form[s.campo]} onChange={v => fd(s.campo, v)} listMode />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Columna derecha: media + notas + resumen */}
                <div style={{ width: 264, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>

                  {/* ── Vista previa de media — siempre visible ── */}
                  <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: '#0f172a', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {(!form.media_url || !form.media_tipo) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#334155' }}>
                        <Play size={30} strokeWidth={1.5} />
                        <span style={{ fontSize: 11 }}>Vista previa</span>
                      </div>
                    ) : form.media_tipo === 'imagen' ? (
                      <img src={form.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : form.media_tipo === 'gif' ? (
                      <img src={form.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : form.media_tipo === 'video' ? (
                      <video src={form.media_url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : form.media_tipo === 'youtube' ? (() => {
                      const yId = form.media_url.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1]
                      return yId
                        ? <iframe src={`https://www.youtube.com/embed/${yId}`} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" allowFullScreen />
                        : <span style={{ fontSize: 11, color: '#475569', padding: 12, textAlign: 'center' }}>URL de YouTube no válida</span>
                    })() : null}
                  </div>

                  {/* Archivo */}
                  <div style={{ marginBottom: 10 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Archivo</div>
                    <select className="form-select" value={form.media_tipo} onChange={e => fd('media_tipo', e.target.value)} style={{ marginBottom: 6 }}>
                      <option value="">Sin media</option>
                      <option value="youtube">YouTube</option>
                      <option value="imagen">Imagen</option>
                      <option value="video">Vídeo</option>
                      <option value="gif">GIF</option>
                    </select>
                    {form.media_tipo && (
                      <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                          <input className="form-input" value={form.media_url}
                            onChange={e => {
                              fd('media_url', e.target.value)
                              if (form.media_tipo === 'youtube') comprobarVideoConflicto(e.target.value, modal?.id)
                            }}
                            placeholder={form.media_tipo === 'youtube' ? 'https://youtube.com/...' : 'https://...'}
                            style={{ flex: 1, fontSize: 12, borderColor: videoConflicto ? '#f59e0b' : undefined }} />
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
                              <span className="btn btn-ghost btn-sm">📁</span>
                            </label>
                          )}
                        </div>
                        {videoConflicto && (
                          <div style={{ padding: '6px 8px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 11, color: '#92400e', marginBottom: 4 }}>
                            ⚠️ Ya en uso: <strong>{videoConflicto.nombre}</strong>
                          </div>
                        )}
                        {form.media_tipo !== 'youtube' && (
                          <input className="form-input" value={form.video_url} onChange={e => fd('video_url', e.target.value)} placeholder='Enlace "Ver vídeo" (opcional)' style={{ fontSize: 12 }} />
                        )}
                      </>
                    )}
                  </div>

                  {/* Notas internas */}
                  <div style={{ marginBottom: 12 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Notas internas</div>
                    <textarea className="form-input" value={form.notas} onChange={e => fd('notas', e.target.value)} placeholder="Apuntes, cuidados, variantes..." rows={3} style={{ resize: 'vertical', fontSize: 12 }} />
                  </div>

                  {/* Resumen de etiquetas */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Resumen</div>
                    {(() => {
                      const labelFromId = id => id.split(':').pop().replace(/_/g, ' ')
                      const secciones = [
                        { label: 'Complejo', color: SECCIONES_CLASIFICACION[0].color, vals: form.complejo_articular || [] },
                        { label: 'Estructura', color: SECCIONES_CLASIFICACION[0].color, vals: form.estructura_anatomica || [] },
                        ...SECCIONES_CLASIFICACION.slice(1).map(s => ({
                          label: s.label, color: s.color,
                          vals: form[s.campo] || [],
                          labelFn: s.labelFn || labelFromId,
                        })),
                      ]
                      const conValores = secciones.filter(s => s.vals.length > 0)
                      if (!conValores.length) return <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Sin etiquetas seleccionadas</div>
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {conValores.map(s => (
                            <div key={s.label}>
                              <div style={{ fontSize: 9.5, fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{s.label}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {s.vals.map(v => (
                                  <span key={v} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 12, background: s.color + '18', color: s.color, border: `1px solid ${s.color}33`, fontWeight: 500 }}>
                                    {(s.labelFn || labelFromId)(v)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={saving || !form.nombre.trim()} onClick={guardar}>{saving ? 'Guardando...' : <><Check size={13} /> Guardar</>}</button>
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}
