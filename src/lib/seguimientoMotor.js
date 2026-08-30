/**
 * seguimientoMotor.js — Motor central de Seguimiento (Fase 5)
 *
 * Módulo puro (sin React, sin Supabase).
 * Recibe datos ya cargados, devuelve items normalizados.
 *
 * Fuente: sesion_feedback.data
 * Persistencia de revisiones: feedback_alertas_revisadas (BD, no localStorage)
 *
 * Reglas individuales (por sesión/feedback):
 *   rpe        → RPE >= 7
 *   molestia   → pain.hasPain+details  o  pain.additionalPain+details
 *   tecnica    → technical.hasDifficulty
 *   comprension→ understanding.unclearExercise
 *   material   → equipment.missingEquipment
 *   duracion   → durReal > durPrev + 15 min (solo si sesión tiene duracion_min)
 *   comentario → generalComments no vacío
 *
 * Reglas acumulativas (racha consecutiva, asociada al ÚLTIMO feedback de la racha):
 *   sueno      → >=3 consecutivos con value<=2  o  >=3 con value==3
 *   recuperacion → >=3 consecutivos con TQR<=5
 *   cumplimiento → >=2 consecutivos partial/missed
 *
 * Datos ausentes: un feedback sin el valor de una métrica NO cuenta como valor malo
 * ni rompe la racha. Solo participan los feedbacks que TIENEN ese valor.
 *
 * Excepción "parcial sin motivo crítico": si status=partial pero la sesión
 * no genera ningún otro aspecto (rpe/molestia/tecnica/comprensión/material),
 * NO genera aspecto individual. Solo participa en racha de cumplimiento.
 */

// ── Categorías canónicas ──────────────────────────────────────────────────────

export const CAT = {
  RPE:          'rpe',
  MOLESTIA:     'molestia',
  TECNICA:      'tecnica',
  COMPRENSION:  'comprension',
  MATERIAL:     'material',
  COMENTARIO:   'comentario',
  DURACION:     'duracion',
  SUENO:        'sueno',
  RECUPERACION: 'recuperacion',
  CUMPLIMIENTO: 'cumplimiento',
}

export const CAT_LABEL = {
  rpe:          'RPE',
  molestia:     'Molestia',
  tecnica:      'Técnica',
  comprension:  'Comprensión',
  material:     'Material',
  comentario:   'Comentario',
  duracion:     'Duración',
  sueno:        'Sueño',
  recuperacion: 'Recuperación',
  cumplimiento: 'Cumplimiento',
}

// ── Aspectos individuales por sesión ─────────────────────────────────────────

export function calcularAspectosIndividuales(fb, ses) {
  const d = fb.data || {}
  const aspectos = []

  // RPE >= 7
  if (d.rpe?.value != null && d.rpe.value >= 7) {
    aspectos.push({ categoria: CAT.RPE, label: `RPE alto · ${d.rpe.value}/10`, detalle: null })
  }

  // Molestia: mainPain o additionalPain, solo si hay texto
  const p = d.pain
  if (p?.hasPain && p.mainPainDetails?.trim()) {
    aspectos.push({ categoria: CAT.MOLESTIA, label: 'Molestia', detalle: p.mainPainDetails.trim() })
  } else if (p?.additionalPain && p.additionalPainDetails?.trim()) {
    aspectos.push({ categoria: CAT.MOLESTIA, label: 'Molestia', detalle: p.additionalPainDetails.trim() })
  }

  // Técnica
  if (d.technical?.hasDifficulty) {
    const det = (d.technical?.additionalTechnicalDetails || d.technical?.mainTechnicalDetails || '').trim()
    aspectos.push({ categoria: CAT.TECNICA, label: 'Dificultad técnica', detalle: det || null })
  }

  // Comprensión — el formulario guarda el detalle en understanding.details
  if (d.understanding?.unclearExercise) {
    const det = (d.understanding?.details || d.understanding?.unclearExerciseDetails || '').trim()
    aspectos.push({ categoria: CAT.COMPRENSION, label: 'No entendió un ejercicio', detalle: det || null })
  }

  // Material — el formulario guarda el detalle en equipment.details
  if (d.equipment?.missingEquipment) {
    const det = (d.equipment?.details || d.equipment?.missingEquipmentDetails || '').trim()
    aspectos.push({ categoria: CAT.MATERIAL, label: 'Falta de material', detalle: det || null })
  }

  // Duración: solo cuando sesión tiene duracion_min prevista y se supera en >15
  const durPrev = ses?.duracion_min
  const durReal = d.duration?.minutes
  if (durPrev && durReal && (durReal - durPrev) > 15) {
    aspectos.push({
      categoria: CAT.DURACION,
      label: 'Duración',
      detalle: `${durReal} min realizados · ${durPrev} min previstos`,
    })
  }

  // Comentario (cualquier texto, positivo o no)
  if (d.generalComments?.trim()) {
    aspectos.push({ categoria: CAT.COMENTARIO, label: 'Comentario', detalle: d.generalComments.trim() })
  }

  return aspectos
}

