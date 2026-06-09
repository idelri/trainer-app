// ============================================================
//  PlanPublica.jsx — Vista pública de la planificación (cliente)
//  Rediseño: vista única navegable (orientación → línea de tiempo →
//  bloques → subbloques → semanas) con controles/valoraciones.
//  Drop-in para src/pages/PlanPublica.jsx — mantiene tu fetching de
//  Supabase y tu modelo de datos. NO añade campos nuevos.
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, addWeeks, addDays, differenceInWeeks, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/* ---------- tokens de diseño ---------- */
const T = {
  bg: '#f5f4f0', bg2: '#eceae4', surface: '#ffffff',
  border: '#d8d5cc', border2: '#c8c5bc',
  ink: '#1a1916', ink2: '#5a5850', ink3: '#9a9890',
  green: '#2d6a4f', greenL: '#e3efe8', greenInk: '#1b4332',
  danger: '#c0392b', dangerL: '#fbe9e6',
  ctrl: '#33619c', ctrlL: '#e8eef6',
  font: "'Sora', sans-serif", mono: "'DM Mono', monospace",
}
const CARGAS = {
  baja:     { label: 'Baja',     color: '#7fae93' },
  media:    { label: 'Media',    color: '#3f8f6a' },
  alta:     { label: 'Alta',     color: '#d68910' },
  muy_alta: { label: 'Muy alta', color: '#c0392b' },
}
const ZONAS = [
  { key: 'zona1_2', real: 'zona1_2_real', label: 'Z1-Z2', color: '#3f8f6a' },
  { key: 'zona3_4', real: 'zona3_4_real', label: 'Z3-Z4', color: '#d68910' },
  { key: 'zona5',   real: 'zona5_real',   label: 'Z5+',   color: '#c0392b' },
]
/* Normas de color de cumplimiento (mismas que en la maqueta) */
const COMP_OK = '#2d8a5f', COMP_WARN = '#d68910', COMP_BAD = '#c0392b'
const COMPLIANCE = {
  vol(pct) { if (pct == null) return T.ink3; const d = Math.abs(pct - 100); return d <= 10 ? COMP_OK : d <= 25 ? COMP_WARN : COMP_BAD },
  zone(diff) { if (diff == null) return T.ink3; const a = Math.abs(diff); return a <= 8 ? COMP_OK : a <= 20 ? COMP_WARN : COMP_BAD },
}

/* ---------- helpers de fecha ---------- */
const fDiaMes = d => format(d, 'dd MMM', { locale: es })
const fMesAno = d => format(d, 'MMM yyyy', { locale: es })
const weeksFrom = (d, inicio) => differenceInDays(d, inicio) / 7

/* ---------- parseo robusto de semana_tipo ---------- */
function parseDia(entrada) {
  if (!entrada) return []
  if (Array.isArray(entrada)) return entrada
  if (typeof entrada === 'string') return entrada ? [{ texto: entrada, color: T.green }] : []
  if (entrada.texto) return [{ texto: entrada.texto, color: entrada.color || T.green }]
  return []
}

/* =================================================================
   COMPONENTES DE PRESENTACIÓN
================================================================= */
function MonoLabel({ children, style }) {
  return <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.6px', textTransform: 'uppercase', color: T.ink3, ...style }}>{children}</div>
}

function Bullets({ text, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {String(text).split('\n').filter(l => l.trim()).map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 9 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 7 }} />
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: T.ink2 }}>{l}</span>
        </div>
      ))}
    </div>
  )
}

