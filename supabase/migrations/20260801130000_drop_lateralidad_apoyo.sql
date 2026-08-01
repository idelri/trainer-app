-- Limpieza final: elimina lateralidad_apoyo tras verificar que el nuevo sistema
-- (familia + posicion_ejercicio + patron_movimiento rediseñado) funciona en producción.

ALTER TABLE public.ejercicios_biblioteca DROP COLUMN IF EXISTS lateralidad_apoyo;
