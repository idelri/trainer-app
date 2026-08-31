-- =============================================================================
-- MIGRACIÓN: Soporte múltiples molestias por feedback (pain_entry_id estable)
-- Fecha: 2026-09-01
-- Autor: Claude / Irene del Río
--
-- QUÉ HACE:
--   1. Añade columna pain_entry_id (nullable) a molestia_reportes
--   2. Elimina el UNIQUE INDEX único actual (sesion_feedback_id)
--   3. Crea índice para reportes legacy     (pain_entry_id IS NULL)
--   4. Crea índice para reportes con entry  (pain_entry_id IS NOT NULL)
--   5. Reescribe _sync_molestia_from_feedback con lógica multi-entry
--
-- CONSERVA todos los reportes existentes:
--   Los reportes actuales tienen pain_entry_id = NULL → cubiertos por el
--   índice legacy sin colisión.
--
-- NO modifica ningún JSON histórico en sesion_feedback.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AUDITORÍA DE DUPLICADOS (aborta si los hay)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT sesion_feedback_id FROM public.molestia_reportes
    WHERE  sesion_feedback_id IS NOT NULL
    GROUP  BY sesion_feedback_id HAVING COUNT(*) > 1
  ) t;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % sesion_feedback_id duplicados encontrados. Limpiar antes de continuar.', v_count;
  END IF;
  RAISE NOTICE 'Auditoría duplicados: OK (0 encontrados)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NUEVA COLUMNA pain_entry_id (nullable — reportes legacy la tienen NULL)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.molestia_reportes
  ADD COLUMN IF NOT EXISTS pain_entry_id text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ELIMINAR EL ÚNICO ÍNDICE ACTUAL
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_molestia_reportes_feedback_unique;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4a. ÍNDICE PARA REPORTES LEGACY (pain_entry_id IS NULL)
--     Garantiza máximo 1 reporte por feedback en el camino del formato antiguo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX idx_molestia_reps_feedback_legacy
  ON public.molestia_reportes(sesion_feedback_id)
  WHERE sesion_feedback_id IS NOT NULL AND pain_entry_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. ÍNDICE PARA REPORTES CON ENTRY ID (pain_entry_id IS NOT NULL)
--     Garantiza máximo 1 reporte por (feedback, entrada).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX idx_molestia_reps_feedback_entry
  ON public.molestia_reportes(sesion_feedback_id, pain_entry_id)
  WHERE sesion_feedback_id IS NOT NULL AND pain_entry_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REESCRIBIR _sync_molestia_from_feedback
--
-- Lógica multi-entry:
--   · Si hasPain IS NOT TRUE → descartar todos los reportes pendientes del feedback
--   · Si pain.entries existe (nuevo formato):
--       - Por cada entry: INSERT si nuevo, UPDATE si pendiente, no-op si vinculado/descartado
--       - Por cada reporte existente cuya pain_entry_id ya no está → descartar si pendiente
--   · Si no hay entries (formato anterior con hasPain+intensity+details):
--       - Comportamiento legacy: 1 reporte por feedback, pain_entry_id = NULL
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
  v_has_pain    boolean;
  v_entries     jsonb;
  v_entry       jsonb;
  v_entry_id    text;
  v_intensity   integer;
  v_details     text;
  v_cliente_id  uuid;
  v_rep         record;
  v_submitted   text[];
