-- Migración: remove_planificaciones_token_publico
-- Fecha: 2026-07-29
-- Elimina el antiguo sistema público /plan/[token] de Supabase.
-- PlanPublica.jsx y la ruta /plan/[token] ya fueron eliminados del frontend.

-- Políticas RLS del antiguo sistema /plan/[token]
drop policy if exists "público - planificaciones por token" on public.planificaciones;
drop policy if exists "público - bloques" on public.bloques;
drop policy if exists "público - subbloques" on public.subbloques;
drop policy if exists "público - semanas" on public.semanas;

-- Columna obsoleta
alter table public.planificaciones
drop column if exists token_publico;
