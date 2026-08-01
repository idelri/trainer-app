// ── PATRÓN DE MOVIMIENTO ──────────────────────────────────────────────────────
// Dos bloques visuales no seleccionables.
// Grupos e hijos son seleccionables con lógica completo/parcial/vacío.
// Los IDs se almacenan en patron_movimiento en DB.

export const PATRON_MOVIMIENTO = [
  {
    id: 'funcional',
    label: 'Patrones funcionales',
    color: '#7c3aed',
    grupos: [
      {
        id: 'funcional:eeii',
        label: 'EEII',
        children: [
          { id: 'funcional:eeii:sentadilla',        label: 'Sentadilla' },
          { id: 'funcional:eeii:bisagra',            label: 'Bisagra de cadera' },
          { id: 'funcional:eeii:puente_hip_thrust',  label: 'Puente / Hip thrust' },
          { id: 'funcional:eeii:zancada',            label: 'Zancada' },
          { id: 'funcional:eeii:step',               label: 'Step-up / Step-down' },
        ],
      },
      {
        id: 'funcional:eess',
        label: 'EESS',
        children: [
          { id: 'funcional:eess:empuje_horizontal',  label: 'Empuje horizontal' },
          { id: 'funcional:eess:empuje_vertical',    label: 'Empuje vertical' },
          { id: 'funcional:eess:traccion_horizontal', label: 'Tracción horizontal' },
          { id: 'funcional:eess:traccion_vertical',  label: 'Tracción vertical' },
        ],
      },
      {
        id: 'funcional:saltos',
        label: 'Saltos',
        children: [
          { id: 'funcional:saltos:salto',            label: 'Salto' },
          { id: 'funcional:saltos:aterrizaje',       label: 'Aterrizaje' },
        ],
      },
      {
        id: 'funcional:locomocion',
        label: 'Locomoción',
        children: [
          { id: 'funcional:locomocion:carrera',            label: 'Carrera' },
          { id: 'funcional:locomocion:aceleracion',        label: 'Aceleración' },
          { id: 'funcional:locomocion:desaceleracion',     label: 'Desaceleración' },
          { id: 'funcional:locomocion:cambio_direccion',   label: 'Cambio de dirección' },
        ],
      },
      {
        id: 'funcional:desplazamientos',
        label: 'Desplazamientos',
        children: [
          { id: 'funcional:desplazamientos:gateo',     label: 'Gateo' },
          { id: 'funcional:desplazamientos:transporte', label: 'Transporte / Carry' },
        ],
      },
      {
        id: 'funcional:acciones_deportivas',
        label: 'Acciones deportivas',
        children: [
          { id: 'funcional:acciones_deportivas:lanzamiento', label: 'Lanzamiento' },
          { id: 'funcional:acciones_deportivas:recepcion',   label: 'Recepción' },
          { id: 'funcional:acciones_deportivas:lucha',       label: 'Lucha' },
        ],
      },
    ],
  },
  {
    id: 'articular',
    label: 'Patrones articulares',
    color: '#0369a1',
    grupos: [
      {
        id: 'articular:pie_tobillo',
        label: 'Pie y tobillo',
        children: [
          { id: 'articular:pie_tobillo:flexion_plantar', label: 'Flexión plantar' },
          { id: 'articular:pie_tobillo:dorsiflexion',    label: 'Dorsiflexión' },
          { id: 'articular:pie_tobillo:inversion',       label: 'Inversión' },
          { id: 'articular:pie_tobillo:eversion',        label: 'Eversión' },
        ],
      },
      {
        id: 'articular:rodilla',
        label: 'Rodilla',
        children: [
          { id: 'articular:rodilla:flexion',   label: 'Flexión de rodilla' },
          { id: 'articular:rodilla:extension', label: 'Extensión de rodilla' },
        ],
      },
      {
        id: 'articular:cadera',
        label: 'Cadera',
        children: [
          { id: 'articular:cadera:flexion',           label: 'Flexión de cadera' },
          { id: 'articular:cadera:extension',         label: 'Extensión de cadera' },
          { id: 'articular:cadera:abduccion',         label: 'Abducción' },
          { id: 'articular:cadera:aduccion',          label: 'Aducción' },
          { id: 'articular:cadera:rotacion_interna',  label: 'Rotación interna' },
          { id: 'articular:cadera:rotacion_externa',  label: 'Rotación externa' },
        ],
      },
      {
        id: 'articular:raquis_movimiento',
        label: 'Raquis · Movimientos',
        children: [
          { id: 'articular:raquis_movimiento:flexion',             label: 'Flexión' },
          { id: 'articular:raquis_movimiento:extension',           label: 'Extensión' },
          { id: 'articular:raquis_movimiento:rotacion',            label: 'Rotación' },
          { id: 'articular:raquis_movimiento:inclinacion_lateral', label: 'Inclinación lateral' },
        ],
      },
      {
        id: 'articular:raquis_antimovimiento',
        label: 'Raquis · Antimovimientos',
        children: [
          { id: 'articular:raquis_antimovimiento:anti_extension',           label: 'Anti-extensión' },
          { id: 'articular:raquis_antimovimiento:anti_flexion',             label: 'Anti-flexión' },
          { id: 'articular:raquis_antimovimiento:anti_rotacion',            label: 'Anti-rotación' },
          { id: 'articular:raquis_antimovimiento:anti_inclinacion_lateral', label: 'Anti-inclinación lateral' },
        ],
      },
      {
        id: 'articular:hombro',
        label: 'Hombro',
        children: [
          { id: 'articular:hombro:flexion',          label: 'Flexión' },
          { id: 'articular:hombro:extension',        label: 'Extensión' },
          { id: 'articular:hombro:abduccion',        label: 'Abducción' },
          { id: 'articular:hombro:aduccion',         label: 'Aducción' },
          { id: 'articular:hombro:rotacion_interna', label: 'Rotación interna' },
          { id: 'articular:hombro:rotacion_externa', label: 'Rotación externa' },
        ],
      },
      {
        id: 'articular:escapula',
        label: 'Escápula',
        children: [
          { id: 'articular:escapula:elevacion',         label: 'Elevación' },
          { id: 'articular:escapula:depresion',         label: 'Depresión' },
          { id: 'articular:escapula:protraccion',       label: 'Protracción' },
          { id: 'articular:escapula:retraccion',        label: 'Retracción' },
          { id: 'articular:escapula:rotacion_superior', label: 'Rotación superior' },
          { id: 'articular:escapula:rotacion_inferior', label: 'Rotación inferior' },
        ],
      },
      {
        id: 'articular:codo_antebrazo',
        label: 'Codo y antebrazo',
        children: [
          { id: 'articular:codo_antebrazo:flexion',    label: 'Flexión de codo' },
          { id: 'articular:codo_antebrazo:extension',  label: 'Extensión de codo' },
          { id: 'articular:codo_antebrazo:pronacion',  label: 'Pronación' },
          { id: 'articular:codo_antebrazo:supinacion', label: 'Supinación' },
        ],
      },
      {
        id: 'articular:mano_muneca',
        label: 'Mano y muñeca',
        children: [
          { id: 'articular:mano_muneca:flexion_muneca',     label: 'Flexión de muñeca' },
          { id: 'articular:mano_muneca:extension_muneca',   label: 'Extensión de muñeca' },
          { id: 'articular:mano_muneca:desviacion_radial',  label: 'Desviación radial' },
          { id: 'articular:mano_muneca:desviacion_cubital', label: 'Desviación cubital' },
          { id: 'articular:mano_muneca:flexion_dedos',      label: 'Flexión de dedos' },
          { id: 'articular:mano_muneca:extension_dedos',    label: 'Extensión de dedos' },
        ],
      },
    ],
  },
]

