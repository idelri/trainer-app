import { useState } from 'react'

const T = {
  ink: '#15171C', ink2: '#5A6270', ink3: '#929BA8',
  paper: '#EEF0F3', card: '#FFFFFF', line: '#E4E6EB',
  accent: '#E0481F',
}

const RPE_LABELS = ['Nada de esfuerzo', 'Muy, muy suave', 'Muy suave', 'Suave', 'Moderada', 'Algo exigente', 'Exigente', 'Muy exigente', 'Muy dura', 'Extremadamente dura', 'Máximo esfuerzo']

const TQR_ANCHORS = { 0: 'Nada recuperado/a', 3: 'Poco recuperado/a', 5: 'Moderadamente recuperado/a', 7: 'Bastante recuperado/a', 10: 'Totalmente recuperado/a' }
const SUENO_LABELS = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien']

const emptyFeedback = () => ({
  completion: { status: null, reasons: [], partialDetails: '' },
  sueno: { value: null },
  tqr: { value: null },
  rpe: { value: null },
  duration: { minutes: null },
  pain: { hasPain: false, mainPainDetails: '', mainPainRelatedToIncompleteSession: false, additionalPain: false, additionalPainLevel: null, additionalPainDetails: '' },
  technical: { hasDifficulty: false, mainTechnicalDetails: '', mainTechnicalRelatedToIncompleteSession: false, additionalTechnicalDifficulty: false, additionalTechnicalDetails: '' },
  equipment: { missingEquipment: false, details: '' },
  understanding: { unclearExercise: false, details: '' },
  postSessionFeeling: null,
  generalComments: '',
  submittedAt: null,
})

function Section({ children }) {
  return <div style={{ marginTop: 20 }}>{children}</div>
}
function Q({ children }) {
  return <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: '0 0 10px' }}>{children}</p>
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

export default function FeedbackForm({ onSubmit, submitting, initial, tipoEditor, submitLabel }) {
  const [fb, setFb] = useState(initial || emptyFeedback())
  const set = (path, value) => setFb(f => {
    const next = JSON.parse(JSON.stringify(f))
    let o = next; const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]]
    o[keys[keys.length - 1]] = value
    return next
  })

  const status = fb.completion.status
  const reasons = fb.completion.reasons
  const has = r => reasons.includes(r)
  const toggleReason = r => set('completion.reasons', has(r) ? reasons.filter(x => x !== r) : [...reasons, r])

  const motivosBC = ['Falta de tiempo', 'Fatiga acumulada', 'Molestia o dolor', 'Dificultad técnica con algún ejercicio', 'No tenía material disponible', 'No entendí algún ejercicio', status === 'partial' ? 'Preferí reducir la sesión' : 'Preferí no hacerla', 'Otro motivo']

  function puedeEnviar() {
    if (!status) return false
    if (status === 'completed' || status === 'partial') {
      if (fb.rpe.value == null) return false
      if (!fb.duration.minutes) return false
    }
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
            const n = i + 1
            const sel = fb.sueno.value === n
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

      {/* Estado de finalización */}
      <Section>
        <Q>¿Has completado la sesión?</Q>
        <OptionBtn active={status === 'completed'} onClick={() => set('completion.status', 'completed')}>Sí, completada al 100%</OptionBtn>
        <OptionBtn active={status === 'partial'} onClick={() => set('completion.status', 'partial')}>Parcialmente completada</OptionBtn>
        <OptionBtn active={status === 'missed'} onClick={() => set('completion.status', 'missed')}>No realizada</OptionBtn>
      </Section>

      {/* CASO B y C: motivo */}
      {(status === 'partial' || status === 'missed') && (
        <Section>
          <Q>{status === 'partial' ? '¿Por qué no completaste la sesión al 100%?' : '¿Por qué no realizaste la sesión?'}</Q>
          {motivosBC.map(m => (
            <OptionBtn key={m} active={has(m)} onClick={() => toggleReason(m)}>{m}</OptionBtn>
          ))}
        </Section>
      )}

      {/* Molestia o dolor (motivo) */}
      {(status === 'partial' || status === 'missed') && has('Molestia o dolor') && (
        <Section>
          <Q>{status === 'partial' ? '¿Qué molestia o dolor hizo que no completaras la sesión? ¿Dónde lo notaste y con qué ejercicio ocurrió?' : '¿Qué molestia o dolor te impidió realizar la sesión? ¿Dónde lo notaste?'}</Q>
          <TextArea value={fb.pain.mainPainDetails} onChange={v => { set('pain.hasPain', true); set('pain.mainPainRelatedToIncompleteSession', true); set('pain.mainPainDetails', v) }}
            placeholder="Ej: dolor lumbar en plancha lateral, molestia en rodilla durante el step-up..." />
        </Section>
      )}

      {/* Dificultad técnica (motivo) */}
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

      {/* No entendí (motivo, solo caso B) */}
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

      {/* B3: parte no realizada */}
      {status === 'partial' && (
        <Section>
          <Q>¿Qué parte de la sesión no realizaste?</Q>
          <TextArea value={fb.completion.partialDetails} onChange={v => set('completion.partialDetails', v)}
            placeholder="Ej: no hice el último bloque, quité una serie de cada ejercicio, no hice el ejercicio 4..." />
        </Section>
      )}

      {/* RPE y duración: solo completed o partial */}
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

      {/* Dolor general (si no se preguntó ya como motivo principal) */}
      {(status === 'completed' || (status === 'partial' && !has('Molestia o dolor'))) && (
        <Section>
          <Q>{status === 'partial' ? '¿Tuviste alguna molestia, dolor o síntoma durante la parte de sesión que realizaste?' : '¿Tuviste alguna molestia, dolor o síntoma durante la sesión?'}</Q>
          {['No', 'Sí, leve y tolerable', 'Sí, moderado', 'Sí, alto', 'Sí, tuve que parar'].map(op => (
            <OptionBtn key={op} active={fb.pain.additionalPainLevel === op || (op === 'No' && fb.pain.additionalPainLevel === 'No')}
              onClick={() => { set('pain.additionalPainLevel', op); set('pain.additionalPain', op !== 'No'); if (op !== 'No') set('pain.hasPain', true) }}>{op}</OptionBtn>
          ))}
          {fb.pain.additionalPainLevel && fb.pain.additionalPainLevel !== 'No' && (
            <div style={{ marginTop: 8 }}>
              <TextArea value={fb.pain.additionalPainDetails} onChange={v => set('pain.additionalPainDetails', v)} placeholder="¿Dónde lo notaste y con qué ejercicio ocurrió?" />
            </div>
          )}
        </Section>
      )}

      {/* Dificultad técnica general (si no se preguntó ya) */}
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

     

      {/* Observaciones generales: siempre */}
      {status && (
        <Section>
          <Q>Observaciones generales</Q>
          <p style={{ fontSize: 11.5, color: T.ink3, margin: '-6px 0 8px' }}>Puedes comentar cualquier cosa que quieras destacar: algo que te haya gustado, algo que no, dudas, ejercicios a revisar o cualquier detalle a tener en cuenta.</p>
          <TextArea value={fb.generalComments} onChange={v => set('generalComments', v)} placeholder="Escribe aquí (opcional)..." />
        </Section>
      )}

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
