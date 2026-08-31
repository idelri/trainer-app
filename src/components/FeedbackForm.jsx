import { useState } from 'react'

const T = {
  ink: '#15171C', ink2: '#5A6270', ink3: '#929BA8',
  paper: '#EEF0F3', card: '#FFFFFF', line: '#E4E6EB',
  accent: '#E0481F',
}

const RPE_LABELS = ['Nada de esfuerzo', 'Muy, muy suave', 'Muy suave', 'Suave', 'Moderada', 'Algo exigente', 'Exigente', 'Muy exigente', 'Muy dura', 'Extremadamente dura', 'Máximo esfuerzo']
const TQR_ANCHORS = { 0: 'Nada recuperado/a', 3: 'Poco recuperado/a', 5: 'Moderadamente recuperado/a', 7: 'Bastante recuperado/a', 10: 'Totalmente recuperado/a' }
const SUENO_LABELS = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien']

// ── Estructura canónica nueva ──────────────────────────────────────────────────
// pain.hasPain      null = no respondido | false = No | true = Sí
// pain.intensity    number 0–10 | null
// pain.details      string (texto libre)
//
// Campos legados (conservados para compatibilidad al leer feedbacks históricos,
// pero ya NO escritos por este formulario):
//   mainPainDetails, mainPainRelatedToIncompleteSession,
//   additionalPain, additionalPainLevel, additionalPainDetails

function emptyFeedback() {
  return {
    completion: { status: null, reasons: [], partialDetails: '' },
    sueno:      { value: null },
    tqr:        { value: null },
    rpe:        { value: null },
    duration:   { minutes: null },
    pain: {
      hasPain:   null,   // null | false | true
      intensity: null,   // number 0-10 | null
      details:   '',     // texto libre
    },
    technical:  { hasDifficulty: false, mainTechnicalDetails: '', mainTechnicalRelatedToIncompleteSession: false, additionalTechnicalDifficulty: false, additionalTechnicalDetails: '' },
    equipment:  { missingEquipment: false, details: '' },
    understanding: { unclearExercise: false, details: '' },
    postSessionFeeling: null,
    generalComments: '',
    submittedAt: null,
  }
}

// Hidrata feedbacks históricos al nuevo formato
function hydratePain(raw) {
  const p = raw || {}
  return {
    // Campos nuevos canónicos
    hasPain:   typeof p.hasPain === 'boolean' ? p.hasPain
               : (p.additionalPain === true ? true : null),
    intensity: p.intensity ?? null,       // no convertir string cualitativo → número
    details:   p.details?.trim()
               || p.mainPainDetails?.trim()
               || p.additionalPainDetails?.trim()
               || '',
    // Conservar campos legados para que sigan siendo legibles externamente
    mainPainDetails:                      p.mainPainDetails ?? '',
    mainPainRelatedToIncompleteSession:   p.mainPainRelatedToIncompleteSession ?? false,
    additionalPain:                       p.additionalPain ?? false,
    additionalPainLevel:                  p.additionalPainLevel ?? null,
    additionalPainDetails:                p.additionalPainDetails ?? '',
  }
}

