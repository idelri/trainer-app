import { format } from 'date-fns'

// ── Componentes base ──────────────────────────────────────────────────────────

export function Bloque({ titulo, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 8 }}>{titulo}</div>
      <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

export function Fila({ label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--text3)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{Array.isArray(value) ? value.join(' · ') : value}</span>
    </div>
  )
}

// ── Resumen práctico ──────────────────────────────────────────────────────────

export function ResumenCuestionario({ data: d }) {
  const CALIDAD_LABELS = ['','Muy mala','Regular','Normal','Buena','Muy buena']
  const ESTRES_LABELS  = ['','Muy bajo','Bajo','Moderado','Alto','Muy alto']
  const CONFIANZA_LABELS = ['','Muy difícil ser constante','Bastantes dificultades','Con algunas dificultades','Bastante confianza','Totalmente seguro/a']

  const lesiones = d.lesiones_actuales || []

  return (
    <div>
      <Bloque titulo="Persona">
        <Fila label="Nombre" value={d.nombre} />
        <Fila label="Fecha nac." value={d.fecha_nacimiento ? format(new Date(d.fecha_nacimiento + 'T12:00:00'), 'dd/MM/yyyy') : null} />
        <Fila label="Profesión" value={d.profesion} />
        <Fila label="Ciudad" value={d.ciudad} />
        <Fila label="Email" value={d.email} />
        <Fila label="Teléfono" value={d.telefono} />
      </Bloque>

      <Bloque titulo="Objetivos">
        <Fila label="Objetivo principal" value={d.objetivo_principal} />
        {(d.competiciones || []).length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            <span style={{ color: 'var(--text3)', marginRight: 10 }}>Competiciones</span>
            {d.competiciones.map((c, i) => (
              <div key={i} style={{ marginLeft: 140, marginTop: 2, lineHeight: 1.5 }}>
                <strong>{c.nombre}</strong>
                {c.fecha ? ` · ${format(new Date(c.fecha + 'T12:00:00'), 'dd/MM/yyyy')}` : ''}
                {c.modalidad ? ` · ${c.modalidad}` : ''}
                {c.objetivo_rendimiento ? ` — ${c.objetivo_rendimiento}` : ''}
              </div>
            ))}
          </div>
        )}
        <Fila label="Objetivos secundarios" value={d.objetivos_secundarios} />
        <Fila label="A 3–6 meses" value={d.objetivo_3_6_meses} />
      </Bloque>

      <Bloque titulo="Experiencia y actividad">
        <Fila label="Deportes actuales" value={d.deportes_actuales} />
        <Fila label="Frecuencia actual" value={d.frecuencia_actual} />
        <Fila label="Duración habitual" value={d.duracion_habitual} />
        <Fila label="Exp. fuerza" value={d.experiencia_fuerza ? `${d.experiencia_fuerza}${d.experiencia_fuerza_obs ? ` — ${d.experiencia_fuerza_obs}` : ''}` : null} />
        <Fila label="Exp. resistencia" value={d.experiencia_resistencia ? `${d.experiencia_resistencia}${d.experiencia_resistencia_obs ? ` — ${d.experiencia_resistencia_obs}` : ''}` : null} />
        <Fila label="Exp. funcional" value={d.experiencia_funcional ? `${d.experiencia_funcional}${d.experiencia_funcional_obs ? ` — ${d.experiencia_funcional_obs}` : ''}` : null} />
      </Bloque>

      <Bloque titulo="Disponibilidad">
        <Fila label="Días/semana" value={d.dias_semana} />
        <Fila label="Días preferentes" value={d.dias_preferentes} />
        <Fila label="Tiempo por sesión" value={d.tiempo_sesion} />
        <Fila label="Horarios" value={d.horarios_preferentes} />
        <Fila label="Lugar" value={d.lugares_entrenamiento} />
        {d.tiene_gimnasio && <Fila label="Gimnasio" value={d.gimnasio_nombre || 'Sí'} />}
        <Fila label="Material en casa" value={d.material_casa} />
        {d.tiene_wearable && <Fila label="Wearable" value={[d.wearable_marca, d.wearable_modelo].filter(Boolean).join(' ') || 'Sí'} />}
      </Bloque>

      {lesiones.length > 0 && (
        <Bloque titulo={`Lesiones actuales (${lesiones.length})`}>
          {lesiones.map((l, i) => (
            <div key={i} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#be123c', marginBottom: 4 }}>{l.zona || 'Zona no especificada'}</div>
              {l.antiguedad && <div style={{ color: 'var(--text2)' }}>{l.antiguedad}{l.intensidad != null ? ` · intensidad ${l.intensidad}/10` : ''}</div>}
              {l.movimientos && <div style={{ color: 'var(--text2)', marginTop: 4 }}>{l.movimientos}</div>}
              {l.diagnostico && <div style={{ color: 'var(--text3)', fontStyle: 'italic', marginTop: 2 }}>Dx: {l.diagnostico}</div>}
              {l.limitaciones && <div style={{ color: 'var(--text2)', marginTop: 2 }}>Limitaciones: {l.limitaciones}</div>}
            </div>
          ))}
        </Bloque>
      )}

      {(d.lesiones_anteriores || d.operaciones || d.enfermedades || d.medicacion || d.restricciones_medicas || d.seguimiento_fisio || d.antecedentes_categorias?.length > 0) && (
        <Bloque titulo="Antecedentes de salud">
          <Fila label="Lesiones anteriores" value={d.lesiones_anteriores} />
          <Fila label="Operaciones" value={d.operaciones} />
          <Fila label="Enfermedades" value={d.enfermedades} />
          <Fila label="Medicación" value={d.medicacion} />
          <Fila label="Restricciones" value={d.restricciones_medicas} />
          <Fila label="Seguimiento / fisio" value={d.seguimiento_fisio || d.tratamiento_actual} />
          <Fila label="Categorías" value={d.antecedentes_categorias} />
        </Bloque>
      )}

      <Bloque titulo="Estilo de vida">
        <Fila label="Sueño" value={d.horas_sueno ? `${d.horas_sueno}${d.calidad_sueno ? ` · calidad ${CALIDAD_LABELS[d.calidad_sueno]}` : ''}` : null} />
        <Fila label="Estrés" value={d.nivel_estres ? ESTRES_LABELS[d.nivel_estres] : null} />
        <Fila label="Trabajo" value={d.tipo_trabajo} />
        <Fila label="Pasos diarios" value={d.pasos_diarios} />
        <Fila label="Tabaco" value={d.consumo_tabaco} />
        <Fila label="Confianza en rutina" value={d.confianza_rutina ? `${d.confianza_rutina}/5 — ${CONFIANZA_LABELS[d.confianza_rutina]}` : null} />
        <Fila label="Barreras" value={d.barreras_adherencia} />
      </Bloque>

      {d.info_adicional && (
        <Bloque titulo="Información adicional">
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{d.info_adicional}</div>
        </Bloque>
      )}
    </div>
  )
}