// ── Rachas acumulativas ───────────────────────────────────────────────────────
// feedsConSesAsc: feedbacks con _fecha, ordenados ASC por fecha de sesión
// Devuelve array de { categoria, label, sesionFeedbackId, fecha }
// — cada racha se asocia al ÚLTIMO feedback de la racha activa actual

export function calcularRachas(feedsConSesAsc) {
  const rachas = []

  // ── SUEÑO ──
  // Participan solo feedbacks con sueno.value != null
  // >=4 rompe ambas rachas; <=2 cuenta como "mala"; ==3 como "regular"
  // La mala y la regular son mutuamente excluyentes en el estado actual
  {
    const feedsSueno = feedsConSesAsc.filter(f => f.data?.sueno?.value != null)
    let rMala = [], rRegular = []
    for (const f of feedsSueno) {
      const v = f.data.sueno.value
      if (v <= 2) {
        rMala.push(f)
        rRegular = []
      } else if (v === 3) {
        rRegular.push(f)
        rMala = []
      } else { // >= 4
        rMala = []
        rRegular = []
      }
    }
    if (rMala.length >= 3) {
      const last = rMala[rMala.length - 1]
      rachas.push({ categoria: CAT.SUENO, sesionFeedbackId: last.id, fecha: last._fecha, label: `Sueño bajo · ${rMala.length} registros consecutivos ≤2/5` })
    } else if (rRegular.length >= 3) {
      const last = rRegular[rRegular.length - 1]
      rachas.push({ categoria: CAT.SUENO, sesionFeedbackId: last.id, fecha: last._fecha, label: `Sueño regular mantenido · ${rRegular.length} registros consecutivos (3/5)` })
    }
  }

  // ── RECUPERACIÓN ──
  // Participan solo feedbacks con tqr.value != null
  // <=5 cuenta; >5 rompe
  {
    const feedsTQR = feedsConSesAsc.filter(f => f.data?.tqr?.value != null)
    let racha = []
    for (const f of feedsTQR) {
      if (f.data.tqr.value <= 5) {
        racha.push(f)
      } else {
        racha = []
      }
    }
    if (racha.length >= 3) {
      const last = racha[racha.length - 1]
      rachas.push({ categoria: CAT.RECUPERACION, sesionFeedbackId: last.id, fecha: last._fecha, label: `Recuperación baja · ${racha.length} sesiones consecutivas ≤5/10` })
    }
  }

  // ── CUMPLIMIENTO ──
  // Participan feedbacks con completion.status != null
  // partial/missed cuenta; completed rompe
  {
    const feedsStatus = feedsConSesAsc.filter(f => f.data?.completion?.status != null)
    let racha = []
    for (const f of feedsStatus) {
      const s = f.data.completion.status
      if (s === 'partial' || s === 'missed') {
        racha.push(f)
      } else if (s === 'completed') {
        racha = []
      }
    }
    if (racha.length >= 2) {
      const last = racha[racha.length - 1]
      rachas.push({ categoria: CAT.CUMPLIMIENTO, sesionFeedbackId: last.id, fecha: last._fecha, label: `Cumplimiento · ${racha.length} sesiones consecutivas sin completar al 100%` })
    }
  }

  return rachas
}

// ── Motor principal ───────────────────────────────────────────────────────────
/**
 * calcularSeguimiento
 *
 * @param {Object} opts
 * @param {Array}  opts.feedbacks       — [{id, sesion_id, data, submitted_at}]
 * @param {Array}  opts.sesiones        — [{id, titulo, fecha, cliente_id, duracion_min}]
 * @param {Array}  opts.revisadas       — [{sesion_feedback_id, categoria}]
 * @param {Array}  [opts.molestiaReps]  — [{sesion_feedback_id, estado, episodio_id}]
 * @param {Object} [opts.clienteMap]    — {clienteId: {nombre}} para modo multi-cliente
 *
 * @returns {Array} items normalizados, ordenados por fecha DESC
 *   Cada item: { id, tipo:'sesion'|'racha', sesionFeedbackId, sesionId?,
 *                clienteId, clienteNombre?, sesionTitulo, fecha, status,
 *                aspectos, categoriasPendientes, categoriasRevisadas,
 *                isPendiente }
 */