// Mapa id → { bloque, grupo, hijo } para lookups O(1)
const _patronMap = new Map()
PATRON_MOVIMIENTO.forEach(bloque => {
  bloque.grupos.forEach(grupo => {
    _patronMap.set(grupo.id, { type: 'grupo', bloque, grupo })
    grupo.children.forEach(hijo => {
      _patronMap.set(hijo.id, { type: 'hijo', bloque, grupo, hijo })
    })
  })
})

export function hijosDeGrupo(grupoId) {
  const entry = _patronMap.get(grupoId)
  if (!entry || entry.type !== 'grupo') return []
  return entry.grupo.children.map(c => c.id)
}

export function labelDePatronId(id) {
  const entry = _patronMap.get(id)
  if (!entry) return id
  return entry.type === 'grupo' ? entry.grupo.label : entry.hijo.label
}

export function colorDePatronId(id) {
  const entry = _patronMap.get(id)
  return entry ? entry.bloque.color : '#6b7280'
}

// ── FAMILIA ──────────────────────────────────────────────────────────────────

export const FAMILIA_LABELS = {
  bilateral:        'Fuerza bilateral',
  unilateral:       'Fuerza unilateral',
  pliometria:       'Pliometría',
  estabilidad:      'Estabilidad',
  movilidad:        'Movilidad',
  ejercicio_tecnico: 'Ejercicio técnico',
  gesto_deportivo:  'Gesto deportivo',
}

export const FAMILIA = Object.entries(FAMILIA_LABELS).map(([id, label]) => ({ id, label }))

// ── POSICIÓN DEL EJERCICIO ────────────────────────────────────────────────────

export const POSICION_LABELS = {
  bipedestacion_bilateral: 'Bipedestación bilateral',
  monopodal:               'Monopodal',
  split_stance:            'Split stance',
  tandem:                  'Tandem',
  sedestacion:             'Sedestación',
  decubito_supino:         'Decúbito supino',
  decubito_prono:          'Decúbito prono',
  decubito_lateral:        'Decúbito lateral',
  cuadrupedia:             'Cuadrupedia',
  plancha:                 'Plancha',
  suspension:              'Suspensión',
  colgado:                 'Colgado',
}

export const POSICION_EJERCICIO = Object.entries(POSICION_LABELS).map(([id, label]) => ({ id, label }))

// ── COMPLEJOS ARTICULARES ─────────────────────────────────────────────────────
// patronesRecomendados: IDs concretos de PATRON_MOVIMIENTO sugeridos
// cuando el nodo (complejo / grupo / hijo) está seleccionado en estructura_anatomica.

