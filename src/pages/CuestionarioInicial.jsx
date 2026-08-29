import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const T = {
  bg: '#f5f4f0',
  card: '#ffffff',
  text: '#1a1916',
  text2: '#5a5850',
  text3: '#9a9890',
  border: '#e0ddd8',
  green: '#2d6a4f',
  greenL: '#e3efe8',
  mono: 'ui-monospace, monospace',
}

const STEPS = [
  'Datos personales',
  'Objetivos',
  'Actividad y experiencia',
  'Disponibilidad y recursos',
  'Salud y lesiones',
  'Estilo de vida',
  'Para conocerte mejor',
]

const OTRO = 'Otro (especificar)'

const EMPTY_COMPETICION = { nombre: '', fecha: '', objetivo_rendimiento: '' }
const EMPTY_LESION = {
  zona: '', zona_otro: '', antiguedad: '', intensidad: null,
  movimientos: '', diagnostico: '', limitaciones: '',
}

const EMPTY = {
  // paso 1
  nombre: '', nombre_preferido: '', email: '', telefono: '',
  fecha_nacimiento: '', profesion: '', ciudad: '',
  foto_url: '',
  _foto_file: null, _foto_preview: '',          // local-only, no se guardan en BD

  // paso 2
  objetivo_principal: '', objetivo_principal_otro: '',
  competiciones: [],
  objetivos_secundarios: [], objetivos_secundarios_otro: '',
  objetivo_3_6_meses: '',

  // paso 3
  deportes_actuales: [], deportes_actuales_otro: '',
  frecuencia_por_actividad: [],                  // [{actividad, frecuencia}]
  frecuencia_actual: '',
  duracion_habitual: '',
  experiencia_fuerza: '', experiencia_fuerza_obs: '',
  experiencia_resistencia: '', experiencia_resistencia_obs: '',
  experiencia_funcional: '', experiencia_funcional_obs: '',
  preferencia_entreno: [],
  tipos_entreno_disfruta: [], tipos_entreno_disfruta_otro: '',
  evitar_ejercicios_yn: null,
  evitar_ejercicios_detalle: '',
  // campos legacy conservados en BD
  actividades_gustan: [], actividades_gustan_otro: '',
  actividades_evitar: [], actividades_evitar_otro: '',

  // paso 4
  dias_semana: '',
  dias_variable_min: '0',
  dias_variable_max: '4',
  dias_preferentes: [],
  tiempo_sesion: '', tiempo_sesion_obs: '',
  horarios_preferentes: [],
  lugares_entrenamiento: [],
  tiene_gimnasio: null,
  gimnasio_nombre: '',
  material_gimnasio: [], material_gimnasio_otro: '',
  material_casa: [], material_casa_otro: '',
  tiene_wearable: null,
  wearable_marca: '', wearable_marca_otro: '',
  wearable_modelo: '',

  // paso 5
  lesiones_actuales_yn: null,
  lesiones_actuales: [],
  tratamiento_actual: '',
  tratamiento_actual_detalle: '',
  antecedentes_categorias: [],
  antecedentes_detalle: {},
  // legacy
  lesiones_anteriores_yn: null, lesiones_anteriores: '',
  operaciones_yn: null, operaciones: '',
  enfermedades_yn: null, enfermedades: '',
  medicacion_yn: null, medicacion: '',
  restricciones_medicas_yn: null, restricciones_medicas: '',
  seguimiento_fisio: '',

  // paso 6
  horas_sueno: '', calidad_sueno: null, nivel_estres: null,
  tipo_trabajo: '', pasos_diarios: '', consumo_tabaco: '',
  // legacy conservados en BD
  nivel_energia: null, consumo_alcohol: '',

  // paso 7
  confianza_rutina: null,
  barreras_adherencia: [], barreras_adherencia_otro: '',
  expectativas_entrenador: [], expectativas_entrenador_otro: '',
  info_adicional: '',
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function Multi({ options, selected, onChange, exclusive = [] }) {
  const toggle = (opt) => {
    if (exclusive.includes(opt)) {
      // Si es exclusivo, deselecciona todos los demás
      if (selected.includes(opt)) onChange([])
      else onChange([opt])
      return
    }
    // Si hay exclusivos seleccionados, los quita
    const sinExclusivos = selected.filter(o => !exclusive.includes(o))
    if (sinExclusivos.includes(opt)) onChange(sinExclusivos.filter(o => o !== opt))
    else onChange([...sinExclusivos, opt])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <div key={opt} onClick={() => toggle(opt)}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text, fontSize: 13, cursor: 'pointer', userSelect: 'none', transition: 'all 0.12s' }}>
            {opt}
          </div>
        )
      })}
    </div>
  )
}

function Single({ options, selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const on = selected === opt
        return (
          <div key={opt} onClick={() => onChange(on ? '' : opt)}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text, fontSize: 13, cursor: 'pointer', userSelect: 'none', transition: 'all 0.12s' }}>
            {opt}
          </div>
        )
      })}
    </div>
  )
}

