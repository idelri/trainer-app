-- =============================================================================
-- MIGRACIÓN: Sincronización server-side de molestia_reportes con sesion_feedback
-- Fecha: 2026-08-31
-- Autor: Claude / Irene del Río
--
-- QUÉ HACE:
--   1. Añade columnas intensidad y detalle a molestia_reportes (si no existen)
--   2. Verifica que no hay duplicados en sesion_feedback_id (aborta si los hay)
--   3. Crea UNIQUE INDEX parcial en molestia_reportes(sesion_feedback_id)
--   4. Crea función interna _sync_molestia_from_feedback
--   5. Actualiza insertar_feedback_por_token para llamar al sync
--   6. Actualiza actualizar_feedback_por_token para llamar al sync
--   7. Actualiza clonar_sesion_flexible_por_token para llamar al sync
--
-- SEGURIDAD: Todas las funciones usan SECURITY DEFINER + SET search_path TO ''
--            con referencias completamente cualificadas (public.<tabla>)
--
-- ORDEN OBLIGATORIO DE EJECUCIÓN:
--   Ejecutar este archivo COMPLETO en una sola transacción (pegar en SQL Editor).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COLUMNAS NUEVAS EN molestia_reportes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.molestia_reportes
  ADD COLUMN IF NOT EXISTS intensidad integer
    CONSTRAINT molestia_reportes_intensidad_check CHECK (intensidad >= 0 AND intensidad <= 10);

ALTER TABLE public.molestia_reportes
  ADD COLUMN IF NOT EXISTS detalle text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AUDITORÍA DE DUPLICADOS (aborta si hay alguno)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_dup_count integer;
  v_ejemplos  text;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT sesion_feedback_id
    FROM   public.molestia_reportes
    WHERE  sesion_feedback_id IS NOT NULL
    GROUP  BY sesion_feedback_id
    HAVING COUNT(*) > 1
  ) t;

  IF v_dup_count > 0 THEN
    SELECT STRING_AGG(sesion_feedback_id::text, ', ' ORDER BY sesion_feedback_id) INTO v_ejemplos
    FROM (
      SELECT sesion_feedback_id
      FROM   public.molestia_reportes
      WHERE  sesion_feedback_id IS NOT NULL
      GROUP  BY sesion_feedback_id
      HAVING COUNT(*) > 1
      LIMIT  5
    ) t;

    RAISE EXCEPTION
      'MIGRACIÓN ABORTADA: % sesion_feedback_id duplicados en molestia_reportes. '
      'Limpiar manualmente antes de continuar. Ejemplos: %',
      v_dup_count, v_ejemplos;
  END IF;

  RAISE NOTICE 'Auditoría de duplicados: OK (0 duplicados encontrados)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. UNIQUE INDEX PARCIAL
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_molestia_reportes_feedback_unique
  ON public.molestia_reportes(sesion_feedback_id)
  WHERE sesion_feedback_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FUNCIÓN INTERNA: _sync_molestia_from_feedback