BEGIN
  v_has_pain := (p_data -> 'pain' ->> 'hasPain')::boolean;

  -- ── Sin dolor: descartar todos los reportes pendientes de este feedback ──
  IF v_has_pain IS NOT TRUE THEN
    UPDATE public.molestia_reportes
    SET    estado = 'descartado'
    WHERE  sesion_feedback_id = p_feedback_id
      AND  estado             = 'pendiente';
    RETURN;
  END IF;

  v_entries := p_data -> 'pain' -> 'entries';

  -- ── Obtener cliente_id ──────────────────────────────────────────────────────
  SELECT s.cliente_id INTO v_cliente_id
  FROM   public.sesiones s
  WHERE  s.id = p_sesion_id;

  IF v_cliente_id IS NULL THEN
    RAISE WARNING '_sync_molestia_from_feedback: sesion_id % no encontrada', p_sesion_id;
    RETURN;
  END IF;

  -- ── CAMINO NUEVO: pain.entries array ────────────────────────────────────────
  IF v_entries IS NOT NULL AND jsonb_typeof(v_entries) = 'array' AND jsonb_array_length(v_entries) > 0 THEN

    -- Recopilar pain_entry_ids enviados en esta actualización
    SELECT ARRAY(
      SELECT e ->> 'id' FROM jsonb_array_elements(v_entries) e WHERE e ->> 'id' IS NOT NULL
    ) INTO v_submitted;

    -- Procesar cada entry
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_entries) LOOP
      v_entry_id  := v_entry ->> 'id';   -- puede ser null (entry legacy sin id)
      v_intensity := NULLIF(v_entry ->> 'intensity', '')::integer;
      v_details   := NULLIF(TRIM(COALESCE(v_entry ->> 'details', '')), '');

      IF v_entry_id IS NULL THEN
        -- Entry sin id: camino legacy (buscar reporte con pain_entry_id IS NULL)
        SELECT id, estado INTO v_rep
        FROM   public.molestia_reportes
        WHERE  sesion_feedback_id = p_feedback_id
          AND  pain_entry_id      IS NULL;

        IF v_rep.id IS NULL THEN
          INSERT INTO public.molestia_reportes
            (sesion_feedback_id, cliente_id, pain_entry_id, intensidad, detalle, origen)
          VALUES
            (p_feedback_id, v_cliente_id, NULL, v_intensity, v_details, 'sesion_feedback');
        ELSIF v_rep.estado = 'pendiente' THEN
          UPDATE public.molestia_reportes
          SET intensidad = v_intensity, detalle = v_details
          WHERE id = v_rep.id;
        END IF;
        -- vinculado/descartado: no-op

      ELSE
        -- Entry con UUID estable
        SELECT id, estado INTO v_rep
        FROM   public.molestia_reportes
        WHERE  sesion_feedback_id = p_feedback_id
          AND  pain_entry_id      = v_entry_id;

        IF v_rep.id IS NULL THEN
          INSERT INTO public.molestia_reportes
            (sesion_feedback_id, cliente_id, pain_entry_id, intensidad, detalle, origen)
          VALUES
            (p_feedback_id, v_cliente_id, v_entry_id, v_intensity, v_details, 'sesion_feedback');
        ELSIF v_rep.estado = 'pendiente' THEN
          UPDATE public.molestia_reportes
          SET intensidad = v_intensity, detalle = v_details
          WHERE id = v_rep.id;
        END IF;
        -- vinculado/descartado: no-op
      END IF;

    END LOOP;

    -- Descartar reportes con pain_entry_id que ya no están en el array (entrada eliminada)
    -- Afecta a reportes pendientes con pain_entry_id NOT NULL cuyo UUID ya no aparece
    UPDATE public.molestia_reportes
    SET    estado = 'descartado'
    WHERE  sesion_feedback_id = p_feedback_id
      AND  pain_entry_id IS NOT NULL
      AND  NOT (pain_entry_id = ANY(v_submitted))
      AND  estado = 'pendiente';

    -- Descartar el reporte legacy (pain_entry_id IS NULL) si el array enviado
    -- ya no contiene ninguna entry con id=null (el cliente la eliminó o se migró a UUID)
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_entries) e WHERE e ->> 'id' IS NULL
    ) THEN
      UPDATE public.molestia_reportes
      SET    estado = 'descartado'
      WHERE  sesion_feedback_id = p_feedback_id
        AND  pain_entry_id      IS NULL
        AND  estado             = 'pendiente';
    END IF;

  ELSE
    -- ── CAMINO LEGACY: pain.hasPain + intensity + details (sin entries) ─────────
    v_intensity := NULLIF(p_data -> 'pain' ->> 'intensity', '')::integer;
    v_details   := NULLIF(TRIM(COALESCE(p_data -> 'pain' ->> 'details', '')), '');

    SELECT id, estado INTO v_rep
    FROM   public.molestia_reportes
    WHERE  sesion_feedback_id = p_feedback_id
      AND  pain_entry_id      IS NULL;

    IF v_rep.id IS NULL THEN
      INSERT INTO public.molestia_reportes
        (sesion_feedback_id, cliente_id, pain_entry_id, intensidad, detalle, origen)
      VALUES
        (p_feedback_id, v_cliente_id, NULL, v_intensity, v_details, 'sesion_feedback');
    ELSIF v_rep.estado = 'pendiente' THEN
      UPDATE public.molestia_reportes
      SET intensidad = v_intensity, detalle = v_details
      WHERE id = v_rep.id;
    END IF;
    -- vinculado/descartado: no-op

  END IF;

END;
$function$;

COMMIT;
