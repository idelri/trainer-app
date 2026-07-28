/**
 * Clasificador conservador de ejercicios.
 *
 * Recibe los campos de texto disponibles y devuelve únicamente los valores
 * de la taxonomía oficial que pueden inferirse con alta confianza.
 * Si existe duda → el campo queda vacío.
 *
 * Jerarquía de prioridad:
 *   1. ejecucion_tipo (selección explícita del entrenador — máxima fiabilidad)
 *   2. Arquetipo claro en nombre/notas/ejecucion_texto
 *   3. Vacío
 *
 * La firma de entrada/salida está diseñada para poder sustituir
 * esta implementación por un clasificador externo sin tocar el schema.
 */

import { ETIQUETAS } from './taxonomia'

// Valores válidos por campo, derivados de ETIQUETAS (fuente única de taxonomía)
export const VALORES_VALIDOS = Object.fromEntries(
  Object.entries(ETIQUETAS).map(([campo, config]) => [
    campo,
    config.grupos.flatMap(g => g.items),
  ])
)

// ─── Reglas de texto libre ────────────────────────────────────────────────────
// Cada regla: { campo, valor, test(texto) → bool }
// Una regla toca exactamente un campo y emite exactamente un valor.
// El valor DEBE existir en TAXONOMIA[campo] (verificado en el test de validación).
// Principio: si existe duda → no emitir.

