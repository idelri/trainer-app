-- Actualiza clonar_sesion_flexible_por_token para asignar sesion_original_id en el clon.
-- Requiere que la columna sesion_original_id exista (migración 20260731120000).

CREATE OR REPLACE FUNCTION public.clonar_sesion_flexible_por_token(
  p_token text,
  p_valores_reales jsonb DEFAULT '{}'::jsonb,
  p_feedback_data jsonb DEFAULT NULL::jsonb,
  p_estado text DEFAULT 'realizada'::text
)
RETURNS TABLE(clon_id uuid, clon_token text, fecha date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sesion          record;
  v_clon_id         uuid;
  v_clon_token      text;
  v_hoy             date;
  v_bloque          record;
  v_nuevo_bloque_id uuid;
  v_ej              record;
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
    VALUES (v_clon_id, p_feedback_data);
  END IF;

  UPDATE public.sesiones
  SET    estado = p_estado
  WHERE  id = v_clon_id;

  RETURN QUERY SELECT v_clon_id, v_clon_token, v_hoy;
END;
$function$;

REVOKE ALL ON FUNCTION public.clonar_sesion_flexible_por_token(text, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clonar_sesion_flexible_por_token(text, jsonb, jsonb, text) TO anon, authenticated;