// ── Átomo UI ──────────────────────────────────────────────────────────────────
function Section({ children }) { return <div style={{ marginTop: 20 }}>{children}</div> }
function Q({ children, hint }) {
  return (
    <>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: '0 0 6px' }}>{children}</p>
      {hint && <p style={{ fontSize: 12, color: T.ink3, margin: '-2px 0 10px' }}>{hint}</p>}
    </>
  )
}
function OptionBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} type="button" style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 7,
      borderRadius: 10, border: `1.5px solid ${active ? T.accent : T.line}`,
      background: active ? T.accent + '14' : T.card, color: active ? T.accent : T.ink,
      fontWeight: active ? 600 : 400, fontSize: 13.5, cursor: 'pointer',
    }}>{children}</button>
  )
}
function TextArea({ value, onChange, placeholder }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.line}`, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FeedbackForm({ onSubmit, submitting, initial, tipoEditor, submitLabel }) {
  const [fb, setFb] = useState(() => {
    const base = initial ? { ...emptyFeedback(), ...initial } : emptyFeedback()
    return { ...base, pain: hydratePain(base.pain) }
  })

  const set = (path, value) => setFb(f => {
    const next = JSON.parse(JSON.stringify(f))
    let o = next; const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]]
    o[keys[keys.length - 1]] = value
    return next
  })

  const status   = fb.completion.status
  const reasons  = fb.completion.reasons
  const has      = r => reasons.includes(r)

  function toggleReason(r) {
    const teniamos = has(r)
    set('completion.reasons', teniamos ? reasons.filter(x => x !== r) : [...reasons, r])
    // Cuando seleccionan "Molestia o dolor" como motivo y el bloque de
    // molestia aún no tiene respuesta → pre-seleccionar Sí
    if (r === 'Molestia o dolor' && !teniamos && fb.pain.hasPain === null) {
      set('pain.hasPain', true)
    }
  }

  const motivosBC = [
    'Falta de tiempo', 'Fatiga acumulada', 'Molestia o dolor',
    'Dificultad técnica con algún ejercicio', 'No tenía material disponible',
    'No entendí algún ejercicio',
    status === 'partial' ? 'Preferí reducir la sesión' : 'Preferí no hacerla',
    'Otro motivo',
  ]

  // Incoherencia: motivo=dolor pero hasPain=false (explícitamente No)
  const hayIncoherencia = has('Molestia o dolor') && fb.pain.hasPain === false

  function puedeEnviar() {
    if (!status) return false
    if (status === 'completed' || status === 'partial') {
      if (fb.rpe.value == null) return false
      if (!fb.duration.minutes) return false
    }
    if (hayIncoherencia) return false
    // Si marcó hasPain=true, tanto intensidad como detalle son obligatorios
    if (fb.pain.hasPain === true && fb.pain.intensity == null) return false
    if (fb.pain.hasPain === true && !fb.pain.details?.trim()) return false
    return true
  }

  function enviar() {
    if (!puedeEnviar()) return
    onSubmit({ ...fb, submittedAt: new Date().toISOString() })
  }

  return (
    <div>
      {/* ── Bloque 0: Cómo llegabas ── */}
      <div style={{ background: '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 14, padding: '16px 16px 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0d9488', margin: '0 0 14px' }}>Antes de empezar</p>

        {/* Sueño */}
        <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: '0 0 10px' }}>¿Cómo has dormido esta noche?</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {SUENO_LABELS.map((label, i) => {
            const n = i + 1; const sel = fb.sueno.value === n
            return (
              <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <button type="button" onClick={() => set('sueno.value', n)}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 10, border: `1.5px solid ${sel ? '#0d9488' : '#99f6e4'}`, background: sel ? '#0d9488' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: sel ? '#fff' : '#0d9488' }}>{n}</span>
                </button>
                <span style={{ fontSize: 9, color: '#0d9488', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
              </div>
            )
          })}
        </div>

        {/* TQR */}
        <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: '0 0 10px' }}>¿Cuánto te notabas de recuperado/a antes de empezar?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" onClick={() => set('tqr.value', n)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: 9, border: `1.5px solid ${fb.tqr.value === n ? '#0d9488' : '#99f6e4'}`, background: fb.tqr.value === n ? '#0d948818' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fb.tqr.value === n ? '#0d9488' : '#f0fdfa', color: fb.tqr.value === n ? '#fff' : '#0d9488', fontWeight: 700, fontSize: 12 }}>{n}</span>
              <span style={{ fontSize: 13, color: fb.tqr.value === n ? '#0d9488' : T.ink2, fontWeight: fb.tqr.value === n ? 600 : 400 }}>{TQR_ANCHORS[n] || ''}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Estado de finalización ── */}
      <Section>
        <Q>¿Has completado la sesión?</Q>
        <OptionBtn active={status === 'completed'} onClick={() => set('completion.status', 'completed')}>Sí, completada al 100%</OptionBtn>
        <OptionBtn active={status === 'partial'}   onClick={() => set('completion.status', 'partial')}>Parcialmente completada</OptionBtn>
        <OptionBtn active={status === 'missed'}    onClick={() => set('completion.status', 'missed')}>No realizada</OptionBtn>
      </Section>

      {/* ── 2. Motivo (partial / missed) ── */}
      {(status === 'partial' || status === 'missed') && (
        <Section>
          <Q>{status === 'partial' ? '¿Por qué no completaste la sesión al 100%?' : '¿Por qué no realizaste la sesión?'}</Q>
          {motivosBC.map(m => (
            <OptionBtn key={m} active={has(m)} onClick={() => toggleReason(m)}>{m}</OptionBtn>
          ))}
        </Section>
      )}

      {/* Nota: "Molestia o dolor" como motivo NO despliega pregunta de detalle aquí.
           La molestia se registra en el bloque único de abajo. */}

      {/* ── Dificultad técnica (motivo) ── */}
      {status === 'partial' && has('Dificultad técnica con algún ejercicio') && (
        <Section>
          <Q>¿Qué ejercicio te impidió completar la sesión o te hizo reducirla? ¿Qué problema técnico tuviste?</Q>
          <TextArea value={fb.technical.mainTechnicalDetails} onChange={v => { set('technical.hasDifficulty', true); set('technical.mainTechnicalRelatedToIncompleteSession', true); set('technical.mainTechnicalDetails', v) }}
            placeholder="Ej: no conseguí hacer bien el hip hinge, me costaba controlar la pelvis en el dead bug..." />
        </Section>
      )}
      {status === 'missed' && (has('Dificultad técnica con algún ejercicio') || has('No entendí algún ejercicio')) && (
        <Section>
          <Q>¿Qué ejercicio o parte de la sesión no entendiste o te generó dudas?</Q>
          <TextArea value={fb.technical.mainTechnicalDetails} onChange={v => { set('technical.hasDifficulty', true); set('technical.mainTechnicalDetails', v) }}
            placeholder="Cuéntame qué ejercicio o parte te generó dudas..." />
        </Section>
      )}

      {/* Material (motivo) */}
      {has('No tenía material disponible') && (
        <Section>
          <Q>¿Qué material no tenías disponible?</Q>
          <TextArea value={fb.equipment.details} onChange={v => { set('equipment.missingEquipment', true); set('equipment.details', v) }}
            placeholder="Ej: no tenía banda elástica, mancuerna, banco, fitball, polea..." />
        </Section>
      )}

      {/* No entendí (motivo, solo parcial) */}
      {status === 'partial' && has('No entendí algún ejercicio') && (
        <Section>
          <Q>¿Qué ejercicio no entendiste?</Q>
          <TextArea value={fb.understanding.details} onChange={v => { set('understanding.unclearExercise', true); set('understanding.details', v) }}
            placeholder="Ej: no entendí el hip hinge, no sabía cómo colocarme en el Pallof press..." />
        </Section>
      )}

      {/* Otro motivo */}
      {has('Otro motivo') && (
        <Section>
          <Q>Cuéntame brevemente el motivo</Q>
          <TextArea value={fb.completion.partialDetails} onChange={v => set('completion.partialDetails', v)} placeholder="Cuéntamelo brevemente..." />
        </Section>
      )}

      {/* Parte no realizada (partial) */}
      {status === 'partial' && (
        <Section>
          <Q>¿Qué parte de la sesión no realizaste?</Q>
          <TextArea value={fb.completion.partialDetails} onChange={v => set('completion.partialDetails', v)}
            placeholder="Ej: no hice el último bloque, quité una serie de cada ejercicio, no hice el ejercicio 4..." />
        </Section>
      )}

      {/* ── 3. RPE + Duración (completed / partial) ── */}
      {(status === 'completed' || status === 'partial') && (
        <>
          <Section>
            <Q>¿Cómo de dura te ha parecido la sesión en global?</Q>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} type="button" onClick={() => set('rpe.value', n)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${fb.rpe.value === n ? T.accent : T.line}`, background: fb.rpe.value === n ? T.accent + '14' : T.card, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fb.rpe.value === n ? T.accent : T.paper, color: fb.rpe.value === n ? '#fff' : T.ink, fontWeight: 700, fontSize: 13 }}>{n}</span>
                  <span style={{ fontSize: 13, color: fb.rpe.value === n ? T.accent : T.ink2, fontWeight: fb.rpe.value === n ? 600 : 400 }}>{RPE_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section>
            <Q>¿Cuánto tiempo te llevó realizar la sesión? Responde en minutos.</Q>
            <input type="number" min="1" max="240" value={fb.duration.minutes || ''} onChange={e => set('duration.minutes', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ej: 45"
              style={{ width: 110, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.line}`, fontSize: 14 }} />
            {fb.duration.minutes > 150 && <p style={{ fontSize: 11.5, color: T.accent, marginTop: 6 }}>Es un tiempo bastante alto, ¿confirmas que es correcto?</p>}
          </Section>
        </>
      )}

      {/* ── 4. BLOQUE ÚNICO DE MOLESTIAS ── */}
      {status && (
        <Section>
          <Q>
            {status === 'missed'
              ? '¿Tuviste alguna molestia, dolor o síntoma ese día?'
              : '¿Tuviste alguna molestia, dolor o síntoma durante la sesión?'}
          </Q>

          {/* Si el motivo fue dolor, contexto informativo */}
          {has('Molestia o dolor') && (
            <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '7px 10px', marginBottom: 10 }}>
              Indicaste que la molestia afectó al cumplimiento de la sesión. Describe aquí qué notaste.
            </p>
          )}

          <OptionBtn
            active={fb.pain.hasPain === false}
            onClick={() => set('pain.hasPain', false)}>
            No
          </OptionBtn>
          <OptionBtn
            active={fb.pain.hasPain === true}
            onClick={() => set('pain.hasPain', true)}>
            Sí
          </OptionBtn>

          {/* Incoherencia */}
          {hayIncoherencia && (
            <p style={{ fontSize: 12, color: T.accent, marginTop: 4 }}>
              Has indicado que la molestia afectó a la sesión pero seleccionaste "No" aquí. Cambia el motivo de incumplimiento o selecciona "Sí".
            </p>
          )}

          {/* Detalle de molestia */}
          {fb.pain.hasPain === true && (
            <div style={{ marginTop: 12 }}>
              {/* Intensidad 0–10 */}
              <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: '0 0 8px' }}>¿Qué intensidad tuvo?</p>
              <p style={{ fontSize: 11.5, color: T.ink3, margin: '-4px 0 10px' }}>0 = sin molestia · 10 = máxima intensidad</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const sel = fb.pain.intensity === n
                  return (
                    <button key={n} type="button" onClick={() => set('pain.intensity', sel ? null : n)}
                      style={{ width: 36, height: 36, borderRadius: 9, border: `1.5px solid ${sel ? T.accent : T.line}`, background: sel ? T.accent + '18' : T.card, color: sel ? T.accent : T.ink2, fontSize: 13, fontWeight: sel ? 700 : 400, cursor: 'pointer' }}>
                      {n}
                    </button>
                  )
                })}
              </div>
              {fb.pain.hasPain === true && fb.pain.intensity == null && (
                <p style={{ fontSize: 12, color: T.accent, marginBottom: 8 }}>Elige una intensidad para continuar.</p>
              )}

              {/* Detalle */}
              <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: '0 0 8px' }}>¿Qué notaste y dónde?</p>
              <TextArea
                value={fb.pain.details}
                onChange={v => set('pain.details', v)}
                placeholder="Ej: molestia en Aquiles derecho al correr, tensión en zona lumbar durante las planchas..."
              />
            </div>
          )}
        </Section>
      )}

      {/* ── 5. Dificultad técnica general ── */}
      {(status === 'completed' || status === 'partial') && (tipoEditor === 'carrera' || (!has('Dificultad técnica con algún ejercicio') && !has('No entendí algún ejercicio'))) && (
        <Section>
          {tipoEditor === 'carrera'
            ? <Q>¿Hubo alguna parte de la sesión que te resultara especialmente difícil de completar según lo previsto?</Q>
            : <Q>¿Hubo algún ejercicio difícil de ejecutar o entender?</Q>
          }
          <OptionBtn active={fb.technical.additionalTechnicalDifficulty === false && fb.technical._answered} onClick={() => { set('technical.additionalTechnicalDifficulty', false); set('technical._answered', true) }}>No</OptionBtn>
          <OptionBtn active={fb.technical.additionalTechnicalDifficulty === true} onClick={() => { set('technical.additionalTechnicalDifficulty', true); set('technical.hasDifficulty', true); set('technical._answered', true) }}>Sí</OptionBtn>
          {fb.technical.additionalTechnicalDifficulty === true && (
            <div style={{ marginTop: 8 }}>
              <TextArea
                value={fb.technical.additionalTechnicalDetails}
                onChange={v => set('technical.additionalTechnicalDetails', v)}
                placeholder={tipoEditor === 'carrera'
                  ? '¿Qué parte fue y qué notaste? Puedes indicar si te costó mantener el ritmo, la zona de FC, la duración, las recuperaciones o si apareció fatiga, molestias o sensación de esfuerzo excesivo.'
                  : '¿Qué ejercicio te resultó difícil y qué problema tuviste?'}
              />
            </div>
          )}
        </Section>
      )}

      {/* ── 6. Observaciones generales ── */}
      {status && (
        <Section>
          <Q>Observaciones generales</Q>
          <p style={{ fontSize: 11.5, color: T.ink3, margin: '-6px 0 8px' }}>Puedes comentar cualquier cosa que quieras destacar: algo que te haya gustado, algo que no, dudas, ejercicios a revisar o cualquier detalle a tener en cuenta.</p>
          <TextArea value={fb.generalComments} onChange={v => set('generalComments', v)} placeholder="Escribe aquí (opcional)..." />
        </Section>
      )}

      {/* ── Enviar ── */}
      {status && (
        <Section>
          <button type="button" disabled={!puedeEnviar() || submitting} onClick={enviar}
            style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: puedeEnviar() ? T.accent : T.line, color: puedeEnviar() ? '#fff' : T.ink3, fontWeight: 700, fontSize: 14.5, cursor: puedeEnviar() ? 'pointer' : 'not-allowed' }}>
            {submitting ? 'Guardando...' : (submitLabel || 'Enviar feedback')}
          </button>
        </Section>
      )}
    </div>
  )
}
