import { useState, useEffect } from 'react'
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
  'Disponibilidad y material',
  'Salud y lesiones',
  'Estilo de vida',
  'Cierre',
]

const OTRO = 'Otro (especificar)'

const EMPTY_COMPETICION = { nombre: '', fecha: '', modalidad: '', objetivo_rendimiento: '' }
const EMPTY_LESION = {
  zona: '', zona_otro: '', tipo: '', tipo_otro: '', antiguedad: '', intensidad: null,
  movimientos: '', diagnostico: '', limitaciones: '',
}

const EMPTY = {
  nombre: '', email: '', telefono: '', fecha_nacimiento: '', profesion: '', ciudad: '',
  objetivo_principal: '',
  objetivo_principal_otro: '',
  competiciones: [],
  objetivos_secundarios: [],
  objetivos_secundarios_otro: '',
  objetivo_3_6_meses: '',
  deportes_actuales: [],
  deportes_actuales_otro: '',
  actividades_gustan: [],
  actividades_gustan_otro: '',
  actividades_evitar: [],
  actividades_evitar_otro: '',
  frecuencia_actual: '',
  duracion_habitual: '',
  experiencia_fuerza: '',
  experiencia_fuerza_obs: '',
  experiencia_resistencia: '',
  experiencia_resistencia_obs: '',
  experiencia_funcional: '',
  experiencia_funcional_obs: '',
  dias_semana: '',
  dias_preferentes: [],
  tiempo_sesion: '',
  tiempo_sesion_obs: '',
  horarios_preferentes: [],
  lugares_entrenamiento: [],
  tiene_gimnasio: null,
  gimnasio_nombre: '',
  material_gimnasio: [],
  material_gimnasio_otro: '',
  material_casa: [],
  material_casa_otro: '',
  tiene_wearable: null,
  wearable_modelo: '',
  lesiones_actuales_yn: null,
  lesiones_actuales: [],
  lesiones_anteriores_yn: null,
  lesiones_anteriores: '',
  operaciones_yn: null,
  operaciones: '',
  enfermedades_yn: null,
  enfermedades: '',
  medicacion_yn: null,
  medicacion: '',
  restricciones_medicas_yn: null,
  restricciones_medicas: '',
  seguimiento_fisio: '',
  horas_sueno: '',
  calidad_sueno: null,
  nivel_estres: null,
  nivel_energia: null,
  tipo_trabajo: '',
  pasos_diarios: '',
  consumo_tabaco: '',
  consumo_alcohol: '',
  confianza_rutina: null,
  info_adicional: '',
}

function Multi({ options, selected, onChange }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(o => o !== opt))
    else onChange([...selected, opt])
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