const REGLAS_TEXTO = [

  // ── tipo_contraccion ──────────────────────────────────────────────────────
  {
    campo: 'tipo_contraccion',
    valor: 'Isométrica',
    test: t => /isométric|isometric|isometría/i.test(t),
  },
  {
    campo: 'tipo_contraccion',
    valor: 'Excéntrica acentuada',
    // Solo si se menciona explícitamente la acentuación excéntrica en texto libre.
    // "Nordic" o "lento" solos no son suficientes.
    test: t => /excéntric[ao]\s+acentuad|acentuación\s+excéntric|excéntric[ao]\s+enfatizad|trabajo\s+excéntric/i.test(t),
  },

  // ── material ─────────────────────────────────────────────────────────────
  {
    campo: 'material',
    valor: 'Sin material / peso corporal',
    test: t => /\bpeso\s+corporal\b|bodyweight|sin\s+material\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Mancuernas',
    test: t => /\bmancuerna|\bdumbbell|\bdb\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Kettlebell',
    test: t => /kettlebell|\bkb\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Barra',
    // Solo "barbell" o "barra" explícitos — NO inferir por el nombre del ejercicio
    test: t => /\bbarbell\b|\bbarra\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Polea',
    test: t => /\bpolea\b|\bcable\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Goma elástica',
    // "goma" sola en contexto fitness se refiere a goma elástica; también las variantes compuestas
    test: t => /\bgoma\b|\bgoma\s+elástica|\belastic\s+band|\bbanda\s+elástica/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Mini-band',
    test: t => /miniband|mini[\s-]band/i.test(t),
  },
  {
    campo: 'material',
    valor: 'TRX / suspensión',
    test: t => /\btrx\b|suspensión\b|suspension\s+trainer/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Fitball',
    test: t => /fitball|swiss\s+ball/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Foam roller',
    test: t => /foam\s+roller|rodillo\s+de\s+foam/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Cajón / step',
    test: t => /\bcajón\b|\bstep\b|\bbox\s+jump|\bbox\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Banco',
    test: t => /\bbanco\b|\bbench\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Bosu / superficie inestable',
    test: t => /\bbosu\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Trineo',
    test: t => /\btrineo\b|\bsled\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Cinta de correr',
    test: t => /cinta\s+de\s+correr|treadmill/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Bicicleta',
    test: t => /\bbicicleta\b|\bcycling\b|\bbike\b/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Remoergómetro',
    test: t => /remoe?rgómetro|rowing\s+machine|concept\s*2/i.test(t),
  },
  {
    campo: 'material',
    valor: 'Assault bike / air bike',
    test: t => /assault\s+bike|air\s+bike/i.test(t),
  },

  // ── patron_movimiento ─────────────────────────────────────────────────────
  {
    campo: 'patron_movimiento',
    valor: 'Dominante de cadera',
    test: t => /\brdl\b|romanian\s+deadlift|peso\s+muerto\s+rumano|hip\s+hinge|hip\s+thrust|puente\s+de\s+glúteo|glute\s+bridge|pull\s+through\b/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Dominante de rodilla',
    // Incluye split squat y búlgara: el patrón de movimiento es dominante de rodilla
    // La lateralidad (Split) se infiere por separado en lateralidad_apoyo
    test: t => /\bsentadilla\b|\bsquat\b|\bgoblet\b|\bleg\s+press\b|\bhack\s+squat\b|\bpistol\b|split\s+squat|zancada|lunge|\bbúlgara\b|bulgarian/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Pliometría y salto',
    test: t => /\bsalto\b|\bjump\b|pliométr|plyometr|\bhop\b/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Carrera y locomoción',
    test: t => /\bcarrera\b|\bsprint\b|\brun(ning)?\b/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Empuje horizontal',
    test: t => /press\s+banca|bench\s+press|press\s+horizontal|push[\s-]up|\bfondos?\b/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Empuje vertical',
    test: t => /press\s+militar|overhead\s+press|\bohp\b|press\s+vertical|shoulder\s+press/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Tracción horizontal',
    test: t => /\bremo\b|\brow\b|tracción\s+horizontal/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Tracción vertical',
    test: t => /dominada|pull[\s-]?up|chin[\s-]?up|lat\s+pulldown|jalón\b/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Anti-extensión',
    test: t => /anti[\s-]?extensión|deadbug|dead\s+bug|\bplank\b|\bplancha\b/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Anti-rotación',
    test: t => /anti[\s-]?rotación|pallof/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Anti-flexión lateral',
    test: t => /anti[\s-]?flexión\s+lateral|suitcase|farmer.{0,10}unilateral/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Abducción / Rotación externa',
    test: t => /abducción|clamshell|fire\s+hydrant|rotación\s+externa/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Flexión de tronco',
    test: t => /\bcrunch\b|\bsit[\s-]?up\b|curl\s+de\s+(tronco|abdominal)/i.test(t),
  },
  {
    campo: 'patron_movimiento',
    valor: 'Control lumbopélvico',
    test: t => /control\s+lumbopélvico|disociación\s+lumbopélvica/i.test(t),
  },

  // ── lateralidad_apoyo ─────────────────────────────────────────────────────
  {
    campo: 'lateralidad_apoyo',
    valor: 'Monopodal',
    test: t => /monopodal|single[\s-]leg|\ba\s+una\s+pierna\b|unipodal/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Asimétrico (Split)',
    test: t => /split\s+squat|zancada|lunge|\bbúlgara\b|bulgarian/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Cuadrupedia',
    test: t => /cuadrupedia|quadruped|cuatro\s+apoyos/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Plancha / Suspensión',
    test: t => /\bplancha\b|\bplank\b/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Decúbito supino',
    test: t => /decúbito\s+supino|tumbado\s+boca\s+arriba|supine/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Decúbito prono',
    test: t => /decúbito\s+prono|tumbado\s+boca\s+abajo|prone/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Decúbito lateral',
    test: t => /decúbito\s+lateral|lateral\s+lying/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Sentado',
    test: t => /\bsentado\b|\bseated\b/i.test(t),
  },
  {
    campo: 'lateralidad_apoyo',
    valor: 'Carga unilateral',
    test: t => /carga\s+unilateral|single[\s-]arm|a\s+un\s+brazo/i.test(t),
  },

  // ── objetivo ──────────────────────────────────────────────────────────────
  {
    campo: 'objetivo',
    valor: 'Movilidad / Flexibilidad',
    test: t => /\bmovilidad\b|\bmobility\b|\bflexibilidad\b|\bflexibility\b|\bestiramiento\b|\bstretching?\b/i.test(t),
  },
  {
    campo: 'objetivo',
    valor: 'Potencia / Velocidad',
    test: t => /\bpotencia\b|\bpower\b|\bexplosivo\b|\bexplosive\b|\bvelocidad\b|\bvelocity\b/i.test(t),
  },
  {
    campo: 'objetivo',
    valor: 'Técnica / Control motor',
    test: t => /control\s+motor|técnica\b|motor\s+control|coordinación/i.test(t),
  },

  // ── nivel_aproximacion — solo cuando el texto es suficientemente explícito ──
  {
    campo: 'nivel_aproximacion',
    valor: '0− Complementario / estructural',
    // Ejercicios de movilidad, flexibilidad o estiramiento tienen baja transferencia al gesto deportivo
    test: t => /\bmovilidad\b|\bmobility\b|\bflexibilidad\b|\bflexibility\b|\bestiramiento\b|\bstretching?\b/i.test(t),
  },
  {
    campo: 'nivel_aproximacion',
    valor: 'IV Reactivo / específico abierto',
    // Solo cuando el texto explicita reacción ante un estímulo externo
    test: t => /reactivo.{0,25}(señal|estímulo|visual|auditivo)|ante\s+(señal|estímulo\s+visual|estímulo\s+auditivo)|con\s+estímulo\s+(visual|auditivo)|reacci[oó]n\s+(visual|auditiva|ante)/i.test(t),
  },
  {
    campo: 'nivel_aproximacion',
    valor: 'V Competitivo',
    // Solo cuando el texto indica partido, juego real o situación competitiva completa
    test: t => /partido\s+\d+\s*(vs?\.?|contra|×)\s*\d+|juego\s+real|competici[oó]n\s+(real|completa)|partido\s+(oficial|amistoso)|situaci[oó]n\s+competitiva/i.test(t),
  },

  // ── zona_corporal ─────────────────────────────────────────────────────────
  {
    campo: 'zona_corporal',
    valor: 'Cadena Posterior',
    test: t => /\bglút(eo)?|\bglute\b|\bisquio|\bhamstring|\bcadena\s+posterior\b/i.test(t),
  },
  {
    campo: 'zona_corporal',
    valor: 'Cadena Anterior',
    test: t => /\bcuádricep|\bquad\b|\bcadena\s+anterior\b/i.test(t),
  },
  {
    campo: 'zona_corporal',
    valor: 'Abdominal',
    test: t => /\babdominal\b|\bcore\b|\bcrunch\b|\bsit[\s-]?up\b/i.test(t),
  },
  {
    campo: 'zona_corporal',
    valor: 'Dorsal / Torácico',
    test: t => /\bdorsal\b|\blatissimus|\blat\b|\btorácic|\bthoracic/i.test(t),
  },
  {
    campo: 'zona_corporal',
    valor: 'Cadena Medial / Aductores',
    test: t => /\baductor|\bgroin\b|cadena\s+medial/i.test(t),
  },
  {
    campo: 'zona_corporal',
    valor: 'Gemelos / Sóleos',
    test: t => /\bgemelo|\bsóleo|\bcalf\b|\bcalves\b/i.test(t),
  },
]

