import { useState, useRef, useEffect } from 'react'

// ── Categorías completas de emojis estándar ────────────────────────────────
const EMOJI_CATS = [
  {
    label: '😀', title: 'Caritas',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🫡','🤔','🫣','🤭','🤫','🤥','😶','🫥','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮‍💨','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  },
  {
    label: '👋', title: 'Personas & Gestos',
    emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄','🫦','🧑','👶','🧒','👦','👧','👱','👴','👵','🧓','👲','🧔','💂','🕵️','👩‍⚕️','👨‍⚕️','👩‍🌾','👨‍🍳','👩‍🎤','👩‍🏫','👩‍🏭','👩‍💼','👩‍🔧','👩‍🔬','👩‍🎨','👩‍✈️','👩‍🚀','👩‍🚒','🧖','🧘','🛀','🧗','🏇','⛷️','🏂','🏌️','🏄','🚣','🧜','🏊','⛹️','🏋️','🚴','🤸','🤼','🤺','🥊','🧑‍🤝‍🧑','👫','👬','👭','👪','🗣️','👤','👥'],
  },
  {
    label: '🐶', title: 'Animales & Naturaleza',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔','🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🎋','🍃','🍂','🍁','🍄','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌟','⭐','🌠','⛅','☁️','🌤️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','🌬️','💨','🌈','🌊','🌀','🌫️','🌈','⚡','🔥','💧','🌊'],
  },
  {
    label: '🍕', title: 'Comida & Bebida',
    emojis: ['🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥐','🥖','🫓','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥢','🧂'],
  },
  {
    label: '✈️', title: 'Viajes & Lugares',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚏','🛣️','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🗼','🗽','⛪','🕌','🛕','⛩️','🕍','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🗾','🎑','🏔️','✈️','🛫','🛬','🪂','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚞','🚋','🚍','🚘','🚖','🛺','🚡','🚠','🚟','🚃','🛤️','⛽','🛞','🚥','🚦','🛑','🚧','⚓','🛟','🪝','⛵','🏁','🚩','🎌','🏴','🌍','🌎','🌏','🗺️','🧭','🌐'],
  },
  {
    label: '⚽', title: 'Deportes & Actividad',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥊','🥋','🎯','🏹','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','🤼','🤺','🏇','🧗','🏄','🚣','🤽','🚴','⛹️','🏌️','🤾','🏊','🎣','🤿','🥅','⛳','🎽','🧢','👟','🥇','🥈','🥉','🏆','🏅','🎖️','🎗️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎮','🕹️','🎰','🎳','🎯','🪀','🪁','🧩','🪆','🪅'],
  },
  {
    label: '💡', title: 'Objetos',
    emojis: ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','💸','💵','💴','💶','💷','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','🪤','🧲','💣','🪓','🔫','🪃','🏹','🛡️','🪝','🧲','🔑','🗝️','🔐','🔒','🔓','🧪','🧫','🧬','🔬','🔭','📡','💊','💉','🩺','🩻','🩹','🩼','🩸','🧸','🪆','🖼️','🪞','🚪','🛏️','🛋️','🪑','🚽','🪠','🚿','🛁','🪣','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🪤','🛒','🚬','⚰️','🪦','🧿','💈','⚗️','🔮','🧿','📿','💒','🪬','🧸','🎀','🎁','🎊','🎉','🎈','🎏','🎐','🎑','🧧','🎀','🎆','🎇','✨','🎍','🥣','🪴','📦','📫','📪','📬','📭','📮','📬','📣','📢','💬','💭','💯','📝','📋','📁','📂','📊','📈','📉','📅','📆','📇','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔏','🔐','🗝️','🔑','🪝','🔨','⛏️','🪓','🗡️','🪃','🏹','🛡️','🪚','🔧','⚙️','🗜️','🔩','⚗️','🔬','🔭','📡','💡'],
  },
  {
    label: '🔣', title: 'Símbolos',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🪯','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚻','🚼','⬆️','↗️','➡️','↘️','⬇️','↙️','⬅️','↖️','↕️','↔️','↩️','↪️','⤴️','⤵️','🔃','🔄','🔙','🔚','🔛','🔜','🔝','🛐','⚛️','🔀','🔁','🔂','▶️','⏩','⏭️','⏯️','◀️','⏪','⏮️','🔼','⏫','🔽','⏬','⏸️','⏹️','⏺️','⏏️','🎦','🔇','🔈','🔉','🔊','📢','📣','📯','🔔','🔕','🎵','🎶','✔️','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔛','🔜','⚕️','♻️','⚜️','🏁','🚩','🎌','🏴','🏳️'],
  },
]

