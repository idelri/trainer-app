// ── COMPLEJOS ARTICULARES ─────────────────────────────────────────────────────
// Cada nodo hoja tiene: id (único en DB), label (visible), canonical_id (solo JS).
// Los IDs de grupo también se almacenan en DB cuando todos sus hijos están seleccionados.
// canonical_id permite agrupar la misma estructura que aparece en varios complejos.

export const COMPLEJOS = [
  {
    id: 'pie_tobillo',
    label: 'Pie y Tobillo',
    emoji: '🦶',
    color: '#0891b2',
    grupos: [
      {
        id: 'pie_tobillo:musculatura_intrinseca',
        label: 'Musculatura intrínseca',
        children: [
          { id: 'pie_tobillo:intrinsecos_dedos', label: 'Intrínsecos de los dedos', canonical_id: 'intrinsecos_dedos_pie' },
          { id: 'pie_tobillo:boveda_plantar', label: 'Bóveda plantar', canonical_id: 'boveda_plantar' },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_anterior',
        label: 'Compartimento anterior',
        children: [
          { id: 'pie_tobillo:tibial_anterior', label: 'Tibial anterior', canonical_id: 'tibial_anterior' },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_posterior_profundo',
        label: 'Compartimento posterior profundo',
        children: [
          { id: 'pie_tobillo:tibial_posterior', label: 'Tibial posterior', canonical_id: 'tibial_posterior' },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_lateral',
        label: 'Compartimento lateral',
        children: [
          { id: 'pie_tobillo:peroneos', label: 'Peroneos', canonical_id: 'peroneos' },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_posterior_superficial',
        label: 'Compartimento posterior superficial',
        children: [
          { id: 'pie_tobillo:soleo', label: 'Sóleo', canonical_id: 'soleo' },
          { id: 'pie_tobillo:gemelos', label: 'Gemelos', canonical_id: 'gemelos' },
        ],
      },
    ],
  },
  {
    id: 'rodilla',
    label: 'Rodilla',
    emoji: '🦵',
    color: '#7c3aed',
    grupos: [
      {
        id: 'rodilla:compartimento_anterior',
        label: 'Compartimento anterior',
        children: [
          { id: 'rodilla:cuadriceps', label: 'Cuádriceps', canonical_id: 'cuadriceps' },
          { id: 'rodilla:recto_femoral', label: 'Recto femoral', canonical_id: 'recto_femoral' },
        ],
      },
      {
        id: 'rodilla:compartimento_posterior',
        label: 'Compartimento posterior',
        children: [
          { id: 'rodilla:isquiotibiales', label: 'Isquiotibiales', canonical_id: 'isquiotibiales' },
          { id: 'rodilla:popliteo', label: 'Poplíteo', canonical_id: 'popliteo' },
        ],
      },
      {
        id: 'rodilla:compartimento_medial',
        label: 'Compartimento medial',
        children: [
          { id: 'rodilla:sartorio', label: 'Sartorio', canonical_id: 'sartorio' },
          { id: 'rodilla:gracil', label: 'Grácil', canonical_id: 'gracil' },
          { id: 'rodilla:pata_de_ganso', label: 'Pata de ganso', canonical_id: 'pata_de_ganso' },
        ],
      },
      {
        id: 'rodilla:compartimento_lateral',
        label: 'Compartimento lateral',
        children: [
          { id: 'rodilla:biceps_femoral', label: 'Bíceps femoral', canonical_id: 'biceps_femoral' },
          { id: 'rodilla:cintilla_iliotibial', label: 'Cintilla iliotibial', canonical_id: 'cintilla_iliotibial' },
        ],
      },
    ],
  },
  {
    id: 'cadera',
    label: 'Cadera',
    emoji: '🦴',
    color: '#b45309',
    grupos: [
      {
        id: 'cadera:compartimento_anterior',
        label: 'Compartimento anterior',
        children: [
          { id: 'cadera:psoas_iliaco', label: 'Psoas-ilíaco', canonical_id: 'psoas_iliaco' },
          { id: 'cadera:recto_femoral', label: 'Recto femoral', canonical_id: 'recto_femoral' },
          { id: 'cadera:sartorio', label: 'Sartorio', canonical_id: 'sartorio' },
        ],
      },
      {
        id: 'cadera:compartimento_posterior',
        label: 'Compartimento posterior',
        children: [
          { id: 'cadera:gluteo_mayor', label: 'Glúteo mayor', canonical_id: 'gluteo_mayor' },
          { id: 'cadera:isquiotibiales', label: 'Isquiotibiales', canonical_id: 'isquiotibiales' },
        ],
      },
      {
        id: 'cadera:compartimento_lateral',
        label: 'Compartimento lateral',
        children: [
          { id: 'cadera:gluteo_medio', label: 'Glúteo medio', canonical_id: 'gluteo_medio' },
          { id: 'cadera:gluteo_menor', label: 'Glúteo menor', canonical_id: 'gluteo_menor' },
          { id: 'cadera:tfl', label: 'Tensor de la fascia lata (TFL)', canonical_id: 'tfl' },
        ],
      },
      {
        id: 'cadera:compartimento_medial',
        label: 'Compartimento medial',
        children: [
          { id: 'cadera:aductor_mayor', label: 'Aductor mayor', canonical_id: 'aductor_mayor' },
          { id: 'cadera:aductor_largo', label: 'Aductor largo', canonical_id: 'aductor_largo' },
          { id: 'cadera:aductor_corto', label: 'Aductor corto', canonical_id: 'aductor_corto' },
          { id: 'cadera:pectineo', label: 'Pectíneo', canonical_id: 'pectineo' },
          { id: 'cadera:gracil', label: 'Grácil', canonical_id: 'gracil' },
        ],
      },
      {
        id: 'cadera:rotadores_profundos',
        label: 'Rotadores profundos',
        children: [
          { id: 'cadera:rotadores_externos_profundos', label: 'Rotadores externos profundos', canonical_id: 'rotadores_externos_profundos' },
        ],
      },
    ],
  },
  {
    id: 'raquis',
    label: 'Raquis',
    emoji: '🦴',
    color: '#166534',
    grupos: [
      {
        id: 'raquis:region_cervical',
        label: 'Región cervical',
        children: [
          { id: 'raquis:flexores_cervicales_profundos', label: 'Flexores cervicales profundos', canonical_id: 'flexores_cervicales_profundos' },
          { id: 'raquis:extensores_cervicales', label: 'Extensores cervicales', canonical_id: 'extensores_cervicales' },
        ],
      },
      {
        id: 'raquis:region_toracica',
        label: 'Región torácica',
        children: [
          { id: 'raquis:extensores_toracicos', label: 'Extensores torácicos', canonical_id: 'extensores_toracicos' },
          { id: 'raquis:rotadores_toracicos', label: 'Rotadores torácicos', canonical_id: 'rotadores_toracicos' },
        ],
      },
      {
        id: 'raquis:region_lumbar',
        label: 'Región lumbar',
        children: [
          { id: 'raquis:erectores_lumbares', label: 'Erectores lumbares', canonical_id: 'erectores_lumbares' },
          { id: 'raquis:multifidos', label: 'Multífidos', canonical_id: 'multifidos' },
          { id: 'raquis:cuadrado_lumbar', label: 'Cuadrado lumbar', canonical_id: 'cuadrado_lumbar' },
        ],
      },
      {
        id: 'raquis:core_anterior',
        label: 'Core anterior',
        children: [
          { id: 'raquis:recto_abdominal', label: 'Recto abdominal', canonical_id: 'recto_abdominal' },
          { id: 'raquis:transverso_abdominal', label: 'Transverso abdominal', canonical_id: 'transverso_abdominal' },
        ],
      },
      {
        id: 'raquis:core_lateral',
        label: 'Core lateral',
        children: [
          { id: 'raquis:oblicuo_interno', label: 'Oblicuo interno', canonical_id: 'oblicuo_interno' },
          { id: 'raquis:oblicuo_externo', label: 'Oblicuo externo', canonical_id: 'oblicuo_externo' },
        ],
      },
      {
        id: 'raquis:complejo_respiratorio_pelvico',
        label: 'Complejo respiratorio y pélvico',
        children: [
          { id: 'raquis:diafragma', label: 'Diafragma', canonical_id: 'diafragma' },
          { id: 'raquis:suelo_pelvico', label: 'Suelo pélvico', canonical_id: 'suelo_pelvico' },
        ],
      },
    ],
  },
  {
    id: 'hombro',
    label: 'Hombro',
    emoji: '💪',
    color: '#be185d',
    grupos: [
      {
        id: 'hombro:compartimento_anterior',
        label: 'Compartimento anterior',
        children: [
          { id: 'hombro:deltoides_anterior', label: 'Deltoides anterior', canonical_id: 'deltoides_anterior' },
          { id: 'hombro:pectoral_mayor', label: 'Pectoral mayor', canonical_id: 'pectoral_mayor' },
        ],
      },
      {
        id: 'hombro:compartimento_superior',
        label: 'Compartimento superior',
        children: [
          { id: 'hombro:trapecio_superior', label: 'Trapecio superior', canonical_id: 'trapecio_superior' },
          { id: 'hombro:elevador_escapula', label: 'Elevador de la escápula', canonical_id: 'elevador_escapula' },
        ],
      },
      {
        id: 'hombro:compartimento_lateral',
        label: 'Compartimento lateral',
        children: [
          { id: 'hombro:deltoides_medio', label: 'Deltoides medio', canonical_id: 'deltoides_medio' },
          { id: 'hombro:supraespinoso', label: 'Supraespinoso', canonical_id: 'supraespinoso' },
        ],
      },
      {
        id: 'hombro:compartimento_posterior',
        label: 'Compartimento posterior',
        children: [
          { id: 'hombro:deltoides_posterior', label: 'Deltoides posterior', canonical_id: 'deltoides_posterior' },
          { id: 'hombro:infraespinoso', label: 'Infraespinoso', canonical_id: 'infraespinoso' },
          { id: 'hombro:redondo_menor', label: 'Redondo menor', canonical_id: 'redondo_menor' },
          { id: 'hombro:redondo_mayor', label: 'Redondo mayor', canonical_id: 'redondo_mayor' },
        ],
      },
      {
        id: 'hombro:compartimento_escapular',
        label: 'Compartimento escapular',
        children: [
          { id: 'hombro:trapecio_medio', label: 'Trapecio medio', canonical_id: 'trapecio_medio' },
          { id: 'hombro:trapecio_inferior', label: 'Trapecio inferior', canonical_id: 'trapecio_inferior' },
          { id: 'hombro:romboides', label: 'Romboides', canonical_id: 'romboides' },
          { id: 'hombro:serrato_anterior', label: 'Serrato anterior', canonical_id: 'serrato_anterior' },
        ],
      },
      {
        id: 'hombro:compartimento_anterior_profundo',
        label: 'Compartimento anterior profundo',
        children: [
          { id: 'hombro:subescapular', label: 'Subescapular', canonical_id: 'subescapular' },
        ],
      },
    ],
  },
  {
    id: 'codo_antebrazo',
    label: 'Codo y Antebrazo',
    emoji: '💪',
    color: '#0f766e',
    grupos: [
      {
        id: 'codo_antebrazo:compartimento_anterior',
        label: 'Compartimento anterior',
        children: [
          { id: 'codo_antebrazo:biceps_braquial', label: 'Bíceps braquial', canonical_id: 'biceps_braquial' },
          { id: 'codo_antebrazo:braquial', label: 'Braquial', canonical_id: 'braquial' },
          { id: 'codo_antebrazo:braquiorradial', label: 'Braquiorradial', canonical_id: 'braquiorradial' },
        ],
      },
      {
        id: 'codo_antebrazo:compartimento_posterior',
        label: 'Compartimento posterior',
        children: [
          { id: 'codo_antebrazo:triceps_braquial', label: 'Tríceps braquial', canonical_id: 'triceps_braquial' },
          { id: 'codo_antebrazo:anconeo', label: 'Ancóneo', canonical_id: 'anconeo' },
        ],
      },
      {
        id: 'codo_antebrazo:compartimento_flexor',
        label: 'Compartimento flexor',
        children: [
          { id: 'codo_antebrazo:flexores_muneca', label: 'Flexores de muñeca', canonical_id: 'flexores_muneca' },
          { id: 'codo_antebrazo:flexores_dedos', label: 'Flexores de dedos', canonical_id: 'flexores_dedos' },
        ],
      },
      {
        id: 'codo_antebrazo:compartimento_extensor',
        label: 'Compartimento extensor',
        children: [
          { id: 'codo_antebrazo:extensores_muneca', label: 'Extensores de muñeca', canonical_id: 'extensores_muneca' },
          { id: 'codo_antebrazo:extensores_dedos', label: 'Extensores de dedos', canonical_id: 'extensores_dedos' },
        ],
      },
      {
        id: 'codo_antebrazo:pronosupinadores',
        label: 'Pronosupinadores',
        children: [
          { id: 'codo_antebrazo:pronadores', label: 'Pronadores', canonical_id: 'pronadores' },
          { id: 'codo_antebrazo:supinadores', label: 'Supinadores', canonical_id: 'supinadores' },
        ],
      },
    ],
  },
  {
    id: 'mano_muneca',
    label: 'Mano y Muñeca',
    emoji: '🤲',
    color: '#4f46e5',
    grupos: [
      {
        id: 'mano_muneca:compartimento_flexor',
        label: 'Compartimento flexor',
        children: [
          { id: 'mano_muneca:flexores_muneca', label: 'Flexores de muñeca', canonical_id: 'flexores_muneca' },
          { id: 'mano_muneca:flexores_dedos', label: 'Flexores de dedos', canonical_id: 'flexores_dedos' },
        ],
      },
      {
        id: 'mano_muneca:compartimento_extensor',
        label: 'Compartimento extensor',
        children: [
          { id: 'mano_muneca:extensores_muneca', label: 'Extensores de muñeca', canonical_id: 'extensores_muneca' },
          { id: 'mano_muneca:extensores_dedos', label: 'Extensores de dedos', canonical_id: 'extensores_dedos' },
        ],
      },
      {
        id: 'mano_muneca:musculatura_intrinseca',
        label: 'Musculatura intrínseca',
        children: [
          { id: 'mano_muneca:eminencia_tenar', label: 'Eminencia tenar', canonical_id: 'eminencia_tenar' },
          { id: 'mano_muneca:eminencia_hipotenar', label: 'Eminencia hipotenar', canonical_id: 'eminencia_hipotenar' },
          { id: 'mano_muneca:interoseos', label: 'Interóseos', canonical_id: 'interoseos' },
          { id: 'mano_muneca:lumbricales', label: 'Lumbricales', canonical_id: 'lumbricales' },
        ],
      },
      {
        id: 'mano_muneca:agarre',
        label: 'Agarre',
        children: [
          { id: 'mano_muneca:fuerza_agarre', label: 'Fuerza de agarre', canonical_id: 'fuerza_agarre' },
          { id: 'mano_muneca:pinza', label: 'Pinza', canonical_id: 'pinza' },
        ],
      },
    ],
  },
]

// ── SECCIONES DE CLASIFICACIÓN ────────────────────────────────────────────────
// tipo 'complejos' → usa COMPLEJOS + helpers de jerarquía
// tipo 'grupos'    → grupos con items planos (chips multi-select)
// tipo 'chips'     → lista plana de chips multi-select
//
// Los editores iteran este array sin lógica específica por sección.

export const SECCIONES_CLASIFICACION = [
  {
    tipo: 'complejos',
    label: 'Estructura implicada',
    campoPrincipal: 'complejo_articular',
    campoEstructura: 'estructura_anatomica',
    color: '#374151',
  },
  {
    tipo: 'grupos',
    label: 'Patrón de movimiento',
    campo: 'patron_movimiento',
    color: '#7c3aed',
    grupos: [
      { grupo: 'Tren inferior', items: ['Dominante de rodilla', 'Dominante de cadera', 'Dominante de tobillo', 'Abducción', 'Aducción', 'Rotación', 'Carrera / locomoción', 'Cambio de dirección', 'Salto / aterrizaje'] },
      { grupo: 'Tren superior', items: ['Empuje horizontal', 'Empuje vertical', 'Tracción horizontal', 'Tracción vertical', 'Estabilidad escapular'] },
      { grupo: 'Core', items: ['Anti-extensión', 'Anti-rotación', 'Anti-flexión lateral', 'Anti-flexión frontal', 'Rotación de tronco', 'Flexión de tronco', 'Control lumbopélvico'] },
    ],
  },
  {
    tipo: 'grupos',
    label: 'Lateralidad y apoyo',
    campo: 'lateralidad_apoyo',
    color: '#065f46',
    grupos: [
      { grupo: 'Tipo de apoyo', items: ['Bilateral', 'Monopodal', 'Asimétrico (Split)', 'Cuadrupedia', 'Plancha / Suspensión', 'Decúbito prono', 'Decúbito supino', 'Decúbito lateral', 'Sentado'] },
      { grupo: 'Ejecución', items: ['Carga bilateral', 'Carga unilateral', 'Unilateral alterno', 'Contralateral', 'Ipsilateral'] },
    ],
  },
  {
    tipo: 'chips',
    label: 'Plano de movimiento',
    campo: 'plano_movimiento',
    color: '#0369a1',
    items: ['Sagital', 'Frontal', 'Transversal', 'Multiplanar'],
  },
  {
    tipo: 'chips',
    label: 'Tipo de contracción',
    campo: 'tipo_contraccion',
    color: '#be185d',
    items: ['Dinámica', 'Isométrica', 'Excéntrica acentuada', 'Isoinercial'],
  },
  {
    tipo: 'grupos',
    label: 'Material',
    campo: 'material',
    color: '#475569',
    grupos: [
      { grupo: 'Sin equipamiento', items: ['Sin material / peso corporal', 'Colchoneta / esterilla'] },
      { grupo: 'Pesos libres', items: ['Mancuernas', 'Kettlebell', 'Barra', 'Discos', 'Balón medicinal'] },
      { grupo: 'Máquinas y poleas', items: ['Máquina guiada', 'Polea'] },
      { grupo: 'Elásticos y suspensión', items: ['Goma elástica', 'Mini-band', 'TRX / suspensión'] },
      { grupo: 'Accesorios', items: ['Fitball', 'Foam roller', 'Cajón / step', 'Banco', 'Bosu / superficie inestable', 'Sliders / plataforma deslizante', 'Trineo', 'Valla / cono / escalera'] },
      { grupo: 'Cardio', items: ['Cinta de correr', 'Bicicleta', 'Remoergómetro', 'Assault bike / air bike', 'Ergómetro ski', 'Elíptica'] },
    ],
  },
]

// Todos los campos DB de clasificación (útil para EMPTY states y selects)
export const CAMPOS_CLASIFICACION = ['complejo_articular', 'estructura_anatomica', 'patron_movimiento', 'lateralidad_apoyo', 'plano_movimiento', 'tipo_contraccion', 'material']

// ── HELPERS DE JERARQUÍA ─────────────────────────────────────────────────────

// Mapa rápido: id → nodo (complejo, grupo o hijo)
const _idToNode = new Map()
COMPLEJOS.forEach(c => {
  _idToNode.set(c.id, { type: 'complejo', node: c })
  c.grupos.forEach(g => {
    _idToNode.set(g.id, { type: 'grupo', node: g, complejoId: c.id })
    g.children.forEach(h => {
      _idToNode.set(h.id, { type: 'hijo', node: h, grupoId: g.id, complejoId: c.id })
    })
  })
})

export function estadoGrupo(grupo, estructuraIds) {
  const childIds = grupo.children.map(c => c.id)
  const n = childIds.filter(id => estructuraIds.includes(id)).length
  if (n === 0) return 'empty'
  if (n === childIds.length) return 'full'
  return 'partial'
}

export function toggleGrupo(grupo, estructuraIds) {
  const childIds = grupo.children.map(c => c.id)
  const estado = estadoGrupo(grupo, estructuraIds)
  if (estado === 'full') {
    const quitar = new Set([grupo.id, ...childIds])
    return estructuraIds.filter(id => !quitar.has(id))
  }
  return [...new Set([...estructuraIds, grupo.id, ...childIds])]
}

export function toggleEstructura(childId, grupo, estructuraIds) {
  let next
  const childIds = grupo.children.map(c => c.id)
  if (estructuraIds.includes(childId)) {
    next = estructuraIds.filter(id => id !== childId && id !== grupo.id)
  } else {
    next = [...estructuraIds, childId]
    if (childIds.every(id => next.includes(id))) {
      next = [...new Set([...next, grupo.id])]
    }
  }
  return next
}

// Deriva complejo_articular automáticamente desde estructura_anatomica
export function derivarComplejos(estructuraIds) {
  const complejoSet = new Set()
  for (const id of estructuraIds) {
    const prefijo = id.split(':')[0]
    if (COMPLEJOS.some(c => c.id === prefijo)) complejoSet.add(prefijo)
  }
  return [...complejoSet]
}

// Etiqueta visible para un ID de estructura
export function labelDeId(id) {
  const entry = _idToNode.get(id)
  return entry ? entry.node.label : id
}

// Color del complejo al que pertenece un ID
export function colorDeId(id) {
  const prefijo = id.split(':')[0]
  const complejo = COMPLEJOS.find(c => c.id === prefijo)
  return complejo ? complejo.color : '#6b7280'
}

// Todos los IDs hoja de estructura_anatomica para filtrar (excluye IDs de grupo)
export function idsHojaDeEstructura(estructuraIds) {
  return estructuraIds.filter(id => {
    const entry = _idToNode.get(id)
    return entry && entry.type === 'hijo'
  })
}
