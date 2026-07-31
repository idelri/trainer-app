-- Crea la RPC que recupera el clon más reciente ejecutado pero sin feedback.
-- Permite restaurar el estado clonToken en SesionPublica.jsx tras una recarga.
-- Busca por token del original (nunca por cliente_id).

CREATE OR REPLACE FUNCTION public.get_clon_pendiente_feedback_por_token_original(p_token text)
RETURNS TABLE(clon_id uuid, clon_token text, fecha date, estado text, completada_el date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_original_id uuid;
BEGIN
  SELECT s.id INTO v_original_id
  FROM   public.sesiones s
  WHERE  s.token_publico = p_token;

  IF v_original_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT c.id,
         c.token_publico,
         c.fecha,
         c.estado,
         c.completada_el
  FROM   public.sesiones c
  WHERE  c.sesion_original_id = v_original_id
    AND  c.completada_el IS NOT NULL
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.sesion_feedback sf
           WHERE  sf.sesion_id = c.id
         )
  ORDER BY c.completada_el DESC, c.created_at DESC, c.id DESC
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_clon_pendiente_feedback_por_token_original(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clon_pendiente_feedback_por_token_original(text) TO anon, authenticated;