function Q({ label, required, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 10, lineHeight: 1.4 }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </div>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.card, fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box' }} />
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

// ─── Steps ───────────────────────────────────────────────────────────────────

function Step1({ f, set }) {
  const s = (k) => (v) => set(k, v)
  return (
    <>
      <Q label="Nombre completo" required>
        <Input value={f.nombre} onChange={s('nombre')} placeholder="Tu nombre y apellidos" />
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
      <Q label="Ciudad">
        <Input value={f.ciudad} onChange={s('ciudad')} placeholder="Ciudad donde vives" />
      </Q>
    </>
  )
}

function Step2({ f, set }) {
  const s = (k) => (v) => set(k, v)

  function addComp() {
    set('competiciones', [...f.competiciones, { ...EMPTY_COMPETICION }])
  }
  function removeComp(i) {
    set('competiciones', f.competiciones.filter((_, idx) => idx !== i))
  }
  function setComp(i, k, v) {
    const c = f.competiciones.map((c, idx) => idx === i ? { ...c, [k]: v } : c)
    set('competiciones', c)
  }

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

  return (
    <>
      <Q label="Objetivo principal" required>
        <Single options={[...OBJETIVOS, OTRO]} selected={f.objetivo_principal} onChange={v => { s('objetivo_principal')(v); if (v !== OTRO) s('objetivo_principal_otro')('') }} />
        {f.objetivo_principal === OTRO && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.objetivo_principal_otro} onChange={s('objetivo_principal_otro')} placeholder="Especifica tu objetivo..." />
          </div>
        )}
      </Q>

      {f.objetivo_principal === 'Preparar una competición o reto deportivo' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Competiciones</div>
          {f.competiciones.map((c, i) => (
            <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Competición {i + 1}</span>
                {f.competiciones.length > 1 && (
                  <button onClick={() => removeComp(i)} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input value={c.nombre} onChange={v => setComp(i, 'nombre', v)} placeholder="Nombre del evento" />
                <Input value={c.fecha} onChange={v => setComp(i, 'fecha', v)} type="date" />
                <Input value={c.modalidad} onChange={v => setComp(i, 'modalidad', v)} placeholder="Distancia / modalidad (ej: 42km, sprint, XCO...)" />
                <Input value={c.objetivo_rendimiento} onChange={v => setComp(i, 'objetivo_rendimiento', v)} placeholder="Objetivo de rendimiento" />
              </div>
            </div>
          ))}
          <button onClick={addComp}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            + Añadir otra competición
          </button>
        </div>
      )}

      <Q label="Objetivos secundarios">
        <Multi options={[...OBJETIVOS.filter(o => o !== f.objetivo_principal), OTRO]} selected={f.objetivos_secundarios} onChange={v => { s('objetivos_secundarios')(v); if (!v.includes(OTRO)) s('objetivos_secundarios_otro')('') }} />
        {f.objetivos_secundarios.includes(OTRO) && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.objetivos_secundarios_otro} onChange={s('objetivos_secundarios_otro')} placeholder="Especifica..." />
          </div>
        )}
      </Q>

      <Q label="¿Qué te gustaría haber conseguido en 3–6 meses?">
        <Textarea value={f.objetivo_3_6_meses} onChange={s('objetivo_3_6_meses')} placeholder="Cuéntame con tus palabras..." rows={2} />
      </Q>
    </>
  )
}

function Step3({ f, set }) {
  const s = (k) => (v) => set(k, v)

  const DEPORTES = ['Running / atletismo','Ciclismo','Natación','Triatlón','Fútbol','Fútbol sala','Baloncesto','Tenis','Pádel','Balonmano','Voleibol','Rugby','Artes marciales / boxeo','Crossfit','Gimnasia / acrobacia','Escalada','Esquí / snowboard','Golf','Yoga','Pilates','Baile / danza','Senderismo','Entrenamiento en sala (gym)','Ninguno actualmente']
  const GUSTAN = ['Entrenar en exterior','Entrenar solo/a','Entrenar en grupo','Entrenamiento de fuerza','Cardio / resistencia','HIIT / circuitos','Movilidad / estiramientos','Trabajo funcional','Actividades de equipo','Competición']
  const EVITAR = ['Carrera continua larga','Saltos e impactos','Sentadillas profundas','Trabajo de suelo (abdominales...)','Ejercicios con barra en rack','Máquinas guiadas','Ejercicios muy técnicos','Entrenamientos muy largos','Entrenamientos muy intensos','Trabajo de movilidad / estiramientos','Ninguno en particular']
  const FRECUENCIA = ['No entreno actualmente','1–2 días/semana','3–4 días/semana','5–6 días/semana','Todos los días','Irregular, sin rutina fija']
  const DURACION = ['Menos de 30 min','30–45 min','45–60 min','60–90 min','Más de 90 min','Variable']
  const EXP = ['Sin experiencia','Principiante (menos de 1 año)','Intermedio (1–3 años)','Avanzado (más de 3 años)']

  return (
    <>
      <Q label="Deportes o actividades que practicas actualmente">
        <Multi options={[...DEPORTES, OTRO]} selected={f.deportes_actuales} onChange={v => { s('deportes_actuales')(v); if (!v.includes(OTRO)) s('deportes_actuales_otro')('') }} />
        {f.deportes_actuales.includes(OTRO) && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.deportes_actuales_otro} onChange={s('deportes_actuales_otro')} placeholder="¿Cuáles?" />
          </div>
        )}
      </Q>
      <Q label="Actividades o ejercicios que te gustan">
        <Multi options={[...GUSTAN, OTRO]} selected={f.actividades_gustan} onChange={v => { s('actividades_gustan')(v); if (!v.includes(OTRO)) s('actividades_gustan_otro')('') }} />
        {f.actividades_gustan.includes(OTRO) && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.actividades_gustan_otro} onChange={s('actividades_gustan_otro')} placeholder="¿Cuáles?" />
          </div>
        )}
      </Q>
      <Q label="Ejercicios o actividades que prefieres evitar">
        <Multi options={[...EVITAR, OTRO]} selected={f.actividades_evitar} onChange={v => { s('actividades_evitar')(v); if (!v.includes(OTRO)) s('actividades_evitar_otro')('') }} />
        {f.actividades_evitar.includes(OTRO) && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.actividades_evitar_otro} onChange={s('actividades_evitar_otro')} placeholder="¿Cuáles?" />
          </div>
        )}
      </Q>
      <Q label="Frecuencia actual de entrenamiento">
        <Single options={FRECUENCIA} selected={f.frecuencia_actual} onChange={s('frecuencia_actual')} />
      </Q>
      <Q label="Duración habitual de las sesiones">
        <Single options={DURACION} selected={f.duracion_habitual} onChange={s('duracion_habitual')} />
      </Q>
      <Q label="Experiencia en entrenamiento de fuerza">
        <Single options={EXP} selected={f.experiencia_fuerza} onChange={s('experiencia_fuerza')} />
        {f.experiencia_fuerza && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.experiencia_fuerza_obs} onChange={s('experiencia_fuerza_obs')} placeholder="Observaciones (opcional)" rows={2} />
          </div>
        )}
      </Q>
      <Q label="Experiencia en resistencia (carrera, bici, natación...)">
        <Single options={EXP} selected={f.experiencia_resistencia} onChange={s('experiencia_resistencia')} />
        {f.experiencia_resistencia && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.experiencia_resistencia_obs} onChange={s('experiencia_resistencia_obs')} placeholder="Observaciones (opcional)" rows={2} />
          </div>
        )}
      </Q>
      <Q label="Experiencia en movilidad, funcional u otras actividades dirigidas">
        <Single options={['Sin experiencia','Principiante','Intermedio','Avanzado']} selected={f.experiencia_funcional} onChange={s('experiencia_funcional')} />
        {f.experiencia_funcional && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.experiencia_funcional_obs} onChange={s('experiencia_funcional_obs')} placeholder="Observaciones (opcional)" rows={2} />
          </div>
        )}
      </Q>
    </>
  )
}