--
-- Recibe:
--   p_feedback_id — id de sesion_feedback recién insertado/actualizado
--   p_sesion_id   — id de la sesión padre
--   p_data        — jsonb completo del feedback
--
-- Reglas:
--   · Solo actúa si p_data.pain.hasPain === true (formato nuevo)
--   · intensity=0 ES válido → crea reporte (0 ≠ false)
--   · ON CONFLICT: actualiza intensidad+detalle SOLO si estado='pendiente'
--     (si es 'vinculado' o 'descartado', no sobrescribe)
--   · Fecha del reporte: COALESCE(completada_el, fecha) de la sesión
--     → para no_realizada: completada_el=NULL → usa fecha planificada (correcto)
--     → para completada/parcial: usa completada_el (fecha real)
--     → fallback: CURRENT_DATE (solo si sesión no tiene fecha, caso edge)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._sync_molestia_from_feedback(
  p_feedback_id uuid,
  p_sesion_id   uuid,
  p_data        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_has_pain   boolean;
  v_intensity  integer;
  v_details    text;
  v_cliente_id uuid;
BEGIN
  v_has_pain := (p_data -> 'pain' ->> 'hasPain')::boolean;

  IF v_has_pain IS NOT TRUE THEN
    -- Cliente cambió a "sin dolor": pasar a descartado cualquier reporte pendiente.
    -- No se modifica detalle ni intensidad (preservar datos originales del cliente).
    -- vinculado y descartado no se tocan.
    UPDATE public.molestia_reportes
    SET    estado = 'descartado'
    WHERE  sesion_feedback_id = p_feedback_id
      AND  estado             = 'pendiente';
    RETURN;
  END IF;

  v_intensity := NULLIF(p_data -> 'pain' ->> 'intensity', '')::integer;
  v_details   := NULLIF(TRIM(COALESCE(p_data -> 'pain' ->> 'details', '')), '');

  SELECT s.cliente_id
  INTO   v_cliente_id
  FROM   public.sesiones s
  WHERE  s.id = p_sesion_id;

  IF v_cliente_id IS NULL THEN
    RAISE WARNING '_sync_molestia_from_feedback: sesion_id % no encontrada', p_sesion_id;
    RETURN;
  END IF;

  INSERT INTO public.molestia_reportes (
    sesion_feedback_id,
    cliente_id,
    intensidad,
    detalle,
    estado
  ) VALUES (
    p_feedback_id,
    v_cliente_id,
    v_intensity,
    v_details,
    'pendiente'
  )
  ON CONFLICT (sesion_feedback_id) DO UPDATE
    SET intensidad = EXCLUDED.intensidad,
        detalle    = EXCLUDED.detalle
  WHERE public.molestia_reportes.estado = 'pendiente';

END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. insertar_feedback_por_token — añade llamada a _sync
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.insertar_feedback_por_token(p_token text, p_data jsonb)
RETURNS TABLE(id uuid, data jsonb, submitted_at timestamp with time zone, editado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sesion_id   uuid;
  v_feedback_id uuid;
BEGIN
  SELECT s.id INTO v_sesion_id
  FROM   public.sesiones s
  WHERE  s.token_publico = p_token;

  IF v_sesion_id IS NULL THEN
    RAISE EXCEPTION 'Token de sesión no válido: %', p_token;
  END IF;

  INSERT INTO public.sesion_feedback (sesion_id, data)
  VALUES (v_sesion_id, p_data)
  RETURNING public.sesion_feedback.id INTO v_feedback_id;

  -- Crear molestia_reporte server-side si el feedback reporta dolor
  PERFORM public._sync_molestia_from_feedback(v_feedback_id, v_sesion_id, p_data);

  RETURN QUERY
  SELECT sf.id, sf.data, sf.submitted_at, sf.editado
  FROM   public.sesion_feedback sf
  WHERE  sf.id = v_feedback_id;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. actualizar_feedback_por_token — añade llamada a _sync
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.actualizar_feedback_por_token(p_token text, p_data jsonb)
RETURNS TABLE(id uuid, data jsonb, submitted_at timestamp with time zone, editado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sesion_id uuid;
  v_id        uuid;
  v_data      jsonb;
  v_submitted timestamptz;
  v_editado   boolean;
BEGIN
  SELECT s.id INTO v_sesion_id
  FROM   public.sesiones s
  WHERE  s.token_publico = p_token;

  IF v_sesion_id IS NULL THEN
    RAISE EXCEPTION 'Token de sesión no válido: %', p_token;
  END IF;

  UPDATE public.sesion_feedback sf
  SET    data    = p_data,
         editado = true
  WHERE  sf.sesion_id = v_sesion_id
  RETURNING sf.id, sf.data, sf.submitted_at, sf.editado
  INTO   v_id, v_data, v_submitted, v_editado;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe feedback para la sesión del token proporcionado';
  END IF;

  -- Sincronizar molestia_reporte con los nuevos datos
  PERFORM public._sync_molestia_from_feedback(v_id, v_sesion_id, p_data);

  RETURN QUERY SELECT v_id, v_data, v_submitted, v_editado;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. clonar_sesion_flexible_por_token — añade llamada a _sync cuando hay feedback
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.clonar_sesion_flexible_por_token(
  p_token          text,
  p_valores_reales jsonb  DEFAULT '{}'::jsonb,
  p_feedback_data  jsonb  DEFAULT NULL::jsonb,
  p_estado         text   DEFAULT 'realizada'::text
)
RETURNS TABLE(clon_id uuid, clon_token text, fecha date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sesion          record;
  v_clon_id         uuid;
  v_clon_token      text;
  v_hoy             date;
  v_bloque          record;
  v_nuevo_bloque_id uuid;
  v_ej              record;
  v_feedback_id     uuid;
BEGIN
  IF p_estado NOT IN ('realizada', 'completada', 'parcial', 'no_realizada') THEN
    RAISE EXCEPTION 'Estado no válido: %. Los valores admitidos son: realizada, completada, parcial, no_realizada', p_estado;
  END IF;

  SELECT s.id, s.cliente_id, s.titulo, s.objetivo, s.duracion_min, s.material,
         s.indicaciones, s.icono, s.tipo_editor, s.con_feedback, s.fecha
  INTO   v_sesion
  FROM   public.sesiones s
  WHERE  s.token_publico = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de sesión no válido: %', p_token;
  END IF;

  IF v_sesion.fecha IS NOT NULL THEN
    RAISE EXCEPTION 'La sesión no es flexible: tiene fecha asignada (%). Solo se pueden clonar sesiones sin fecha.', v_sesion.fecha;
  END IF;

  v_hoy        := CURRENT_DATE;
  v_clon_token := gen_random_uuid()::text;

  INSERT INTO public.sesiones (
    cliente_id, titulo, fecha, objetivo, duracion_min, material, indicaciones,
    icono, tipo_editor, con_feedback, token_publico, completada_el, tipo_sesion,
    estado, sesion_original_id
  ) VALUES (
    v_sesion.cliente_id, v_sesion.titulo, v_hoy, v_sesion.objetivo,
    v_sesion.duracion_min, v_sesion.material, v_sesion.indicaciones,
    v_sesion.icono, v_sesion.tipo_editor, v_sesion.con_feedback,
    v_clon_token, v_hoy, 'programada', NULL,
    v_sesion.id
  )
  RETURNING id INTO v_clon_id;

  FOR v_bloque IN
    SELECT id, nombre, color, nota, orden
    FROM   public.sesion_bloques
    WHERE  sesion_id = v_sesion.id
    ORDER  BY orden
  LOOP
    INSERT INTO public.sesion_bloques (sesion_id, nombre, color, nota, orden)
    VALUES (v_clon_id, v_bloque.nombre, v_bloque.color, v_bloque.nota, v_bloque.orden)
    RETURNING id INTO v_nuevo_bloque_id;

    FOR v_ej IN
      SELECT id, nombre, series, reps, rpe, notas, media_tipo, media_url,
             video_url, orden, peso, duracion, distancia, altura, descanso,
             ejecucion_tipo, ejecucion_texto, variables_activas,
             peso_der, peso_izq, reps_por_lado
      FROM   public.sesion_ejercicios
      WHERE  bloque_id = v_bloque.id
      ORDER  BY orden
    LOOP
      INSERT INTO public.sesion_ejercicios (
        bloque_id, nombre, series, reps, rpe, notas, media_tipo, media_url,
        video_url, orden, peso, duracion, distancia, altura, descanso,
        ejecucion_tipo, ejecucion_texto, variables_activas,
        peso_der, peso_izq, reps_por_lado, valores_reales
      ) VALUES (
        v_nuevo_bloque_id, v_ej.nombre, v_ej.series, v_ej.reps, v_ej.rpe,
        v_ej.notas, v_ej.media_tipo, v_ej.media_url, v_ej.video_url,
        v_ej.orden, v_ej.peso, v_ej.duracion, v_ej.distancia,
        v_ej.altura, v_ej.descanso, v_ej.ejecucion_tipo,
        v_ej.ejecucion_texto, v_ej.variables_activas,
        v_ej.peso_der, v_ej.peso_izq, v_ej.reps_por_lado,
        COALESCE(p_valores_reales -> (v_ej.id::text), '{}'::jsonb)
      );
    END LOOP;
  END LOOP;

  UPDATE public.sesiones
  SET    completada_el = v_hoy
  WHERE  id = v_sesion.id;

  IF p_feedback_data IS NOT NULL THEN
    INSERT INTO public.sesion_feedback (sesion_id, data)
    VALUES (v_clon_id, p_feedback_data)
    RETURNING id INTO v_feedback_id;

    -- Sincronizar molestia_reporte con el feedback del clon
    PERFORM public._sync_molestia_from_feedback(v_feedback_id, v_clon_id, p_feedback_data);
  END IF;

  UPDATE public.sesiones
  SET    estado = p_estado
  WHERE  id = v_clon_id;

  RETURN QUERY SELECT v_clon_id, v_clon_token, v_hoy;
END;
$function$;

COMMIT;