// ─── Reglas de ejecucion_tipo (selección explícita del entrenador) ────────────
// Tienen prioridad máxima porque son datos estructurados, no inferencia.
// Los valores de ejecucion_tipo son: Explosiva, Controlada, Control excéntrico,
// Con pausa, Técnica prioritaria, Máxima estabilidad, Rango completo, Personalizado

const REGLAS_EJECUCION = [
  {
    campo: 'tipo_contraccion',
    valor: 'Excéntrica acentuada',
    test: et => et === 'Control excéntrico',
  },
  {
    campo: 'objetivo',
    valor: 'Potencia / Velocidad',
    test: et => et === 'Explosiva',
  },
  {
    campo: 'objetivo',
    valor: 'Técnica / Control motor',
    test: et => et === 'Técnica prioritaria',
  },
]

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * @param {{
 *   nombre?: string,
 *   notas?: string,
 *   ejecucion_tipo?: string,
 *   ejecucion_texto?: string,
 * }} campos
 * @returns {Partial<Record<keyof TAXONOMIA, string[]>>}
 *
 * Solo devuelve campos con inferencia de alta confianza.
 * Campos sin inferencia no aparecen en el resultado (no se devuelven como []).
 */
export function clasificarEjercicio({ nombre = '', notas = '', ejecucion_tipo = '', ejecucion_texto = '' } = {}) {
  const resultado = {}

  function añadir(campo, valor) {
    if (!resultado[campo]) resultado[campo] = []
    if (!resultado[campo].includes(valor)) resultado[campo].push(valor)
  }

  // 1. Reglas de ejecucion_tipo (prioridad alta — selección explícita)
  for (const regla of REGLAS_EJECUCION) {
    if (regla.test(ejecucion_tipo)) añadir(regla.campo, regla.valor)
  }

  // 2. Reglas de texto libre (nombre + notas + ejecucion_texto)
  const texto = `${nombre} ${notas} ${ejecucion_texto}`.trim()
  if (texto) {
    for (const regla of REGLAS_TEXTO) {
      if (regla.test(texto)) añadir(regla.campo, regla.valor)
    }
  }

  return resultado
}
