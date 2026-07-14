import { useState, useRef, useEffect } from 'react'

const EMOJI_CATS = [
  { label: '⭐ Recientes', emojis: ['💪','🏃','🏋️','🧘','🚴','🏊','🔥','⚡','🎯','🌟','🦵','🫀','🧠','🩺','🏆','🥇','⏱️'] },
  { label: '⚽ Deportes', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥊','🥋','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏆','🥇','🥈','🥉','🎖️','🏅','🎣','🤿','🏹','⛳','🥅','🎽','🧢','👟'] },
  { label: '🏃 Actividad', emojis: ['🏃','🚶','🧍','🧎','🏋️','🤸','🧘','🤼','🤺','🏇','🧗','🏄','🚣','🤽','🚴','🏊','🤾','🏌️','⛹️','🥊','🪃','🪁'] },
  { label: '💪 Cuerpo', emojis: ['💪','🦾','🦵','🦶','🖐️','👟','🩺','🩻','❤️','🫀','🫁','🧠','👁️','🦷','🦴','🩹','💉','💊','🌡️','🧬','🔬'] },
  { label: '⚡ Energía', emojis: ['🔥','⚡','💥','💫','✨','🌟','⭐','🌊','🌬️','❄️','☀️','🌙','🌈','🎆','💢','🔆','🌀'] },
  { label: '🎯 Objetos', emojis: ['🎯','⏱️','⏰','🕐','📊','📈','📉','🗓️','📋','✅','🔁','💡','🧩','🎲','🪙','🧰','⚙️','🔩','🪛','🔧','🩺','🌡️','🧪','📝','🗒️','📌','🗂️','📁'] },
  { label: '😊 Caras', emojis: ['😤','😅','😓','🥵','🥶','😵','🤯','😎','🤩','😁','😊','🙂','😶','😴','🥱','🤒','😷','🤕','💪','🦸'] },
  { label: '🌿 Naturaleza', emojis: ['🌿','🌱','🌾','🍃','🌲','🌳','🌴','🍀','🌻','🌺','🌸','🌼','🍎','🍊','🍋','🥑','🥦','🫐','🍓'] },
  { label: '🎵 Varios', emojis: ['🎵','🎶','🎸','🥁','🎺','🎻','🎹','🎤','🎧','🎬','🎮','🕹️','🎭','🎨','✏️','📚','💻','📱','🖥️','⌚','🔋','💡','🕯️','🔦'] },
]

const EMOJI_SEARCH = {
  '💪': 'fuerza brazos musculo','🏃': 'correr carrera run','🏋️': 'pesas gym peso','🧘': 'yoga meditacion stretching','🚴': 'bici ciclismo spinning',
  '🏊': 'nadar natacion piscina','🔥': 'fuego calor intensidad','⚡': 'rayo energia electrico','🎯': 'diana objetivo meta','🌟': 'estrella brillo',
  '⚽': 'futbol balon','🏀': 'baloncesto basket','🎾': 'tenis padel','🥊': 'boxeo puñetazo','🧗': 'escalada trepar',
  '🤸': 'gimnasia acrobacia','🏄': 'surf ola playa','🤽': 'waterpolo agua','🚣': 'remo kayak','🤼': 'lucha combate',
  '⛹️': 'baloncesto saltar','🏇': 'equitacion caballo','🤺': 'esgrima espada','🏌️': 'golf','🏹': 'arco flecha',
  '🎣': 'pesca pescar','🤿': 'buceo snorkel agua','💥': 'explosion impacto','💫': 'mareo energía','🦵': 'pierna cuadriceps',
  '🦶': 'pie tobillo','🫀': 'corazon cardio','🧠': 'cerebro mental','🦴': 'hueso estructura','🩺': 'medico salud',
  '🩻': 'rayos X hueso','⏱️': 'tiempo cronometro','📊': 'grafica datos','🏆': 'trofeo campeon','🥇': 'oro primero podio',
  '❤️': 'corazon amor','🌊': 'ola agua mar','❄️': 'frio hielo','☀️': 'sol calor','🎿': 'ski nieve invierno',
  '⛷️': 'esqui nieve montana','🏂': 'snowboard','🪂': 'paracaidas salto','🏅': 'medalla premio','🛹': 'skateboard',
  '⛸️': 'patinaje hielo','🏸': 'badminton','🏓': 'ping pong tenis mesa','🥋': 'karate judo artes marciales',
  '🎽': 'ropa deportiva camiseta','👟': 'zapatillas running','😤': 'esfuerzo concentracion','🥵': 'calor agotado',
  '💊': 'pastilla medicina','🩹': 'herida recuperacion','🧬': 'biologia genetica','🔬': 'ciencia laboratorio',
  '✅': 'completado hecho ok','🔁': 'repeticion ciclo','💡': 'idea plan','🗓️': 'calendario fecha',
}

export default function EmojiPicker({ value, onChange }) {
  const [abierto, setAbierto] = useState(false)
  const [cat, setCat] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  function seleccionar(ico) {
    onChange(value === ico ? '' : ico)
    setAbierto(false)
  }

  const todosEmojis = [...new Set(EMOJI_CATS.flatMap(c => c.emojis))]
  const q = busqueda.toLowerCase().trim()
  const lista = q
    ? todosEmojis.filter(e => (EMOJI_SEARCH[e] || '').includes(q) || e === q)
    : EMOJI_CATS[cat].emojis

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 26, minWidth: 36, textAlign: 'center' }}>{value || '💪'}</div>
        <button type="button" className="btn btn-ghost btn-sm"
          onClick={() => { setAbierto(v => !v); setBusqueda(''); setCat(0) }}>
          {abierto ? 'Cerrar' : '😊 Elegir icono'}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--text3)' }}
            onClick={() => { onChange(''); setAbierto(false) }}>
            ✕ Quitar
          </button>
        )}
      </div>

      {abierto && (
        <div style={{
          position: 'fixed',
          zIndex: 9999,
          width: 320,
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--bg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          top: ref.current ? (() => {
            const r = ref.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - r.bottom
            return spaceBelow > 300 ? r.bottom + 4 : r.top - 304
          })() : 100,
          left: ref.current ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 328) : 0,
        }}>
          {/* Buscador */}
          <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--border)' }}>
            <input className="form-input" placeholder="Buscar... (fuerza, cardio, yoga...)"
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={{ fontSize: 13 }} autoFocus />
          </div>

          {/* Tabs categorías */}
          {!busqueda && (
            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '4px 8px', gap: 2 }}>
              {EMOJI_CATS.map((c, i) => (
                <button key={i} type="button" onClick={() => setCat(i)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: 'none', background: cat === i ? 'var(--accent-light,#e8f5f0)' : 'transparent', color: cat === i ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: cat === i ? 600 : 400 }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '10px', maxHeight: 220, overflowY: 'auto' }}>
            {lista.map((ico, idx) => {
              const sel = value === ico
              return (
                <button key={ico + idx} type="button" onClick={() => seleccionar(ico)} title={EMOJI_SEARCH[ico] || ico}
                  style={{ fontSize: 22, width: 38, height: 38, borderRadius: 8, border: `2px solid ${sel ? 'var(--accent)' : 'transparent'}`, background: sel ? 'var(--accent-light,#e8f5f0)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {ico}
                </button>
              )
            })}
            {lista.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 4px' }}>Sin resultados</span>}
          </div>
        </div>
      )}
    </div>
  )
}
