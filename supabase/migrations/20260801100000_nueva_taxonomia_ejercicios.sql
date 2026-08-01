-- Fase 1+2: Añade columnas nuevas de taxonomía a ejercicios_biblioteca.
-- Las columnas antiguas (zona_corporal, objetivo, nivel_aproximacion) se eliminan en Fase 3
-- una vez verificado el nuevo frontend en producción.
-- patron_movimiento, lateralidad_apoyo, tipo_contraccion se conservan pero se vaciarán en Fase 3.

ALTER TABLE public.ejercicios_biblioteca
  ADD COLUMN IF NOT EXISTS complejo_articular  text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estructura_anatomica text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plano_movimiento     text[] DEFAULT '{}';