function Scale({ labels, selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {labels.map((label, i) => {
        const n = i + 1
        const on = selected === n
        return (
          <div key={n} onClick={() => onChange(on ? null : n)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, cursor: 'pointer', transition: 'all 0.12s' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: on ? T.green : T.border, color: on ? '#fff' : T.text3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</div>
            <span style={{ fontSize: 13, color: on ? T.green : T.text, lineHeight: 1.4 }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function Q({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: hint ? 4 : 10, lineHeight: 1.4 }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </div>
      {hint && <div style={{ fontSize: 12, color: T.text3, marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.card, fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.card, fontSize: 13, color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
  )
}

function YesNo({ selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {['Sí', 'No'].map(opt => {
        const on = selected === opt
        return (
          <div key={opt} onClick={() => onChange(on ? null : opt)}
            style={{ padding: '8px 20px', borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text, fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s' }}>
            {opt}
          </div>
        )
      })}
    </div>
  )
}

function Reveal({ show, children }) {
  if (!show) return null
  return <div style={{ marginTop: 12 }}>{children}</div>
}

// ─── Step 1 — Datos personales ────────────────────────────────────────────────

function Step1({ f, set }) {
  const s = (k) => (v) => set(k, v)
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    set('_foto_file', file)
    set('_foto_preview', URL.createObjectURL(file))
  }

  function quitarFoto() {
    set('_foto_file', null)
    set('_foto_preview', '')
    set('foto_url', '')
    if (fileRef.current) fileRef.current.value = ''
  }

  const previewSrc = f._foto_preview || f.foto_url
  return (
    <>
      <Q label="Nombre completo" required>
        <Input value={f.nombre} onChange={s('nombre')} placeholder="Nombre y apellidos" />
      </Q>

      <Q label="¿Cómo prefieres que te llamemos?" hint="Por ejemplo: nombre completo «Alejandro García» → nombre preferido «Álex»">
        <Input value={f.nombre_preferido} onChange={s('nombre_preferido')} placeholder="Opcional" />
      </Q>

      <Q label="Foto de perfil">
        {previewSrc && (
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={previewSrc} alt="Vista previa" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${T.border}` }} />
            <button type="button" onClick={quitarFoto}
              style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5' }}>
              Eliminar foto
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}
          style={{ fontSize: 13, color: T.text2 }} />
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 4 }}>Máx. 5 MB · JPG, PNG o WebP</div>
      </Q>

      <Q label="Email" required>
        <Input value={f.email} onChange={s('email')} type="email" placeholder="tu@email.com" />
      </Q>
      <Q label="Teléfono">
        <Input value={f.telefono} onChange={s('telefono')} placeholder="+34 600 000 000" />
      </Q>
      <Q label="Fecha de nacimiento">
        <Input value={f.fecha_nacimiento} onChange={s('fecha_nacimiento')} type="date" />
      </Q>
      <Q label="Profesión">
        <Input value={f.profesion} onChange={s('profesion')} placeholder="¿A qué te dedicas?" />
      </Q>
      <Q label="Ciudad / zona donde vives">
        <Input value={f.ciudad} onChange={s('ciudad')} placeholder="Ciudad o zona" />
      </Q>
    </>
  )
}

// ─── Step 2 — Objetivos ───────────────────────────────────────────────────────

const OBJETIVOS = [
  'Mejorar mi salud y condición física general',
  'Ganar fuerza',
  'Ganar masa muscular',
  'Perder grasa',
  'Mejorar mi resistencia',
  'Preparar una competición o reto deportivo',
  'Mejorar el rendimiento en mi deporte',
  'Reducir molestias o prevenir lesiones',
  'Recuperar la confianza después de una lesión',
  'Crear una rutina de entrenamiento',
]

const COMP_TRIGGER = 'Preparar una competición o reto deportivo'

function Step2({ f, set }) {
  const s = (k) => (v) => set(k, v)

  const mostrarCompeticion = f.objetivo_principal === COMP_TRIGGER ||
    f.objetivos_secundarios.includes(COMP_TRIGGER)

  function addComp() {
    set('competiciones', [...f.competiciones, { ...EMPTY_COMPETICION }])
  }
  function removeComp(i) {
    set('competiciones', f.competiciones.filter((_, idx) => idx !== i))
  }
  function setComp(i, k, v) {
    set('competiciones', f.competiciones.map((c, idx) => idx === i ? { ...c, [k]: v } : c))
  }

  // Al montar, si se activa mostrarCompeticion y competiciones está vacío, añadimos una
  useEffect(() => {
    if (mostrarCompeticion && f.competiciones.length === 0) addComp()
  }, [mostrarCompeticion]) // eslint-disable-line

  return (
    <>
      <Q label="Objetivo principal" required>
        <Single
          options={[...OBJETIVOS, OTRO]}
          selected={f.objetivo_principal}
          onChange={v => { s('objetivo_principal')(v); if (v !== OTRO) s('objetivo_principal_otro')('') }}
        />
        <Reveal show={f.objetivo_principal === OTRO}>
          <Input value={f.objetivo_principal_otro} onChange={s('objetivo_principal_otro')} placeholder="Especifica tu objetivo..." />
        </Reveal>
      </Q>

      <Q label="Objetivos secundarios">
        <Multi
          options={[...OBJETIVOS.filter(o => o !== f.objetivo_principal), OTRO]}
          selected={f.objetivos_secundarios}
          onChange={v => { s('objetivos_secundarios')(v); if (!v.includes(OTRO)) s('objetivos_secundarios_otro')('') }}
        />
        <Reveal show={f.objetivos_secundarios.includes(OTRO)}>
          <Input value={f.objetivos_secundarios_otro} onChange={s('objetivos_secundarios_otro')} placeholder="Especifica..." />
        </Reveal>
      </Q>

      {mostrarCompeticion && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 10 }}>
            Competición o reto
          </div>
          {f.competiciones.map((c, i) => (
            <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>
                  {f.competiciones.length > 1 ? `Competición ${i + 1}` : 'Competición / reto'}
                </span>
                {f.competiciones.length > 1 && (
                  <button type="button" onClick={() => removeComp(i)}
                    style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input value={c.nombre} onChange={v => setComp(i, 'nombre', v)} placeholder="Nombre del evento o reto" />
                <div>
                  <div style={{ fontSize: 11.5, color: T.text3, marginBottom: 4 }}>Fecha (si se conoce)</div>
                  <Input value={c.fecha} onChange={v => setComp(i, 'fecha', v)} type="date" />
                </div>
                <Input value={c.objetivo_rendimiento} onChange={v => setComp(i, 'objetivo_rendimiento', v)}
                  placeholder="Objetivo para la prueba (opcional) — ej: terminarla, bajar de 1h35..." />
              </div>
            </div>
          ))}
          <button type="button" onClick={addComp}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            + Añadir otra competición
          </button>
        </div>
      )}

      <Q label="¿Qué te gustaría haber conseguido en 3–6 meses?">
        <Textarea value={f.objetivo_3_6_meses} onChange={s('objetivo_3_6_meses')} placeholder="Cuéntame con tus palabras..." rows={2} />
      </Q>
    </>
  )
}

// ─── Step 3 — Actividad y experiencia ────────────────────────────────────────

const DEPORTES = [
  'Running / atletismo','Ciclismo','Natación','Triatlón','Fútbol','Fútbol sala',
  'Baloncesto','Tenis','Pádel','Balonmano','Voleibol','Rugby',
  'Artes marciales / boxeo','Crossfit','Gimnasia / acrobacia','Escalada',
  'Esquí / snowboard','Golf','Yoga','Pilates','Baile / danza','Senderismo',
  'Entrenamiento en sala (gym)','Ninguno actualmente',
]
const DEPORTES_SIN_FREQ = ['Ninguno actualmente']

const FREC_ACT_OPTS = ['1 día/sem','2 días/sem','3 días/sem','4 días/sem','5+ días/sem']
const EXP = ['Sin experiencia','Principiante (menos de 1 año)','Intermedio (1–3 años)','Avanzado (más de 3 años)']
const FRECUENCIA = ['No entreno actualmente','1–2 días/semana','3–4 días/semana','5–6 días/semana','Todos los días','Irregular, sin rutina fija']
const DURACION = ['Menos de 30 min','30–45 min','45–60 min','60–90 min','Más de 90 min','Variable']

function Step3({ f, set }) {
  const s = (k) => (v) => set(k, v)

  // Sincronizar frecuencia_por_actividad cuando cambian los deportes
  function handleDeportes(nuevos) {
    s('deportes_actuales')(nuevos)
    if (!nuevos.includes(OTRO)) s('deportes_actuales_otro')('')
    // Recomponer frecuencia_por_actividad: conservar frecuencias existentes, quitar actividades eliminadas
    const activas = nuevos.filter(d => !DEPORTES_SIN_FREQ.includes(d) && d !== OTRO)
    const actual = f.frecuencia_por_actividad || []
    const nuevaFreq = activas.map(a => {
      const existing = actual.find(x => x.actividad === a)
      return existing || { actividad: a, frecuencia: '' }
    })
    set('frecuencia_por_actividad', nuevaFreq)
  }

  function setFreqAct(actividad, frecuencia) {
    set('frecuencia_por_actividad', (f.frecuencia_por_actividad || []).map(x =>
      x.actividad === actividad ? { ...x, frecuencia } : x
    ))
  }

  const deportesConFreq = (f.deportes_actuales || []).filter(d => !DEPORTES_SIN_FREQ.includes(d) && d !== OTRO)

  return (
    <>
      <Q label="Deportes o actividades que practicas actualmente">
        <Multi
          options={[...DEPORTES, OTRO]}
          selected={f.deportes_actuales}
          onChange={handleDeportes}
          exclusive={['Ninguno actualmente']}
        />
        <Reveal show={f.deportes_actuales.includes(OTRO)}>
          <Input value={f.deportes_actuales_otro} onChange={s('deportes_actuales_otro')} placeholder="¿Cuáles?" />
        </Reveal>
      </Q>

      {deportesConFreq.length > 0 && (
        <Q label="¿Cuántos días por semana practicas estas actividades?">
          {deportesConFreq.length === 1 ? (
            <Single
              options={FREC_ACT_OPTS}
              selected={(f.frecuencia_por_actividad || []).find(x => x.actividad === deportesConFreq[0])?.frecuencia || ''}
              onChange={v => setFreqAct(deportesConFreq[0], v)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {deportesConFreq.map(act => {
                const freq = (f.frecuencia_por_actividad || []).find(x => x.actividad === act)?.frecuencia || ''
                return (
                  <div key={act}>
                    <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 6, fontWeight: 500 }}>{act}</div>
                    <Single options={FREC_ACT_OPTS} selected={freq} onChange={v => setFreqAct(act, v)} />
                  </div>
                )
              })}
            </div>
          )}
        </Q>
      )}

      <Q label="Frecuencia actual de entrenamiento (total)">
        <Single options={FRECUENCIA} selected={f.frecuencia_actual} onChange={s('frecuencia_actual')} />
      </Q>

      <Q label="Duración habitual de las sesiones">
        <Single options={DURACION} selected={f.duracion_habitual} onChange={s('duracion_habitual')} />
      </Q>

      <Q label="Experiencia en entrenamiento de fuerza">
        <Single options={EXP} selected={f.experiencia_fuerza} onChange={s('experiencia_fuerza')} />
        <Reveal show={!!f.experiencia_fuerza}>
          <Textarea value={f.experiencia_fuerza_obs} onChange={s('experiencia_fuerza_obs')} placeholder="Observaciones (opcional)" rows={2} />
        </Reveal>
      </Q>

      <Q label="Experiencia en resistencia (carrera, bici, natación...)">
        <Single options={EXP} selected={f.experiencia_resistencia} onChange={s('experiencia_resistencia')} />
        <Reveal show={!!f.experiencia_resistencia}>
          <Textarea value={f.experiencia_resistencia_obs} onChange={s('experiencia_resistencia_obs')} placeholder="Observaciones (opcional)" rows={2} />
        </Reveal>
      </Q>

      <Q label="Experiencia en movilidad, funcional u otras actividades dirigidas">
        <Single options={['Sin experiencia','Principiante','Intermedio','Avanzado']} selected={f.experiencia_funcional} onChange={s('experiencia_funcional')} />
        <Reveal show={!!f.experiencia_funcional}>
          <Textarea value={f.experiencia_funcional_obs} onChange={s('experiencia_funcional_obs')} placeholder="Observaciones (opcional)" rows={2} />
        </Reveal>
      </Q>

      <Q label="¿Cómo prefieres entrenar?">
        <Multi
          options={['Solo/a','Acompañado/a','En grupo','En interior','Al aire libre','Sin preferencia']}
          selected={f.preferencia_entreno}
          onChange={s('preferencia_entreno')}
          exclusive={['Sin preferencia']}
        />
      </Q>

      <Q label="¿Qué tipos de entrenamiento disfrutas especialmente?">
        <Multi
          options={['Entrenamiento de fuerza','Cardio / resistencia','HIIT / circuitos','Movilidad / flexibilidad','Actividades deportivas','Competición','Ninguno en particular', OTRO]}
          selected={f.tipos_entreno_disfruta}
          onChange={v => { s('tipos_entreno_disfruta')(v); if (!v.includes(OTRO)) s('tipos_entreno_disfruta_otro')('') }}
          exclusive={['Ninguno en particular']}
        />
        <Reveal show={f.tipos_entreno_disfruta.includes(OTRO)}>
          <Input value={f.tipos_entreno_disfruta_otro} onChange={s('tipos_entreno_disfruta_otro')} placeholder="¿Cuáles?" />
        </Reveal>
      </Q>

      <Q label="¿Hay algún ejercicio, actividad o tipo de entrenamiento que no te guste o prefieras evitar?">
        <YesNo selected={f.evitar_ejercicios_yn} onChange={s('evitar_ejercicios_yn')} />
        <Reveal show={f.evitar_ejercicios_yn === 'Sí'}>
          <Textarea value={f.evitar_ejercicios_detalle} onChange={s('evitar_ejercicios_detalle')} placeholder="¿Cuál y por qué?" rows={2} />
        </Reveal>
      </Q>
    </>
  )
}

// ─── Step 4 — Disponibilidad y recursos ───────────────────────────────────────

const DIAS_SEM = ['L','M','X','J','V','S','D']
const DIAS_SEM_FULL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const TIEMPO = ['Menos de 30 min','30–45 min','45–60 min','60–90 min','Más de 90 min','Variable']
const HORARIOS = ['Primera hora de la mañana (antes de 8h)','Mañana (8h–12h)','Mediodía (12h–15h)','Tarde (15h–19h)','Noche (19h–22h)','Sin preferencia']
const LUGARES = ['En casa','Gimnasio','Aire libre (parque, calle, monte...)','Piscina','Pista deportiva / campo','Trabajo / empresa','Varios lugares']
const MAT_CASA = ['Sin material','Esterilla','Mancuernas','Kettlebells','Barra y discos','Bandas elásticas','TRX / entrenamiento en suspensión','Barra de dominadas (puerta)','Banco','Cajón / step','Foam roller','Bicicleta estática','Cinta de correr','Remoergómetro','Balón medicinal']
const WEARABLE_MARCAS = ['Garmin','Apple Watch','Polar','COROS','Suunto','Huawei','Whoop', OTRO]

function Step4({ f, set }) {
  const s = (k) => (v) => set(k, v)

  function toggleDia(dia) {
    const curr = f.dias_preferentes
    if (curr.includes(dia)) set('dias_preferentes', curr.filter(d => d !== dia))
    else set('dias_preferentes', [...curr, dia])
  }

  const tieneGimnasio = f.lugares_entrenamiento.includes('Gimnasio')
  const tieneEnCasa = f.lugares_entrenamiento.includes('En casa')

  return (
    <>
      <Q label="¿Cuántos días por semana puedes comprometerte de forma realista a entrenar?">
        <Single
          options={['1 día','2 días','3 días','4 días','5 días','6 días','7 días','Variable según la semana']}
          selected={f.dias_semana}
          onChange={s('dias_semana')}
        />
        {f.dias_semana === 'Variable según la semana' && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: T.text2 }}>Entre</span>
            {[0,1,2,3,4,5,6,7].map(n => {
              const on = f.dias_variable_min === String(n)
              return (
                <div key={n} onClick={() => { set('dias_variable_min', String(n)); if (Number(f.dias_variable_max) < n) set('dias_variable_max', String(n)) }}
                  style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}>
                  {n}
                </div>
              )
            })}
            <span style={{ fontSize: 13, color: T.text2 }}>y</span>
            {[0,1,2,3,4,5,6,7].filter(n => n >= Number(f.dias_variable_min)).map(n => {
              const on = f.dias_variable_max === String(n)
              return (
                <div key={n} onClick={() => set('dias_variable_max', String(n))}
                  style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}>
                  {n}
                </div>
              )
            })}
            <span style={{ fontSize: 13, color: T.text2 }}>días</span>
          </div>
        )}
      </Q>

      <Q label="¿Qué días suelen ser los más viables para ti?">
        <div style={{ display: 'flex', gap: 8 }}>
          {DIAS_SEM.map((d, i) => {
            const on = f.dias_preferentes.includes(DIAS_SEM_FULL[i])
            return (
              <div key={d} onClick={() => toggleDia(DIAS_SEM_FULL[i])}
                style={{ width: 40, height: 40, borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}>
                {d}
              </div>
            )
          })}
        </div>
      </Q>

      <Q label="Tiempo disponible por sesión">
        <Single options={TIEMPO} selected={f.tiempo_sesion} onChange={s('tiempo_sesion')} />
        <div style={{ marginTop: 8 }}>
          <Textarea value={f.tiempo_sesion_obs} onChange={s('tiempo_sesion_obs')} placeholder="¿Quieres añadir algo? Ej: los sábados tengo más tiempo, entre semana solo puedo al mediodía..." rows={2} />
        </div>
      </Q>

      <Q label="Horarios preferentes">
        <Multi options={HORARIOS} selected={f.horarios_preferentes} onChange={s('horarios_preferentes')} exclusive={['Sin preferencia']} />
      </Q>

      <Q label="Lugar habitual de entrenamiento">
        <Multi options={LUGARES} selected={f.lugares_entrenamiento} onChange={s('lugares_entrenamiento')} />
      </Q>

      {tieneGimnasio && (
        <div style={{ background: '#f8f7f4', border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Gimnasio</div>
          <Input value={f.gimnasio_nombre} onChange={s('gimnasio_nombre')} placeholder="¿A qué gimnasio vas? (opcional)" />
        </div>
      )}

      {tieneEnCasa && (
        <Q label="Material disponible en casa">
          <Multi
            options={[...MAT_CASA, OTRO]}
            selected={f.material_casa}
            onChange={v => { s('material_casa')(v); if (!v.includes(OTRO)) s('material_casa_otro')('') }}
            exclusive={['Sin material']}
          />
          <Reveal show={f.material_casa.includes(OTRO)}>
            <Input value={f.material_casa_otro} onChange={s('material_casa_otro')} placeholder="¿Qué otro material?" />
          </Reveal>
        </Q>
      )}

      <Q label="¿Dispones de algún reloj deportivo o wearable para registrar tus entrenamientos?">
        <YesNo selected={f.tiene_wearable} onChange={s('tiene_wearable')} />
        {f.tiene_wearable === 'Sí' && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Marca</div>
              <Single
                options={WEARABLE_MARCAS}
                selected={f.wearable_marca}
                onChange={v => { s('wearable_marca')(v); if (v !== OTRO) s('wearable_marca_otro')('') }}
              />
              <Reveal show={f.wearable_marca === OTRO}>
                <div style={{ marginTop: 8 }}>
                  <Input value={f.wearable_marca_otro} onChange={s('wearable_marca_otro')} placeholder="¿Qué marca?" />
                </div>
              </Reveal>
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Modelo (opcional)</div>
              <Input value={f.wearable_modelo} onChange={s('wearable_modelo')} placeholder="Ej: Forerunner 255, Apple Watch Series 9..." />
            </div>
          </div>
        )}
      </Q>
    </>
  )
}

// ─── Step 5 — Salud y lesiones ────────────────────────────────────────────────

const ZONAS = [
  'Cabeza / cuello','Hombro derecho','Hombro izquierdo','Codo / antebrazo derecho',
  'Codo / antebrazo izquierdo','Muñeca / mano derecha','Muñeca / mano izquierda',
  'Zona dorsal','Zona lumbar','Zona abdominal / core','Cadera / glúteo derecho',
  'Cadera / glúteo izquierdo','Muslo / cuádriceps derecho','Muslo / cuádriceps izquierdo',
  'Isquiotibiales derecho','Isquiotibiales izquierdo','Rodilla derecha','Rodilla izquierda',
  'Pierna / gemelo derecho','Pierna / gemelo izquierdo','Tobillo / pie derecho','Tobillo / pie izquierdo', OTRO,
]
const ANTIGUEDAD = ['Hace menos de 1 semana','1–4 semanas','1–3 meses','3–6 meses','Más de 6 meses','Más de 1 año','Crónica (varios años)']

const ANTECEDENTES_OPTS = [
  'Lesiones anteriores relevantes',
  'Operaciones o intervenciones previas',
  'Enfermedad o diagnóstico médico relevante',
  'Medicación que pueda afectar al entrenamiento',
  'Restricciones o indicaciones médicas',
  'Ninguno',
]
const ANTECEDENTES_PLACEHOLDER = {
  'Lesiones anteriores relevantes': '¿Qué lesión/es y cuándo ocurrieron?',
  'Operaciones o intervenciones previas': '¿Cuáles y cuándo?',
  'Enfermedad o diagnóstico médico relevante': '¿Cuál?',
  'Medicación que pueda afectar al entrenamiento': '¿Cuál?',
  'Restricciones o indicaciones médicas': '¿Cuáles?',
}
const ANTECEDENTES_KEY = {
  'Lesiones anteriores relevantes': 'lesiones_anteriores',
  'Operaciones o intervenciones previas': 'operaciones',
  'Enfermedad o diagnóstico médico relevante': 'enfermedades',
  'Medicación que pueda afectar al entrenamiento': 'medicacion',
  'Restricciones o indicaciones médicas': 'restricciones_medicas',
}
const TRATAMIENTO_OPTS = ['No','Fisioterapia','Rehabilitación','Seguimiento médico','Varios']

function Step5({ f, set }) {
  const s = (k) => (v) => set(k, v)

  function addLesion() { set('lesiones_actuales', [...f.lesiones_actuales, { ...EMPTY_LESION }]) }
  function removeLesion(i) { set('lesiones_actuales', f.lesiones_actuales.filter((_, idx) => idx !== i)) }
  function setLesion(i, k, v) {
    set('lesiones_actuales', f.lesiones_actuales.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }

  function handleAntecedentes(nuevos) {
    s('antecedentes_categorias')(nuevos)
    // Limpiar detalle de categorías eliminadas
    const nuevoDetalle = { ...f.antecedentes_detalle }
    Object.keys(nuevoDetalle).forEach(k => {
      const cat = Object.entries(ANTECEDENTES_KEY).find(([, v]) => v === k)?.[0]
      if (cat && !nuevos.includes(cat)) delete nuevoDetalle[k]
    })
    set('antecedentes_detalle', nuevoDetalle)
  }

  function setDetalle(categoria, valor) {
    const key = ANTECEDENTES_KEY[categoria]
    if (!key) return
    set('antecedentes_detalle', { ...f.antecedentes_detalle, [key]: valor })
  }

  return (
    <>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 24, fontSize: 12.5, color: '#1d4ed8', lineHeight: 1.5 }}>
        ⚕️ La información de este apartado se utiliza únicamente para adaptar el entrenamiento y no sustituye una valoración o diagnóstico médico.
      </div>

      <Q label="¿Tienes actualmente alguna lesión, dolor o molestia?" required>
        <YesNo selected={f.lesiones_actuales_yn} onChange={s('lesiones_actuales_yn')} />
        {f.lesiones_actuales_yn === 'Sí' && (
          <div style={{ marginTop: 12 }}>
            {f.lesiones_actuales.length === 0 && (
              <button type="button" onClick={addLesion}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
                + Añadir lesión o molestia
              </button>
            )}
            {f.lesiones_actuales.map((l, i) => (
              <div key={i} style={{ background: '#f8f7f4', border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>Lesión / molestia {i + 1}</span>
                  <button type="button" onClick={() => removeLesion(i)}
                    style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Zona corporal</div>
                    <Single options={ZONAS} selected={l.zona}
                      onChange={v => { setLesion(i, 'zona', v); if (v !== OTRO) setLesion(i, 'zona_otro', '') }} />
                    <Reveal show={l.zona === OTRO}>
                      <Input value={l.zona_otro} onChange={v => setLesion(i, 'zona_otro', v)} placeholder="¿Qué zona?" />
                    </Reveal>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>¿Desde cuándo?</div>
                    <Single options={ANTIGUEDAD} selected={l.antiguedad} onChange={v => setLesion(i, 'antiguedad', v)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Intensidad habitual (0 = sin dolor · 10 = máximo)</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                        const on = l.intensidad === n
                        return (
                          <div key={n} onClick={() => setLesion(i, 'intensidad', on ? null : n)}
                            style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${on ? T.green : T.border}`, background: on ? T.greenL : T.card, color: on ? T.green : T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {n}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>¿Qué movimientos o actividades la provocan o empeoran?</div>
                    <Textarea value={l.movimientos} onChange={v => setLesion(i, 'movimientos', v)} placeholder="Describe qué la empeora o alivia..." rows={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>¿Te impide o limita alguna actividad?</div>
                    <Textarea value={l.limitaciones} onChange={v => setLesion(i, 'limitaciones', v)} placeholder="¿Qué no puedes hacer o tienes que evitar? (opcional)" rows={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>¿Tienes algún diagnóstico relacionado?</div>
                    <Input value={l.diagnostico} onChange={v => setLesion(i, 'diagnostico', v)} placeholder="Ej: tendinitis rotuliana, hernia discal L4-L5... (opcional)" />
                  </div>
                </div>
              </div>
            ))}
            {f.lesiones_actuales.length > 0 && (
              <button type="button" onClick={addLesion}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                + Añadir otra lesión o molestia
              </button>
            )}
          </div>
        )}
      </Q>

      <Q label="¿Estás actualmente en tratamiento o seguimiento por alguna lesión o problema de salud?">
        <Single options={TRATAMIENTO_OPTS} selected={f.tratamiento_actual} onChange={s('tratamiento_actual')} />
        <Reveal show={!!f.tratamiento_actual && f.tratamiento_actual !== 'No'}>
          <Textarea value={f.tratamiento_actual_detalle} onChange={s('tratamiento_actual_detalle')} placeholder="Cuéntanos brevemente (opcional)" rows={2} />
        </Reveal>
      </Q>

      <Q label="¿Hay algún antecedente de salud que debamos conocer para adaptar tu entrenamiento?"
        hint="Selecciona todo lo que aplique. Si no hay ninguno, selecciona «Ninguno».">
        <Multi
          options={ANTECEDENTES_OPTS}
          selected={f.antecedentes_categorias}
          onChange={handleAntecedentes}
          exclusive={['Ninguno']}
        />
        {f.antecedentes_categorias.filter(c => c !== 'Ninguno').map(cat => (
          <div key={cat} style={{ marginTop: 12, padding: '10px 14px', background: '#f8f7f4', borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>{cat}</div>
            <Textarea
              value={(f.antecedentes_detalle || {})[ANTECEDENTES_KEY[cat]] || ''}
              onChange={v => setDetalle(cat, v)}
              placeholder={ANTECEDENTES_PLACEHOLDER[cat] || ''}
              rows={2}
            />
          </div>
        ))}
      </Q>
    </>
  )
}

// ─── Step 6 — Estilo de vida ──────────────────────────────────────────────────

const SUENO = ['Menos de 5 h','5–6 h','6–7 h','7–8 h','Más de 8 h']
const TRABAJO = [
  'Principalmente sedentario (oficina, ordenador)',
  'Mixto (alterno estar de pie y sentado)',
  'Activo (de pie o caminando la mayor parte)',
  'Físicamente exigente (trabajo manual, cargas...)',
]
const PASOS = ['Menos de 3.000 pasos','3.000–6.000 pasos','6.000–10.000 pasos','Más de 10.000 pasos','No lo controlo']
const TABACO = ['No fumo','Exfumador/a','Fumador/a ocasional','Fumador/a habitual']

function Step6({ f, set }) {
  const s = (k) => (v) => set(k, v)
  return (
    <>
      <Q label="Horas de sueño habituales por noche">
        <Single options={SUENO} selected={f.horas_sueno} onChange={s('horas_sueno')} />
      </Q>
      <Q label="Calidad del sueño">
        <Scale labels={['Muy mala','Regular','Normal','Buena','Muy buena']} selected={f.calidad_sueno} onChange={s('calidad_sueno')} />
      </Q>
      <Q label="Nivel de estrés habitual">
        <Scale labels={['Muy bajo','Bajo','Moderado','Alto','Muy alto']} selected={f.nivel_estres} onChange={s('nivel_estres')} />
      </Q>
      <Q label="Tipo de trabajo o actividad principal durante el día">
        <Single options={TRABAJO} selected={f.tipo_trabajo} onChange={s('tipo_trabajo')} />
      </Q>
      <Q label="Movimiento o pasos diarios aproximados">
        <Single options={PASOS} selected={f.pasos_diarios} onChange={s('pasos_diarios')} />
      </Q>
      <Q label="Consumo de tabaco">
        <Single options={TABACO} selected={f.consumo_tabaco} onChange={s('consumo_tabaco')} />
      </Q>
    </>
  )
}

// ─── Step 7 — Para conocerte mejor ───────────────────────────────────────────

const BARRERAS_OPTS = [
  'Falta de tiempo','Horarios cambiantes','Trabajo','Responsabilidades familiares',
  'Cansancio','Molestias o dolor','Viajes','Motivación / constancia', OTRO,
  'No creo que tenga grandes dificultades',
]
const EXPECTATIVAS_OPTS = [
  'Planificar mi entrenamiento','Mantener constancia y seguimiento',
  'Mejorar mi rendimiento','Aprender a entrenar mejor',
  'Adaptar el entrenamiento a molestias o limitaciones',
  'Preparar una competición o reto','Motivación / acompañamiento', OTRO,
]

function Step7({ f, set }) {
  const s = (k) => (v) => set(k, v)
  return (
    <>
      <Q label="¿Hasta qué punto confías en que podrás mantener una rutina de entrenamiento de forma regular?">
        <Scale
          labels={[
            'Creo que me resultará muy difícil ser constante.',
            'Probablemente tendré bastantes dificultades para mantenerla.',
            'Creo que podré mantenerla, aunque con algunas dificultades.',
            'Confío bastante en poder entrenar con regularidad.',
            'Estoy totalmente seguro/a de que podré mantener una rutina constante.',
          ]}
          selected={f.confianza_rutina}
          onChange={s('confianza_rutina')}
        />
      </Q>

      <Q label="¿Qué crees que podría dificultarte mantener el entrenamiento de forma regular?">
        <Multi
          options={BARRERAS_OPTS}
          selected={f.barreras_adherencia}
          onChange={v => { s('barreras_adherencia')(v); if (!v.includes(OTRO)) s('barreras_adherencia_otro')('') }}
          exclusive={['No creo que tenga grandes dificultades']}
        />
        <Reveal show={f.barreras_adherencia.includes(OTRO)}>
          <Input value={f.barreras_adherencia_otro} onChange={s('barreras_adherencia_otro')} placeholder="Especifica..." />
        </Reveal>
      </Q>

      <Q label="¿Hay algo más que consideres importante que sepa antes de empezar a trabajar contigo?">
        <Textarea
          value={f.info_adicional}
          onChange={s('info_adicional')}
          placeholder="Por ejemplo: situación personal o familiar relevante, miedo a ciertos movimientos, experiencias previas con entrenadores, motivaciones o bloqueos que quieras compartir..."
          rows={4}
        />
      </Q>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CuestionarioInicial({ token }) {
  const [cuestionario, setCuestionario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('cuestionario_inicial')
        .select('*')
        .eq('token_publico', token)
        .single()
      if (error || !data) { setError('Enlace no válido o caducado.'); setLoading(false); return }
      setCuestionario(data)
      if (data.submitted_at) { setDone(true); setLoading(false); return }
      if (data.nombre) setForm(f => ({ ...f, ...extractFormFromData(data) }))
      setLoading(false)
    }
    load()
  }, [token])

  function extractFormFromData(d) {
    return {
      nombre: d.nombre || '',
      nombre_preferido: d.nombre_preferido || '',
      email: d.email || '',
      telefono: d.telefono || '',
      fecha_nacimiento: d.fecha_nacimiento || '',
      profesion: d.profesion || '',
      ciudad: d.ciudad || '',
      foto_url: d.foto_url || '',
      _foto_file: null, _foto_preview: '',

      objetivo_principal: d.objetivo_principal || '',
      objetivo_principal_otro: '',
      competiciones: d.competiciones || [],
      objetivos_secundarios: d.objetivos_secundarios || [],
      objetivos_secundarios_otro: '',
      objetivo_3_6_meses: d.objetivo_3_6_meses || '',

      deportes_actuales: d.deportes_actuales || [],
      deportes_actuales_otro: '',
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
      tipos_entreno_disfruta_otro: '',
      evitar_ejercicios_yn: d.evitar_ejercicios_yn || null,
      evitar_ejercicios_detalle: d.evitar_ejercicios_detalle || '',
      actividades_gustan: d.actividades_gustan || [],
      actividades_gustan_otro: '',
      actividades_evitar: d.actividades_evitar || [],
      actividades_evitar_otro: '',

      dias_semana: d.dias_semana || '',
      dias_variable_min: '0',
      dias_variable_max: '4',
      dias_preferentes: d.dias_preferentes || [],
      tiempo_sesion: d.tiempo_sesion || '',
      tiempo_sesion_obs: d.tiempo_sesion_obs || '',
      horarios_preferentes: d.horarios_preferentes || [],
      lugares_entrenamiento: d.lugares_entrenamiento || [],
      tiene_gimnasio: d.tiene_gimnasio === true ? 'Sí' : d.tiene_gimnasio === false ? 'No' : null,
      gimnasio_nombre: d.gimnasio_nombre || '',
      material_gimnasio: d.material_gimnasio || [],
      material_gimnasio_otro: '',
      material_casa: d.material_casa || [],
      material_casa_otro: '',
      tiene_wearable: d.tiene_wearable === true ? 'Sí' : d.tiene_wearable === false ? 'No' : null,
      wearable_marca: d.wearable_marca || '',
      wearable_marca_otro: '',
      wearable_modelo: d.wearable_modelo || '',

      lesiones_actuales_yn: (d.lesiones_actuales && d.lesiones_actuales.length > 0) ? 'Sí' : null,
      lesiones_actuales: d.lesiones_actuales || [],
      tratamiento_actual: d.tratamiento_actual || '',
      tratamiento_actual_detalle: d.tratamiento_actual_detalle || '',
      antecedentes_categorias: d.antecedentes_categorias || [],
      antecedentes_detalle: d.antecedentes_detalle || {},
      lesiones_anteriores_yn: d.lesiones_anteriores ? 'Sí' : null,
      lesiones_anteriores: d.lesiones_anteriores || '',
      operaciones_yn: d.operaciones ? 'Sí' : null,
      operaciones: d.operaciones || '',
      enfermedades_yn: d.enfermedades ? 'Sí' : null,
      enfermedades: d.enfermedades || '',
      medicacion_yn: d.medicacion ? 'Sí' : null,
      medicacion: d.medicacion || '',
      restricciones_medicas_yn: d.restricciones_medicas ? 'Sí' : null,
      restricciones_medicas: d.restricciones_medicas || '',
      seguimiento_fisio: d.seguimiento_fisio || '',

      horas_sueno: d.horas_sueno || '',
      calidad_sueno: d.calidad_sueno || null,
      nivel_estres: d.nivel_estres || null,
      nivel_energia: d.nivel_energia || null,
      tipo_trabajo: d.tipo_trabajo || '',
      pasos_diarios: d.pasos_diarios || '',
      consumo_tabaco: d.consumo_tabaco || '',
      consumo_alcohol: d.consumo_alcohol || '',

      confianza_rutina: d.confianza_rutina || null,
      barreras_adherencia: d.barreras_adherencia || [],
      barreras_adherencia_otro: '',
      expectativas_entrenador: d.expectativas_entrenador || [],
      expectativas_entrenador_otro: '',
      info_adicional: d.info_adicional || '',
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    setSaving(true)

    // ── Subir foto si hay archivo nuevo ──────────────────────────────────────
    let foto_url = form.foto_url
    if (form._foto_file) {
      const ext = form._foto_file.name.split('.').pop().toLowerCase()
      const path = `cuestionario/${token}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatares-clientes')
        .upload(path, form._foto_file, { upsert: true, contentType: form._foto_file.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatares-clientes').getPublicUrl(path)
        foto_url = urlData.publicUrl
      }
    }

    // ── Resolver "Otro (especificar)" ────────────────────────────────────────
    const resolveS = (val, otro) => val === OTRO ? (otro || OTRO) : (val || null)
    const resolveM = (arr, otro) => arr.map(v => v === OTRO ? (otro || OTRO) : v)
    const resolveLesiones = (lesiones) => lesiones.map(l => ({
      zona: l.zona === OTRO ? (l.zona_otro || OTRO) : l.zona,
      antiguedad: l.antiguedad,
      intensidad: l.intensidad,
      movimientos: l.movimientos,
      diagnostico: l.diagnostico,
      limitaciones: l.limitaciones,
    }))

    // ── Retrocompatibilidad antecedentes ─────────────────────────────────────
    const det = form.antecedentes_detalle || {}
    const tieneCat = (cat) => form.antecedentes_categorias.includes(cat)

    // Mapeo tratamiento_actual → seguimiento_fisio (legacy)
    const mapTratamiento = (t) => {
      if (!t || t === 'No') return 'No'
      const map = { 'Fisioterapia': 'Sí, fisioterapia', 'Rehabilitación': 'Sí, rehabilitación', 'Seguimiento médico': 'Sí, seguimiento médico', 'Varios': 'Sí, varios' }
      return map[t] || t
    }

    const tieneGimnasio = form.lugares_entrenamiento.includes('Gimnasio')
    const wearableMarca = form.wearable_marca === OTRO ? (form.wearable_marca_otro || OTRO) : form.wearable_marca

    const payload = {
      nombre: form.nombre || null,
      nombre_preferido: form.nombre_preferido || null,
      foto_url: foto_url || null,
      email: form.email || null,
      telefono: form.telefono || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      profesion: form.profesion || null,
      ciudad: form.ciudad || null,

      objetivo_principal: resolveS(form.objetivo_principal, form.objetivo_principal_otro),
      competiciones: (form.objetivo_principal === COMP_TRIGGER || form.objetivos_secundarios.includes(COMP_TRIGGER))
        ? form.competiciones : [],
      objetivos_secundarios: resolveM(form.objetivos_secundarios, form.objetivos_secundarios_otro),
      objetivo_3_6_meses: form.objetivo_3_6_meses || null,

      deportes_actuales: resolveM(form.deportes_actuales, form.deportes_actuales_otro),
      frecuencia_por_actividad: form.frecuencia_por_actividad || [],
      frecuencia_actual: form.frecuencia_actual || null,
      duracion_habitual: form.duracion_habitual || null,
      experiencia_fuerza: form.experiencia_fuerza || null,
      experiencia_fuerza_obs: form.experiencia_fuerza_obs || null,
      experiencia_resistencia: form.experiencia_resistencia || null,
      experiencia_resistencia_obs: form.experiencia_resistencia_obs || null,
      experiencia_funcional: form.experiencia_funcional || null,
      experiencia_funcional_obs: form.experiencia_funcional_obs || null,
      preferencia_entreno: form.preferencia_entreno,
      tipos_entreno_disfruta: resolveM(form.tipos_entreno_disfruta, form.tipos_entreno_disfruta_otro),
      evitar_ejercicios_yn: form.evitar_ejercicios_yn || null,
      evitar_ejercicios_detalle: form.evitar_ejercicios_yn === 'Sí' ? (form.evitar_ejercicios_detalle || null) : null,
      // legacy
      actividades_gustan: form.actividades_gustan,
      actividades_evitar: form.actividades_evitar,

      dias_semana: form.dias_semana === 'Variable según la semana'
        ? `Variable (${form.dias_variable_min}–${form.dias_variable_max} días)`
        : (form.dias_semana || null),
      dias_preferentes: form.dias_preferentes,
      tiempo_sesion: form.tiempo_sesion || null,
      tiempo_sesion_obs: form.tiempo_sesion_obs || null,
      horarios_preferentes: form.horarios_preferentes,
      lugares_entrenamiento: form.lugares_entrenamiento,
      tiene_gimnasio: tieneGimnasio ? true : (form.lugares_entrenamiento.length > 0 ? false : null),
      gimnasio_nombre: tieneGimnasio ? (form.gimnasio_nombre || null) : null,
      material_gimnasio: [],  // ya no se pregunta
      material_casa: form.lugares_entrenamiento.includes('En casa')
        ? resolveM(form.material_casa, form.material_casa_otro) : [],
      tiene_wearable: form.tiene_wearable === 'Sí' ? true : form.tiene_wearable === 'No' ? false : null,
      wearable_marca: form.tiene_wearable === 'Sí' ? (wearableMarca || null) : null,
      wearable_modelo: form.tiene_wearable === 'Sí' ? (form.wearable_modelo || null) : null,

      lesiones_actuales: form.lesiones_actuales_yn === 'Sí' ? resolveLesiones(form.lesiones_actuales) : [],
      tratamiento_actual: form.tratamiento_actual || null,
      tratamiento_actual_detalle: (form.tratamiento_actual && form.tratamiento_actual !== 'No')
        ? (form.tratamiento_actual_detalle || null) : null,
      seguimiento_fisio: mapTratamiento(form.tratamiento_actual),

      antecedentes_categorias: form.antecedentes_categorias,
      antecedentes_detalle: det,
      // legacy — retrocompatibilidad
      lesiones_anteriores: tieneCat('Lesiones anteriores relevantes') ? (det.lesiones_anteriores || null) : null,
      operaciones: tieneCat('Operaciones o intervenciones previas') ? (det.operaciones || null) : null,
      enfermedades: tieneCat('Enfermedad o diagnóstico médico relevante') ? (det.enfermedades || null) : null,
      medicacion: tieneCat('Medicación que pueda afectar al entrenamiento') ? (det.medicacion || null) : null,
      restricciones_medicas: tieneCat('Restricciones o indicaciones médicas') ? (det.restricciones_medicas || null) : null,

      horas_sueno: form.horas_sueno || null,
      calidad_sueno: form.calidad_sueno || null,
      nivel_estres: form.nivel_estres || null,
      nivel_energia: form.nivel_energia || null,  // conservado pero no preguntado
      tipo_trabajo: form.tipo_trabajo || null,
      pasos_diarios: form.pasos_diarios || null,
      consumo_tabaco: form.consumo_tabaco || null,
      consumo_alcohol: form.consumo_alcohol || null,  // conservado pero no preguntado

      confianza_rutina: form.confianza_rutina || null,
      barreras_adherencia: resolveM(form.barreras_adherencia, form.barreras_adherencia_otro),
      expectativas_entrenador: resolveM(form.expectativas_entrenador, form.expectativas_entrenador_otro),
      info_adicional: form.info_adicional || null,

      submitted_at: new Date().toISOString(),
    }

    await supabase.from('cuestionario_inicial').update(payload).eq('token_publico', token)

    // Actualizar foto_url en clientes si tenemos cliente_id y foto nueva
    if (foto_url && cuestionario?.cliente_id) {
      await supabase.from('clientes').update({ foto_url }).eq('id', cuestionario.cliente_id)
    }

    setSaving(false)
    setDone(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: T.text3, fontSize: 14 }}>Cargando...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 32, maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: T.text, fontSize: 14 }}>{error}</p>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 40, maxWidth: 480, textAlign: 'center', border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 12 }}>¡Cuestionario enviado!</h2>
        <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.7 }}>
          Gracias por tomarte tu tiempo para completar el cuestionario. Aunque estaremos en contacto continuo, esta información me ayuda a conocerte mejor y a tener un buen punto de partida para adaptar el entrenamiento a ti, a tus objetivos y a tus necesidades.
        </p>
        <p style={{ fontSize: 16, fontWeight: 600, color: T.green, marginTop: 16 }}>¡Empezamos! 💪</p>
      </div>
    </div>
  )

  const stepComponents = [
    <Step1 f={form} set={set} />,
    <Step2 f={form} set={set} />,
    <Step3 f={form} set={set} />,
    <Step4 f={form} set={set} />,
    <Step5 f={form} set={set} />,
    <Step6 f={form} set={set} />,
    <Step7 f={form} set={set} />,
  ]

  function goToStep(n) {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const isLast = step === STEPS.length - 1

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* Header */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.5px', color: T.text3, marginBottom: 2 }}>Cuestionario inicial</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{STEPS[step]}</div>
            </div>
            <div style={{ fontSize: 12, color: T.text3 }}>{step + 1} / {STEPS.length}</div>
          </div>
          <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: T.green, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px 120px' }}>
        {stepComponents[step]}
      </div>

      {/* Footer nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: T.card, borderTop: `1px solid ${T.border}`, padding: '14px 20px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button type="button" onClick={() => goToStep(step - 1)} disabled={step === 0}
            style={{ padding: '11px 20px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, color: step === 0 ? T.text3 : T.text, fontSize: 14, fontWeight: 500, cursor: step === 0 ? 'not-allowed' : 'pointer' }}>
            ← Anterior
          </button>
          {!isLast ? (
            <button type="button" onClick={() => goToStep(step + 1)}
              style={{ flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Siguiente →
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={saving}
              style={{ flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enviando...' : 'Enviar cuestionario ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
