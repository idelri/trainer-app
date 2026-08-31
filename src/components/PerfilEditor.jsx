/**
 * PerfilEditor — Pestaña INFORMACIÓN de ClienteFicha
 *
 * Fuentes de datos:
 *   - clientes          → nombre, email, telefono, foto_url
 *   - cliente_perfil    → resto del perfil vivo y editable
 *   - cliente_objetivos → objetivos con histórico
 *   - competiciones     → competiciones/retos
 *   - cuestionario_inicial → lectura + edición admin (via CuestionarioEditorAdmin)
 */

import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SaludMolestias from './SaludMolestias'
import { format, parseISO, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { ResumenCuestionario, RespuestasCompletas } from './CuestionarioViewer'
import CuestionarioEditorAdmin from './CuestionarioEditorAdmin'
import {
  OBJETIVOS, DEPORTES, DEPORTES_SIN_FREQ, FREC_ACT_OPTS, EXP,
  FRECUENCIA, DURACION, PREFERENCIA_ENTRENO, TIPOS_ENTRENO,
  DIAS_ABR, DIAS_FULL, DIAS_OPTS, TIEMPO, HORARIOS, LUGARES,
  MAT_CASA, WEARABLE_MARCAS, SUENO, TRABAJO, PASOS, TABACO,
  BARRERAS_OPTS, ANTECEDENTES_OPTS, ESTADO_COMP_LABEL, OTRO,
} from '../lib/opcionesCliente'

const HOY = () => format(new Date(), 'yyyy-MM-dd')

// ── Helpers de guardado ───────────────────────────────────────────────────────

async function upsertPerfil(clienteId, perfil, campos) {
  if (perfil?.id) {
    await supabase.from('cliente_perfil').update(campos).eq('id', perfil.id)
  } else {
    const { data } = await supabase
      .from('cliente_perfil')
      .insert({ cliente_id: clienteId, ...campos })
      .select().single()
    return data // nuevo perfil completo
  }
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PerfilEditor({
  clienteId,
  cliente, setCliente,
  perfil, setPerfil,
  objetivos, setObjetivos,
  competiciones, setCompeticiones,
  cuestionario,
  verCuestionario, setVerCuestionario,
  cueTab, setCueTab,
  abrirNuevaMolestia, onAbrirMolestiaConsumido,
}) {
  const [mostrarEditorCue, setMostrarEditorCue] = useState(false)
  const [cuestionarioLocal, setCuestionarioLocal] = useState(cuestionario)

  const objetivoActivo = objetivos.find(o => o.estado === 'activo')
  const historialObjetivos = objetivos.filter(o => o.estado !== 'activo')

  async function savePerfil(campos) {
    const nuevo = await upsertPerfil(clienteId, perfil, campos)
    if (nuevo) setPerfil(nuevo)
    else setPerfil(p => p ? { ...p, ...campos } : { cliente_id: clienteId, ...campos })
  }

  async function saveCliente(campos) {
    await supabase.from('clientes').update(campos).eq('id', clienteId)
    setCliente(p => ({ ...p, ...campos }))
  }

  return (
    <div className="perfil-info-wrap">
      <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 24, lineHeight: 1.5 }}>
        Información actual del cliente. Los cambios realizados aquí no modifican el cuestionario inicial.
      </p>

      {/* 1. Datos personales */}
      <SecDatosPersonales
        clienteId={clienteId} cliente={cliente} perfil={perfil}
        saveCliente={saveCliente} savePerfil={savePerfil}
      />

      {/* 2. Objetivos + Competiciones */}
      <SecObjetivos
        clienteId={clienteId}
        objetivoActivo={objetivoActivo}
        historial={historialObjetivos}
        setObjetivos={setObjetivos}
        competiciones={competiciones}
        setCompeticiones={setCompeticiones}
      />

      {/* 3. Actividad y experiencia */}
      <SecActividad perfil={perfil} savePerfil={savePerfil} />

      {/* 4. Disponibilidad */}
      <SecDisponibilidad perfil={perfil} savePerfil={savePerfil} />

      {/* 5. Salud y molestias */}
      <SaludMolestias
        clienteId={clienteId}
        cuestionario={cuestionario}
        abrirNueva={abrirNuevaMolestia}
        onAbrirConsumido={onAbrirMolestiaConsumido}
      />

      {/* 6. Antecedentes de salud */}
      <SecAntecedentes perfil={perfil} savePerfil={savePerfil} />

      {/* 7. Recursos */}
      <SecRecursos perfil={perfil} savePerfil={savePerfil} />

      {/* 8. Estilo de vida */}
      <SecEstiloVida perfil={perfil} savePerfil={savePerfil} />

      {/* 9. Barreras y expectativas */}
      <SecBarreras perfil={perfil} savePerfil={savePerfil} />

      {/* 10. Cuestionario inicial */}
      <SecCuestionario
        cuestionario={cuestionarioLocal}
        verCuestionario={verCuestionario} setVerCuestionario={setVerCuestionario}
        cueTab={cueTab} setCueTab={setCueTab}
        onEditar={() => setMostrarEditorCue(true)}
        onSincronizar={() => window.location.reload()}
      />

      {/* Modal editor cuestionario */}
      {mostrarEditorCue && (cuestionarioLocal?.submitted_at) && (
        <CuestionarioEditorAdmin
          cuestionario={cuestionarioLocal}
          clienteId={clienteId}
          onSaved={updated => { setCuestionarioLocal(updated); setMostrarEditorCue(false) }}
          onClose={() => setMostrarEditorCue(false)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. DATOS PERSONALES
// ══════════════════════════════════════════════════════════════════════════════

function SecDatosPersonales({ clienteId, cliente, perfil, saveCliente, savePerfil }) {
  const [editando, setEditando]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [draft, setDraft]         = useState({})
  const [fotoFile, setFotoFile]   = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const inputFoto = useRef(null)

  const edad = perfil?.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(perfil.fecha_nacimiento)) : null

  function abrir() {
    setDraft({
      // clientes
      nombre:    cliente.nombre || '',
      email:     cliente.email || '',
      telefono:  cliente.telefono || '',
      // cliente_perfil
      nombre_preferido: perfil?.nombre_preferido || '',
      fecha_nacimiento: perfil?.fecha_nacimiento || '',
      profesion:  perfil?.profesion || '',
      ciudad:     perfil?.ciudad || '',
    })
    setFotoFile(null)
    setFotoPreview(null)
    setEditando(true)
  }

  function cerrar() { setEditando(false); setFotoFile(null); setFotoPreview(null) }

  function onFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function guardar() {
    if (!draft.nombre.trim()) return
    setSaving(true)

    // Subir foto si hay nueva
    let foto_url = cliente.foto_url
    if (fotoFile) {
      const ext  = fotoFile.name.split('.').pop()
      const path = `cliente_${clienteId}/foto_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatares-clientes')
        .upload(path, fotoFile, { upsert: true, contentType: fotoFile.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatares-clientes').getPublicUrl(path)
        foto_url = urlData.publicUrl
      }
    }

    // Guardar clientes
    await saveCliente({
      nombre:   draft.nombre.trim(),
      email:    draft.email || null,
      telefono: draft.telefono || null,
      foto_url: foto_url,
    })

    // Guardar perfil
    await savePerfil({
      nombre_preferido: draft.nombre_preferido || null,
      fecha_nacimiento: draft.fecha_nacimiento || null,
      profesion:  draft.profesion || null,
      ciudad:     draft.ciudad || null,
    })

    setSaving(false)
    setEditando(false)
    setFotoFile(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function eliminarFoto() {
    if (!window.confirm('¿Eliminar la foto?')) return
    await saveCliente({ foto_url: null })
  }

  return (
    <Bloque
      numero="1" titulo="Datos personales" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={cerrar}
      onGuardar={guardar} saving={saving}
    >
      {!editando ? (
        // ── Vista ──
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Foto */}
          {cliente.foto_url && (
            <div>
              <img src={cliente.foto_url} alt={cliente.nombre}
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
            </div>
          )}
          <GrillaInfo>
            <FilaInfo label="Nombre"          value={cliente.nombre} />
            <FilaInfo label="Cómo llamarle"   value={perfil?.nombre_preferido} />
            <FilaInfo label="Fecha nac."       value={perfil?.fecha_nacimiento
              ? `${format(parseISO(perfil.fecha_nacimiento), 'd MMM yyyy', { locale: es })}${edad != null ? ` · ${edad} años` : ''}`
              : null} />
            <FilaInfo label="Profesión"        value={perfil?.profesion} />
            <FilaInfo label="Ciudad / zona"    value={perfil?.ciudad} />
            <FilaInfo label="Email"            value={cliente.email} />
            <FilaInfo label="Teléfono"         value={cliente.telefono} />
          </GrillaInfo>
        </div>
      ) : (
        // ── Edición ──
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Foto */}
          <div>
            <Label>Foto</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg2)', border: '2px solid var(--border)', flexShrink: 0 }}>
                {(fotoPreview || cliente.foto_url) && (
                  <img src={fotoPreview || cliente.foto_url} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                  onClick={() => inputFoto.current?.click()}>
                  {cliente.foto_url ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {cliente.foto_url && !fotoPreview && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: '#ef4444' }}
                    onClick={eliminarFoto}>
                    Eliminar foto
                  </button>
                )}
                <input ref={inputFoto} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={onFotoChange} />
              </div>
            </div>
          </div>

          <Campo label="Nombre completo *" value={draft.nombre} onChange={v => setDraft(p => ({ ...p, nombre: v }))} />
          <Campo label="Cómo prefiere que la llamemos" value={draft.nombre_preferido} onChange={v => setDraft(p => ({ ...p, nombre_preferido: v }))} placeholder="p.ej. Marta" />
          <Campo label="Fecha de nacimiento" value={draft.fecha_nacimiento} onChange={v => setDraft(p => ({ ...p, fecha_nacimiento: v }))} type="date" />
          <Campo label="Profesión" value={draft.profesion} onChange={v => setDraft(p => ({ ...p, profesion: v }))} />
          <Campo label="Ciudad / zona" value={draft.ciudad} onChange={v => setDraft(p => ({ ...p, ciudad: v }))} />
          <Campo label="Email" value={draft.email} onChange={v => setDraft(p => ({ ...p, email: v }))} type="email" />
          <Campo label="Teléfono" value={draft.telefono} onChange={v => setDraft(p => ({ ...p, telefono: v }))} />
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. OBJETIVOS + COMPETICIONES
// ══════════════════════════════════════════════════════════════════════════════

const EMPTY_OBJ = { objetivo_principal: '', objetivos_secundarios: [], observaciones: '' }
const EMPTY_COMP = { nombre: '', fecha: '', deporte: '', objetivo: '', resultado: '', notas: '', estado: 'pendiente' }

function SecObjetivos({ clienteId, objetivoActivo, historial, setObjetivos, competiciones, setCompeticiones }) {
  // Modal objetivo
  const [modalObj, setModalObj]   = useState(false)
  const [modoObj, setModoObj]     = useState('edit')   // 'edit' | 'nuevo'
  const [draftObj, setDraftObj]   = useState(EMPTY_OBJ)
  const [draftNuevo, setDraftNuevo] = useState(EMPTY_OBJ)
  const [savingObj, setSavingObj] = useState(false)

  // Modal competición
  const [modalComp, setModalComp] = useState(null) // { mode:'new'|'edit', comp: {...} }
  const [draftComp, setDraftComp] = useState(EMPTY_COMP)
  const [savingComp, setSavingComp] = useState(false)

  function abrirModalObj() {
    setDraftObj({
      objetivo_principal:    objetivoActivo?.objetivo_principal || '',
      objetivos_secundarios: objetivoActivo?.objetivos_secundarios || [],
      observaciones:         objetivoActivo?.observaciones || '',
    })
    setDraftNuevo(EMPTY_OBJ)
    setModoObj('edit')
    setModalObj(true)
  }

  async function guardarObjetivo() {
    if (!draftObj.objetivo_principal.trim()) return
    setSavingObj(true)

    if (modoObj === 'edit') {
      // Editar objetivo actual
      if (objetivoActivo?.id) {
        await supabase.from('cliente_objetivos').update({
          objetivo_principal:    draftObj.objetivo_principal,
          objetivos_secundarios: draftObj.objetivos_secundarios,
          observaciones:         draftObj.observaciones || null,
        }).eq('id', objetivoActivo.id)
        setObjetivos(prev => prev.map(o =>
          o.id === objetivoActivo.id
            ? { ...o, ...draftObj }
            : o
        ))
      } else {
        // No hay objetivo activo → crear nuevo
        const hoy = HOY()
        const { data } = await supabase.from('cliente_objetivos').insert({
          cliente_id: clienteId,
          objetivo_principal:    draftObj.objetivo_principal,
          objetivos_secundarios: draftObj.objetivos_secundarios,
          observaciones:         draftObj.observaciones || null,
          estado: 'activo',
          fecha_inicio: hoy,
        }).select().single()
        if (data) setObjetivos(prev => [data, ...prev])
      }
    } else {
      // Finalizar actual + crear nuevo
      if (!draftNuevo.objetivo_principal.trim()) { setSavingObj(false); return }
      const hoy = HOY()
      // Finalizar actual
      if (objetivoActivo?.id) {
        await supabase.from('cliente_objetivos').update({ estado: 'finalizado', fecha_fin: hoy }).eq('id', objetivoActivo.id)
      }
      // Crear nuevo
      const { data } = await supabase.from('cliente_objetivos').insert({
        cliente_id: clienteId,
        objetivo_principal:    draftNuevo.objetivo_principal,
        objetivos_secundarios: draftNuevo.objetivos_secundarios,
        observaciones:         draftNuevo.observaciones || null,
        estado: 'activo',
        fecha_inicio: hoy,
      }).select().single()
      if (data) {
        setObjetivos(prev => [
          data,
          ...prev.map(o => o.id === objetivoActivo?.id ? { ...o, estado: 'finalizado', fecha_fin: hoy } : o),
        ])
      }
    }

    setSavingObj(false)
    setModalObj(false)
  }

  // ── Competiciones ──

  function abrirNuevaComp() {
    setDraftComp({ ...EMPTY_COMP })
    setModalComp({ mode: 'new' })
  }

  function abrirEditComp(comp) {
    setDraftComp({
      nombre:    comp.nombre || '',
      fecha:     comp.fecha || '',
      deporte:   comp.deporte || '',
      objetivo:  comp.objetivo || '',
      resultado: comp.resultado || '',
      notas:     comp.notas || '',
      estado:    comp.estado || 'pendiente',
    })
    setModalComp({ mode: 'edit', id: comp.id })
  }

  async function guardarComp() {
    if (!draftComp.nombre.trim() || !draftComp.fecha) return
    setSavingComp(true)
    const campos = {
      nombre:    draftComp.nombre.trim(),
      fecha:     draftComp.fecha,
      deporte:   draftComp.deporte || null,
      objetivo:  draftComp.objetivo || null,
      resultado: draftComp.resultado || null,
      notas:     draftComp.notas || null,
      estado:    draftComp.estado,
    }
    if (modalComp.mode === 'new') {
      const { data } = await supabase.from('competiciones')
        .insert({ cliente_id: clienteId, ...campos }).select().single()
      if (data) setCompeticiones(prev => [data, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha)))
    } else {
      await supabase.from('competiciones').update(campos).eq('id', modalComp.id)
      setCompeticiones(prev => prev.map(c => c.id === modalComp.id ? { ...c, ...campos } : c))
    }
    setSavingComp(false)
    setModalComp(null)
  }

  async function eliminarComp(id) {
    if (!window.confirm('¿Eliminar esta competición?')) return
    await supabase.from('competiciones').delete().eq('id', id)
    setCompeticiones(prev => prev.filter(c => c.id !== id))
  }

  const hoy = HOY()
  const proximas   = competiciones.filter(c => c.fecha >= hoy && c.estado !== 'cancelada')
  const anteriores = competiciones.filter(c => c.fecha < hoy || c.estado === 'realizada' || c.estado === 'cancelada')

  return (
    <div style={{ marginBottom: 28 }}>
      {/* ── Objetivos ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>2. Objetivos</span>
        <button className="btn btn-ghost btn-sm" onClick={abrirModalObj} style={{ fontSize: 12 }}>Gestionar</button>
      </div>

      {objetivoActivo ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Objetivo actual</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5, marginBottom: objetivoActivo.objetivos_secundarios?.length ? 6 : 0 }}>
            {objetivoActivo.objetivo_principal}
          </div>
          {objetivoActivo.objetivos_secundarios?.length > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 4 }}>
              Secundarios: {objetivoActivo.objetivos_secundarios.join(' · ')}
            </div>
          )}
          {objetivoActivo.observaciones && (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', fontStyle: 'italic' }}>{objetivoActivo.observaciones}</div>
          )}
          {objetivoActivo.fecha_inicio && (
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5, fontFamily: 'var(--mono)' }}>
              Desde {format(parseISO(objetivoActivo.fecha_inicio), 'd MMM yyyy', { locale: es })}
              {objetivoActivo.fecha_fin && ` → ${format(parseISO(objetivoActivo.fecha_fin), 'd MMM yyyy', { locale: es })}`}
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>Sin objetivo activo. Pulsa Gestionar para añadir uno.</p>
      )}

      {/* Historial de objetivos */}
      {historial.length > 0 && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer', marginBottom: 8 }}>
            {historial.length} objetivo{historial.length !== 1 ? 's' : ''} anterior{historial.length !== 1 ? 'es' : ''}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
            {historial.map(o => (
              <div key={o.id} style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{o.objetivo_principal}</span>
                {o.fecha_fin && <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 12, fontFamily: 'var(--mono)' }}>
                  → {format(parseISO(o.fecha_fin), 'd MMM yyyy', { locale: es })}
                </span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Competiciones / Retos ── */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Competiciones / Retos</span>
          <button className="btn btn-ghost btn-sm" onClick={abrirNuevaComp} style={{ fontSize: 12, color: 'var(--accent)' }}>+ Añadir</button>
        </div>

        {proximas.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6 }}>Próximas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {proximas.map(c => <CompRow key={c.id} comp={c} onEdit={() => abrirEditComp(c)} onDelete={() => eliminarComp(c.id)} />)}
            </div>
          </div>
        )}

        {anteriores.length > 0 && (
          <details>
            <summary style={{ fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer', marginBottom: 8 }}>
              {anteriores.length} anterior{anteriores.length !== 1 ? 'es' : ''}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {anteriores.map(c => <CompRow key={c.id} comp={c} onEdit={() => abrirEditComp(c)} onDelete={() => eliminarComp(c.id)} />)}
            </div>
          </details>
        )}

        {competiciones.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sin competiciones registradas.</p>
        )}
      </div>

      {/* ── Modal: gestionar objetivo ── */}
      {modalObj && (
        <Modal titulo="Gestionar objetivo" onClose={() => setModalObj(false)} ancho={560}>
          {/* Objetivo actual */}
          {modoObj === 'edit' && (
            <>
              <ModalLabel>{objetivoActivo ? 'Objetivo actual' : 'Nuevo objetivo'}</ModalLabel>
              <FormObjetivo draft={draftObj} setDraft={setDraftObj} />
              {objetivoActivo && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>
                    ¿El objetivo ha cambiado fundamentalmente? Puedes finalizar el actual y crear uno nuevo manteniendo el historial.
                  </p>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--accent)' }}
                    onClick={() => setModoObj('nuevo')}>
                    Finalizar actual y crear nuevo →
                  </button>
                </div>
              )}
            </>
          )}

          {modoObj === 'nuevo' && (
            <>
              {/* Objetivo actual (read-only resumen) */}
              {objetivoActivo && (
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: 'var(--mono)' }}>Se finalizará el {format(new Date(), 'd MMM yyyy', { locale: es })}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text2)' }}>{objetivoActivo.objetivo_principal}</div>
                </div>
              )}
              <ModalLabel>Nuevo objetivo activo</ModalLabel>
              <FormObjetivo draft={draftNuevo} setDraft={setDraftNuevo} />
              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12, marginTop: 8 }}
                onClick={() => setModoObj('edit')}>
                ← Volver a editar actual
              </button>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setModalObj(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardarObjetivo} disabled={savingObj ||
              (modoObj === 'edit' && !draftObj.objetivo_principal.trim()) ||
              (modoObj === 'nuevo' && !draftNuevo.objetivo_principal.trim())}>
              {savingObj ? 'Guardando…' : modoObj === 'nuevo' ? 'Finalizar y crear nuevo' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: competición ── */}
      {modalComp && (
        <Modal titulo={modalComp.mode === 'new' ? 'Nueva competición / reto' : 'Editar competición'} onClose={() => setModalComp(null)} ancho={480}>
          <Campo label="Nombre *" value={draftComp.nombre} onChange={v => setDraftComp(p => ({ ...p, nombre: v }))} placeholder="Ej: Media Maratón Barcelona" />
          <Campo label="Fecha *" value={draftComp.fecha} onChange={v => setDraftComp(p => ({ ...p, fecha: v }))} type="date" />
          <Campo label="Deporte" value={draftComp.deporte} onChange={v => setDraftComp(p => ({ ...p, deporte: v }))} placeholder="Ej: Running, Ciclismo..." />
          <Campo label="Objetivo de rendimiento" value={draftComp.objetivo} onChange={v => setDraftComp(p => ({ ...p, objetivo: v }))} placeholder="Ej: Terminarla, bajar de 1h35..." />
          <Campo label="Resultado" value={draftComp.resultado} onChange={v => setDraftComp(p => ({ ...p, resultado: v }))} placeholder="Solo si ya se realizó" />
          <Campo label="Notas" value={draftComp.notas} onChange={v => setDraftComp(p => ({ ...p, notas: v }))} multiline />
          <div>
            <Label>Estado</Label>
            <CampoSelect
              value={draftComp.estado}
              onChange={v => setDraftComp(p => ({ ...p, estado: v }))}
              options={[
                { value: 'pendiente', label: 'Próxima / Pendiente' },
                { value: 'realizada', label: 'Realizada' },
                { value: 'cancelada', label: 'Cancelada' },
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setModalComp(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardarComp}
              disabled={savingComp || !draftComp.nombre.trim() || !draftComp.fecha}>
              {savingComp ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CompRow({ comp, onEdit, onDelete }) {
  const fechaStr = comp.fecha ? format(parseISO(comp.fecha), 'd MMM yyyy', { locale: es }) : null
  const estado = ESTADO_COMP_LABEL[comp.estado] || comp.estado
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{comp.nombre}</span>
          {fechaStr && <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fechaStr}</span>}
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5, background: 'var(--bg2)', color: 'var(--text3)' }}>{estado}</span>
        </div>
        {comp.objetivo && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>{comp.objetivo}</div>}
        {comp.resultado && <div style={{ fontSize: 12.5, color: 'var(--accent)', marginTop: 1 }}>✓ {comp.resultado}</div>}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ fontSize: 12, flexShrink: 0 }}>Editar</button>
      <button className="btn btn-ghost btn-sm" onClick={onDelete} style={{ fontSize: 12, color: '#ef4444', flexShrink: 0 }}>✕</button>
    </div>
  )
}

function FormObjetivo({ draft, setDraft }) {
  const set = k => v => setDraft(p => ({ ...p, [k]: v }))
  const opcionesSecundarios = OBJETIVOS.filter(o => o !== draft.objetivo_principal)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Label>Objetivo principal *</Label>
        <ChipsSingle options={OBJETIVOS} value={draft.objetivo_principal} onChange={set('objetivo_principal')} />
        {draft.objetivo_principal && !OBJETIVOS.includes(draft.objetivo_principal) && (
          <Campo value={draft.objetivo_principal} onChange={set('objetivo_principal')} placeholder="Escribe el objetivo..." />
        )}
      </div>
      <div>
        <Label>Objetivos secundarios</Label>
        <ChipsMulti options={opcionesSecundarios} value={draft.objetivos_secundarios || []} onChange={set('objetivos_secundarios')} />
      </div>
      <Campo label="Observaciones" value={draft.observaciones || ''} onChange={set('observaciones')} multiline placeholder="Contexto adicional (opcional)" />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ACTIVIDAD Y EXPERIENCIA
// ══════════════════════════════════════════════════════════════════════════════

function SecActividad({ perfil, savePerfil }) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const set = k => v => setDraft(p => ({ ...p, [k]: v }))

  function abrir() {
    const deportes = perfil?.deportes_actuales || []
    setDraft({
      deportes_actuales:       deportes,
      frecuencia_por_actividad: perfil?.frecuencia_por_actividad || [],
      frecuencia_actual:       perfil?.frecuencia_actual || '',
      duracion_habitual:       perfil?.duracion_habitual || '',
      experiencia_fuerza:      perfil?.experiencia_fuerza || '',
      experiencia_fuerza_obs:  perfil?.experiencia_fuerza_obs || '',
      experiencia_resistencia: perfil?.experiencia_resistencia || '',
      experiencia_resistencia_obs: perfil?.experiencia_resistencia_obs || '',
      experiencia_funcional:   perfil?.experiencia_funcional || '',
      experiencia_funcional_obs: perfil?.experiencia_funcional_obs || '',
      preferencia_entreno:     perfil?.preferencia_entreno || [],
      tipos_entreno_disfruta:  perfil?.tipos_entreno_disfruta || [],
      evitar_ejercicios_yn:    perfil?.evitar_ejercicios_yn || '',
      evitar_ejercicios_detalle: perfil?.evitar_ejercicios_detalle || '',
    })
    setEditando(true)
  }

  function handleDeportes(nuevos) {
    setDraft(p => {
      const activas = nuevos.filter(d => !DEPORTES_SIN_FREQ.includes(d))
      const actual = p.frecuencia_por_actividad || []
      const nuevaFreq = activas.map(a => actual.find(x => x.actividad === a) || { actividad: a, frecuencia: '' })
      return { ...p, deportes_actuales: nuevos, frecuencia_por_actividad: nuevaFreq }
    })
  }

  function setFreqAct(actividad, frecuencia) {
    setDraft(p => ({
      ...p,
      frecuencia_por_actividad: (p.frecuencia_por_actividad || []).map(x =>
        x.actividad === actividad ? { ...x, frecuencia } : x
      ),
    }))
  }

  async function guardar() {
    setSaving(true)
    await savePerfil({
      deportes_actuales:        draft.deportes_actuales,
      frecuencia_por_actividad: draft.frecuencia_por_actividad,
      frecuencia_actual:        draft.frecuencia_actual || null,
      duracion_habitual:        draft.duracion_habitual || null,
      experiencia_fuerza:       draft.experiencia_fuerza || null,
      experiencia_fuerza_obs:   draft.experiencia_fuerza_obs || null,
      experiencia_resistencia:  draft.experiencia_resistencia || null,
      experiencia_resistencia_obs: draft.experiencia_resistencia_obs || null,
      experiencia_funcional:    draft.experiencia_funcional || null,
      experiencia_funcional_obs: draft.experiencia_funcional_obs || null,
      preferencia_entreno:      draft.preferencia_entreno,
      tipos_entreno_disfruta:   draft.tipos_entreno_disfruta,
      evitar_ejercicios_yn:     draft.evitar_ejercicios_yn || null,
      evitar_ejercicios_detalle: draft.evitar_ejercicios_detalle || null,
    })
    setSaving(false)
    setEditando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deportesConFreq = (perfil?.deportes_actuales || []).filter(d => !DEPORTES_SIN_FREQ.includes(d))
  const freqMap = Object.fromEntries((perfil?.frecuencia_por_actividad || []).map(x => [x.actividad, x.frecuencia]))

  return (
    <Bloque numero="3" titulo="Actividad y experiencia" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={() => setEditando(false)}
      onGuardar={guardar} saving={saving}>
      {!editando ? (
        <GrillaInfo>
          <FilaInfo label="Deportes actuales" value={perfil?.deportes_actuales?.join(', ')} />
          {deportesConFreq.map(d => (
            <FilaInfo key={d} label={`  · ${d}`} value={freqMap[d] ? `${freqMap[d]}` : null} />
          ))}
          <FilaInfo label="Frecuencia total"  value={perfil?.frecuencia_actual} />
          <FilaInfo label="Duración habitual" value={perfil?.duracion_habitual} />
          <FilaInfo label="Exp. fuerza"       value={[perfil?.experiencia_fuerza, perfil?.experiencia_fuerza_obs].filter(Boolean).join(' — ')} />
          <FilaInfo label="Exp. resistencia"  value={[perfil?.experiencia_resistencia, perfil?.experiencia_resistencia_obs].filter(Boolean).join(' — ')} />
          <FilaInfo label="Exp. funcional"    value={[perfil?.experiencia_funcional, perfil?.experiencia_funcional_obs].filter(Boolean).join(' — ')} />
          <FilaInfo label="Prefiere"          value={perfil?.preferencia_entreno?.join(', ')} />
          <FilaInfo label="Disfruta"          value={perfil?.tipos_entreno_disfruta?.join(', ')} />
          <FilaInfo label="Evita"             value={perfil?.evitar_ejercicios_yn === 'Sí' ? (perfil?.evitar_ejercicios_detalle || 'Sí') : null} />
        </GrillaInfo>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Label>Deportes / actividades actuales</Label>
            <ChipsMulti options={DEPORTES} value={draft.deportes_actuales} onChange={handleDeportes} />
          </div>
          {(draft.deportes_actuales || []).filter(d => !DEPORTES_SIN_FREQ.includes(d)).length > 0 && (
            <div>
              <Label>Frecuencia por actividad</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(draft.deportes_actuales || []).filter(d => !DEPORTES_SIN_FREQ.includes(d)).map(act => {
                  const freq = (draft.frecuencia_por_actividad || []).find(x => x.actividad === act)?.frecuencia || ''
                  return (
                    <div key={act}>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 5 }}>{act}</div>
                      <ChipsSingle options={FREC_ACT_OPTS} value={freq} onChange={v => setFreqAct(act, v)} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <Label>Frecuencia total de entrenamiento</Label>
            <ChipsSingle options={FRECUENCIA} value={draft.frecuencia_actual} onChange={set('frecuencia_actual')} />
          </div>
          <div>
            <Label>Duración habitual</Label>
            <ChipsSingle options={DURACION} value={draft.duracion_habitual} onChange={set('duracion_habitual')} />
          </div>
          <div>
            <Label>Experiencia en fuerza</Label>
            <ChipsSingle options={EXP} value={draft.experiencia_fuerza} onChange={set('experiencia_fuerza')} />
            {draft.experiencia_fuerza && <Campo style={{ marginTop: 6 }} value={draft.experiencia_fuerza_obs} onChange={set('experiencia_fuerza_obs')} placeholder="Observaciones (opcional)" />}
          </div>
          <div>
            <Label>Experiencia en resistencia</Label>
            <ChipsSingle options={EXP} value={draft.experiencia_resistencia} onChange={set('experiencia_resistencia')} />
            {draft.experiencia_resistencia && <Campo style={{ marginTop: 6 }} value={draft.experiencia_resistencia_obs} onChange={set('experiencia_resistencia_obs')} placeholder="Observaciones (opcional)" />}
          </div>
          <div>
            <Label>Experiencia funcional / movilidad</Label>
            <ChipsSingle options={['Sin experiencia','Principiante','Intermedio','Avanzado']} value={draft.experiencia_funcional} onChange={set('experiencia_funcional')} />
            {draft.experiencia_funcional && <Campo style={{ marginTop: 6 }} value={draft.experiencia_funcional_obs} onChange={set('experiencia_funcional_obs')} placeholder="Observaciones (opcional)" />}
          </div>
          <div>
            <Label>Preferencia de entrenamiento</Label>
            <ChipsMulti options={PREFERENCIA_ENTRENO} value={draft.preferencia_entreno} onChange={set('preferencia_entreno')} />
          </div>
          <div>
            <Label>Tipos que disfruta</Label>
            <ChipsMulti options={TIPOS_ENTRENO} value={draft.tipos_entreno_disfruta} onChange={set('tipos_entreno_disfruta')} />
          </div>
          <div>
            <Label>¿Prefiere evitar ejercicios concretos?</Label>
            <ChipsSingle options={['Sí','No']} value={draft.evitar_ejercicios_yn} onChange={set('evitar_ejercicios_yn')} />
            {draft.evitar_ejercicios_yn === 'Sí' && (
              <Campo style={{ marginTop: 6 }} value={draft.evitar_ejercicios_detalle} onChange={set('evitar_ejercicios_detalle')} multiline placeholder="¿Cuáles y por qué?" />
            )}
          </div>
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DISPONIBILIDAD
// ══════════════════════════════════════════════════════════════════════════════

function SecDisponibilidad({ perfil, savePerfil }) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const set = k => v => setDraft(p => ({ ...p, [k]: v }))

  function abrir() {
    setDraft({
      dias_semana:         perfil?.dias_semana || '',
      dias_variable_min:   perfil?.dias_variable_min ?? 2,
      dias_variable_max:   perfil?.dias_variable_max ?? 4,
      dias_preferentes:    perfil?.dias_preferentes || [],
      tiempo_sesion:       perfil?.tiempo_sesion || '',
      horarios:            perfil?.horarios || [],
      lugares_entrenamiento: perfil?.lugares_entrenamiento || [],
    })
    setEditando(true)
  }

  async function guardar() {
    setSaving(true)
    await savePerfil({
      dias_semana:           draft.dias_semana || null,
      dias_variable_min:     draft.dias_semana === 'Variable según la semana' ? Number(draft.dias_variable_min) : null,
      dias_variable_max:     draft.dias_semana === 'Variable según la semana' ? Number(draft.dias_variable_max) : null,
      dias_preferentes:      draft.dias_preferentes,
      tiempo_sesion:         draft.tiempo_sesion || null,
      horarios:              draft.horarios,
      lugares_entrenamiento: draft.lugares_entrenamiento,
    })
    setSaving(false)
    setEditando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleDia(dia) {
    setDraft(p => {
      const curr = p.dias_preferentes || []
      return { ...p, dias_preferentes: curr.includes(dia) ? curr.filter(d => d !== dia) : [...curr, dia] }
    })
  }

  // Vista legible
  let diasDisplay = perfil?.dias_semana
  if (diasDisplay === 'Variable según la semana' && (perfil.dias_variable_min != null || perfil.dias_variable_max != null)) {
    diasDisplay = `Variable (${perfil.dias_variable_min ?? 0}–${perfil.dias_variable_max ?? 7} días)`
  }

  return (
    <Bloque numero="4" titulo="Disponibilidad" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={() => setEditando(false)}
      onGuardar={guardar} saving={saving}>
      {!editando ? (
        <GrillaInfo>
          <FilaInfo label="Días/semana"   value={diasDisplay} />
          <FilaInfo label="Días preferentes" value={perfil?.dias_preferentes?.join(' · ')} />
          <FilaInfo label="Tiempo/sesión" value={perfil?.tiempo_sesion} />
          <FilaInfo label="Horarios"      value={perfil?.horarios?.join(' · ')} />
          <FilaInfo label="Lugares"       value={perfil?.lugares_entrenamiento?.join(', ')} />
        </GrillaInfo>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Label>Días por semana</Label>
            <ChipsSingle options={DIAS_OPTS} value={draft.dias_semana} onChange={set('dias_semana')} />
            {draft.dias_semana === 'Variable según la semana' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Entre</span>
                {[0,1,2,3,4,5,6,7].map(n => {
                  const on = Number(draft.dias_variable_min) === n
                  return <NumBtn key={n} n={n} on={on} onClick={() => setDraft(p => ({ ...p, dias_variable_min: n, dias_variable_max: Math.max(n, p.dias_variable_max) }))} />
                })}
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>y</span>
                {[0,1,2,3,4,5,6,7].filter(n => n >= Number(draft.dias_variable_min)).map(n => {
                  const on = Number(draft.dias_variable_max) === n
                  return <NumBtn key={n} n={n} on={on} onClick={() => setDraft(p => ({ ...p, dias_variable_max: n }))} />
                })}
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>días</span>
              </div>
            )}
          </div>
          <div>
            <Label>Días preferentes</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DIAS_ABR.map((abr, i) => {
                const dia = DIAS_FULL[i]
                const on = (draft.dias_preferentes || []).includes(dia)
                return (
                  <button key={abr} type="button" onClick={() => toggleDia(dia)}
                    style={{ width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {abr}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <Label>Tiempo por sesión</Label>
            <ChipsSingle options={TIEMPO} value={draft.tiempo_sesion} onChange={set('tiempo_sesion')} />
          </div>
          <div>
            <Label>Horarios preferentes</Label>
            <ChipsMulti options={HORARIOS} value={draft.horarios} onChange={set('horarios')} />
          </div>
          <div>
            <Label>Lugares de entrenamiento</Label>
            <ChipsMulti options={LUGARES} value={draft.lugares_entrenamiento} onChange={set('lugares_entrenamiento')} />
          </div>
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. SALUD Y MOLESTIAS (placeholder)
// ══════════════════════════════════════════════════════════════════════════════

// SecSalud eliminada en Fase 4 — reemplazada por SaludMolestias

// ══════════════════════════════════════════════════════════════════════════════
// 6. ANTECEDENTES DE SALUD
// ══════════════════════════════════════════════════════════════════════════════

function SecAntecedentes({ perfil, savePerfil }) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const set = k => v => setDraft(p => ({ ...p, [k]: v }))

  function abrir() {
    setDraft({
      antecedentes_categorias: perfil?.antecedentes_categorias || [],
      lesiones_previas:    perfil?.lesiones_previas || '',
      operaciones:         perfil?.operaciones || '',
      condiciones_medicas: perfil?.condiciones_medicas || '',
      medicacion:          perfil?.medicacion || '',
      restricciones_medicas: perfil?.restricciones_medicas || '',
      tratamiento_actual:  perfil?.tratamiento_actual || '',
    })
    setEditando(true)
  }

  async function guardar() {
    setSaving(true)
    await savePerfil({
      antecedentes_categorias: draft.antecedentes_categorias,
      lesiones_previas:    draft.lesiones_previas || null,
      operaciones:         draft.operaciones || null,
      condiciones_medicas: draft.condiciones_medicas || null,
      medicacion:          draft.medicacion || null,
      restricciones_medicas: draft.restricciones_medicas || null,
      tratamiento_actual:  draft.tratamiento_actual || null,
    })
    setSaving(false)
    setEditando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tieneAntecedentes = perfil?.antecedentes_categorias?.length ||
    perfil?.lesiones_previas || perfil?.operaciones || perfil?.condiciones_medicas ||
    perfil?.medicacion || perfil?.restricciones_medicas || perfil?.tratamiento_actual

  return (
    <Bloque numero="6" titulo="Antecedentes de salud" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={() => setEditando(false)}
      onGuardar={guardar} saving={saving}>
      {!editando ? (
        tieneAntecedentes ? (
          <GrillaInfo>
            <FilaInfo label="Categorías"         value={perfil?.antecedentes_categorias?.join(', ')} />
            <FilaInfo label="Lesiones previas"   value={perfil?.lesiones_previas} />
            <FilaInfo label="Operaciones"        value={perfil?.operaciones} />
            <FilaInfo label="Condiciones médicas" value={perfil?.condiciones_medicas} />
            <FilaInfo label="Medicación"         value={perfil?.medicacion} />
            <FilaInfo label="Restricciones"      value={perfil?.restricciones_medicas} />
            <FilaInfo label="Tratamiento actual" value={perfil?.tratamiento_actual} />
          </GrillaInfo>
        ) : <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sin antecedentes registrados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Categorías</Label>
            <ChipsMulti
              options={ANTECEDENTES_OPTS}
              value={draft.antecedentes_categorias}
              onChange={set('antecedentes_categorias')}
            />
          </div>
          <Campo label="Lesiones previas relevantes" value={draft.lesiones_previas} onChange={set('lesiones_previas')} multiline placeholder="¿Cuáles y cuándo?" />
          <Campo label="Operaciones o intervenciones" value={draft.operaciones} onChange={set('operaciones')} multiline placeholder="¿Cuáles y cuándo?" />
          <Campo label="Condiciones médicas" value={draft.condiciones_medicas} onChange={set('condiciones_medicas')} multiline placeholder="Diagnóstico o condición relevante" />
          <Campo label="Medicación" value={draft.medicacion} onChange={set('medicacion')} placeholder="Medicación que pueda afectar al ejercicio" />
          <Campo label="Restricciones médicas" value={draft.restricciones_medicas} onChange={set('restricciones_medicas')} multiline placeholder="Instrucciones o restricciones del médico" />
          <Campo label="Tratamiento / seguimiento actual" value={draft.tratamiento_actual} onChange={set('tratamiento_actual')} placeholder="Ej: Fisioterapia, rehabilitación..." />
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. RECURSOS
// ══════════════════════════════════════════════════════════════════════════════

function SecRecursos({ perfil, savePerfil }) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const set = k => v => setDraft(p => ({ ...p, [k]: v }))
  const tieneGimnasio = (perfil?.lugares_entrenamiento || []).includes('Gimnasio')
  const tieneEnCasa   = (perfil?.lugares_entrenamiento || []).includes('En casa')
  const draftGimnasio = draft.lugares_entrenamiento?.includes('Gimnasio')
  const draftEnCasa   = draft.lugares_entrenamiento?.includes('En casa')

  function abrir() {
    setDraft({
      tiene_gimnasio: perfil?.tiene_gimnasio,
      gimnasio_nombre: perfil?.gimnasio_nombre || '',
      material_casa:   perfil?.material_casa || [],
      tiene_wearable:  perfil?.tiene_wearable,
      wearable_marca:  perfil?.wearable_marca || '',
      wearable_modelo: perfil?.wearable_modelo || '',
      lugares_entrenamiento: perfil?.lugares_entrenamiento || [],
    })
    setEditando(true)
  }

  async function guardar() {
    setSaving(true)
    await savePerfil({
      tiene_gimnasio:  draftGimnasio ? true : (draft.tiene_gimnasio ?? null),
      gimnasio_nombre: draft.gimnasio_nombre || null,
      material_casa:   draft.material_casa,
      tiene_wearable:  draft.tiene_wearable ?? null,
      wearable_marca:  draft.wearable_marca || null,
      wearable_modelo: draft.wearable_modelo || null,
      lugares_entrenamiento: draft.lugares_entrenamiento,
    })
    setSaving(false)
    setEditando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const wearableLabel = perfil?.tiene_wearable
    ? [perfil.wearable_marca, perfil.wearable_modelo].filter(Boolean).join(' ') || 'Sí'
    : perfil?.tiene_wearable === false ? 'No' : null

  return (
    <Bloque numero="7" titulo="Recursos" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={() => setEditando(false)}
      onGuardar={guardar} saving={saving}>
      {!editando ? (
        <GrillaInfo>
          <FilaInfo label="Lugares"       value={perfil?.lugares_entrenamiento?.join(', ')} />
          <FilaInfo label="Gimnasio"      value={tieneGimnasio ? (perfil?.gimnasio_nombre || 'Sí') : null} />
          <FilaInfo label="Material casa" value={perfil?.material_casa?.filter(m => m !== 'Sin material').join(', ')} />
          <FilaInfo label="Wearable"      value={wearableLabel} />
        </GrillaInfo>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Label>Lugares de entrenamiento</Label>
            <ChipsMulti options={LUGARES} value={draft.lugares_entrenamiento} onChange={set('lugares_entrenamiento')} />
          </div>
          {draftGimnasio && (
            <Campo label="Nombre del gimnasio" value={draft.gimnasio_nombre} onChange={set('gimnasio_nombre')} placeholder="¿A cuál va?" />
          )}
          {draftEnCasa && (
            <div>
              <Label>Material en casa</Label>
              <ChipsMulti options={MAT_CASA} value={draft.material_casa} onChange={set('material_casa')} />
            </div>
          )}
          <div>
            <Label>¿Tiene wearable?</Label>
            <ChipsSingle options={['Sí','No']}
              value={draft.tiene_wearable === true ? 'Sí' : draft.tiene_wearable === false ? 'No' : ''}
              onChange={v => setDraft(p => ({ ...p, tiene_wearable: v === 'Sí' ? true : v === 'No' ? false : null }))} />
            {draft.tiene_wearable === true && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <Label>Marca</Label>
                  <ChipsMulti options={WEARABLE_MARCAS} value={draft.wearable_marca ? [draft.wearable_marca] : []}
                    onChange={v => setDraft(p => ({ ...p, wearable_marca: v[v.length - 1] || '' }))} />
                  {draft.wearable_marca && !WEARABLE_MARCAS.includes(draft.wearable_marca) && (
                    <Campo style={{ marginTop: 6 }} value={draft.wearable_marca} onChange={set('wearable_marca')} placeholder="Marca personalizada" />
                  )}
                </div>
                <Campo label="Modelo (opcional)" value={draft.wearable_modelo} onChange={set('wearable_modelo')} placeholder="Ej: Forerunner 255..." />
              </div>
            )}
          </div>
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. ESTILO DE VIDA
// ══════════════════════════════════════════════════════════════════════════════

function SecEstiloVida({ perfil, savePerfil }) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const set = k => v => setDraft(p => ({ ...p, [k]: v }))
  const CALIDAD = ['Muy mala','Regular','Normal','Buena','Muy buena']
  const ESTRES  = ['Muy bajo','Bajo','Moderado','Alto','Muy alto']

  function abrir() {
    setDraft({
      horas_sueno:    perfil?.horas_sueno || '',
      calidad_sueno:  perfil?.calidad_sueno ?? null,
      nivel_estres:   perfil?.nivel_estres ?? null,
      tipo_trabajo:   perfil?.tipo_trabajo || '',
      pasos_diarios:  perfil?.pasos_diarios || '',
      consumo_tabaco: perfil?.consumo_tabaco || '',
    })
    setEditando(true)
  }

  async function guardar() {
    setSaving(true)
    await savePerfil({
      horas_sueno:    draft.horas_sueno || null,
      calidad_sueno:  draft.calidad_sueno,
      nivel_estres:   draft.nivel_estres,
      tipo_trabajo:   draft.tipo_trabajo || null,
      pasos_diarios:  draft.pasos_diarios || null,
      consumo_tabaco: draft.consumo_tabaco || null,
    })
    setSaving(false)
    setEditando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Bloque numero="8" titulo="Estilo de vida" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={() => setEditando(false)}
      onGuardar={guardar} saving={saving}>
      {!editando ? (
        <GrillaInfo>
          <FilaInfo label="Horas de sueño" value={perfil?.horas_sueno
            ? `${perfil.horas_sueno}${perfil.calidad_sueno ? ` · calidad ${CALIDAD[perfil.calidad_sueno - 1]}` : ''}` : null} />
          <FilaInfo label="Estrés"         value={perfil?.nivel_estres ? ESTRES[perfil.nivel_estres - 1] : null} />
          <FilaInfo label="Tipo de trabajo" value={perfil?.tipo_trabajo} />
          <FilaInfo label="Pasos diarios"  value={perfil?.pasos_diarios} />
          <FilaInfo label="Tabaco"         value={perfil?.consumo_tabaco} />
        </GrillaInfo>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Label>Horas de sueño habituales</Label>
            <ChipsSingle options={SUENO} value={draft.horas_sueno} onChange={set('horas_sueno')} />
          </div>
          <div>
            <Label>Calidad del sueño</Label>
            <ScaleInput labels={CALIDAD} value={draft.calidad_sueno} onChange={set('calidad_sueno')} />
          </div>
          <div>
            <Label>Nivel de estrés habitual</Label>
            <ScaleInput labels={ESTRES} value={draft.nivel_estres} onChange={set('nivel_estres')} />
          </div>
          <div>
            <Label>Tipo de trabajo / actividad</Label>
            <ChipsSingle options={TRABAJO} value={draft.tipo_trabajo} onChange={set('tipo_trabajo')} />
          </div>
          <div>
            <Label>Pasos / movimiento diario</Label>
            <ChipsSingle options={PASOS} value={draft.pasos_diarios} onChange={set('pasos_diarios')} />
          </div>
          <div>
            <Label>Tabaco</Label>
            <ChipsSingle options={TABACO} value={draft.consumo_tabaco} onChange={set('consumo_tabaco')} />
          </div>
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. BARRERAS Y EXPECTATIVAS
// ══════════════════════════════════════════════════════════════════════════════

function SecBarreras({ perfil, savePerfil }) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const set = k => v => setDraft(p => ({ ...p, [k]: v }))
  const CONFIANZA = [
    'Creo que me resultará muy difícil ser constante.',
    'Probablemente tendré bastantes dificultades.',
    'Podré mantenerla, aunque con algunas dificultades.',
    'Confío bastante en poder entrenar con regularidad.',
    'Totalmente seguro/a de que podré mantener una rutina.',
  ]

  function abrir() {
    setDraft({
      confianza_rutina:    perfil?.confianza_rutina ?? null,
      barreras_adherencia: perfil?.barreras_adherencia || [],
    })
    setEditando(true)
  }

  async function guardar() {
    setSaving(true)
    await savePerfil({
      confianza_rutina:    draft.confianza_rutina,
      barreras_adherencia: draft.barreras_adherencia,
    })
    setSaving(false)
    setEditando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Bloque numero="9" titulo="Barreras y expectativas" guardado={saved}
      editando={editando} onEditar={abrir} onCancelar={() => setEditando(false)}
      onGuardar={guardar} saving={saving}>
      {!editando ? (
        <GrillaInfo>
          <FilaInfo label="Confianza en rutina" value={perfil?.confianza_rutina
            ? `${perfil.confianza_rutina}/5 — ${CONFIANZA[perfil.confianza_rutina - 1]}` : null} />
          <FilaInfo label="Posibles barreras" value={perfil?.barreras_adherencia?.join(', ')} />
        </GrillaInfo>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Label>Confianza para mantener rutina</Label>
            <ScaleInput labels={CONFIANZA} value={draft.confianza_rutina} onChange={set('confianza_rutina')} />
          </div>
          <div>
            <Label>Posibles barreras</Label>
            <ChipsMulti options={BARRERAS_OPTS} value={draft.barreras_adherencia} onChange={set('barreras_adherencia')} />
          </div>
        </div>
      )}
    </Bloque>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. CUESTIONARIO INICIAL
// ══════════════════════════════════════════════════════════════════════════════

function SecCuestionario({ cuestionario, verCuestionario, setVerCuestionario, cueTab, setCueTab, onEditar, onSincronizar }) {
  const [sincronizando, setSincronizando] = useState(false)
  const [sincronizado, setSincronizado] = useState(false)

  async function sincronizar() {
    if (!cuestionario?.token_publico) return
    setSincronizando(true)
    await supabase.rpc('sincronizar_perfil_desde_cuestionario', { p_token_publico: cuestionario.token_publico })
    setSincronizando(false)
    setSincronizado(true)
    setTimeout(() => setSincronizado(false), 3000)
    onSincronizar?.()
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>10. Cuestionario inicial</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cuestionario?.submitted_at && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={sincronizar} disabled={sincronizando}>
              {sincronizado ? '✓ Sincronizado' : sincronizando ? 'Sincronizando…' : '↻ Sincronizar perfil'}
            </button>
          )}
          {cuestionario?.submitted_at && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={onEditar}>
              ✏️ Editar
            </button>
          )}
          {cuestionario?.submitted_at && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
              onClick={() => setVerCuestionario(v => !v)}>
              {verCuestionario ? 'Ocultar ↑' : 'Ver ↓'}
            </button>
          )}
        </div>
      </div>

      {cuestionario?.submitted_at ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: verCuestionario ? 16 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'var(--accent-light)', color: 'var(--accent-text)' }}>
              ✓ Completado el {format(parseISO(cuestionario.submitted_at), 'd MMM yyyy', { locale: es })}
            </span>
          </div>
          {verCuestionario && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                {[['resumen','Resumen'],['respuestas','Respuestas completas']].map(([id, label]) => (
                  <button key={id} onClick={() => setCueTab(id)}
                    style={{ padding: '7px 12px', fontSize: 12.5, fontWeight: cueTab === id ? 600 : 400, color: cueTab === id ? 'var(--accent)' : 'var(--text2)', background: 'none', border: 'none', borderBottom: cueTab === id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
                    {label}
                  </button>
                ))}
              </div>
              {cueTab === 'resumen' ? <ResumenCuestionario data={cuestionario} /> : <RespuestasCompletas data={cuestionario} />}
            </div>
          )}
        </>
      ) : cuestionario ? (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Cuestionario pendiente de respuesta por el cliente.</p>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sin cuestionario inicial generado.</p>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES REUTILIZABLES
// ══════════════════════════════════════════════════════════════════════════════

function Bloque({ numero, titulo, editando, onEditar, onCancelar, onGuardar, saving, guardado, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{numero}. {titulo}</span>
          {guardado && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>✓ Guardado</span>}
        </div>
        {!editando ? (
          <button className="btn btn-ghost btn-sm" onClick={onEditar} style={{ fontSize: 12 }}>Editar</button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={onCancelar} style={{ fontSize: 12 }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={onGuardar} disabled={saving} style={{ fontSize: 12 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function GrillaInfo({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
}

function FilaInfo({ label, value }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--text3)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{Array.isArray(value) ? value.join(', ') : String(value)}</span>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text2)', marginBottom: 7 }}>{children}</div>
  )
}

function ModalLabel({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, fontFamily: 'var(--mono)' }}>{children}</div>
  )
}

function Campo({ label, value, onChange, type = 'text', placeholder = '', multiline = false, style: extraStyle = {} }) {
  return (
    <div style={extraStyle}>
      {label && <Label>{label}</Label>}
      {multiline ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', resize: 'vertical', outline: 'none' }} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', outline: 'none' }} />
      )}
    </div>
  )
}

function CampoSelect({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', outline: 'none' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// Multi-select chips: opciones estándar + valores personalizados que puedan existir
function ChipsMulti({ options, value = [], onChange }) {
  const customValues = (value || []).filter(v => !options.includes(v))
  const todos = [...options, ...customValues]
  function toggle(opt) {
    const curr = value || []
    onChange(curr.includes(opt) ? curr.filter(v => v !== opt) : [...curr, opt])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {todos.map(opt => {
        const on = (value || []).includes(opt)
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            style={{ padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12.5, cursor: 'pointer', transition: 'all 0.1s' }}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// Single-select chips
function ChipsSingle({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const on = value === opt
        return (
          <button key={opt} type="button" onClick={() => onChange(on ? '' : opt)}
            style={{ padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12.5, cursor: 'pointer', transition: 'all 0.1s' }}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// Scale 1-5
function ScaleInput({ labels, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {labels.map((label, i) => {
        const n = i + 1
        const on = value === n
        return (
          <button key={n} type="button" onClick={() => onChange(on ? null : n)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: on ? 'var(--accent)' : 'var(--border)', color: on ? '#fff' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
            <span style={{ fontSize: 13, color: on ? 'var(--accent-text)' : 'var(--text2)', lineHeight: 1.4 }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Botón numérico (variable days)
function NumBtn({ n, on, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s' }}>
      {n}
    </button>
  )
}

// Modal genérico
function Modal({ titulo, onClose, children, ancho = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '24px', width: '100%', maxWidth: ancho, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      </div>
    </div>
  )
}