// Mapa de búsqueda expandido
const EMOJI_SEARCH = {
  '💪':'fuerza brazos musculo bíceps','🏃':'correr carrera run running','🏋️':'pesas gym peso levantamiento','🧘':'yoga meditacion stretching flexibilidad',
  '🚴':'bici ciclismo spinning','🏊':'nadar natacion piscina','🔥':'fuego calor intensidad quema','⚡':'rayo energia electrico velocidad',
  '🎯':'diana objetivo meta precision','🌟':'estrella brillo excelencia','⚽':'futbol balon soccer','🏀':'baloncesto basket','🎾':'tenis padel raqueta',
  '🥊':'boxeo puñetazo combate','🧗':'escalada trepar','🤸':'gimnasia acrobacia flexibilidad','🏄':'surf ola playa',
  '🤽':'waterpolo agua','🚣':'remo kayak canoa','🤼':'lucha combate','⛹️':'baloncesto saltar','🏇':'equitacion caballo',
  '🏌️':'golf','🏹':'arco flecha tiro','🎣':'pesca pescar','🤿':'buceo snorkel agua','💥':'explosion impacto potencia',
  '💫':'mareo energía','🦵':'pierna cuadriceps','🦶':'pie tobillo','🫀':'corazon cardio frecuencia','🧠':'cerebro mental cognitivo',
  '🦴':'hueso estructura','🩺':'medico salud clinico','🩻':'rayos X hueso','⏱️':'tiempo cronometro','📊':'grafica datos estadistica',
  '🏆':'trofeo campeon premio','🥇':'oro primero podio','❤️':'corazon amor','🌊':'ola agua mar','❄️':'frio hielo recuperacion',
  '☀️':'sol calor','🎿':'ski nieve invierno','⛷️':'esqui nieve montana','🏂':'snowboard','🪂':'paracaidas salto',
  '🏅':'medalla premio','🛹':'skateboard','⛸️':'patinaje hielo','🏸':'badminton','🏓':'ping pong tenis mesa',
  '🥋':'karate judo artes marciales','🎽':'ropa deportiva camiseta','👟':'zapatillas running','😤':'esfuerzo concentracion',
  '🥵':'calor agotado','💊':'pastilla medicina suplemento','🩹':'herida recuperacion','🧬':'biologia genetica',
  '🔬':'ciencia laboratorio','✅':'completado hecho ok check','🔁':'repeticion ciclo','💡':'idea plan estrategia',
  '🗓️':'calendario fecha planificacion','🧑‍💻':'codigo tech','😀':'sonrisa feliz','😢':'triste llorar',
  '🥰':'amor cariño bonito','🤔':'pensar reflexionar','😎':'cool fresco','🤯':'sorpresa flipar',
  '💤':'dormir descanso sueño recuperacion','⭐':'estrella logro','🌈':'arcoiris','🔑':'clave importante',
  '📝':'notas apuntes escribir','📅':'fecha calendario','⏰':'alarma tiempo','🚀':'velocidad potencia lanzamiento',
}