function Step4({ f, set }) {
  const s = (k) => (v) => set(k, v)

  const DIAS_NUM = ['1 día','2 días','3 días','4 días','5 días','6 días','7 días','Variable según semana']
  const DIAS_SEM = ['L','M','X','J','V','S','D']
  const DIAS_SEM_FULL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
  const TIEMPO = ['Menos de 30 min','30–45 min','45–60 min','60–90 min','Más de 90 min','Variable']
  const HORARIOS = ['Primera hora de la mañana (antes de 8h)','Mañana (8h–12h)','Mediodía (12h–15h)','Tarde (15h–19h)','Noche (19h–22h)','Sin preferencia']
  const LUGARES = ['En casa','Gimnasio','Aire libre (parque, calle, monte...)','Piscina','Pista deportiva / campo','Trabajo / empresa','Varios lugares']
  const MAT_GYM = ['Mancuernas','Kettlebells','Barra y discos','Barras de dominadas y paralelas','Banco plano e inclinado','Rack / jaula de sentadillas','Máquinas guiadas','Poleas altas y bajas','TRX / entrenamiento en suspensión','Cinta de correr','Bicicleta estática o de spinning','Elíptica','Remoergómetro','Esterillas y zona de suelo','Cajón / step','Balón medicinal','Bandas elásticas']
  const MAT_CASA = ['Sin material','Esterilla','Mancuernas','Kettlebells','Barra y discos','Bandas elásticas','TRX / entrenamiento en suspensión','Barra de dominadas (puerta)','Banco','Cajón / step','Foam roller','Bicicleta estática','Cinta de correr','Remoergómetro','Balón medicinal']

  function toggleDia(dia) {
    const curr = f.dias_preferentes
    if (curr.includes(dia)) set('dias_preferentes', curr.filter(d => d !== dia))
    else set('dias_preferentes', [...curr, dia])
  }

  return (
    <>
      <Q label="Días disponibles para entrenar por semana">
        <Single options={DIAS_NUM} selected={f.dias_semana} onChange={s('dias_semana')} />
      </Q>

      <Q label="Días preferentes">
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
          <Textarea value={f.tiempo_sesion_obs} onChange={s('tiempo_sesion_obs')} placeholder="¿Quieres añadir algo más? Por ejemplo: los sábados tengo más tiempo, entre semana solo puedo al mediodía..." rows={2} />
        </div>
      </Q>

      <Q label="Horarios preferentes">
        <Multi options={HORARIOS} selected={f.horarios_preferentes} onChange={s('horarios_preferentes')} />
      </Q>

      <Q label="Lugar habitual de entrenamiento">
        <Multi options={LUGARES} selected={f.lugares_entrenamiento} onChange={s('lugares_entrenamiento')} />
      </Q>

      <Q label="¿Vas a algún gimnasio?">
        <YesNo selected={f.tiene_gimnasio} onChange={s('tiene_gimnasio')} />
        {f.tiene_gimnasio === 'Sí' && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input value={f.gimnasio_nombre} onChange={s('gimnasio_nombre')} placeholder="¿A cuál?" />
            <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 4 }}>Material disponible en el gimnasio:</div>
            <Multi options={[...MAT_GYM, OTRO]} selected={f.material_gimnasio} onChange={v => { s('material_gimnasio')(v); if (!v.includes(OTRO)) s('material_gimnasio_otro')('') }} />
            {f.material_gimnasio.includes(OTRO) && (
              <div style={{ marginTop: 8 }}>
                <Input value={f.material_gimnasio_otro} onChange={s('material_gimnasio_otro')} placeholder="¿Qué otro material?" />
              </div>
            )}
          </div>
        )}
      </Q>

      <Q label="Material disponible en casa">
        <Multi options={[...MAT_CASA, OTRO]} selected={f.material_casa} onChange={v => { s('material_casa')(v); if (!v.includes(OTRO)) s('material_casa_otro')('') }} />
        {f.material_casa.includes(OTRO) && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.material_casa_otro} onChange={s('material_casa_otro')} placeholder="¿Qué otro material?" />
          </div>
        )}
      </Q>

      <Q label="¿Dispones de algún reloj deportivo o dispositivo wearable para registrar tus entrenamientos, actividad diaria, sueño u otras variables?">
        <YesNo selected={f.tiene_wearable} onChange={s('tiene_wearable')} />
        {f.tiene_wearable === 'Sí' && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.wearable_modelo} onChange={s('wearable_modelo')} placeholder="Marca y modelo (ej: Garmin Forerunner 255, Polar Ignite 3...)" />
          </div>
        )}
      </Q>
    </>
  )
}

