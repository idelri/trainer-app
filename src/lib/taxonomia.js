export const ETIQUETAS = {
  zona_corporal: {
    label: 'Zona corporal',
    grupos: [
      { grupo: 'Cadenas principales', items: ['Cadena Anterior', 'Cadena Posterior', 'Estabilizadores de Cadera', 'Cadena Medial / Aductores'] },
      { grupo: 'CORE / Tronco', items: ['Lumbo-pélvico', 'Abdominal', 'Dorsal / Torácico', 'Cervical'] },
      { grupo: 'Pie / Tobillo', items: ['Gemelos / Sóleos', 'Tibial anterior', 'Peroneos', 'Intrínsecos del pie'] },
    ],
  },
  patron_movimiento: {
    label: 'Patrón de movimiento',
    grupos: [
      { grupo: 'Tren inferior', items: ['Dominante de rodilla', 'Dominante de cadera', 'Dominante de tobillo', 'Abducción / Rotación externa', 'Aducción / Plano medial', 'Pliometría y salto', 'Carrera y locomoción', 'Cambio de dirección / Desaceleración'] },
      { grupo: 'Tren superior', items: ['Empuje horizontal', 'Empuje vertical', 'Tracción horizontal', 'Tracción vertical', 'Estabilidad escapular'] },
      { grupo: 'Core', items: ['Anti-extensión', 'Anti-rotación', 'Anti-flexión lateral', 'Anti-flexión frontal', 'Rotación', 'Flexión de tronco', 'Control lumbopélvico'] },
    ],
  },
  lateralidad_apoyo: {
    label: 'Lateralidad y apoyo',
    grupos: [
      { grupo: 'Tipo de apoyo', items: ['Bilateral', 'Monopodal', 'Asimétrico (Split)', 'Cuadrupedia', 'Plancha / Suspensión', 'Decúbito prono', 'Decúbito supino', 'Decúbito lateral', 'Sentado'] },
      { grupo: 'Ejecución y carga', items: ['Carga bilateral', 'Carga unilateral', 'Unilateral alterno', 'Contralateral', 'Ipsilateral'] },
    ],
  },
  objetivo: {
    label: 'Objetivo',
    grupos: [
      { grupo: '', items: ['Fuerza', 'Potencia / Velocidad', 'Técnica / Control motor', 'Movilidad / Flexibilidad', 'Resistencia muscular'] },
    ],
  },
  nivel_aproximacion: {
    label: 'Nivel de aproximación',
    single: true,
    grupos: [
      { grupo: '', items: ['0− Complementario / estructural', '0+ General orientado', 'I Fundamental', 'II Dirigido', 'III Específico cerrado', 'IV Reactivo / específico abierto', 'V Competitivo'] },
    ],
  },
  tipo_contraccion: {
    label: 'Tipo de contracción',
    grupos: [
      { grupo: '', items: ['Dinámica (Concéntrica + Excéntrica)', 'Excéntrica acentuada', 'Isométrica', 'Isoinercial / Isocinética'] },
    ],
  },
  material: {
    label: 'Material',
    grupos: [
      { grupo: 'Sin equipamiento', items: ['Sin material / peso corporal', 'Colchoneta / esterilla'] },
      { grupo: 'Pesos libres', items: ['Mancuernas', 'Kettlebell', 'Barra', 'Discos', 'Balón medicinal'] },
      { grupo: 'Máquinas y poleas', items: ['Máquina guiada', 'Polea'] },
      { grupo: 'Elásticos y suspensión', items: ['Goma elástica', 'Mini-band', 'TRX / suspensión'] },
      { grupo: 'Accesorios', items: ['Fitball', 'Foam roller', 'Cajón / step', 'Banco', 'Bosu / superficie inestable', 'Sliders / plataforma deslizante', 'Trineo', 'Valla / cono / escalera'] },
      { grupo: 'Cardio', items: ['Cinta de correr', 'Bicicleta', 'Remoergómetro', 'Assault bike / air bike', 'Ergómetro ski', 'Elíptica'] },
    ],
  },
}

export const TAG_COLORS = {
  zona_corporal: '#0369a1',
  patron_movimiento: '#7c3aed',
  lateralidad_apoyo: '#065f46',
  objetivo: '#b45309',
  nivel_aproximacion: '#0f766e',
  tipo_contraccion: '#be185d',
  material: '#475569',
}
