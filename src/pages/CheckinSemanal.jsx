import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

const T = {
  bg: '#f8f7f4',
  card: '#ffffff',
  text: '#1a1a1a',
  text2: '#6b6b6b',
  text3: '#9b9b9b',
  border: '#e8e5e0',
  accent: '#2d6a4f',
  accentLight: '#e8f5f0',
  warning: '#b45309',
  warningLight: '#fef3c7',
  mono: 'ui-monospace, monospace',
}

function ScaleButtons({ labels, selected, onSelect, color = T.accent }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {labels.map((label, i) => {
        const n = i + 1
        const isSelected = selected === n
        return (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div onClick={() => onSelect(n)}
              style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `1.5px solid ${isSelected ? color : T.border}`, background: isSelected ? color : T.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: isSelected ? '#fff' : T.text2 }}>{n}</span>
            </div>
            <span style={{ fontSize: 9, color: T.text3, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function RadioOptions({ options, selected, onSelect, color = T.accent, bgColor, borderColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(op => {
        const isSelected = selected === op
        return (
          <div key={op} onClick={() => onSelect(op)}
            style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${isSelected ? borderColor || color : T.border}`, background: isSelected ? bgColor || T.accentLight : T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${isSelected ? color : T.border}`, background: isSelected ? color : 'transparent', flexShrink: 0, transition: 'all 0.15s' }} />
            <span style={{ fontSize: 13, color: isSelected ? color : T.text }}>{op}</span>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ icon, title, color, bgColor, borderColor }) {
  return (
    <div style={{ padding: '12px 16px 10px', background: bgColor, borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <p style={{ fontSize: 12, fontWeight: 600, color, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</p>
    </div>
  )
}

export default function CheckinSemanal() {
  const token = window.location.pathname.split('/checkin/')[1]
  const [semana, setSemana] = useState(null)
  const [bloque, setBloque] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviado, setEnviado] = useState(false)
  const [yaRespondido, setYaRespondido] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [energia, setEnergia] = useState(null)
  const [descanso, setDescanso] = useState(null)
  const [horasSueno, setHorasSueno] = useState(null)
  const [molestias, setMolestias] = useState(null)
  const [zonas, setZonas] = useState([{ zona: '', intensidad: 0 }])
  const [agujetas, setAgujetas] = useState(null)
  const [agujetasDetalle, setAgujetasDetalle] = useState('')
  const [tolerancia, setTolerancia] = useState(null)
  const [comparativa, setComparativa] = useState(null)
  const [comentario, setComentario] = useState('')

  useEffect(() => { if (token) cargarDatos() }, [token])

  async function cargarDatos() {
    setLoading(true)
    const { data: sem } = await supabase.from('semanas').select('*, bloques(*, planificaciones(cliente_id))').eq('token_publico', token).single()
    if (!sem) { setLoading(false); return }
    setSemana(sem)
    setBloque(sem.bloques)
    const clienteId = sem.bloques?.planificaciones?.cliente_id
    if (clienteId) {
      const { data: cli } = await supabase.from('clientes').select('nombre').eq('id', clienteId).single()
      setCliente(cli)
    }
    const { data: existing } = await supabase.from('checkin_semanal').select('id').eq('semana_id', sem.id).maybeSingle()
    if (existing) setYaRespondido(true)
    setLoading(false)
  }

  async function enviar() {
    if (!semana) return
    setEnviando(true)
    const clienteId = semana.bloques?.planificaciones?.cliente_id
    const molestiaZonas = molestias && molestias !== 'No' ? zonas.filter(z => z.zona.trim()) : null
    const { error } = await supabase.from('checkin_semanal').insert({
      cliente_id: clienteId,
      semana_id: semana.id,
      energia,
      descanso,
      horas_sueno: horasSueno,
      molestias,
      molestias_zonas: molestiaZonas,
      agujetas,
      agujetas_detalle: agujetasDetalle || null,
      tolerancia_carga: tolerancia,
      comparativa_semanas: comparativa,
      comentario_libre: comentario || null,
    })
    setEnviando(false)
    if (error) {
      alert('No se pudo enviar el check-in. Inténtalo de nuevo.')
      return
    }
    setEnviado(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: T.text2, fontSize: 14 }}>Cargando...</p>
    </div>
  )

  if (!semana) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <p style={{ color: T.text2, fontSize: 14, textAlign: 'center' }}>Este enlace no es válido o ha caducado.</p>
    </div>
  )

  if (enviado) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
        <h2 style={{ fontSize: 20, fontWeight: 500, color: T.text, margin: '0 0 10px' }}>¡Gracias!</h2>
        <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: 0 }}>Tu check-in semanal se ha enviado correctamente. Tu entrenadora lo revisará antes de planificar la siguiente semana.</p>
      </div>
    </div>
  )

  if (yaRespondido) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <h2 style={{ fontSize: 20, fontWeight: 500, color: T.text, margin: '0 0 10px' }}>Ya respondiste este check-in</h2>
        <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: 0 }}>El check-in de esta semana ya fue enviado correctamente.</p>
      </div>
    </div>
  )

  const fechaInicio = bloque?.fecha_inicio ? format(addWeeks(parseISO(bloque.fecha_inicio), semana.numero - 1), 'dd MMM', { locale: es }) : ''
  const fechaFin = bloque?.fecha_inicio ? format(addWeeks(parseISO(bloque.fecha_inicio), semana.numero), 'dd MMM yyyy', { locale: es }) : ''

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>

        <div style={{ background: '#1a1a2e', padding: '24px 20px 28px', borderRadius: '0 0 20px 20px', marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{cliente?.nombre}</p>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#fff', margin: '0 0 4px' }}>Sensaciones de semana</h1>
          {fechaInicio && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 16px' }}>{fechaInicio} – {fechaFin} · Semana {semana.numero}</p>}
          {semana.objetivo && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Objetivo de la semana</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.5 }}>{semana.objetivo}</p>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '14px 0 0', lineHeight: 1.5 }}>Valora brevemente cómo ha ido la semana. Tus sensaciones son importantes para ajustar el entrenamiento de forma individualizada.</p>
        </div>

        <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, margin: '0 12px 12px', overflow: 'hidden' }}>
          <SectionHeader icon="⚡" title="Energía y descanso" color="#1d4ed8" bgColor="#eff6ff" borderColor="#bfdbfe" />
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo ha sido tu nivel de energía esta semana?</p>
              <ScaleButtons labels={['Muy bajo','Bajo','Normal','Bueno','Muy bueno']} selected={energia} onSelect={setEnergia} color="#1d4ed8" />
            </div>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo valorarías la calidad de tu descanso?</p>
              <ScaleButtons labels={['Muy mala','Mala','Regular','Buena','Muy buena']} selected={descanso} onSelect={setDescanso} color="#1d4ed8" />
            </div>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cuántas horas has dormido de media por noche?</p>
              <RadioOptions options={['Menos de 5h','5–6h','6–7h','7–8h','Más de 8h']} selected={horasSueno} onSelect={setHorasSueno} color="#1d4ed8" bgColor="#eff6ff" borderColor="#bfdbfe" />
            </div>
          </div>
        </div>

        <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, margin: '0 12px 12px', overflow: 'hidden' }}>
          <SectionHeader icon="🛡️" title="Molestias y recuperación" color="#b45309" bgColor="#fffbeb" borderColor="#fde68a" />
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Has tenido molestias o dolor esta semana?</p>
              <RadioOptions options={['No','Sí, leve','Sí, moderado','Sí, alto']} selected={molestias} onSelect={setMolestias} color="#b45309" bgColor="#fffbeb" borderColor="#fde68a" />
            </div>
            {molestias && molestias !== 'No' && (
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: 14, border: '1px solid #fde68a' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#b45309', margin: '0 0 10px' }}>Zona y nivel de molestia</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {zonas.map((z, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" placeholder="Ej: rodilla derecha" value={z.zona}
                        onChange={e => setZonas(zs => zs.map((x, j) => j === i ? { ...x, zona: e.target.value } : x))}
                        style={{ flex: 1, fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #fde68a', background: '#fff', minWidth: 0, fontFamily: 'inherit' }} />
                      <span style={{ fontSize: 11, color: T.text3, flexShrink: 0 }}>0</span>
                      <input type="range" min="0" max="10" value={z.intensidad}
                        onChange={e => setZonas(zs => zs.map((x, j) => j === i ? { ...x, intensidad: parseInt(e.target.value) } : x))}
                        style={{ width: 60, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#b45309', minWidth: 16, flexShrink: 0 }}>{z.intensidad}</span>
                    </div>
                  ))}
                  <button onClick={() => setZonas(zs => [...zs, { zona: '', intensidad: 0 }])}
                    style={{ fontSize: 12, color: '#b45309', background: 'none', border: '1px dashed #fde68a', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Añadir zona
                  </button>
                </div>
              </div>
            )}
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo han sido las agujetas o fatiga muscular?</p>
              <RadioOptions options={['No he tenido','Leves y normales','Moderadas, tolerables','Altas, me han limitado','Muy altas, varios días']} selected={agujetas} onSelect={setAgujetas} color="#b45309" bgColor="#fffbeb" borderColor="#fde68a" />
              <textarea placeholder="Después de qué sesión y en qué zona (opcional)..." value={agujetasDetalle} onChange={e => setAgujetasDetalle(e.target.value)}
                style={{ width: '100%', marginTop: 8, fontSize: 13, padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, boxSizing: 'border-box', minHeight: 72, resize: 'none', fontFamily: 'inherit', color: T.text }} />
            </div>
          </div>
        </div>

        <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, margin: '0 12px 12px', overflow: 'hidden' }}>
          <SectionHeader icon="💪" title="Carga y sensaciones" color="#065f46" bgColor="#ecfdf5" borderColor="#a7f3d0" />
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Cómo has tolerado la carga de entrenamiento?</p>
              <RadioOptions options={['Muy fácil','Fácil','Adecuada','Exigente, pero asumible','Demasiado exigente']} selected={tolerancia} onSelect={setTolerancia} color={T.accent} bgColor={T.accentLight} borderColor="#6ee7b7" />
            </div>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>Respecto a semanas anteriores, ¿cómo notas tu cuerpo?</p>
              <RadioOptions options={['Mejor','Igual','Algo peor','Claramente peor','No lo sé']} selected={comparativa} onSelect={setComparativa} color={T.accent} bgColor={T.accentLight} borderColor="#6ee7b7" />
            </div>
            <div>
              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', fontWeight: 500 }}>¿Hay algo que quieras comentar sobre esta semana?</p>
              <textarea placeholder="Escribe aquí lo que quieras..." value={comentario} onChange={e => setComentario(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, boxSizing: 'border-box', minHeight: 88, resize: 'none', fontFamily: 'inherit', color: T.text }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '4px 12px 0' }}>
          <button onClick={enviar} disabled={enviando}
            style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: T.accent, color: '#fff', fontSize: 15, fontWeight: 500, cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1, fontFamily: 'inherit' }}>
            {enviando ? 'Enviando...' : 'Enviar respuestas'}
          </button>
          <p style={{ fontSize: 12, color: T.text3, textAlign: 'center', margin: '10px 0 0' }}>Tu entrenadora recibirá este check-in antes de planificar la siguiente semana.</p>
        </div>

      </div>
    </div>
  )
}