function Step5({ f, set }) {
  const s = (k) => (v) => set(k, v)

  const ZONAS = ['Cabeza / cuello','Hombro derecho','Hombro izquierdo','Codo / antebrazo derecho','Codo / antebrazo izquierdo','Muñeca / mano derecha','Muñeca / mano izquierda','Zona dorsal','Zona lumbar','Zona abdominal / core','Cadera / glúteo derecho','Cadera / glúteo izquierdo','Muslo / cuádriceps derecho','Muslo / cuádriceps izquierdo','Isquiotibiales derecho','Isquiotibiales izquierdo','Rodilla derecha','Rodilla izquierda','Pierna / gemelo derecho','Pierna / gemelo izquierdo','Tobillo / pie derecho','Tobillo / pie izquierdo', OTRO]
  const TIPOS = ['Dolor agudo o punzante','Dolor sordo o continuo','Rigidez o tensión muscular','Inflamación o hinchazón','Inestabilidad o sensación de fallo','Hormigueo o entumecimiento','Crepitación o ruido articular','Limitación de movilidad', OTRO]
  const ANTIGUEDAD = ['Hace menos de 1 semana','1–4 semanas','1–3 meses','3–6 meses','Más de 6 meses','Más de 1 año','Crónica (varios años)']
  const SEGUIMIENTO_OPTS = ['No','Sí, fisioterapia','Sí, rehabilitación','Sí, seguimiento médico','Sí, varios']

  function addLesion() { set('lesiones_actuales', [...f.lesiones_actuales, { ...EMPTY_LESION }]) }
  function removeLesion(i) { set('lesiones_actuales', f.lesiones_actuales.filter((_, idx) => idx !== i)) }
  function setLesion(i, k, v) {
    set('lesiones_actuales', f.lesiones_actuales.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }

  return (
    <>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 24, fontSize: 12.5, color: '#1d4ed8', lineHeight: 1.5 }}>
        ⚕️ La información de este apartado se utilizará únicamente para adaptar el entrenamiento y no sustituye una valoración o diagnóstico médico.
      </div>

      <Q label="¿Tienes actualmente alguna lesión, dolor o molestia?" required>
        <YesNo selected={f.lesiones_actuales_yn} onChange={s('lesiones_actuales_yn')} />
        {f.lesiones_actuales_yn === 'Sí' && (
          <div style={{ marginTop: 12 }}>
            {f.lesiones_actuales.length === 0 && (
              <button onClick={addLesion} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
                + Añadir lesión o molestia
              </button>
            )}
            {f.lesiones_actuales.map((l, i) => (
              <div key={i} style={{ background: '#f8f7f4', border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>Lesión / molestia {i + 1}</span>
                  <button onClick={() => removeLesion(i)} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Zona corporal</div>
                    <Single options={ZONAS} selected={l.zona} onChange={v => { setLesion(i, 'zona', v); if (v !== OTRO) setLesion(i, 'zona_otro', '') }} />
                    {l.zona === OTRO && (
                      <div style={{ marginTop: 8 }}>
                        <Input value={l.zona_otro} onChange={v => setLesion(i, 'zona_otro', v)} placeholder="¿Qué zona?" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Tipo de molestia</div>
                    <Single options={TIPOS} selected={l.tipo} onChange={v => { setLesion(i, 'tipo', v); if (v !== OTRO) setLesion(i, 'tipo_otro', '') }} />
                    {l.tipo === OTRO && (
                      <div style={{ marginTop: 8 }}>
                        <Input value={l.tipo_otro} onChange={v => setLesion(i, 'tipo_otro', v)} placeholder="¿Qué tipo de molestia?" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>¿Desde cuándo?</div>
                    <Single options={ANTIGUEDAD} selected={l.antiguedad} onChange={v => setLesion(i, 'antiguedad', v)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Intensidad del dolor (0 = sin dolor · 10 = máximo)</div>
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
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Movimientos que la empeoran o mejoran</div>
                    <Textarea value={l.movimientos} onChange={v => setLesion(i, 'movimientos', v)} placeholder="Describe qué empeora la molestia y qué la mejora o alivia..." rows={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Diagnóstico (si tienes)</div>
                    <Input value={l.diagnostico} onChange={v => setLesion(i, 'diagnostico', v)} placeholder="Ej: tendinitis rotuliana, hernia discal L4-L5... (opcional)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Limitaciones actuales</div>
                    <Textarea value={l.limitaciones} onChange={v => setLesion(i, 'limitaciones', v)} placeholder="¿Qué no puedes hacer o tienes que evitar? (opcional)" rows={2} />
                  </div>
                </div>
              </div>
            ))}
            {f.lesiones_actuales.length > 0 && (
              <button onClick={addLesion} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                + Añadir otra lesión o molestia
              </button>
            )}
          </div>
        )}
      </Q>

      <Q label="¿Tienes lesiones anteriores relevantes?">
        <YesNo selected={f.lesiones_anteriores_yn} onChange={s('lesiones_anteriores_yn')} />
        {f.lesiones_anteriores_yn === 'Sí' && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.lesiones_anteriores} onChange={s('lesiones_anteriores')} placeholder="Cuéntame cuáles..." rows={2} />
          </div>
        )}
      </Q>

      <Q label="¿Has tenido operaciones o intervenciones previas?">
        <YesNo selected={f.operaciones_yn} onChange={s('operaciones_yn')} />
        {f.operaciones_yn === 'Sí' && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.operaciones} onChange={s('operaciones')} placeholder="¿Cuáles y cuándo?" rows={2} />
          </div>
        )}
      </Q>

      <Q label="¿Tienes enfermedades o diagnósticos médicos relevantes para el ejercicio?">
        <YesNo selected={f.enfermedades_yn} onChange={s('enfermedades_yn')} />
        {f.enfermedades_yn === 'Sí' && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.enfermedades} onChange={s('enfermedades')} placeholder="¿Cuáles?" rows={2} />
          </div>
        )}
      </Q>

      <Q label="¿Tomas medicación que pueda afectar al entrenamiento?">
        <YesNo selected={f.medicacion_yn} onChange={s('medicacion_yn')} />
        {f.medicacion_yn === 'Sí' && (
          <div style={{ marginTop: 8 }}>
            <Input value={f.medicacion} onChange={s('medicacion')} placeholder="¿Cuál?" />
          </div>
        )}
      </Q>

      <Q label="¿Tienes restricciones o indicaciones médicas respecto al ejercicio?">
        <YesNo selected={f.restricciones_medicas_yn} onChange={s('restricciones_medicas_yn')} />
        {f.restricciones_medicas_yn === 'Sí' && (
          <div style={{ marginTop: 8 }}>
            <Textarea value={f.restricciones_medicas} onChange={s('restricciones_medicas')} placeholder="¿Cuáles?" rows={2} />
          </div>
        )}
      </Q>

      <Q label="¿Sigues actualmente algún tratamiento de fisioterapia, rehabilitación o seguimiento médico?">
        <Single options={SEGUIMIENTO_OPTS} selected={f.seguimiento_fisio} onChange={s('seguimiento_fisio')} />
      </Q>
    </>
  )
}

function Step6({ f, set }) {
  const s = (k) => (v) => set(k, v)

  const SUENO = ['Menos de 5 h','5–6 h','6–7 h','7–8 h','Más de 8 h']
  const TRABAJO = ['Principalmente sedentario (oficina, ordenador)','Mixto (alterno estar de pie y sentado)','Activo (de pie o caminando la mayor parte)','Físicamente exigente (trabajo manual, cargas...)']
  const PASOS = ['Menos de 3.000 pasos','3.000–6.000 pasos','6.000–10.000 pasos','Más de 10.000 pasos','No lo controlo']
  const TABACO = ['No fumo','Exfumador/a','Fumador/a ocasional','Fumador/a habitual']
  const ALCOHOL = ['No consumo','Ocasional (fines de semana o eventos)','Moderado (varios días a la semana)','Habitual (casi a diario)']

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
      <Q label="Nivel de energía habitual">
        <Scale labels={['Muy bajo','Bajo','Moderado','Alto','Muy alto']} selected={f.nivel_energia} onChange={s('nivel_energia')} />
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
      <Q label="Consumo habitual de alcohol">
        <Single options={ALCOHOL} selected={f.consumo_alcohol} onChange={s('consumo_alcohol')} />
      </Q>
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
    </>
  )
}

