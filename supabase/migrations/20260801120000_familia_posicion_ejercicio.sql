-- Fase aditiva: añade familia y posicion_ejercicio a ejercicios_biblioteca.
-- lateralidad_apoyo se elimina en la migración de limpieza posterior,
-- solo tras verificar que el nuevo frontend funciona en producción.

ALTER TABLE public.ejercicios_biblioteca
  ADD COLUMN IF NOT EXISTS familia            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS posicion_ejercicio text[] NOT NULL DEFAULT '{}';