function ZonaBar({ values, height = 9 }) {
  const total = values.reduce((s, v) => s + v.v, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', background: T.bg2 }}>
        {values.map((v, i) => v.v > 0 && <div key={i} style={{ width: `${(v.v / total) * 100}%`, background: v.color }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 7 }}>
        {values.map((v, i) => v.v > 0 && (
          <span key={i} style={{ fontFamily: T.mono, fontSize: 10.5, color: v.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: v.color }} />
            {v.label} {Math.round((v.v / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function CargaChip({ carga }) {
  const c = CARGAS[carga]; if (!c) return null
  return <span style={{ fontFamily: T.mono, fontSize: 9.5, color: c.color, background: c.color + '1f', padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.3px' }}>{c.label}</span>
}

function Chevron({ open, size = 12, color = T.ink3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
      <path d="M5 2l5 5-5 5" stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SubSection({ label, color, open, onToggle, children }) {
  return (
    <div>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
        <MonoLabel style={{ color, flex: 1 }}>{label}</MonoLabel>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>{open ? 'ocultar' : 'ver'}</span>
        <Chevron open={open} size={10} />
      </div>
      {open && <div style={{ marginTop: 9 }}>{children}</div>}
    </div>
  )
}

function SemanaTipo({ cliente }) {
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const AB = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const st = cliente?.semana_tipo || {}
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, overflowX: 'auto' }}>
      {DIAS.map((dia, i) => {
        const items = parseDia(st[dia])
        return (
          <div key={dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>{AB[i]}</div>
            <div style={{ width: '100%', minHeight: 56, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: 3, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
              {items.length === 0
                ? <span style={{ fontSize: 9, color: T.ink3 }}>—</span>
                : items.map((it, k) => (
                  <div key={k} style={{ background: (it.color || T.green) + '1f', borderRadius: 4, padding: '3px 2px', textAlign: 'center' }}>
                    <span style={{ fontSize: 8.5, fontWeight: 500, color: it.color || T.green, lineHeight: 1.2 }}>{it.texto}</span>
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* =================================================================
   LÍNEA DE TIEMPO — bloques, subbloques, semanas tocables
================================================================= */
function Timeline({ data, meta, totalSemanas, inicio, semanaActual, enCurso, onJump }) {
  const go = onJump || (() => {})
  const pxSem = 32
  const width = totalSemanas * pxSem
  const posHoy = Math.max(0, Math.min(weeksFrom(new Date(), inicio) * pxSem, width))
  const curIdx = meta.findIndex(m => semanaActual >= m.startGlobal && semanaActual <= m.endGlobal)
  const scRef = useRef(null)

  useEffect(() => { const c = scRef.current; if (c && enCurso) c.scrollLeft = Math.max(0, posHoy - c.clientWidth / 2) }, [posHoy, enCurso])

  function resolveWeek(globalNum) {
    for (let i = 0; i < data.bloques.length; i++) {
      const m = meta[i]
      if (globalNum >= m.startGlobal && globalNum <= m.endGlobal) {
        const b = data.bloques[i]
        const rel = globalNum - m.startGlobal + 1
        const sub = b.subbloques.find(s => rel >= s.semana_inicio && rel <= s.semana_fin)
        return { block: b.id, sub: sub && sub.id, week: `w-${b.id}-${rel}` }
      }
    }
    return {}
  }

  const HOY_TOP = 22, BLOCK_H = 44

  return (
    <div ref={scRef} style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ width, minWidth: '100%', position: 'relative', paddingTop: HOY_TOP }}>
        {enCurso && <>
          <div style={{ position: 'absolute', left: posHoy, top: HOY_TOP - 4, height: BLOCK_H + 8, width: 2, background: T.ink, zIndex: 6 }} />
          <div style={{ position: 'absolute', left: posHoy, top: 0, transform: 'translateX(-50%)', zIndex: 7, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 500, color: '#fff', background: T.ink, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap', letterSpacing: '0.5px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>HOY</div>
            <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `5px solid ${T.ink}` }} />
          </div>
        </>}

        {/* bloques */}
        <div style={{ display: 'flex', gap: 2 }}>
          {data.bloques.map((b, i) => (
            <button key={b.id} onClick={() => go({ block: b.id })} title={`Ir a ${b.nombre}`}
              style={{ width: b.semanas * pxSem - 2, background: b.color || T.green, border: i === curIdx ? '2px solid #1a1916' : '2px solid transparent', borderRadius: 6, padding: '5px 8px', height: BLOCK_H, overflow: 'hidden', cursor: 'pointer', fontFamily: T.font, textAlign: 'left', display: 'block' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.nombre}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>{b.semanas} sem</div>
            </button>
          ))}
        </div>

        {/* subbloques */}
        <div style={{ position: 'relative', height: 20, marginTop: 3 }}>
          {data.bloques.map((b, bi) => {
            const off = meta[bi].startGlobal - 1
            return b.subbloques.map(sub => {
              const l = (off + sub.semana_inicio - 1) * pxSem
              const w = (sub.semana_fin - sub.semana_inicio + 1) * pxSem - 2
              return (
                <button key={sub.id} onClick={() => go({ block: b.id, sub: sub.id })} title={`Ir a ${sub.nombre}`}
                  style={{ position: 'absolute', left: l, width: w, height: 20, background: (b.color || T.green) + '26', border: `1px solid ${(b.color || T.green)}66`, borderRadius: 4, padding: '0 6px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: T.font }}>
                  <span style={{ fontSize: 9, fontWeight: 500, color: b.color || T.green, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.nombre}</span>
                </button>
              )
            })
          })}
        </div>

        {/* competiciones */}
        <div style={{ position: 'relative', height: 30, marginTop: 4 }}>
          {data.competiciones.map(c => {
            const p = weeksFrom(parseISO(c.fecha), inicio) * pxSem
            return (
              <div key={c.id} style={{ position: 'absolute', left: p, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 9, height: 9, background: T.danger, transform: 'rotate(45deg)', borderRadius: 2 }} />
                <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.danger, whiteSpace: 'nowrap', marginTop: 3 }}>{c.nombre}</span>
              </div>
            )
          })}
        </div>

        {/* controles / valoraciones */}
        {data.controles.length > 0 && (
          <div style={{ position: 'relative', height: 26, marginTop: 2 }}>
            {data.controles.map(c => {
              const p = weeksFrom(parseISO(c.fecha), inicio) * pxSem
              return (
                <div key={c.id} title={c.nombre + (c.tipo ? ` · ${c.tipo}` : '')} style={{ position: 'absolute', left: p, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 50 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.surface, border: `2px solid ${T.ctrl}` }} />
                  <span style={{ fontFamily: T.mono, fontSize: 8, color: T.ctrl, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 50, textAlign: 'center', marginTop: 2 }}>{c.tipo || c.nombre}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* números de semana */}
        <div style={{ display: 'flex', borderTop: `1px solid ${T.border}`, paddingTop: 3 }}>
          {Array.from({ length: totalSemanas }, (_, i) => {
            const cur = i + 1 === semanaActual && enCurso
            return (
              <button key={i} onClick={() => go(resolveWeek(i + 1))} title={`Ir a la semana ${i + 1}`}
                style={{ width: pxSem, textAlign: 'center', fontFamily: T.mono, fontSize: 8.5, color: cur ? T.ink : T.ink3, fontWeight: cur ? 700 : 400, background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 0' }}>{i + 1}</button>
            )
          })}
        </div>

        {/* meses */}
        <div style={{ display: 'flex', marginTop: 1 }}>
          {Array.from({ length: totalSemanas }, (_, i) => {
            const f = addWeeks(inicio, i)
            const first = i === 0 || f.getMonth() !== addWeeks(inicio, i - 1).getMonth()
            return (
              <div key={i} style={{ width: pxSem, position: 'relative', height: 14 }}>
                {first && <span style={{ position: 'absolute', left: 0, fontFamily: T.mono, fontSize: 8.5, color: T.green, fontWeight: 500, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{fMesAno(f)}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* =================================================================
   FILA DE SEMANA
================================================================= */
function SemanaRow({ sem, sub, fecha, globalNum, esActual, comp, ctrl, registerRef, weekId }) {
  const [open, setOpen] = useState(false)
  const carga = CARGAS[sem.carga] || CARGAS.media
  const pctKm = sem.km_objetivo && sem.km_real ? Math.round((sem.km_real / sem.km_objetivo) * 100) : null
  const pctColor = COMPLIANCE.vol(pctKm)
  const totalZ = (sem.zona1_2_real || 0) + (sem.zona3_4_real || 0) + (sem.zona5_real || 0)

  return (
    <div ref={el => registerRef && registerRef(weekId, el)} style={{ scrollMarginTop: 80, borderTop: `1px solid ${T.bg2}`, background: esActual ? T.greenL : 'transparent' }}>
      {comp.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', background: T.dangerL }}>
          <div style={{ width: 7, height: 7, background: T.danger, transform: 'rotate(45deg)', borderRadius: 1 }} />
          <span style={{ fontSize: 11.5, fontWeight: 500, color: T.danger }}>{c.nombre}</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.danger, opacity: 0.8 }}>{fDiaMes(parseISO(c.fecha))}</span>
        </div>
      ))}
      {ctrl.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', background: T.ctrlL }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.surface, border: `2px solid ${T.ctrl}`, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 500, color: T.ctrl }}>{c.nombre}</span>
          {c.tipo && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.ctrl, opacity: 0.75 }}>· {c.tipo}</span>}
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ctrl, opacity: 0.8, marginLeft: 'auto' }}>{fDiaMes(parseISO(c.fecha))}</span>
        </div>
      ))}
      <div onClick={() => sem.notas && setOpen(o => !o)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '9px 14px', cursor: sem.notas ? 'pointer' : 'default' }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: esActual ? T.green : carga.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: esActual ? `0 0 0 2px ${T.green}, 0 0 0 4px ${T.greenL}` : 'none' }}>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 500, color: '#fff' }}>S{globalNum}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13, color: T.ink, fontWeight: esActual ? 500 : 400 }}>{sem.objetivo}</span>
            {esActual && <span style={{ fontFamily: T.mono, fontSize: 8.5, fontWeight: 500, color: '#fff', background: T.green, padding: '1px 6px', borderRadius: 4 }}>EN CURSO</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, flexWrap: 'wrap' }}>
            <CargaChip carga={sem.carga} />
            {sem.km_objetivo != null && (
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3 }}>
                obj <b style={{ color: T.ink2, fontWeight: 500 }}>{sem.km_objetivo}km</b>
                {sem.km_real != null && <> · real <b style={{ color: T.ink, fontWeight: 500 }}>{sem.km_real}km</b></>}
              </span>
            )}
            {pctKm != null && <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, color: pctColor }}>{pctKm}%</span>}
          </div>
          {totalZ > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: T.bg2 }}>
                {ZONAS.map(z => { const v = sem[z.real] || 0; return v > 0 && <div key={z.key} style={{ width: `${(v / totalZ) * 100}%`, background: z.color }} /> })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                {ZONAS.map(z => {
                  const v = sem[z.real] || 0; if (!v) return null
                  const real = Math.round((v / totalZ) * 100)
                  const obj = sub ? sub[z.key] : null
                  const diff = obj != null ? real - obj : null
                  return <span key={z.key} style={{ fontFamily: T.mono, fontSize: 9.5, color: COMPLIANCE.zone(diff) }}>{z.label} {real}%</span>
                })}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
          {sem.notas && <Chevron open={open} size={11} />}
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.ink3 }}>{fDiaMes(fecha)}</span>
        </div>
      </div>
      {open && sem.notas && (
        <div style={{ padding: '0 14px 12px 55px' }}>
          <Bullets text={sem.notas} color={T.ink3} />
        </div>
      )}
    </div>
  )
}

/* =================================================================
   SUBBLOQUE
================================================================= */
function Subbloque({ b, sub, startGlobal, semanas, comps, ctrls, inicio, isOpen, onToggle, registerRef }) {
  const [showCont, setShowCont] = useState(true)
  const [showMet, setShowMet] = useState(false)
  const sems = semanas.filter(s => s.numero >= sub.semana_inicio && s.numero <= sub.semana_fin)
  const realTot = ZONAS.map(z => sems.reduce((s, x) => s + (x[z.real] || 0), 0))
  const sumReal = realTot.reduce((a, b) => a + b, 0)
  const hayReal = sumReal > 0
  const semsKm = sems.filter(s => s.km_real != null)
  const kmRealMedio = semsKm.length ? Math.round(semsKm.reduce((s, x) => s + x.km_real, 0) / semsKm.length) : 0
  const kmObjMedio = sub.km_min && sub.km_max ? Math.round((sub.km_min + sub.km_max) / 2) : (sub.km_max || sub.km_min)
  const pctKm = kmObjMedio && kmRealMedio ? Math.round((kmRealMedio / kmObjMedio) * 100) : null
  const kmMax = Math.max(sub.km_max || 0, kmRealMedio, 1)
  const tieneMet = (sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0 || sub.km_min || sub.km_max)

  return (
    <div ref={el => registerRef && registerRef(sub.id, el)} style={{ scrollMarginTop: 80, borderTop: `1px solid ${T.border}` }}>
      <div onClick={onToggle} style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: isOpen ? (b.color || T.green) + '0c' : 'transparent' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color || T.green, flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{sub.nombre}</span>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginLeft: 'auto' }}>S{startGlobal + sub.semana_inicio - 1}–S{startGlobal + sub.semana_fin - 1}</span>
        <Chevron open={isOpen} />
      </div>

      {isOpen && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {sub.notas && (
            <SubSection label="Contenidos" color={b.color || T.green} open={showCont} onToggle={() => setShowCont(v => !v)}>
              <Bullets text={sub.notas} color={b.color || T.green} />
            </SubSection>
          )}

          {tieneMet && (
            <SubSection label="Zonas y volumen" color={b.color || T.green} open={showMet} onToggle={() => setShowMet(v => !v)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(sub.zona1_2 > 0 || sub.zona3_4 > 0 || sub.zona5 > 0) && (
                  <div>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginBottom: 5 }}>OBJETIVO{hayReal ? ' VS REAL' : ''}</div>
                    <ZonaBar values={ZONAS.map(z => ({ v: sub[z.key], color: z.color, label: z.label }))} />
                    {hayReal && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.ink3, marginBottom: 4 }}>REAL ACUMULADO · {sumReal} min</div>
                        <ZonaBar values={ZONAS.map((z, i) => ({ v: realTot[i], color: z.color, label: z.label }))} height={7} />
                      </div>
                    )}
                  </div>
                )}
                {(sub.km_min || sub.km_max) && (
                  <div>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginBottom: 5 }}>VOLUMEN SEMANAL</div>
                    <div style={{ position: 'relative', height: 9, background: T.bg2, borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: `${(sub.km_min / kmMax) * 100}%`, width: `${((sub.km_max - sub.km_min) / kmMax) * 100}%`, top: 0, bottom: 0, background: (b.color || T.green) + '33' }} />
                      {kmRealMedio > 0 && <div style={{ position: 'absolute', left: 0, width: `${Math.min((kmRealMedio / kmMax) * 100, 100)}%`, top: 0, bottom: 0, background: T.green, borderRadius: 5 }} />}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: T.mono, fontSize: 10 }}>
                      <span style={{ color: T.ink3 }}>objetivo <b style={{ color: T.ink2, fontWeight: 500 }}>{sub.km_min}–{sub.km_max} km</b></span>
                      {kmRealMedio > 0 && <span style={{ color: T.ink3 }}>real <b style={{ color: T.ink2, fontWeight: 500 }}>{kmRealMedio} km</b>{pctKm && <> · <b style={{ color: COMPLIANCE.vol(pctKm), fontWeight: 600 }}>{pctKm}%</b></>}</span>}
                    </div>
                  </div>
                )}
              </div>
            </SubSection>
          )}

          <div>
            <MonoLabel style={{ marginBottom: 2 }}>Semanas · {sems.length}</MonoLabel>
            <div style={{ background: T.bg, borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.bg2}` }}>
              {sems.map(sem => {
                const globalNum = startGlobal + sem.numero - 1
                const fechaSem = addWeeks(inicio, globalNum - 1)
                const hoy = new Date()
                const esActual = hoy >= fechaSem && hoy < addWeeks(fechaSem, 1)
                const inWeek = arr => arr.filter(c => { const f = parseISO(c.fecha); return f >= fechaSem && f < addWeeks(fechaSem, 1) })
                return <SemanaRow key={sem.numero} sem={sem} sub={sub} fecha={fechaSem} globalNum={globalNum} esActual={esActual} comp={inWeek(comps)} ctrl={inWeek(ctrls)} registerRef={registerRef} weekId={`w-${b.id}-${sem.numero}`} />
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =================================================================
   BLOQUE — acordeón nivel 1
================================================================= */
function Bloque({ b, idx, m, inicio, comps, ctrls, registerRef, expandido, onToggle, semanaActual, enCurso, subAbierto, onToggleSub }) {
  const esActual = enCurso && semanaActual >= m.startGlobal && semanaActual <= m.endGlobal
  const [showObj, setShowObj] = useState(true)
  const semDone = enCurso ? Math.max(0, Math.min(b.semanas, semanaActual - m.startGlobal + (semanaActual >= m.startGlobal ? 1 : 0))) : (new Date() > addWeeks(inicio, m.endGlobal) ? b.semanas : 0)
  const completado = enCurso ? semanaActual > m.endGlobal : new Date() > addDays(addWeeks(inicio, m.endGlobal), 0)
  const pctBloque = Math.round((Math.min(semDone, b.semanas) / b.semanas) * 100)
  const col = b.color || T.green
  const fin = addDays(addWeeks(parseISO(b.fecha_inicio), b.semanas), -1)

  return (
    <div ref={el => registerRef(b.id, el)} style={{ scrollMarginTop: 80, background: T.surface, border: `1px solid ${esActual ? col + '88' : T.border}`, borderLeft: `4px solid ${col}`, borderRadius: 14, overflow: 'hidden', boxShadow: esActual ? `0 4px 16px ${col}1f` : '0 1px 2px rgba(0,0,0,0.03), 0 6px 16px rgba(0,0,0,0.03)' }}>
      <div onClick={onToggle} style={{ padding: '13px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: col, fontWeight: 500, whiteSpace: 'nowrap' }}>BLOQUE {idx + 1}</span>
            {esActual && <span style={{ fontFamily: T.mono, fontSize: 8.5, fontWeight: 500, color: '#fff', background: col, padding: '1px 6px', borderRadius: 4 }}>EN CURSO</span>}
            {completado && <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.ink3, border: `1px solid ${T.border}`, padding: '1px 6px', borderRadius: 4 }}>COMPLETADO</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginTop: 2, letterSpacing: '-0.2px' }}>{b.nombre}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink3, marginTop: 2 }}>
            {b.semanas} sem · {b.subbloques.length} subbloques · {fDiaMes(parseISO(b.fecha_inicio))}–{fDiaMes(fin)}
          </div>
        </div>
        <Chevron open={expandido} size={14} />
      </div>

      <div style={{ padding: '0 15px 12px' }}>
        <div style={{ height: 4, background: T.bg2, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pctBloque}%`, background: col, borderRadius: 2 }} />
        </div>
      </div>

      {expandido && (
        <div style={{ borderTop: `1px solid ${T.bg2}` }}>
          {b.objetivo && (
            <div style={{ padding: '13px 15px', background: col + '0c', borderBottom: `1px solid ${T.bg2}` }}>
              <SubSection label="Objetivo del bloque" color={col} open={showObj} onToggle={() => setShowObj(v => !v)}>
                <Bullets text={b.objetivo} color={col} />
              </SubSection>
            </div>
          )}
          {b.subbloques.map(sub => (
            <Subbloque key={sub.id} b={b} sub={sub} startGlobal={m.startGlobal} semanas={b.semanasData} comps={comps} ctrls={ctrls} inicio={inicio}
              isOpen={!!subAbierto[sub.id]} onToggle={() => onToggleSub(sub.id)} registerRef={registerRef} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 0' }}>
      <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.6px', textTransform: 'uppercase', color: T.ink3 }}>{children}</span>
      {right}
    </div>
  )
}

/* =================================================================
   COMPONENTE PRINCIPAL
================================================================= */
export default function PlanPublica({ token }) {
  const [plan, setPlan] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [bloques, setBloques] = useState([])
  const [subbloques, setSubbloques] = useState({})
  const [semanas, setSemanas] = useState({})
  const [competiciones, setCompeticiones] = useState([])
  const [controles, setControles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [abierto, setAbierto] = useState({})
  const [subAbierto, setSubAbierto] = useState({})
  const [tlOpen, setTlOpen] = useState(true)
  const [showTop, setShowTop] = useState(false)
  const refs = useRef({})
  const registerRef = (id, el) => { if (el) refs.current[id] = el }

  useEffect(() => { cargar() }, [token])
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 560)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function cargar() {
    const { data: planData } = await supabase
      .from('planificaciones').select('*, clientes(id, nombre, semana_tipo, disponibilidad, consideraciones)')
      .eq('token_publico', token).single()
    if (!planData) { setError(true); setLoading(false); return }
    setPlan(planData); setCliente(planData.clientes)

    const { data: bls } = await supabase.from('bloques').select('*').eq('planificacion_id', planData.id).order('orden')
    setBloques(bls || [])

    if (bls && bls.length > 0) {
      const ids = bls.map(b => b.id)
      const { data: subs } = await supabase.from('subbloques').select('*').in('bloque_id', ids).order('semana_inicio')
      const subsMap = {}; (subs || []).forEach(s => { (subsMap[s.bloque_id] = subsMap[s.bloque_id] || []).push(s) }); setSubbloques(subsMap)
      const { data: sems } = await supabase.from('semanas').select('*').in('bloque_id', ids).order('numero')
      const semsMap = {}; (sems || []).forEach(s => { (semsMap[s.bloque_id] = semsMap[s.bloque_id] || []).push(s) }); setSemanas(semsMap)
    }

    const cid = planData.clientes?.id || planData.cliente_id
    const { data: comps } = await supabase.from('competiciones').select('*').eq('cliente_id', cid).order('fecha')
    setCompeticiones(comps || [])
    const { data: ctrls } = await supabase.from('controles').select('*').eq('cliente_id', cid).order('fecha')
    setControles(ctrls || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: T.font }}>
      <p style={{ color: T.ink3 }}>Cargando planificación…</p>
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: T.font }}>
      <p style={{ color: T.danger }}>Enlace no válido o planificación no encontrada.</p>
    </div>
  )

  /* ---- cálculos ---- */
  const inicio = parseISO(plan.fecha_inicio)
  const fin = parseISO(plan.fecha_fin)
  const totalSemanas = differenceInWeeks(fin, inicio) + 1
  const hoy = new Date()
  const totalDias = Math.max(1, (fin - inicio) / 86400000)
  const diasTrans = Math.max(0, Math.min((hoy - inicio) / 86400000, totalDias))
  const estado = hoy < inicio ? 'pre' : hoy > fin ? 'post' : 'curso'
  const enCurso = estado === 'curso'
  const pct = estado === 'pre' ? 0 : estado === 'post' ? 100 : Math.round((diasTrans / totalDias) * 100)
  const semanaActual = Math.max(1, Math.min(Math.floor(diasTrans / 7) + 1, totalSemanas))

  /* meta: semana global de inicio/fin de cada bloque */
  let acc = 0
  const meta = bloques.map(b => { const startGlobal = acc + 1; acc += b.semanas; return { startGlobal, endGlobal: acc } })

  const bActualIdx = enCurso ? meta.findIndex(m => semanaActual >= m.startGlobal && semanaActual <= m.endGlobal) : -1
  const bActual = bActualIdx >= 0 ? bloques[bActualIdx] : null
  const colA = bActual?.color || T.green
  let subActual = null, semActualData = null
  if (bActual) {
    const rel = semanaActual - meta[bActualIdx].startGlobal + 1
    subActual = (subbloques[bActual.id] || []).find(s => rel >= s.semana_inicio && rel <= s.semana_fin)
    semActualData = (semanas[bActual.id] || []).find(s => s.numero === rel)
  }

  /* datos normalizados para los componentes */
  const data = {
    plan, cliente, competiciones, controles,
    bloques: bloques.map(b => ({ ...b, subbloques: subbloques[b.id] || [], semanasData: semanas[b.id] || [] })),
  }

  const prox = competiciones.map(c => ({ ...c, d: parseISO(c.fecha) })).filter(c => c.d >= hoy).sort((a, b) => a.d - b.d)[0]
  const diasProx = prox ? Math.round((prox.d - hoy) / 86400000) : null

  const allOpen = bloques.length > 0 && bloques.every(b => abierto[b.id])
  const toggleAll = () => { const next = {}; if (!allOpen) bloques.forEach(b => { next[b.id] = true }); setAbierto(next) }

  function jump(t) {
    if (!t) return
    if (t.block) setAbierto(a => ({ ...a, [t.block]: true }))
    if (t.sub) setSubAbierto(s => ({ ...s, [t.sub]: true }))
    const id = t.week || t.sub || t.block
    setTimeout(() => {
      const el = refs.current[id]
      if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 76; window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }) }
    }, 90)
  }

  function faltan(d) {
    const days = Math.round((d - hoy) / 86400000)
    if (days < 0) return 'Realizada'
    if (days === 0) return 'Es hoy'
    const w = Math.floor(days / 7), r = days % 7, parts = []
    if (w > 0) parts.push(`${w} sem`)
    if (r > 0) parts.push(`${r} día${r > 1 ? 's' : ''}`)
    return 'Faltan ' + parts.join(' ')
  }

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 6px 16px rgba(0,0,0,0.03)' }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.font, color: T.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* HEADER sticky */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 18px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <MonoLabel>Planificación</MonoLabel>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', marginTop: 1 }}>{cliente?.nombre}</div>
              <div style={{ fontSize: 12, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.nombre}</div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 600, color: T.green }}>{enCurso ? <>S{semanaActual}<span style={{ color: T.ink3, fontWeight: 400 }}>/{totalSemanas}</span></> : `${totalSemanas} sem`}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginTop: 1 }}>{pct}% completado</div>
            </div>
          </div>
          {bloques.length > 0 && (
            <div style={{ display: 'flex', gap: 7, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
              {bloques.map((b, i) => {
                const act = i === bActualIdx
                return (
                  <button key={b.id} onClick={() => jump({ block: b.id })} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 20, border: `1px solid ${act ? (b.color || T.green) : T.border}`, background: act ? (b.color || T.green) : T.surface, cursor: 'pointer', fontFamily: T.font }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: act ? '#fff' : (b.color || T.green) }} />
                    <span style={{ fontSize: 12, fontWeight: act ? 600 : 500, color: act ? '#fff' : T.ink2, whiteSpace: 'nowrap' }}>{b.nombre}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 18px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* HERO "estás aquí" */}
        <div style={{ ...card, borderLeft: `4px solid ${colA}`, padding: '15px 16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <MonoLabel style={{ color: colA }}>{enCurso ? '● Estás aquí' : estado === 'pre' ? '○ Aún no ha empezado' : '✓ Plan finalizado'}</MonoLabel>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, textTransform: 'capitalize' }}>{format(hoy, 'dd MMM yyyy', { locale: es })}</span>
          </div>
          {enCurso ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px' }}>Semana {semanaActual}</span>
                {bActual && <span style={{ fontSize: 13, color: T.ink2 }}>· {bActual.nombre}{subActual ? ` → ${subActual.nombre}` : ''}</span>}
              </div>
              {semActualData?.objetivo && <div style={{ fontSize: 13.5, color: T.ink2, marginTop: 5, lineHeight: 1.45 }}>{semActualData.objetivo}</div>}
              {bActual && (
                <button onClick={() => jump({ block: bActual.id })} style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 6, background: colA, border: 'none', color: '#fff', fontFamily: T.font, fontSize: 12.5, fontWeight: 500, padding: '7px 13px', borderRadius: 8, cursor: 'pointer' }}>
                  Ver mi bloque actual
                  <svg width="13" height="13" viewBox="0 0 14 14"><path d="M3 7h7M7 3.5L10.5 7 7 10.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
            </>
          ) : (
            <div style={{ fontSize: 14, color: T.ink2, marginTop: 9 }}>
              {estado === 'pre' ? <>Empieza el <b style={{ color: T.ink }}>{format(inicio, "d 'de' MMMM", { locale: es })}</b>. {faltan(inicio)}.</> : <>Completado el {format(fin, "d 'de' MMMM yyyy", { locale: es })}.</>}
            </div>
          )}

          {/* progreso global */}
          <div style={{ marginTop: 13 }}>
            <div style={{ height: 6, background: T.bg2, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                {bloques.map(b => <div key={b.id} style={{ width: `${(b.semanas / totalSemanas) * 100}%`, borderRight: `1px solid ${T.surface}`, background: b.color || T.green, opacity: 0.18 }} />)}
              </div>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: colA, borderRadius: 3 }} />
            </div>
            {enCurso && (
              <div style={{ position: 'relative', height: 0 }}>
                <div style={{ position: 'absolute', left: `${pct}%`, top: -9, transform: 'translateX(-50%)', width: 3, height: 12, background: T.ink, borderRadius: 2, boxShadow: `0 0 0 2px ${T.surface}` }} />
              </div>
            )}
          </div>

          {/* próxima competición */}
          {prox && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.bg2}` }}>
              <div style={{ width: 9, height: 9, background: T.danger, transform: 'rotate(45deg)', borderRadius: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{prox.nombre}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3 }}>{prox.tipo ? `${prox.tipo} · ` : ''}{fDiaMes(prox.d)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 600, color: T.danger }}>{diasProx}</div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3 }}>días · {Math.floor(diasProx / 7)} sem</div>
              </div>
            </div>
          )}
        </div>

        {/* LÍNEA DE TIEMPO */}
        {bloques.length > 0 && (
          <div style={card}>
            <div onClick={() => setTlOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 15px', cursor: 'pointer' }}>
              <MonoLabel style={{ flex: 1 }}>Línea de tiempo · {totalSemanas} semanas</MonoLabel>
              <Chevron open={tlOpen} size={13} />
            </div>
            {tlOpen && (
              <div style={{ padding: '0 15px 14px' }}>
                <Timeline data={data} meta={meta} totalSemanas={totalSemanas} inicio={inicio} semanaActual={semanaActual} enCurso={enCurso} onJump={jump} />
                <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.bg2}`, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 9.5, color: T.ink3 }}>
                    <span style={{ width: 8, height: 8, background: T.danger, transform: 'rotate(45deg)', borderRadius: 1 }} /> Competición
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 9.5, color: T.ink3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.surface, border: `2px solid ${T.ctrl}` }} /> Control / valoración
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BLOQUES */}
        {bloques.length > 0 && (
          <SectionLabel right={
            <button onClick={toggleAll} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, color: T.ink2, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
              {allOpen ? 'Cerrar todo' : 'Abrir todo'}
            </button>
          }>Bloques de entrenamiento</SectionLabel>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {data.bloques.map((b, i) => (
            <Bloque key={b.id} b={b} idx={i} m={meta[i]} inicio={inicio} comps={competiciones} ctrls={controles}
              registerRef={registerRef} expandido={!!abierto[b.id]} onToggle={() => setAbierto(a => ({ ...a, [b.id]: !a[b.id] }))}
              semanaActual={semanaActual} enCurso={enCurso} subAbierto={subAbierto} onToggleSub={(id) => setSubAbierto(s => ({ ...s, [id]: !s[id] }))} />
          ))}
        </div>

        {/* SEMANA TIPO */}
        {cliente?.semana_tipo && (
          <>
            <SectionLabel>Semana tipo</SectionLabel>
            <div style={{ ...card, padding: '14px 14px 12px' }}>
              <SemanaTipo cliente={cliente} />
              {cliente?.disponibilidad && (
                <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.bg2}` }}>
                  <MonoLabel style={{ marginBottom: 5 }}>Disponibilidad</MonoLabel>
                  <div style={{ fontSize: 13, color: T.ink2 }}>{cliente.disponibilidad}</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* CONSIDERACIONES */}
        {cliente?.consideraciones && (
          <>
            <SectionLabel>Consideraciones</SectionLabel>
            <div style={{ ...card, padding: '14px 16px' }}>
              <Bullets text={cliente.consideraciones} color={colA} />
            </div>
          </>
        )}

        {/* COMPETICIONES */}
        {competiciones.length > 0 && (
          <>
            <SectionLabel>Competiciones</SectionLabel>
            <div style={{ ...card, padding: '6px 0' }}>
              {competiciones.map((c, i) => {
                const d = parseISO(c.fecha), fut = d >= hoy
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderTop: i ? `1px solid ${T.bg2}` : 'none' }}>
                    <div style={{ width: 11, height: 11, background: T.danger, transform: 'rotate(45deg)', borderRadius: 2, flexShrink: 0, opacity: fut ? 1 : 0.4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink3 }}>{c.tipo ? `${c.tipo} · ` : ''}{fDiaMes(d)}</div>
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 500, color: fut ? T.danger : T.ink3, textAlign: 'right', flexShrink: 0 }}>{faltan(d)}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* CONTROLES / VALORACIONES */}
        {controles.length > 0 && (
          <>
            <SectionLabel>Controles y valoraciones</SectionLabel>
            <div style={{ ...card, padding: '6px 0' }}>
              {controles.map((c, i) => {
                const d = parseISO(c.fecha), fut = d >= hoy
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderTop: i ? `1px solid ${T.bg2}` : 'none' }}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: T.surface, border: `2.5px solid ${T.ctrl}`, flexShrink: 0, opacity: fut ? 1 : 0.4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink3 }}>{c.tipo ? `${c.tipo} · ` : ''}{fDiaMes(d)}</div>
                      {c.notas && <div style={{ fontSize: 12, color: T.ink2, marginTop: 3, lineHeight: 1.4 }}>{c.notas}</div>}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 500, color: fut ? T.ctrl : T.ink3, textAlign: 'right', flexShrink: 0 }}>{faltan(d)}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 9.5, color: T.ink3, marginTop: 6 }}>
          Las sesiones del día a día se desarrollan en TrainingPeaks
        </div>
      </div>

      {/* volver arriba */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ position: 'fixed', right: 18, bottom: 22, width: 44, height: 44, borderRadius: '50%', background: T.ink, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 13V4M4 7.5L8 3.5l4 4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  )
}
