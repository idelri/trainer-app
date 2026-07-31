-- Añade la columna sesion_original_id a la tabla sesiones.
-- Permite vincular un clon de sesión flexible con su sesión original (plantilla).
-- ON DELETE SET NULL: si se elimina la plantilla, el historial de clones se conserva.

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS sesion_original_id uuid NULL
    REFERENCES public.sesiones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_original_id
  ON public.sesiones (sesion_original_id)
  WHERE sesion_original_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_original_completada
  ON public.sesiones (sesion_original_id, completada_el DESC)
  WHERE sesion_original_id IS NOT NULL AND completada_el IS NOT NULL;