function Step7({ f, set }) {
  const s = (k) => (v) => set(k, v)
  return (
    <Q label="¿Hay algo importante que debería saber antes de empezar a trabajar contigo?">
      <Textarea
        value={f.info_adicional}
        onChange={s('info_adicional')}
        placeholder="Por ejemplo: situación personal o familiar relevante, miedo a ciertos movimientos, experiencias previas con entrenadores, motivaciones o bloqueos que quieras compartir..."
        rows={5}
      />
    </Q>
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
      if (data.submitted_at) setDone(true)
      else if (data.nombre) {
        // Pre-fill if partially saved
        setForm(f => ({ ...f, ...extractFormFromData(data) }))
      }
      setLoading(false)
    }
    load()
  }, [token])

  function extractFormFromData(data) {
    return {
      nombre: data.nombre || '',
      email: data.email || '',
      telefono: data.telefono || '',
      fecha_nacimiento: data.fecha_nacimiento || '',
      profesion: data.profesion || '',
      ciudad: data.ciudad || '',
      objetivo_principal: data.objetivo_principal || '',
      competiciones: data.competiciones || [],
      objetivos_secundarios: data.objetivos_secundarios || [],
      objetivo_3_6_meses: data.objetivo_3_6_meses || '',
      deportes_actuales: data.deportes_actuales || [],
      actividades_gustan: data.actividades_gustan || [],
      actividades_evitar: data.actividades_evitar || [],
      frecuencia_actual: data.frecuencia_actual || '',
      duracion_habitual: data.duracion_habitual || '',
      experiencia_fuerza: data.experiencia_fuerza || '',
      experiencia_fuerza_obs: data.experiencia_fuerza_obs || '',
      experiencia_resistencia: data.experiencia_resistencia || '',
      experiencia_resistencia_obs: data.experiencia_resistencia_obs || '',
      experiencia_funcional: data.experiencia_funcional || '',
      experiencia_funcional_obs: data.experiencia_funcional_obs || '',
      dias_semana: data.dias_semana || '',
      dias_preferentes: data.dias_preferentes || [],
      tiempo_sesion: data.tiempo_sesion || '',
      tiempo_sesion_obs: data.tiempo_sesion_obs || '',
      horarios_preferentes: data.horarios_preferentes || [],
      lugares_entrenamiento: data.lugares_entrenamiento || [],
      tiene_gimnasio: data.tiene_gimnasio === true ? 'Sí' : data.tiene_gimnasio === false ? 'No' : null,
      gimnasio_nombre: data.gimnasio_nombre || '',
      material_gimnasio: data.material_gimnasio || [],
      material_casa: data.material_casa || [],
      tiene_wearable: data.tiene_wearable === true ? 'Sí' : data.tiene_wearable === false ? 'No' : null,
      wearable_modelo: data.wearable_modelo || '',
      lesiones_actuales_yn: (data.lesiones_actuales && data.lesiones_actuales.length > 0) ? 'Sí' : null,
      lesiones_actuales: data.lesiones_actuales || [],
      lesiones_anteriores_yn: data.lesiones_anteriores ? 'Sí' : null,
      lesiones_anteriores: data.lesiones_anteriores || '',
      operaciones_yn: data.operaciones ? 'Sí' : null,
      operaciones: data.operaciones || '',
      enfermedades_yn: data.enfermedades ? 'Sí' : null,
      enfermedades: data.enfermedades || '',
      medicacion_yn: data.medicacion ? 'Sí' : null,
      medicacion: data.medicacion || '',
      restricciones_medicas_yn: data.restricciones_medicas ? 'Sí' : null,
      restricciones_medicas: data.restricciones_medicas || '',
      seguimiento_fisio: data.seguimiento_fisio || '',
      horas_sueno: data.horas_sueno || '',
      calidad_sueno: data.calidad_sueno || null,
      nivel_estres: data.nivel_estres || null,
      nivel_energia: data.nivel_energia || null,
      tipo_trabajo: data.tipo_trabajo || '',
      pasos_diarios: data.pasos_diarios || '',
      consumo_tabaco: data.consumo_tabaco || '',
      consumo_alcohol: data.consumo_alcohol || '',
      confianza_rutina: data.confianza_rutina || null,
      info_adicional: data.info_adicional || '',
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    setSaving(true)

    // Resolver "Otro (especificar)" → texto libre antes de guardar
    const resolveS = (val, otro) => val === OTRO ? (otro || OTRO) : (val || null)
    const resolveM = (arr, otro) => arr.map(v => v === OTRO ? (otro || OTRO) : v)
    const resolveLesiones = (lesiones) => lesiones.map(l => ({
      zona: l.zona === OTRO ? (l.zona_otro || OTRO) : l.zona,
      tipo: l.tipo === OTRO ? (l.tipo_otro || OTRO) : l.tipo,
      antiguedad: l.antiguedad,
      intensidad: l.intensidad,
      movimientos: l.movimientos,
      diagnostico: l.diagnostico,
      limitaciones: l.limitaciones,
    }))

    const payload = {
      nombre: form.nombre || null,
      email: form.email || null,
      telefono: form.telefono || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      profesion: form.profesion || null,
      ciudad: form.ciudad || null,
      objetivo_principal: resolveS(form.objetivo_principal, form.objetivo_principal_otro),
      competiciones: form.objetivo_principal === 'Preparar una competición o reto deportivo' ? form.competiciones : [],
      objetivos_secundarios: resolveM(form.objetivos_secundarios, form.objetivos_secundarios_otro),
      objetivo_3_6_meses: form.objetivo_3_6_meses || null,
      deportes_actuales: resolveM(form.deportes_actuales, form.deportes_actuales_otro),
      actividades_gustan: resolveM(form.actividades_gustan, form.actividades_gustan_otro),
      actividades_evitar: resolveM(form.actividades_evitar, form.actividades_evitar_otro),
      frecuencia_actual: form.frecuencia_actual || null,
      duracion_habitual: form.duracion_habitual || null,
      experiencia_fuerza: form.experiencia_fuerza || null,
      experiencia_fuerza_obs: form.experiencia_fuerza_obs || null,
      experiencia_resistencia: form.experiencia_resistencia || null,
      experiencia_resistencia_obs: form.experiencia_resistencia_obs || null,
      experiencia_funcional: form.experiencia_funcional || null,
      experiencia_funcional_obs: form.experiencia_funcional_obs || null,
      dias_semana: form.dias_semana || null,
      dias_preferentes: form.dias_preferentes,
      tiempo_sesion: form.tiempo_sesion || null,
      tiempo_sesion_obs: form.tiempo_sesion_obs || null,
      horarios_preferentes: form.horarios_preferentes,
      lugares_entrenamiento: form.lugares_entrenamiento,
      tiene_gimnasio: form.tiene_gimnasio === 'Sí' ? true : form.tiene_gimnasio === 'No' ? false : null,
      gimnasio_nombre: form.tiene_gimnasio === 'Sí' ? (form.gimnasio_nombre || null) : null,
      material_gimnasio: form.tiene_gimnasio === 'Sí' ? resolveM(form.material_gimnasio, form.material_gimnasio_otro) : [],
      material_casa: resolveM(form.material_casa, form.material_casa_otro),
      tiene_wearable: form.tiene_wearable === 'Sí' ? true : form.tiene_wearable === 'No' ? false : null,
      wearable_modelo: form.tiene_wearable === 'Sí' ? (form.wearable_modelo || null) : null,
      lesiones_actuales: form.lesiones_actuales_yn === 'Sí' ? resolveLesiones(form.lesiones_actuales) : [],
      lesiones_anteriores: form.lesiones_anteriores_yn === 'Sí' ? (form.lesiones_anteriores || null) : null,
      operaciones: form.operaciones_yn === 'Sí' ? (form.operaciones || null) : null,
      enfermedades: form.enfermedades_yn === 'Sí' ? (form.enfermedades || null) : null,
      medicacion: form.medicacion_yn === 'Sí' ? (form.medicacion || null) : null,
      restricciones_medicas: form.restricciones_medicas_yn === 'Sí' ? (form.restricciones_medicas || null) : null,
      seguimiento_fisio: form.seguimiento_fisio || null,
      horas_sueno: form.horas_sueno || null,
      calidad_sueno: form.calidad_sueno || null,
      nivel_estres: form.nivel_estres || null,
      nivel_energia: form.nivel_energia || null,
      tipo_trabajo: form.tipo_trabajo || null,
      pasos_diarios: form.pasos_diarios || null,
      consumo_tabaco: form.consumo_tabaco || null,
      consumo_alcohol: form.consumo_alcohol || null,
      confianza_rutina: form.confianza_rutina || null,
      info_adicional: form.info_adicional || null,
      submitted_at: new Date().toISOString(),
    }
    await supabase.from('cuestionario_inicial').update(payload).eq('token_publico', token)
    setSaving(false)
    setDone(true)
  }

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
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 10 }}>¡Cuestionario enviado!</h2>
        <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6 }}>Gracias por rellenar el cuestionario. Tu entrenadora revisará tus respuestas para preparar un plan de entrenamiento personalizado para ti.</p>
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
          {/* Progress bar */}
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
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            style={{ padding: '11px 20px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, color: step === 0 ? T.text3 : T.text, fontSize: 14, fontWeight: 500, cursor: step === 0 ? 'not-allowed' : 'pointer' }}>
            ← Anterior
          </button>
          {!isLast ? (
            <button onClick={() => setStep(s => s + 1)}
              style={{ flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Siguiente →
            </button>
          ) : (
            <button onClick={submit} disabled={saving}
              style={{ flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enviando...' : 'Enviar cuestionario ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