export const COMPLEJOS = [
  {
    id: 'pie_tobillo',
    label: 'Pie y Tobillo',
    emoji: '🦶',
    color: '#0891b2',
    patronesRecomendados: [
      'articular:pie_tobillo:flexion_plantar',
      'articular:pie_tobillo:dorsiflexion',
      'articular:pie_tobillo:inversion',
      'articular:pie_tobillo:eversion',
      'funcional:eeii:sentadilla',
      'funcional:eeii:bisagra',
    ],
    grupos: [
      {
        id: 'pie_tobillo:musculatura_intrinseca',
        label: 'Musculatura intrínseca',
        patronesRecomendados: ['articular:pie_tobillo:flexion_plantar'],
        children: [
          { id: 'pie_tobillo:intrinsecos_dedos', label: 'Intrínsecos de los dedos', canonical_id: 'intrinsecos_dedos_pie', patronesRecomendados: ['articular:pie_tobillo:flexion_plantar'] },
          { id: 'pie_tobillo:boveda_plantar',    label: 'Bóveda plantar',           canonical_id: 'boveda_plantar',          patronesRecomendados: ['articular:pie_tobillo:flexion_plantar'] },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_anterior',
        label: 'Compartimento anterior',
        patronesRecomendados: ['articular:pie_tobillo:dorsiflexion'],
        children: [
          { id: 'pie_tobillo:tibial_anterior', label: 'Tibial anterior', canonical_id: 'tibial_anterior', patronesRecomendados: ['articular:pie_tobillo:dorsiflexion'] },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_posterior_profundo',
        label: 'Compartimento posterior profundo',
        patronesRecomendados: ['articular:pie_tobillo:inversion'],
        children: [
          { id: 'pie_tobillo:tibial_posterior', label: 'Tibial posterior', canonical_id: 'tibial_posterior', patronesRecomendados: ['articular:pie_tobillo:inversion'] },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_lateral',
        label: 'Compartimento lateral',
        patronesRecomendados: ['articular:pie_tobillo:eversion'],
        children: [
          { id: 'pie_tobillo:peroneos', label: 'Peroneos', canonical_id: 'peroneos', patronesRecomendados: ['articular:pie_tobillo:eversion'] },
        ],
      },
      {
        id: 'pie_tobillo:compartimento_posterior_superficial',
        label: 'Compartimento posterior superficial',
        patronesRecomendados: ['articular:pie_tobillo:flexion_plantar', 'funcional:eeii:sentadilla', 'funcional:eeii:bisagra'],
        children: [
          { id: 'pie_tobillo:soleo',   label: 'Sóleo',   canonical_id: 'soleo',   patronesRecomendados: ['articular:pie_tobillo:flexion_plantar'] },
          { id: 'pie_tobillo:gemelos', label: 'Gemelos', canonical_id: 'gemelos', patronesRecomendados: ['articular:pie_tobillo:flexion_plantar', 'articular:rodilla:flexion'] },
        ],
      },
    ],
  },
  {
    id: 'rodilla',
    label: 'Rodilla',
    emoji: '🦵',
    color: '#7c3aed',
    patronesRecomendados: [
      'articular:rodilla:flexion',
      'articular:rodilla:extension',
      'funcional:eeii:sentadilla',
      'funcional:eeii:zancada',
      'funcional:eeii:step',
    ],
    grupos: [
      {
        id: 'rodilla:compartimento_anterior',
        label: 'Compartimento anterior',
        patronesRecomendados: ['articular:rodilla:extension', 'funcional:eeii:sentadilla', 'funcional:eeii:step'],
        children: [
          { id: 'rodilla:cuadriceps',    label: 'Cuádriceps',    canonical_id: 'cuadriceps',    patronesRecomendados: ['articular:rodilla:extension', 'funcional:eeii:sentadilla', 'funcional:eeii:step'] },
          { id: 'rodilla:recto_femoral', label: 'Recto femoral', canonical_id: 'recto_femoral', patronesRecomendados: ['articular:rodilla:extension', 'articular:cadera:flexion'] },
        ],
      },
      {
        id: 'rodilla:compartimento_posterior',
        label: 'Compartimento posterior',
        patronesRecomendados: ['articular:rodilla:flexion', 'funcional:eeii:bisagra'],
        children: [
          { id: 'rodilla:isquiotibiales', label: 'Isquiotibiales', canonical_id: 'isquiotibiales', patronesRecomendados: ['articular:rodilla:flexion', 'funcional:eeii:bisagra'] },
          { id: 'rodilla:popliteo',       label: 'Poplíteo',       canonical_id: 'popliteo',       patronesRecomendados: ['articular:rodilla:flexion'] },
        ],
      },
      {
        id: 'rodilla:compartimento_medial',
        label: 'Compartimento medial',
        patronesRecomendados: ['articular:rodilla:flexion'],
        children: [
          { id: 'rodilla:sartorio',      label: 'Sartorio',      canonical_id: 'sartorio',      patronesRecomendados: ['articular:rodilla:flexion', 'articular:cadera:flexion'] },
          { id: 'rodilla:gracil',        label: 'Grácil',        canonical_id: 'gracil',        patronesRecomendados: ['articular:rodilla:flexion', 'articular:cadera:aduccion'] },
          { id: 'rodilla:pata_de_ganso', label: 'Pata de ganso', canonical_id: 'pata_de_ganso', patronesRecomendados: ['articular:rodilla:flexion'] },
        ],
      },
      {
        id: 'rodilla:compartimento_lateral',
        label: 'Compartimento lateral',
        patronesRecomendados: ['articular:rodilla:flexion'],
        children: [
          { id: 'rodilla:biceps_femoral',       label: 'Bíceps femoral',       canonical_id: 'biceps_femoral',       patronesRecomendados: ['articular:rodilla:flexion', 'articular:cadera:extension'] },
          { id: 'rodilla:cintilla_iliotibial',  label: 'Cintilla iliotibial',  canonical_id: 'cintilla_iliotibial', patronesRecomendados: ['articular:cadera:abduccion'] },
        ],
      },
    ],
  },
  {
    id: 'cadera',
    label: 'Cadera',
    emoji: '🦴',
    color: '#b45309',
    patronesRecomendados: [
      'funcional:eeii:bisagra',
      'funcional:eeii:puente_hip_thrust',
      'funcional:eeii:sentadilla',
      'funcional:eeii:zancada',
      'articular:cadera:flexion',
      'articular:cadera:extension',
      'articular:cadera:abduccion',
      'articular:cadera:aduccion',
      'articular:cadera:rotacion_interna',
      'articular:cadera:rotacion_externa',
    ],
    grupos: [
      {
        id: 'cadera:compartimento_anterior',
        label: 'Compartimento anterior',
        patronesRecomendados: ['articular:cadera:flexion'],
        children: [
          { id: 'cadera:psoas_iliaco',   label: 'Psoas-ilíaco',   canonical_id: 'psoas_iliaco',   patronesRecomendados: ['articular:cadera:flexion'] },
          { id: 'cadera:recto_femoral',  label: 'Recto femoral',  canonical_id: 'recto_femoral',  patronesRecomendados: ['articular:cadera:flexion', 'articular:rodilla:extension'] },
          { id: 'cadera:sartorio',       label: 'Sartorio',       canonical_id: 'sartorio',       patronesRecomendados: ['articular:cadera:flexion'] },
        ],
      },
      {
        id: 'cadera:compartimento_posterior',
        label: 'Compartimento posterior',
        patronesRecomendados: ['articular:cadera:extension', 'funcional:eeii:bisagra', 'funcional:eeii:puente_hip_thrust'],
        children: [
          { id: 'cadera:gluteo_mayor',   label: 'Glúteo mayor',   canonical_id: 'gluteo_mayor',   patronesRecomendados: ['funcional:eeii:bisagra', 'funcional:eeii:puente_hip_thrust', 'articular:cadera:extension'] },
          { id: 'cadera:isquiotibiales', label: 'Isquiotibiales', canonical_id: 'isquiotibiales', patronesRecomendados: ['funcional:eeii:bisagra', 'articular:cadera:extension', 'articular:rodilla:flexion'] },
        ],
      },
      {
        id: 'cadera:compartimento_lateral',
        label: 'Compartimento lateral',
        patronesRecomendados: ['articular:cadera:abduccion', 'articular:cadera:rotacion_interna', 'articular:cadera:rotacion_externa'],
        children: [
          { id: 'cadera:gluteo_medio', label: 'Glúteo medio',                  canonical_id: 'gluteo_medio', patronesRecomendados: ['articular:cadera:abduccion', 'articular:cadera:rotacion_externa'] },
          { id: 'cadera:gluteo_menor', label: 'Glúteo menor',                  canonical_id: 'gluteo_menor', patronesRecomendados: ['articular:cadera:abduccion', 'articular:cadera:rotacion_interna'] },
          { id: 'cadera:tfl',          label: 'Tensor de la fascia lata (TFL)', canonical_id: 'tfl',          patronesRecomendados: ['articular:cadera:abduccion', 'articular:cadera:rotacion_interna'] },
        ],
      },
      {
        id: 'cadera:compartimento_medial',
        label: 'Compartimento medial',
        patronesRecomendados: ['articular:cadera:aduccion'],
        children: [
          { id: 'cadera:aductor_mayor', label: 'Aductor mayor', canonical_id: 'aductor_mayor', patronesRecomendados: ['articular:cadera:aduccion', 'articular:cadera:extension'] },
          { id: 'cadera:aductor_largo', label: 'Aductor largo', canonical_id: 'aductor_largo', patronesRecomendados: ['articular:cadera:aduccion'] },
          { id: 'cadera:aductor_corto', label: 'Aductor corto', canonical_id: 'aductor_corto', patronesRecomendados: ['articular:cadera:aduccion'] },
          { id: 'cadera:pectineo',      label: 'Pectíneo',      canonical_id: 'pectineo',      patronesRecomendados: ['articular:cadera:aduccion', 'articular:cadera:flexion'] },
          { id: 'cadera:gracil',        label: 'Grácil',        canonical_id: 'gracil',        patronesRecomendados: ['articular:cadera:aduccion', 'articular:rodilla:flexion'] },
        ],
      },
      {
        id: 'cadera:rotadores_profundos',
        label: 'Rotadores profundos',
        patronesRecomendados: ['articular:cadera:rotacion_interna', 'articular:cadera:rotacion_externa'],
        children: [
          { id: 'cadera:rotadores_externos_profundos', label: 'Rotadores externos profundos', canonical_id: 'rotadores_externos_profundos', patronesRecomendados: ['articular:cadera:rotacion_externa'] },
        ],
      },
    ],
  },
  {
    id: 'raquis',
    label: 'Raquis',
    emoji: '🦴',
    color: '#166534',
    patronesRecomendados: [
      'articular:raquis_movimiento:flexion',
      'articular:raquis_movimiento:extension',
      'articular:raquis_movimiento:rotacion',
      'articular:raquis_movimiento:inclinacion_lateral',
      'articular:raquis_antimovimiento:anti_extension',
      'articular:raquis_antimovimiento:anti_flexion',
      'articular:raquis_antimovimiento:anti_rotacion',
      'articular:raquis_antimovimiento:anti_inclinacion_lateral',
    ],
    grupos: [
      {
        id: 'raquis:region_cervical',
        label: 'Región cervical',
        patronesRecomendados: ['articular:raquis_movimiento:flexion', 'articular:raquis_movimiento:extension', 'articular:raquis_movimiento:rotacion'],
        children: [
          { id: 'raquis:flexores_cervicales_profundos', label: 'Flexores cervicales profundos', canonical_id: 'flexores_cervicales_profundos', patronesRecomendados: ['articular:raquis_movimiento:flexion', 'articular:raquis_antimovimiento:anti_extension'] },
          { id: 'raquis:extensores_cervicales',         label: 'Extensores cervicales',         canonical_id: 'extensores_cervicales',         patronesRecomendados: ['articular:raquis_movimiento:extension'] },
        ],
      },
      {
        id: 'raquis:region_toracica',
        label: 'Región torácica',
        patronesRecomendados: ['articular:raquis_movimiento:rotacion', 'articular:raquis_movimiento:extension'],
        children: [
          { id: 'raquis:extensores_toracicos', label: 'Extensores torácicos', canonical_id: 'extensores_toracicos', patronesRecomendados: ['articular:raquis_movimiento:extension'] },
          { id: 'raquis:rotadores_toracicos',  label: 'Rotadores torácicos',  canonical_id: 'rotadores_toracicos',  patronesRecomendados: ['articular:raquis_movimiento:rotacion'] },
        ],
      },
      {
        id: 'raquis:region_lumbar',
        label: 'Región lumbar',
        patronesRecomendados: ['articular:raquis_antimovimiento:anti_extension', 'articular:raquis_movimiento:extension'],
        children: [
          { id: 'raquis:erectores_lumbares', label: 'Erectores lumbares', canonical_id: 'erectores_lumbares', patronesRecomendados: ['articular:raquis_movimiento:extension', 'articular:raquis_antimovimiento:anti_extension'] },
          { id: 'raquis:multifidos',         label: 'Multífidos',         canonical_id: 'multifidos',         patronesRecomendados: ['articular:raquis_antimovimiento:anti_rotacion', 'articular:raquis_antimovimiento:anti_extension'] },
          { id: 'raquis:cuadrado_lumbar',    label: 'Cuadrado lumbar',    canonical_id: 'cuadrado_lumbar',    patronesRecomendados: ['articular:raquis_movimiento:inclinacion_lateral', 'articular:raquis_antimovimiento:anti_inclinacion_lateral'] },
        ],
      },
      {
        id: 'raquis:core_anterior',
        label: 'Core anterior',
        patronesRecomendados: ['articular:raquis_antimovimiento:anti_extension', 'articular:raquis_movimiento:flexion'],
        children: [
          { id: 'raquis:recto_abdominal',     label: 'Recto abdominal',     canonical_id: 'recto_abdominal',     patronesRecomendados: ['articular:raquis_movimiento:flexion', 'articular:raquis_antimovimiento:anti_extension'] },
          { id: 'raquis:transverso_abdominal', label: 'Transverso abdominal', canonical_id: 'transverso_abdominal', patronesRecomendados: ['articular:raquis_antimovimiento:anti_extension', 'articular:raquis_antimovimiento:anti_rotacion'] },
        ],
      },
      {
        id: 'raquis:core_lateral',
        label: 'Core lateral',
        patronesRecomendados: ['articular:raquis_antimovimiento:anti_inclinacion_lateral', 'articular:raquis_antimovimiento:anti_rotacion'],
        children: [
          { id: 'raquis:oblicuo_interno', label: 'Oblicuo interno', canonical_id: 'oblicuo_interno', patronesRecomendados: ['articular:raquis_antimovimiento:anti_rotacion', 'articular:raquis_antimovimiento:anti_inclinacion_lateral'] },
          { id: 'raquis:oblicuo_externo', label: 'Oblicuo externo', canonical_id: 'oblicuo_externo', patronesRecomendados: ['articular:raquis_movimiento:rotacion', 'articular:raquis_antimovimiento:anti_rotacion'] },
        ],
      },
      {
        id: 'raquis:complejo_respiratorio_pelvico',
        label: 'Complejo respiratorio y pélvico',
        patronesRecomendados: ['articular:raquis_antimovimiento:anti_extension'],
        children: [
          { id: 'raquis:diafragma',     label: 'Diafragma',     canonical_id: 'diafragma',     patronesRecomendados: ['articular:raquis_antimovimiento:anti_extension'] },
          { id: 'raquis:suelo_pelvico', label: 'Suelo pélvico', canonical_id: 'suelo_pelvico', patronesRecomendados: ['articular:raquis_antimovimiento:anti_extension'] },
        ],
      },
    ],
  },
  {
    id: 'hombro',
    label: 'Hombro',
    emoji: '💪',
    color: '#be185d',
    patronesRecomendados: [
      'funcional:eess:empuje_horizontal',
      'funcional:eess:empuje_vertical',
      'funcional:eess:traccion_horizontal',
      'funcional:eess:traccion_vertical',
      'articular:hombro:flexion',
      'articular:hombro:extension',
      'articular:hombro:abduccion',
      'articular:hombro:aduccion',
      'articular:hombro:rotacion_interna',
      'articular:hombro:rotacion_externa',
      'articular:escapula:elevacion',
      'articular:escapula:depresion',
      'articular:escapula:protraccion',
      'articular:escapula:retraccion',
      'articular:escapula:rotacion_superior',
      'articular:escapula:rotacion_inferior',
    ],
    grupos: [
      {
        id: 'hombro:compartimento_anterior',
        label: 'Compartimento anterior',
        patronesRecomendados: ['funcional:eess:empuje_horizontal', 'funcional:eess:empuje_vertical', 'articular:hombro:flexion', 'articular:hombro:aduccion'],
        children: [
          { id: 'hombro:deltoides_anterior', label: 'Deltoides anterior', canonical_id: 'deltoides_anterior', patronesRecomendados: ['funcional:eess:empuje_vertical', 'articular:hombro:flexion', 'articular:hombro:abduccion'] },
          { id: 'hombro:pectoral_mayor',     label: 'Pectoral mayor',     canonical_id: 'pectoral_mayor',     patronesRecomendados: ['funcional:eess:empuje_horizontal', 'articular:hombro:aduccion', 'articular:hombro:rotacion_interna'] },
        ],
      },
      {
        id: 'hombro:compartimento_superior',
        label: 'Compartimento superior',
        patronesRecomendados: ['articular:escapula:elevacion'],
        children: [
          { id: 'hombro:trapecio_superior',  label: 'Trapecio superior',         canonical_id: 'trapecio_superior',  patronesRecomendados: ['articular:escapula:elevacion'] },
          { id: 'hombro:elevador_escapula',  label: 'Elevador de la escápula',   canonical_id: 'elevador_escapula',  patronesRecomendados: ['articular:escapula:elevacion'] },
        ],
      },
      {
        id: 'hombro:compartimento_lateral',
        label: 'Compartimento lateral',
        patronesRecomendados: ['articular:hombro:abduccion'],
        children: [
          { id: 'hombro:deltoides_medio', label: 'Deltoides medio', canonical_id: 'deltoides_medio', patronesRecomendados: ['articular:hombro:abduccion'] },
          { id: 'hombro:supraespinoso',   label: 'Supraespinoso',   canonical_id: 'supraespinoso',   patronesRecomendados: ['articular:hombro:abduccion'] },
        ],
      },
      {
        id: 'hombro:compartimento_posterior',
        label: 'Compartimento posterior',
        patronesRecomendados: ['funcional:eess:traccion_horizontal', 'funcional:eess:traccion_vertical', 'articular:hombro:extension', 'articular:hombro:rotacion_externa'],
        children: [
          { id: 'hombro:deltoides_posterior', label: 'Deltoides posterior', canonical_id: 'deltoides_posterior', patronesRecomendados: ['funcional:eess:traccion_horizontal', 'articular:hombro:extension', 'articular:hombro:rotacion_externa'] },
          { id: 'hombro:infraespinoso',       label: 'Infraespinoso',       canonical_id: 'infraespinoso',       patronesRecomendados: ['articular:hombro:rotacion_externa'] },
          { id: 'hombro:redondo_menor',       label: 'Redondo menor',       canonical_id: 'redondo_menor',       patronesRecomendados: ['articular:hombro:rotacion_externa'] },
          { id: 'hombro:redondo_mayor',       label: 'Redondo mayor',       canonical_id: 'redondo_mayor',       patronesRecomendados: ['funcional:eess:traccion_vertical', 'articular:hombro:extension', 'articular:hombro:aduccion'] },
        ],
      },
      {
        id: 'hombro:compartimento_escapular',
        label: 'Compartimento escapular',
        patronesRecomendados: ['articular:escapula:retraccion', 'articular:escapula:depresion', 'articular:escapula:protraccion', 'articular:escapula:rotacion_superior'],
        children: [
          { id: 'hombro:trapecio_medio',    label: 'Trapecio medio',    canonical_id: 'trapecio_medio',    patronesRecomendados: ['articular:escapula:retraccion', 'funcional:eess:traccion_horizontal'] },
          { id: 'hombro:trapecio_inferior', label: 'Trapecio inferior', canonical_id: 'trapecio_inferior', patronesRecomendados: ['articular:escapula:depresion', 'articular:escapula:rotacion_superior'] },
          { id: 'hombro:romboides',         label: 'Romboides',         canonical_id: 'romboides',         patronesRecomendados: ['articular:escapula:retraccion'] },
          { id: 'hombro:serrato_anterior',  label: 'Serrato anterior',  canonical_id: 'serrato_anterior',  patronesRecomendados: ['articular:escapula:protraccion', 'articular:escapula:rotacion_superior'] },
        ],
      },
      {
        id: 'hombro:compartimento_anterior_profundo',
        label: 'Compartimento anterior profundo',
        patronesRecomendados: ['articular:hombro:rotacion_interna'],
        children: [
          { id: 'hombro:subescapular', label: 'Subescapular', canonical_id: 'subescapular', patronesRecomendados: ['articular:hombro:rotacion_interna'] },
        ],
      },
    ],
  },
  {
    id: 'codo_antebrazo',
    label: 'Codo y Antebrazo',
    emoji: '💪',
    color: '#0f766e',
    patronesRecomendados: [
      'articular:codo_antebrazo:flexion',
      'articular:codo_antebrazo:extension',
      'articular:codo_antebrazo:pronacion',
      'articular:codo_antebrazo:supinacion',
      'funcional:eess:traccion_horizontal',
      'funcional:eess:traccion_vertical',
      'funcional:eess:empuje_horizontal',
      'funcional:eess:empuje_vertical',
    ],
    grupos: [
      {
        id: 'codo_antebrazo:compartimento_anterior',
        label: 'Compartimento anterior',
        patronesRecomendados: ['articular:codo_antebrazo:flexion', 'funcional:eess:traccion_horizontal', 'funcional:eess:traccion_vertical'],
        children: [
          { id: 'codo_antebrazo:biceps_braquial',  label: 'Bíceps braquial',  canonical_id: 'biceps_braquial',  patronesRecomendados: ['articular:codo_antebrazo:flexion', 'articular:codo_antebrazo:supinacion', 'funcional:eess:traccion_horizontal'] },
          { id: 'codo_antebrazo:braquial',         label: 'Braquial',         canonical_id: 'braquial',         patronesRecomendados: ['articular:codo_antebrazo:flexion'] },
          { id: 'codo_antebrazo:braquiorradial',   label: 'Braquiorradial',   canonical_id: 'braquiorradial',   patronesRecomendados: ['articular:codo_antebrazo:flexion'] },
        ],
      },
      {
        id: 'codo_antebrazo:compartimento_posterior',
        label: 'Compartimento posterior',
        patronesRecomendados: ['articular:codo_antebrazo:extension', 'funcional:eess:empuje_horizontal', 'funcional:eess:empuje_vertical'],
        children: [
          { id: 'codo_antebrazo:triceps_braquial', label: 'Tríceps braquial', canonical_id: 'triceps_braquial', patronesRecomendados: ['articular:codo_antebrazo:extension', 'funcional:eess:empuje_horizontal', 'funcional:eess:empuje_vertical'] },
          { id: 'codo_antebrazo:anconeo',          label: 'Ancóneo',          canonical_id: 'anconeo',          patronesRecomendados: ['articular:codo_antebrazo:extension'] },
        ],
      },
      {
        id: 'codo_antebrazo:compartimento_flexor',
        label: 'Compartimento flexor',
        patronesRecomendados: ['articular:mano_muneca:flexion_muneca', 'articular:mano_muneca:flexion_dedos'],
        children: [
          { id: 'codo_antebrazo:flexores_muneca', label: 'Flexores de muñeca', canonical_id: 'flexores_muneca', patronesRecomendados: ['articular:mano_muneca:flexion_muneca'] },
          { id: 'codo_antebrazo:flexores_dedos',  label: 'Flexores de dedos',  canonical_id: 'flexores_dedos',  patronesRecomendados: ['articular:mano_muneca:flexion_dedos'] },
        ],
      },
      {
        id: 'codo_antebrazo:compartimento_extensor',
        label: 'Compartimento extensor',
        patronesRecomendados: ['articular:mano_muneca:extension_muneca', 'articular:mano_muneca:extension_dedos'],
        children: [
          { id: 'codo_antebrazo:extensores_muneca', label: 'Extensores de muñeca', canonical_id: 'extensores_muneca', patronesRecomendados: ['articular:mano_muneca:extension_muneca'] },
          { id: 'codo_antebrazo:extensores_dedos',  label: 'Extensores de dedos',  canonical_id: 'extensores_dedos',  patronesRecomendados: ['articular:mano_muneca:extension_dedos'] },
        ],
      },
      {
        id: 'codo_antebrazo:pronosupinadores',
        label: 'Pronosupinadores',
        patronesRecomendados: ['articular:codo_antebrazo:pronacion', 'articular:codo_antebrazo:supinacion'],
        children: [
          { id: 'codo_antebrazo:pronadores',  label: 'Pronadores',  canonical_id: 'pronadores',  patronesRecomendados: ['articular:codo_antebrazo:pronacion'] },
          { id: 'codo_antebrazo:supinadores', label: 'Supinadores', canonical_id: 'supinadores', patronesRecomendados: ['articular:codo_antebrazo:supinacion'] },
        ],
      },
    ],
  },
  {
    id: 'mano_muneca',
    label: 'Mano y Muñeca',
    emoji: '🤲',
    color: '#4f46e5',
    patronesRecomendados: [
      'articular:mano_muneca:flexion_muneca',
      'articular:mano_muneca:extension_muneca',
      'articular:mano_muneca:desviacion_radial',
      'articular:mano_muneca:desviacion_cubital',
      'articular:mano_muneca:flexion_dedos',
      'articular:mano_muneca:extension_dedos',
      'funcional:eess:traccion_horizontal',
      'funcional:eess:traccion_vertical',
    ],
    grupos: [
      {
        id: 'mano_muneca:compartimento_flexor',
        label: 'Compartimento flexor',
        patronesRecomendados: ['articular:mano_muneca:flexion_muneca', 'articular:mano_muneca:flexion_dedos'],
        children: [
          { id: 'mano_muneca:flexores_muneca', label: 'Flexores de muñeca', canonical_id: 'flexores_muneca', patronesRecomendados: ['articular:mano_muneca:flexion_muneca'] },
          { id: 'mano_muneca:flexores_dedos',  label: 'Flexores de dedos',  canonical_id: 'flexores_dedos',  patronesRecomendados: ['articular:mano_muneca:flexion_dedos'] },
        ],
      },
      {
        id: 'mano_muneca:compartimento_extensor',
        label: 'Compartimento extensor',
        patronesRecomendados: ['articular:mano_muneca:extension_muneca', 'articular:mano_muneca:extension_dedos'],
        children: [
          { id: 'mano_muneca:extensores_muneca', label: 'Extensores de muñeca', canonical_id: 'extensores_muneca', patronesRecomendados: ['articular:mano_muneca:extension_muneca'] },
          { id: 'mano_muneca:extensores_dedos',  label: 'Extensores de dedos',  canonical_id: 'extensores_dedos',  patronesRecomendados: ['articular:mano_muneca:extension_dedos'] },
        ],
      },
      {
        id: 'mano_muneca:musculatura_intrinseca',
        label: 'Musculatura intrínseca',
        patronesRecomendados: ['articular:mano_muneca:flexion_dedos', 'articular:mano_muneca:extension_dedos'],
        children: [
          { id: 'mano_muneca:eminencia_tenar',    label: 'Eminencia tenar',    canonical_id: 'eminencia_tenar',    patronesRecomendados: ['articular:mano_muneca:flexion_dedos'] },
          { id: 'mano_muneca:eminencia_hipotenar', label: 'Eminencia hipotenar', canonical_id: 'eminencia_hipotenar', patronesRecomendados: ['articular:mano_muneca:flexion_dedos'] },
          { id: 'mano_muneca:interoseos',          label: 'Interóseos',          canonical_id: 'interoseos',          patronesRecomendados: ['articular:mano_muneca:flexion_dedos', 'articular:mano_muneca:extension_dedos'] },
          { id: 'mano_muneca:lumbricales',         label: 'Lumbricales',         canonical_id: 'lumbricales',         patronesRecomendados: ['articular:mano_muneca:flexion_dedos'] },
        ],
      },
      {
        id: 'mano_muneca:agarre',
        label: 'Agarre',
        patronesRecomendados: ['articular:mano_muneca:flexion_dedos', 'funcional:eess:traccion_horizontal', 'funcional:eess:traccion_vertical'],
        children: [
          { id: 'mano_muneca:fuerza_agarre', label: 'Fuerza de agarre', canonical_id: 'fuerza_agarre', patronesRecomendados: ['articular:mano_muneca:flexion_dedos', 'funcional:eess:traccion_horizontal'] },
          { id: 'mano_muneca:pinza',         label: 'Pinza',             canonical_id: 'pinza',         patronesRecomendados: ['articular:mano_muneca:flexion_dedos'] },
        ],
      },
    ],
  },
]

// ── SECCIONES DE CLASIFICACIÓN ────────────────────────────────────────────────
// tipo 'complejos' → ComplexSelector con COMPLEJOS
// tipo 'chips'     → chips planos; items puede ser string[] o {id,label}[]
// tipo 'grupos'    → grupos con children planos (material)
// tipo 'patron'    → PatronSelector con PATRON_MOVIMIENTO
//
// labelFn: (id) => string — transforma el ID almacenado al label visible.
// Solo necesario cuando los items son IDs distintos al label (familia, posicion).

export const SECCIONES_CLASIFICACION = [
  {
    tipo: 'complejos',
    label: 'Estructura implicada',
    campoPrincipal: 'complejo_articular',
    campoEstructura: 'estructura_anatomica',
    color: '#374151',
  },
  {
    tipo: 'chips',
    label: 'Familia',
    campo: 'familia',
    color: '#0891b2',
    items: FAMILIA.map(f => f.id),
    labelFn: id => FAMILIA_LABELS[id] || id,
  },
  {
    tipo: 'patron',
    label: 'Patrón de movimiento',
    campo: 'patron_movimiento',
    color: '#7c3aed',
  },
  {
    tipo: 'chips',
    label: 'Posición del ejercicio',
    campo: 'posicion_ejercicio',
    color: '#065f46',
    items: POSICION_EJERCICIO.map(p => p.id),
    labelFn: id => POSICION_LABELS[id] || id,
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

export const CAMPOS_CLASIFICACION = [
  'complejo_articular',
  'estructura_anatomica',
  'familia',
  'patron_movimiento',
  'posicion_ejercicio',
  'plano_movimiento',
  'tipo_contraccion',
  'material',
]

// ── HELPERS — ESTRUCTURA ANATÓMICA ───────────────────────────────────────────

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

export function estadoGrupo(grupo, selectedIds) {
  const childIds = grupo.children.map(c => c.id)
  const n = childIds.filter(id => selectedIds.includes(id)).length
  if (n === 0) return 'empty'
  if (n === childIds.length) return 'full'
  return 'partial'
}

export function toggleGrupo(grupo, selectedIds) {
  const childIds = grupo.children.map(c => c.id)
  const estado = estadoGrupo(grupo, selectedIds)
  if (estado === 'full') {
    const quitar = new Set([grupo.id, ...childIds])
    return selectedIds.filter(id => !quitar.has(id))
  }
  return [...new Set([...selectedIds, grupo.id, ...childIds])]
}

export function toggleEstructura(childId, grupo, selectedIds) {
  let next
  const childIds = grupo.children.map(c => c.id)
  if (selectedIds.includes(childId)) {
    next = selectedIds.filter(id => id !== childId && id !== grupo.id)
  } else {
    next = [...selectedIds, childId]
    if (childIds.every(id => next.includes(id))) {
      next = [...new Set([...next, grupo.id])]
    }
  }
  return next
}

export function derivarComplejos(estructuraIds) {
  const complejoSet = new Set()
  for (const id of estructuraIds) {
    const prefijo = id.split(':')[0]
    if (COMPLEJOS.some(c => c.id === prefijo)) complejoSet.add(prefijo)
  }
  return [...complejoSet]
}

export function labelDeId(id) {
  const entry = _idToNode.get(id)
  return entry ? entry.node.label : id
}

export function colorDeId(id) {
  const prefijo = id.split(':')[0]
  const complejo = COMPLEJOS.find(c => c.id === prefijo)
  return complejo ? complejo.color : '#6b7280'
}

export function idsHojaDeEstructura(estructuraIds) {
  return estructuraIds.filter(id => {
    const entry = _idToNode.get(id)
    return entry && entry.type === 'hijo'
  })
}

// ── HELPERS — PATRONES RECOMENDADOS ──────────────────────────────────────────

// Recoge patronesRecomendados de los complejos y estructuras seleccionados,
// los deduplica y los ordena por frecuencia de aparición (mayor frecuencia → primero).
export function patronesRecomendadosActivos(complejosIds = [], estructurasIds = []) {
  const freq = new Map()
  function add(ids) {
    for (const id of ids) freq.set(id, (freq.get(id) || 0) + 1)
  }
  for (const cId of complejosIds) {
    const complejo = COMPLEJOS.find(c => c.id === cId)
    if (complejo?.patronesRecomendados) add(complejo.patronesRecomendados)
  }
  for (const eId of estructurasIds) {
    const entry = _idToNode.get(eId)
    if (entry?.node?.patronesRecomendados) add(entry.node.patronesRecomendados)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
}
