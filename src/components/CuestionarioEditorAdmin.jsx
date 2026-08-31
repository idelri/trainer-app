/**
 * CuestionarioEditorAdmin
 * Permite a Irene corregir el cuestionario inicial de un cliente
 * desde la ficha de cliente (autenticada). Solo admin.
 *
 * Al guardar:
 *  1. Actualiza cuestionario_inicial directamente (autenticado → sin RLS)
 *  2. Fuerza sincronización de cliente_perfil
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  OTRO, OBJETIVOS, DEPORTES, DEPORTES_SIN_FREQ, FREC_ACT_OPTS, EXP,
  FRECUENCIA, DURACION, PREFERENCIA_ENTRENO, TIPOS_ENTRENO,
  DIAS_ABR, DIAS_FULL, DIAS_OPTS, TIEMPO, HORARIOS, LUGARES,
  MAT_CASA, WEARABLE_MARCAS, SUENO, TRABAJO, PASOS, TABACO,
  BARRERAS_OPTS, ANTECEDENTES_OPTS,
} from '../lib/opcionesCliente'

// ── Constantes locales (salud) ────────────────────────────────────────────────
const ZONAS = [
  'Cabeza / cuello','Hombro derecho','Hombro izquierdo','Codo / antebrazo derecho',
  'Codo / antebrazo izquierdo','Muñeca / mano derecha','Muñeca / mano izquierda',
  'Zona dorsal','Zona lumbar','Zona abdominal / core','Cadera / glúteo derecho',
  'Cadera / glúteo izquierdo','Muslo / cuádriceps derecho','Muslo / cuádriceps izquierdo',
  'Isquiotibiales derecho','Isquiotibiales izquierdo','Rodilla derecha','Rodilla izquierda',
  'Pierna / gemelo derecho','Pierna / gemelo izquierdo','Tobillo / pie derecho','Tobillo / pie izquierdo', OTRO,
]
const ANTIGUEDAD = ['Hace menos de 1 semana','1–4 semanas','1–3 meses','3–6 meses','Más de 6 meses','Más de 1 año','Crónica (varios años)']
const TRATAMIENTO_OPTS = ['No','Fisioterapia','Rehabilitación','Seguimiento médico','Varios']
const ANTECEDENTES_KEY = {
  'Lesiones anteriores relevantes': 'lesiones_anteriores',
  'Operaciones o intervenciones previas': 'operaciones',
  'Enfermedad o diagnóstico médico relevante': 'enfermedades',
  'Medicación que pueda afectar al entrenamiento': 'medicacion',
  'Restricciones o indicaciones médicas': 'restricciones_medicas',
}
const ANTECEDENTES_PLACEHOLDER = {
  'Lesiones anteriores relevantes': '¿Qué lesión/es y cuándo ocurrieron?',
  'Operaciones o intervenciones previas': '¿Cuáles y cuándo?',
  'Enfermedad o diagnóstico médico relevante': '¿Cuál?',
  'Medicación que pueda afectar al entrenamiento': '¿Cuál?',
  'Restricciones o indicaciones médicas': '¿Cuáles?',
}
const EMPTY_LESION = { zona: '', zona_otro: '', antiguedad: '', intensidad: null, movimientos: '', limitaciones: '', diagnostico: '' }
const COMP_TRIGGER = 'Preparar una competición o reto deportivo'
const CONFIANZA_LABELS = [
  'Creo que me resultará muy difícil ser constante.',
  'Probablemente tendré bastantes dificultades.',
  'Podré mantenerla, aunque con algunas dificultades.',
  'Confío bastante en poder entrenar con regularidad.',
  'Totalmente seguro/a de que podré mantener una rutina.',
]

// ── Helper: init form desde cuestionario ─────────────────────────────────────
function initForm(d) {
  if (!d) return {}
  const det = d.antecedentes_detalle || {}
  return {
    nombre: d.nombre || '',
    nombre_preferido: d.nombre_preferido || '',
    email: d.email || '',
    telefono: d.telefono || '',
    fecha_nacimiento: d.fecha_nacimiento || '',
    profesion: d.profesion || '',
    ciudad: d.ciudad || '',

    objetivo_principal: d.objetivo_principal || '',
    objetivos_secundarios: d.objetivos_secundarios || [],
    objetivo_3_6_meses: d.objetivo_3_6_meses || '',

    deportes_actuales: d.deportes_actuales || [],
    frecuencia_por_actividad: d.frecuencia_por_actividad || [],
    frecuencia_actual: d.frecuencia_actual || '',
    duracion_habitual: d.duracion_habitual || '',
    experiencia_fuerza: d.experiencia_fuerza || '',
    experiencia_fuerza_obs: d.experiencia_fuerza_obs || '',
    experiencia_resistencia: d.experiencia_resistencia || '',
    experiencia_resistencia_obs: d.experiencia_resistencia_obs || '',
    experiencia_funcional: d.experiencia_funcional || '',
    experiencia_funcional_obs: d.experiencia_funcional_obs || '',
    preferencia_entreno: d.preferencia_entreno || [],
    tipos_entreno_disfruta: d.tipos_entreno_disfruta || [],
    evitar_ejercicios_yn: d.evitar_ejercicios_yn || '',
    evitar_ejercicios_detalle: d.evitar_ejercicios_detalle || '',

    dias_semana: d.dias_semana || '',
    dias_preferentes: d.dias_preferentes || [],
    tiempo_sesion: d.tiempo_sesion || '',
    horarios_preferentes: d.horarios_preferentes || [],
    lugares_entrenamiento: d.lugares_entrenamiento || [],
    tiene_gimnasio: d.tiene_gimnasio,
    gimnasio_nombre: d.gimnasio_nombre || '',
    material_casa: d.material_casa || [],
    tiene_wearable: d.tiene_wearable,
    wearable_marca: d.wearable_marca || '',
    wearable_modelo: d.wearable_modelo || '',

    antecedentes_categorias: d.antecedentes_categorias || [],
    antecedentes_detalle: det,
    lesiones_actuales_yn: (d.lesiones_actuales && d.lesiones_actuales.length > 0) ? 'Sí' : 'No',
    lesiones_actuales: d.lesiones_actuales || [],
    tratamiento_actual: d.tratamiento_actual || '',
    tratamiento_actual_detalle: d.tratamiento_actual_detalle || '',

    horas_sueno: d.horas_sueno || '',
    calidad_sueno: d.calidad_sueno || null,
    nivel_estres: d.nivel_estres || null,
    tipo_trabajo: d.tipo_trabajo || '',
    pasos_diarios: d.pasos_diarios || '',
    consumo_tabaco: d.consumo_tabaco || '',

    confianza_rutina: d.confianza_rutina || null,
    barreras_adherencia: d.barreras_adherencia || [],
    info_adicional: d.info_adicional || '',
  }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CuestionarioEditorAdmin({ cuestionario, clienteId, onSaved, onClose }) {
  const [form, setForm] = useState(() => initForm(cuestionario))
  const [saving, setSaving] = useState(false)
  const [abierto, setAbierto] = useState({ personal: true, salud: true })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const s = k => v => set(k, v)

  function toggleSeccion(k) { setAbierto(a => ({ ...a, [k]: !a[k] })) }

  // ── Lesiones helpers ──
  function addLesion() { set('lesiones_actuales', [...form.lesiones_actuales, { ...EMPTY_LESION }]) }
  function removeLesion(i) { set('lesiones_actuales', form.lesiones_actuales.filter((_, idx) => idx !== i)) }
  function setLesion(i, k, v) {
    set('lesiones_actuales', form.lesiones_actuales.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }

  // ── Antecedentes helpers ──
  function handleAntecedentes(nuevos) {
    set('antecedentes_categorias', nuevos)
    const det = { ...form.antecedentes_detalle }
    Object.keys(det).forEach(k => {
      const cat = Object.entries(ANTECEDENTES_KEY).find(([, v]) => v === k)?.[0]
      if (cat && !nuevos.includes(cat)) delete det[k]
    })
    set('antecedentes_detalle', det)
  }
  function setDetalle(cat, val) {
    const key = ANTECEDENTES_KEY[cat]
    if (!key) return
    set('antecedentes_detalle', { ...form.antecedentes_detalle, [key]: val })
  }

  // ── Guardar ──
  async function guardar() {
    setSaving(true)
    const f = form
    const tieneGimnasio = f.lugares_entrenamiento.includes('Gimnasio')

    const payload = {
      nombre: f.nombre || null,
      nombre_preferido: f.nombre_preferido || null,
      email: f.email || null,
      telefono: f.telefono || null,
      fecha_nacimiento: f.fecha_nacimiento || null,
      profesion: f.profesion || null,
      ciudad: f.ciudad || null,

      objetivo_principal: f.objetivo_principal || null,
      objetivos_secundarios: f.objetivos_secundarios,
      objetivo_3_6_meses: f.objetivo_3_6_meses || null,

      deportes_actuales: f.deportes_actuales,
      frecuencia_por_actividad: f.frecuencia_por_actividad,
      frecuencia_actual: f.frecuencia_actual || null,
      duracion_habitual: f.duracion_habitual || null,
      experiencia_fuerza: f.experiencia_fuerza || null,
      experiencia_fuerza_obs: f.experiencia_fuerza_obs || null,
      experiencia_resistencia: f.experiencia_resistencia || null,
      experiencia_resistencia_obs: f.experiencia_resistencia_obs || null,
      experiencia_funcional: f.experiencia_funcional || null,
      experiencia_funcional_obs: f.experiencia_funcional_obs || null,
      preferencia_entreno: f.preferencia_entreno,
      tipos_entreno_disfruta: f.tipos_entreno_disfruta,
      evitar_ejercicios_yn: f.evitar_ejercicios_yn || null,
      evitar_ejercicios_detalle: f.evitar_ejercicios_yn === 'Sí' ? (f.evitar_ejercicios_detalle || null) : null,

      dias_semana: f.dias_semana || null,
      dias_preferentes: f.dias_preferentes,
      tiempo_sesion: f.tiempo_sesion || null,
      horarios_preferentes: f.horarios_preferentes,
      lugares_entrenamiento: f.lugares_entrenamiento,
      tiene_gimnasio: tieneGimnasio ? true : (f.tiene_gimnasio ?? null),
      gimnasio_nombre: tieneGimnasio ? (f.gimnasio_nombre || null) : null,
      material_casa: f.lugares_entrenamiento.includes('En casa') ? f.material_casa : [],
      tiene_wearable: f.tiene_wearable,
      wearable_marca: f.tiene_wearable ? (f.wearable_marca || null) : null,
      wearable_modelo: f.tiene_wearable ? (f.wearable_modelo || null) : null,

      antecedentes_categorias: f.antecedentes_categorias,
      antecedentes_detalle: f.antecedentes_detalle,
      lesiones_anteriores: f.antecedentes_detalle?.lesiones_anteriores || null,
      operaciones: f.antecedentes_detalle?.operaciones || null,
      enfermedades: f.antecedentes_detalle?.enfermedades || null,
      medicacion: f.antecedentes_detalle?.medicacion || null,
      restricciones_medicas: f.antecedentes_detalle?.restricciones_medicas || null,
      lesiones_actuales: f.lesiones_actuales_yn === 'Sí' ? f.lesiones_actuales : [],
      tratamiento_actual: f.tratamiento_actual || null,
      tratamiento_actual_detalle: (f.tratamiento_actual && f.tratamiento_actual !== 'No') ? (f.tratamiento_actual_detalle || null) : null,
      seguimiento_fisio: f.tratamiento_actual || null,

      horas_sueno: f.horas_sueno || null,
      calidad_sueno: f.calidad_sueno || null,
      nivel_estres: f.nivel_estres || null,
      tipo_trabajo: f.tipo_trabajo || null,
      pasos_diarios: f.pasos_diarios || null,
      consumo_tabaco: f.consumo_tabaco || null,

      confianza_rutina: f.confianza_rutina || null,
      barreras_adherencia: f.barreras_adherencia,
      info_adicional: f.info_adicional || null,
    }

    const { error } = await supabase
      .from('cuestionario_inicial')
      .update(payload)
      .eq('id', cuestionario.id)

    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }

    // Forzar sync cliente_perfil (sobrescribe, no COALESCE — edición admin)
    await supabase.from('cliente_perfil').upsert({
      cliente_id: clienteId,
      nombre_preferido: payload.nombre_preferido,
      fecha_nacimiento: payload.fecha_nacimiento,
      profesion: payload.profesion,
      ciudad: payload.ciudad,
      deportes_actuales: payload.deportes_actuales,
      frecuencia_por_actividad: payload.frecuencia_por_actividad,
      frecuencia_actual: payload.frecuencia_actual,
      duracion_habitual: payload.duracion_habitual,
      experiencia_fuerza: payload.experiencia_fuerza,
      experiencia_fuerza_obs: payload.experiencia_fuerza_obs,
      experiencia_resistencia: payload.experiencia_resistencia,
      experiencia_resistencia_obs: payload.experiencia_resistencia_obs,
      experiencia_funcional: payload.experiencia_funcional,
      experiencia_funcional_obs: payload.experiencia_funcional_obs,
      preferencia_entreno: payload.preferencia_entreno,
      tipos_entreno_disfruta: payload.tipos_entreno_disfruta,
      evitar_ejercicios_yn: payload.evitar_ejercicios_yn,
      evitar_ejercicios_detalle: payload.evitar_ejercicios_detalle,
      dias_semana: payload.dias_semana,
      dias_preferentes: payload.dias_preferentes,
      tiempo_sesion: payload.tiempo_sesion,
      horarios: payload.horarios_preferentes,
      lugares_entrenamiento: payload.lugares_entrenamiento,
      tiene_gimnasio: payload.tiene_gimnasio,
      gimnasio_nombre: payload.gimnasio_nombre,
      material_casa: payload.material_casa,
      tiene_wearable: payload.tiene_wearable,
      wearable_marca: payload.wearable_marca,
      wearable_modelo: payload.wearable_modelo,
      horas_sueno: payload.horas_sueno,
      calidad_sueno: payload.calidad_sueno,
      nivel_estres: payload.nivel_estres,
      tipo_trabajo: payload.tipo_trabajo,
      pasos_diarios: payload.pasos_diarios,
      consumo_tabaco: payload.consumo_tabaco,
      confianza_rutina: payload.confianza_rutina,
      barreras_adherencia: payload.barreras_adherencia,
      antecedentes_categorias: payload.antecedentes_categorias,
      lesiones_previas: payload.antecedentes_detalle?.lesiones_anteriores || null,
      operaciones: payload.antecedentes_detalle?.operaciones || null,
      condiciones_medicas: payload.antecedentes_detalle?.enfermedades || null,
      medicacion: payload.antecedentes_detalle?.medicacion || null,
      restricciones_medicas: payload.antecedentes_detalle?.restricciones_medicas || null,
      tratamiento_actual: payload.tratamiento_actual,
    }, { onConflict: 'cliente_id' })

    // Actualizar clientes con datos básicos
    await supabase.from('clientes').update({
      nombre: payload.nombre,
      email: payload.email,
      telefono: payload.telefono,
    }).eq('id', clienteId)

    setSaving(false)
    onSaved({ ...cuestionario, ...payload })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 680, padding: '0 0 32px' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, borderRadius: '14px 14px 0 0' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Editar cuestionario inicial</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Solo visible para ti · Los cambios también actualizan la pestaña Información</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 18, padding: '2px 8px' }}>✕</button>
        </div>

        <div style={{ padding: '0 24px' }}>

          {/* 1. Datos personales */}
          <Seccion titulo="Datos personales" id="personal" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Nombre completo">
              <Input value={form.nombre} onChange={s('nombre')} />
            </Fila>
            <Fila label="Cómo llamarle">
              <Input value={form.nombre_preferido} onChange={s('nombre_preferido')} placeholder="p.ej. Marta" />
            </Fila>
            <Fila label="Email">
              <Input value={form.email} onChange={s('email')} type="email" />
            </Fila>
            <Fila label="Teléfono">
              <Input value={form.telefono} onChange={s('telefono')} />
            </Fila>
            <Fila label="Fecha de nacimiento">
              <Input value={form.fecha_nacimiento} onChange={s('fecha_nacimiento')} type="date" />
            </Fila>
            <Fila label="Profesión">
              <Input value={form.profesion} onChange={s('profesion')} />
            </Fila>
            <Fila label="Ciudad / zona">
              <Input value={form.ciudad} onChange={s('ciudad')} />
            </Fila>
          </Seccion>

          {/* 2. Objetivos */}
          <Seccion titulo="Objetivos" id="objetivos" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Objetivo principal">
              <Chips options={OBJETIVOS} value={form.objetivo_principal} multi={false} onChange={s('objetivo_principal')} />
            </Fila>
            <Fila label="Objetivos secundarios">
              <Chips options={OBJETIVOS.filter(o => o !== form.objetivo_principal)} value={form.objetivos_secundarios} multi onChange={s('objetivos_secundarios')} />
            </Fila>
            <Fila label="Objetivo a 3–6 meses">
              <Textarea value={form.objetivo_3_6_meses} onChange={s('objetivo_3_6_meses')} rows={2} />
            </Fila>
          </Seccion>

          {/* 3. Actividad */}
          <Seccion titulo="Actividad y experiencia" id="actividad" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Deportes actuales">
              <Chips options={DEPORTES} value={form.deportes_actuales} multi onChange={v => {
                const activas = v.filter(d => !DEPORTES_SIN_FREQ.includes(d))
                const nueva = activas.map(a => form.frecuencia_por_actividad.find(x => x.actividad === a) || { actividad: a, frecuencia: '' })
                set('deportes_actuales', v)
                set('frecuencia_por_actividad', nueva)
              }} />
            </Fila>
            {form.deportes_actuales.filter(d => !DEPORTES_SIN_FREQ.includes(d)).map(act => (
              <Fila key={act} label={`Freq. ${act}`}>
                <Chips options={FREC_ACT_OPTS} multi={false}
                  value={(form.frecuencia_por_actividad.find(x => x.actividad === act)?.frecuencia) || ''}
                  onChange={v => set('frecuencia_por_actividad', form.frecuencia_por_actividad.map(x => x.actividad === act ? { ...x, frecuencia: v } : x))} />
              </Fila>
            ))}
            <Fila label="Frecuencia total">
              <Chips options={FRECUENCIA} multi={false} value={form.frecuencia_actual} onChange={s('frecuencia_actual')} />
            </Fila>
            <Fila label="Duración habitual">
              <Chips options={DURACION} multi={false} value={form.duracion_habitual} onChange={s('duracion_habitual')} />
            </Fila>
            <Fila label="Exp. fuerza">
              <Chips options={EXP} multi={false} value={form.experiencia_fuerza} onChange={s('experiencia_fuerza')} />
              {form.experiencia_fuerza && <Input style={{ marginTop: 6 }} value={form.experiencia_fuerza_obs} onChange={s('experiencia_fuerza_obs')} placeholder="Observaciones (opcional)" />}
            </Fila>
            <Fila label="Exp. resistencia">
              <Chips options={EXP} multi={false} value={form.experiencia_resistencia} onChange={s('experiencia_resistencia')} />
              {form.experiencia_resistencia && <Input style={{ marginTop: 6 }} value={form.experiencia_resistencia_obs} onChange={s('experiencia_resistencia_obs')} placeholder="Observaciones (opcional)" />}
            </Fila>
            <Fila label="Exp. funcional">
              <Chips options={['Sin experiencia','Principiante','Intermedio','Avanzado']} multi={false} value={form.experiencia_funcional} onChange={s('experiencia_funcional')} />
            </Fila>
            <Fila label="Preferencia entreno">
              <Chips options={PREFERENCIA_ENTRENO} multi value={form.preferencia_entreno} onChange={s('preferencia_entreno')} />
            </Fila>
            <Fila label="Tipos que disfruta">
              <Chips options={TIPOS_ENTRENO} multi value={form.tipos_entreno_disfruta} onChange={s('tipos_entreno_disfruta')} />
            </Fila>
            <Fila label="¿Evita ejercicios?">
              <Chips options={['Sí','No']} multi={false} value={form.evitar_ejercicios_yn} onChange={s('evitar_ejercicios_yn')} />
              {form.evitar_ejercicios_yn === 'Sí' && <Textarea style={{ marginTop: 6 }} value={form.evitar_ejercicios_detalle} onChange={s('evitar_ejercicios_detalle')} placeholder="¿Cuáles y por qué?" rows={2} />}
            </Fila>
          </Seccion>

          {/* 4. Disponibilidad */}
          <Seccion titulo="Disponibilidad y recursos" id="disponibilidad" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Días/semana">
              <Chips options={DIAS_OPTS} multi={false} value={form.dias_semana} onChange={s('dias_semana')} />
            </Fila>
            <Fila label="Días preferentes">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DIAS_ABR.map((abr, i) => {
                  const dia = DIAS_FULL[i]
                  const on = form.dias_preferentes.includes(dia)
                  return <button key={abr} type="button" onClick={() => set('dias_preferentes', on ? form.dias_preferentes.filter(d => d !== dia) : [...form.dias_preferentes, dia])}
                    style={{ width: 34, height: 34, borderRadius: 7, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{abr}</button>
                })}
              </div>
            </Fila>
            <Fila label="Tiempo/sesión">
              <Chips options={TIEMPO} multi={false} value={form.tiempo_sesion} onChange={s('tiempo_sesion')} />
            </Fila>
            <Fila label="Horarios">
              <Chips options={HORARIOS} multi value={form.horarios_preferentes} onChange={s('horarios_preferentes')} />
            </Fila>
            <Fila label="Lugares">
              <Chips options={LUGARES} multi value={form.lugares_entrenamiento} onChange={s('lugares_entrenamiento')} />
            </Fila>
            {form.lugares_entrenamiento.includes('Gimnasio') && (
              <Fila label="Nombre gimnasio">
                <Input value={form.gimnasio_nombre} onChange={s('gimnasio_nombre')} />
              </Fila>
            )}
            {form.lugares_entrenamiento.includes('En casa') && (
              <Fila label="Material en casa">
                <Chips options={MAT_CASA} multi value={form.material_casa} onChange={s('material_casa')} />
              </Fila>
            )}
            <Fila label="¿Wearable?">
              <Chips options={['Sí','No']} multi={false}
                value={form.tiene_wearable === true ? 'Sí' : form.tiene_wearable === false ? 'No' : ''}
                onChange={v => set('tiene_wearable', v === 'Sí' ? true : v === 'No' ? false : null)} />
              {form.tiene_wearable === true && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Chips options={WEARABLE_MARCAS} multi={false} value={form.wearable_marca} onChange={s('wearable_marca')} />
                  <Input value={form.wearable_modelo} onChange={s('wearable_modelo')} placeholder="Modelo (opcional)" />
                </div>
              )}
            </Fila>
          </Seccion>

          {/* 5. Salud y lesiones */}
          <Seccion titulo="Salud y lesiones" id="salud" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Antecedentes de salud">
              <Chips
                options={ANTECEDENTES_OPTS}
                multi
                value={form.antecedentes_categorias}
                onChange={handleAntecedentes}
                exclusive={['Ninguno']}
              />
              {form.antecedentes_categorias.filter(c => c !== 'Ninguno').map(cat => (
                <div key={cat} style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>{cat}</div>
                  <Textarea
                    value={(form.antecedentes_detalle || {})[ANTECEDENTES_KEY[cat]] || ''}
                    onChange={v => setDetalle(cat, v)}
                    placeholder={ANTECEDENTES_PLACEHOLDER[cat] || ''}
                    rows={2}
                  />
                </div>
              ))}
            </Fila>

            <Fila label="¿Lesión / molestia actual?">
              <Chips options={['Sí','No']} multi={false} value={form.lesiones_actuales_yn} onChange={v => {
                s('lesiones_actuales_yn')(v)
                if (v === 'No') set('lesiones_actuales', [])
                if (v === 'Sí' && form.lesiones_actuales.length === 0) set('lesiones_actuales', [{ ...EMPTY_LESION }])
              }} />
            </Fila>

            {form.lesiones_actuales_yn === 'Sí' && (
              <div style={{ marginTop: 8 }}>
                {form.lesiones_actuales.map((l, i) => (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Lesión / molestia {i + 1}</span>
                      <button type="button" onClick={() => removeLesion(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>Zona</div>
                        <Chips options={ZONAS} multi={false} value={l.zona}
                          onChange={v => set('lesiones_actuales', form.lesiones_actuales.map((l2, idx) => idx === i ? { ...l2, zona: v, ...(v !== OTRO ? { zona_otro: '' } : {}) } : l2))} />
                        {l.zona === OTRO && <Input style={{ marginTop: 6 }} value={l.zona_otro} onChange={v => setLesion(i, 'zona_otro', v)} placeholder="¿Qué zona?" />}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>¿Desde cuándo?</div>
                        <Chips options={ANTIGUEDAD} multi={false} value={l.antiguedad} onChange={v => setLesion(i, 'antiguedad', v)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>Intensidad (0–10)</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                            const on = l.intensidad === n
                            return <button key={n} type="button" onClick={() => setLesion(i, 'intensidad', on ? null : n)}
                              style={{ width: 34, height: 34, borderRadius: 7, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>Movimientos que la provocan</div>
                        <Textarea value={l.movimientos} onChange={v => setLesion(i, 'movimientos', v)} rows={2} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>Limitaciones</div>
                        <Textarea value={l.limitaciones} onChange={v => setLesion(i, 'limitaciones', v)} rows={2} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>Diagnóstico (opcional)</div>
                        <Input value={l.diagnostico} onChange={v => setLesion(i, 'diagnostico', v)} placeholder="Ej: tendinitis rotuliana..." />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addLesion}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  + Añadir otra lesión o molestia
                </button>
              </div>
            )}

            <Fila label="Tratamiento / seguimiento actual">
              <Chips options={TRATAMIENTO_OPTS} multi={false} value={form.tratamiento_actual} onChange={s('tratamiento_actual')} />
              {form.tratamiento_actual && form.tratamiento_actual !== 'No' && (
                <Textarea style={{ marginTop: 6 }} value={form.tratamiento_actual_detalle} onChange={s('tratamiento_actual_detalle')} rows={2} placeholder="Detalles (opcional)" />
              )}
            </Fila>
          </Seccion>

          {/* 6. Estilo de vida */}
          <Seccion titulo="Estilo de vida" id="estilo" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Horas de sueño">
              <Chips options={SUENO} multi={false} value={form.horas_sueno} onChange={s('horas_sueno')} />
            </Fila>
            <Fila label="Calidad sueño (1–5)">
              <Scale labels={['Muy mala','Regular','Normal','Buena','Muy buena']} value={form.calidad_sueno} onChange={s('calidad_sueno')} />
            </Fila>
            <Fila label="Nivel de estrés (1–5)">
              <Scale labels={['Muy bajo','Bajo','Moderado','Alto','Muy alto']} value={form.nivel_estres} onChange={s('nivel_estres')} />
            </Fila>
            <Fila label="Tipo de trabajo">
              <Chips options={TRABAJO} multi={false} value={form.tipo_trabajo} onChange={s('tipo_trabajo')} />
            </Fila>
            <Fila label="Pasos diarios">
              <Chips options={PASOS} multi={false} value={form.pasos_diarios} onChange={s('pasos_diarios')} />
            </Fila>
            <Fila label="Tabaco">
              <Chips options={TABACO} multi={false} value={form.consumo_tabaco} onChange={s('consumo_tabaco')} />
            </Fila>
          </Seccion>

          {/* 7. Motivación */}
          <Seccion titulo="Motivación y barreras" id="motivacion" abierto={abierto} toggle={toggleSeccion}>
            <Fila label="Confianza en rutina (1–5)">
              <Scale labels={CONFIANZA_LABELS} value={form.confianza_rutina} onChange={s('confianza_rutina')} />
            </Fila>
            <Fila label="Posibles barreras">
              <Chips options={BARRERAS_OPTS} multi value={form.barreras_adherencia} onChange={s('barreras_adherencia')}
                exclusive={['No creo que tenga grandes dificultades']} />
            </Fila>
            <Fila label="Información adicional">
              <Textarea value={form.info_adicional} onChange={s('info_adicional')} rows={3} placeholder="Cualquier cosa relevante que no haya aparecido antes" />
            </Fila>
          </Seccion>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Seccion({ titulo, id, abierto, toggle, children }) {
  const open = abierto[id] !== false
  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)' }}>
      <button type="button" onClick={() => toggle(id)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{titulo}</span>
        <span style={{ fontSize: 16, color: 'var(--text3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 16 }}>{children}</div>}
    </div>
  )
}

function Fila({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text2)', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder = '', style: extra = {} }) {
  return (
    <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', outline: 'none', ...extra }} />
  )
}

function Textarea({ value, onChange, rows = 2, placeholder = '', style: extra = {} }) {
  return (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', resize: 'vertical', outline: 'none', ...extra }} />
  )
}

function Chips({ options, value, onChange, multi = false, exclusive = [] }) {
  function toggle(opt) {
    if (multi) {
      const curr = Array.isArray(value) ? value : []
      let next
      if (exclusive.includes(opt)) {
        next = curr.includes(opt) ? [] : [opt]
      } else {
        const sinExclusivos = curr.filter(v => !exclusive.includes(v))
        next = sinExclusivos.includes(opt) ? sinExclusivos.filter(v => v !== opt) : [...sinExclusivos, opt]
      }
      onChange(next)
    } else {
      onChange(value === opt ? '' : opt)
    }
  }
  const arr = multi ? (Array.isArray(value) ? value : []) : null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const on = multi ? arr.includes(opt) : value === opt
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

function Scale({ labels, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {labels.map((label, i) => {
        const n = i + 1
        const on = value === n
        return (
          <button key={n} type="button" onClick={() => onChange(on ? null : n)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: on ? 'var(--accent)' : 'var(--border)', color: on ? '#fff' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
            <span style={{ fontSize: 12.5, color: on ? 'var(--accent-text)' : 'var(--text2)', lineHeight: 1.4 }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
