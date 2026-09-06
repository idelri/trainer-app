/**
 * clonarSesion — helper centralizado de clonación de sesiones
 *
 * Copia la PRESCRIPCIÓN completa de una sesión (y sus bloques, ejercicios,
 * fases y grupos) hacia un cliente/fecha de destino.
 *
 * EXCLUYE deliberadamente:
 *   - id, token_publico, created_at, orden          → se regeneran
 *   - pack_id, sesion_original_id                   → son relaciones del cliente origen
 *   - _tipo, _estadoColor, _fechaVisual, _prevista   → campos virtuales del calendario
 *   - km_real, duracion_real, rpe_real,
 *     zona1_2_real, zona3_4_real, zona5_real         → ejecución real del cliente origen
 *   - completada_el                                  → fecha en que el cliente realizó la sesión
 *   - estado_manual                                  → estado de realización override
 *   - lista, estado                                  → se resetean a false / 'pendiente'
 *   - valores_reales (ejercicios)                    → marcas reales del cliente
 *
 * CONSERVA deliberadamente:
 *   - biblioteca_id (ejercicios): identifica qué entrada de biblioteca
 *     originó el ejercicio; es una referencia conceptual compartida entre
 *     clientes y no supone datos de ejecución.
 *
 * @param {object} supabase   — cliente Supabase ya inicializado
 * @param {string} sesionId   — UUID de la sesión origen
 * @param {object} opts
 * @param {string} opts.clienteDestino  — UUID del cliente destino
 * @param {string} opts.fecha           — fecha de destino (yyyy-MM-dd) o null
 * @param {string} [opts.titulo]        — si se pasa, sobreescribe el título (útil para "copia")
 * @returns {{ data: nuevaSesion, error }}
 */
export async function clonarSesion(supabase, sesionId, { clienteDestino, fecha, titulo } = {}) {
  // ── 1. Leer sesión origen desde BD ──────────────────────────────────────
  const { data: fuente, error: errRead } = await supabase
    .from('sesiones')
    .select('*')
    .eq('id', sesionId)
    .single()
  if (errRead || !fuente) {
    return { data: null, error: errRead || new Error('Sesión origen no encontrada') }
  }

  // ── 2. Construir payload de prescripción (spread + exclusión explícita) ─
  const {
    // IDs / metadatos auto-generados
    id: _id, token_publico: _tk, created_at: _ca, orden: _ord,
    // FK cliente-específicas que no deben copiarse
    pack_id: _pk, sesion_original_id: _soid,
    // Campos virtuales del calendario (no existen en BD)
    _tipo: _virt, _estadoColor: _ec, _fechaVisual: _fv, _prevista: _pv,
    // Ejecución real del cliente origen
    km_real: _kmr, duracion_real: _dr, rpe_real: _rpr,
    zona1_2_real: _z12r, zona3_4_real: _z34r, zona5_real: _z5r,
    completada_el: _cel, estado_manual: _em,
    // Campos que se resetean siempre
    lista: _lista, estado: _estado,
    // Campos que se sobreescriben con los de destino
    cliente_id: _cid, fecha: _fecha,
    ...prescripcion
  } = fuente

  // ── 3. Insertar nueva sesión ─────────────────────────────────────────────
  const { data: nuevaSesion, error: errSesion } = await supabase
    .from('sesiones')
    .insert({
      ...prescripcion,
      cliente_id: clienteDestino,
      fecha: fecha ?? null,
      lista: false,
      estado: 'pendiente',
      ...(titulo !== undefined ? { titulo } : {}),
    })
    .select()
    .single()
  if (errSesion || !nuevaSesion) {
    return { data: null, error: errSesion || new Error('Error insertando sesión destino') }
  }

  // ── 4. Bloques de fuerza ─────────────────────────────────────────────────
  const { data: bls } = await supabase
    .from('sesion_bloques')
    .select('*')
    .eq('sesion_id', fuente.id)
    .order('orden')
  for (const b of bls || []) {
    const { id: _bid, sesion_id: _bsid, ...bloquePayload } = b
    const { data: nb } = await supabase
      .from('sesion_bloques')
      .insert({ ...bloquePayload, sesion_id: nuevaSesion.id })
      .select()
      .single()
    if (!nb) continue

    const { data: ejs } = await supabase
      .from('sesion_ejercicios')
      .select('*')
      .eq('bloque_id', b.id)
      .order('orden')
    for (const e of ejs || []) {
      const {
        id: _eid, bloque_id: _ebid,
        // Ejecución real — excluida
        valores_reales: _vr,
        ...ejPayload
      } = e
      // biblioteca_id se conserva: identifica el ejercicio de biblioteca de origen
      const { error: errEj } = await supabase
        .from('sesion_ejercicios')
        .insert({ ...ejPayload, bloque_id: nb.id })
      if (errEj) console.error('[clonarSesion] error ejercicio:', errEj.message, ejPayload)
    }
  }

  // ── 5. Grupos de carrera ─────────────────────────────────────────────────
  const { data: grupos } = await supabase
    .from('sesion_fase_grupos')
    .select('*')
    .eq('sesion_id', fuente.id)
    .order('orden')
  const gruposMap = {}
  for (const g of grupos || []) {
    const { data: ng } = await supabase
      .from('sesion_fase_grupos')
      .insert({ sesion_id: nuevaSesion.id, repeticiones: g.repeticiones, orden: g.orden })
      .select()
      .single()
    if (ng) gruposMap[g.id] = ng.id
  }

  // ── 6. Fases de carrera ──────────────────────────────────────────────────
  const { data: fases } = await supabase
    .from('sesion_fases')
    .select('*')
    .eq('sesion_id', fuente.id)
    .order('orden')
  for (const f of fases || []) {
    const { id: _fid, sesion_id: _fsid, grupo_id: _fgid, ...fasePayload } = f
    const { error: errF } = await supabase
      .from('sesion_fases')
      .insert({
        ...fasePayload,
        sesion_id: nuevaSesion.id,
        grupo_id: f.grupo_id ? (gruposMap[f.grupo_id] ?? null) : null,
      })
    if (errF) console.error('[clonarSesion] error fase:', errF.message)
  }

  return { data: nuevaSesion, error: null }
}