export function calcularSeguimiento({ feedbacks, sesiones, revisadas, molestiaReps = [], clienteMap = {} }) {
  const sesMap  = Object.fromEntries(sesiones.map(s => [s.id, s]))
  const revisSet = new Set(revisadas.map(r => `${r.sesion_feedback_id}:${r.categoria}`))
  const molMap  = {}
  for (const r of molestiaReps) {
    if (r.sesion_feedback_id) molMap[r.sesion_feedback_id] = r
  }

  // Enriquecer feedbacks con fecha de sesión y referencia a sesión
  const feedsEnriquecidos = feedbacks
    .map(fb => {
      const ses = sesMap[fb.sesion_id] || {}
      return {
        ...fb,
        _ses:   ses,
        _fecha: ses.fecha || fb.submitted_at?.slice(0, 10) || '',
      }
    })
    .filter(fb => fb._fecha) // descartar sin fecha

  // Ordenar ASC para cálculo de rachas
  const feedsAsc  = [...feedsEnriquecidos].sort((a, b) => a._fecha.localeCompare(b._fecha))
  // Ordenar DESC para display
  const feedsDesc = [...feedsEnriquecidos].sort((a, b) => b._fecha.localeCompare(a._fecha))

  const items = []

  // ── Items individuales (por sesión/feedback) ──
  for (const fb of feedsDesc) {
    const ses     = fb._ses
    const d       = fb.data || {}
    const status  = d.completion?.status || null

    const aspectos = calcularAspectosIndividuales(fb, ses)

    // Enriquecer molestia con estado de salud si existe
    const molIdx = aspectos.findIndex(a => a.categoria === CAT.MOLESTIA)
    if (molIdx >= 0 && molMap[fb.id]) {
      aspectos[molIdx].molestiaEstado   = molMap[fb.id].estado   // 'pendiente'|'vinculado'|'descartado'
      aspectos[molIdx].molestiaEpisodio = molMap[fb.id].episodio_id
    }

    // Parcial sin motivo crítico → no genera aspecto individual, solo participa en racha
    const tieneAspectoCritico = aspectos.some(a => [CAT.MOLESTIA, CAT.TECNICA, CAT.COMPRENSION, CAT.MATERIAL, CAT.RPE].includes(a.categoria))
    const statusLabel = status === 'partial' && !tieneAspectoCritico ? null // contexto informativo
      : status === 'missed' ? 'No realizada'
      : status === 'partial' ? 'Completada parcialmente'
      : null

    const categoriasPendientes = aspectos.filter(a => !revisSet.has(`${fb.id}:${a.categoria}`)).map(a => a.categoria)
    const categoriasRevisadas  = aspectos.filter(a =>  revisSet.has(`${fb.id}:${a.categoria}`)).map(a => a.categoria)

    const clienteId = ses.cliente_id
    const clienteNombre = clienteMap[clienteId]?.nombre || null

    items.push({
      id:                    fb.id,
      tipo:                  'sesion',
      sesionFeedbackId:      fb.id,
      sesionId:              fb.sesion_id,
      clienteId,
      clienteNombre,
      sesionTitulo:          ses.titulo || '—',
      fecha:                 fb._fecha,
      status,
      statusLabel,
      aspectos,
      categoriasPendientes,
      categoriasRevisadas,
      isPendiente:           categoriasPendientes.length > 0,
    })
  }

  // ── Fusionar rachas en el item de sesión correspondiente ──
  // Cada racha se asocia al último feedback de la racha activa (por sesionFeedbackId).
  // Se añade como aspecto adicional al item de sesión que ya existe con ese id.
  // Si no hay item coincidente (caso edge muy improbable), la racha se descarta.
  const rachas = calcularRachas(feedsAsc)
  for (const racha of rachas) {
    const isRevisado = revisSet.has(`${racha.sesionFeedbackId}:${racha.categoria}`)
    const itemIdx = items.findIndex(i => i.sesionFeedbackId === racha.sesionFeedbackId)
    if (itemIdx >= 0) {
      const item = items[itemIdx]
      item.aspectos.push({ categoria: racha.categoria, label: racha.label, detalle: null })
      if (isRevisado) {
        item.categoriasRevisadas.push(racha.categoria)
      } else {
        item.categoriasPendientes.push(racha.categoria)
        item.isPendiente = true
      }
    }
  }

  // Ordenar: fecha DESC (rachas y sesiones mezcladas por fecha)
  items.sort((a, b) => b.fecha.localeCompare(a.fecha))

  return items
}