// ── Respuestas completas ──────────────────────────────────────────────────────

export function RespuestasCompletas({ data: d }) {
  function Seccion({ titulo, children }) {
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12 }}>{titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
      </div>
    )
  }
  function R({ q, a }) {
    if (a == null || a === '' || (Array.isArray(a) && a.length === 0)) return null
    return (
      <div style={{ fontSize: 13 }}>
        <div style={{ color: 'var(--text3)', marginBottom: 2 }}>{q}</div>
        <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{Array.isArray(a) ? a.join(', ') : String(a)}</div>
      </div>
    )
  }

  const lesiones = d.lesiones_actuales || []
  const comps = d.competiciones || []

  return (
    <div>
      <Seccion titulo="1. Datos personales">
        <R q="Nombre" a={d.nombre} />
        <R q="Nombre preferido" a={d.nombre_preferido} />
        <R q="Email" a={d.email} />
        <R q="Teléfono" a={d.telefono} />
        <R q="Fecha de nacimiento" a={d.fecha_nacimiento ? format(new Date(d.fecha_nacimiento + 'T12:00:00'), 'dd/MM/yyyy') : null} />
        <R q="Profesión" a={d.profesion} />
        <R q="Ciudad" a={d.ciudad} />
      </Seccion>

      <Seccion titulo="2. Objetivos">
        <R q="Objetivo principal" a={d.objetivo_principal} />
        {comps.length > 0 && comps.map((c, i) => (
          <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: '#166534', marginBottom: 2 }}>Competición {i + 1}: {c.nombre}</div>
            {c.fecha && <div style={{ color: 'var(--text2)' }}>Fecha: {format(new Date(c.fecha + 'T12:00:00'), 'dd/MM/yyyy')}</div>}
            {c.modalidad && <div style={{ color: 'var(--text2)' }}>Modalidad: {c.modalidad}</div>}
            {c.objetivo_rendimiento && <div style={{ color: 'var(--text2)' }}>Objetivo: {c.objetivo_rendimiento}</div>}
          </div>
        ))}
        <R q="Objetivos secundarios" a={d.objetivos_secundarios} />
        <R q="¿Qué te gustaría conseguir en 3–6 meses?" a={d.objetivo_3_6_meses} />
      </Seccion>

      <Seccion titulo="3. Actividad y experiencia">
        <R q="Deportes actuales" a={d.deportes_actuales} />
        <R q="Frecuencia actual" a={d.frecuencia_actual} />
        <R q="Duración habitual" a={d.duracion_habitual} />
        <R q="Preferencia de entrenamiento" a={d.preferencia_entreno} />
        <R q="Tipos que disfruta" a={d.tipos_entreno_disfruta} />
        <R q="Ejercicios que prefiere evitar" a={d.evitar_ejercicios_yn === 'Sí' ? d.evitar_ejercicios_detalle : null} />
        <R q="Experiencia en fuerza" a={d.experiencia_fuerza} />
        <R q="Observaciones fuerza" a={d.experiencia_fuerza_obs} />
        <R q="Experiencia en resistencia" a={d.experiencia_resistencia} />
        <R q="Experiencia en funcional" a={d.experiencia_funcional} />
      </Seccion>

      <Seccion titulo="4. Disponibilidad y material">
        <R q="Días disponibles por semana" a={d.dias_semana} />
        <R q="Días preferentes" a={d.dias_preferentes} />
        <R q="Tiempo por sesión" a={d.tiempo_sesion} />
        <R q="Horarios preferentes" a={d.horarios_preferentes} />
        <R q="Lugar de entrenamiento" a={d.lugares_entrenamiento} />
        <R q="¿Va al gimnasio?" a={d.tiene_gimnasio === true ? 'Sí' : d.tiene_gimnasio === false ? 'No' : null} />
        <R q="Gimnasio" a={d.gimnasio_nombre} />
        <R q="Material en casa" a={d.material_casa} />
        <R q="¿Tiene wearable?" a={d.tiene_wearable === true ? 'Sí' : d.tiene_wearable === false ? 'No' : null} />
        <R q="Marca wearable" a={d.wearable_marca} />
        <R q="Modelo wearable" a={d.wearable_modelo} />
      </Seccion>

      <Seccion titulo="5. Salud y lesiones">
        {lesiones.length > 0 ? lesiones.map((l, i) => (
          <div key={i} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: '#be123c', marginBottom: 4 }}>Lesión {i + 1}: {l.zona}</div>
            <R q="Antigüedad" a={l.antiguedad} />
            <R q="Intensidad" a={l.intensidad != null ? `${l.intensidad}/10` : null} />
            <R q="Movimientos afectados" a={l.movimientos} />
            <R q="Diagnóstico" a={l.diagnostico} />
            <R q="Limitaciones" a={l.limitaciones} />
          </div>
        )) : <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sin lesiones actuales declaradas</div>}
        <R q="Antecedentes" a={d.antecedentes_categorias} />
        <R q="Lesiones anteriores" a={d.lesiones_anteriores} />
        <R q="Operaciones" a={d.operaciones} />
        <R q="Enfermedades / condiciones" a={d.enfermedades} />
        <R q="Medicación" a={d.medicacion} />
        <R q="Restricciones médicas" a={d.restricciones_medicas} />
        <R q="Tratamiento / fisioterapia" a={d.tratamiento_actual || d.seguimiento_fisio} />
      </Seccion>

      <Seccion titulo="6. Estilo de vida">
        <R q="Horas de sueño" a={d.horas_sueno} />
        <R q="Calidad del sueño" a={d.calidad_sueno ? `${d.calidad_sueno}/5` : null} />
        <R q="Nivel de estrés" a={d.nivel_estres ? `${d.nivel_estres}/5` : null} />
        <R q="Tipo de trabajo" a={d.tipo_trabajo} />
        <R q="Pasos diarios" a={d.pasos_diarios} />
        <R q="Tabaco" a={d.consumo_tabaco} />
        <R q="Confianza en rutina" a={d.confianza_rutina ? `${d.confianza_rutina}/5` : null} />
        <R q="Barreras de adherencia" a={d.barreras_adherencia} />
      </Seccion>

      {d.info_adicional && (
        <Seccion titulo="7. Información adicional">
          <R q="Comentario libre" a={d.info_adicional} />
        </Seccion>
      )}
    </div>
  )
}