export default function EmojiPicker({ value, onChange, multi = false }) {
  const [abierto, setAbierto] = useState(false)
  const [cat, setCat] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef(null)
  const panelRef = useRef(null)

  const selected = multi
    ? (value ? value.split(' ').filter(Boolean) : [])
    : []

  useEffect(() => {
    if (!abierto) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  function seleccionar(ico) {
    if (multi) {
      const next = selected.includes(ico)
        ? selected.filter(e => e !== ico)
        : [...selected, ico]
      onChange(next.join(' '))
    } else {
      onChange(value === ico ? '' : ico)
      setAbierto(false)
    }
  }

  const todosEmojis = [...new Set(EMOJI_CATS.flatMap(c => c.emojis))]
  const q = busqueda.toLowerCase().trim()
  const lista = q
    ? todosEmojis.filter(e => (EMOJI_SEARCH[e] || '').toLowerCase().includes(q) || e === q)
    : EMOJI_CATS[cat].emojis

  const displayValue = multi ? (selected.length > 0 ? selected.join(' ') : null) : value

  // Posición del panel
  function panelStyle() {
    if (!ref.current) return {}
    const r = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const top = spaceBelow > 340 ? r.bottom + 4 : r.top - 344
    const left = Math.min(r.left, window.innerWidth - 344)
    return { top, left }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 26, minWidth: 36, textAlign: 'center', letterSpacing: 2 }}>
          {displayValue || '💪'}
        </div>
        <button type="button" className="btn btn-ghost btn-sm"
          onClick={() => { setAbierto(v => !v); setBusqueda(''); setCat(0) }}>
          {abierto ? 'Cerrar' : '😊 Elegir icono'}
        </button>
        {displayValue && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--text3)' }}
            onClick={() => { onChange(''); setAbierto(false) }}>
            ✕ Quitar
          </button>
        )}
      </div>

      {multi && selected.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {selected.map(ico => (
            <span key={ico} style={{ fontSize: 20, cursor: 'pointer', padding: '2px 4px', borderRadius: 6, border: '1.5px solid var(--accent)', background: 'var(--accent-light)' }}
              title="Clic para quitar" onClick={() => seleccionar(ico)}>
              {ico}
            </span>
          ))}
        </div>
      )}

      {abierto && (
        <div style={{
          position: 'fixed',
          zIndex: 9999,
          width: 340,
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--bg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          ...panelStyle(),
        }}>
          {/* Buscador */}
          <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--border)' }}>
            <input className="form-input" placeholder="Buscar emoji..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={{ fontSize: 13 }} autoFocus />
          </div>

          {/* Tabs categorías */}
          {!busqueda && (
            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '4px 6px', gap: 2, scrollbarWidth: 'none' }}>
              {EMOJI_CATS.map((c, i) => (
                <button key={i} type="button" onClick={() => { setCat(i); if (panelRef.current) panelRef.current.scrollTop = 0 }}
                  title={c.title}
                  style={{ fontSize: 16, padding: '4px 8px', borderRadius: 8, border: 'none', background: cat === i ? 'var(--accent-light,#e8f5f0)' : 'transparent', outline: cat === i ? '1.5px solid var(--accent)' : 'none', cursor: 'pointer', flexShrink: 0 }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Título de categoría */}
          {!busqueda && (
            <div style={{ padding: '4px 12px 2px', fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {EMOJI_CATS[cat].title}
            </div>
          )}

          {/* Grid */}
          <div ref={panelRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 1, padding: '6px 8px 10px', maxHeight: 260, overflowY: 'auto' }}>
            {lista.map((ico, idx) => {
              const sel = multi ? selected.includes(ico) : value === ico
              return (
                <button key={ico + idx} type="button" onClick={() => seleccionar(ico)}
                  title={EMOJI_SEARCH[ico] || ico}
                  style={{ fontSize: 22, width: 36, height: 36, borderRadius: 6, border: `2px solid ${sel ? 'var(--accent)' : 'transparent'}`, background: sel ? 'var(--accent-light,#e8f5f0)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}>
                  {ico}
                </button>
              )
            })}
            {lista.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 4px' }}>Sin resultados para "{busqueda}"</span>}
          </div>

          {multi && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAbierto(false)}>Listo</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
