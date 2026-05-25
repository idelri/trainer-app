-- =============================================
-- ESQUEMA DE BASE DE DATOS - Trainer App
-- Ejecuta esto en Supabase > SQL Editor
-- =============================================

-- 1. CLIENTES
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  estado text not null default 'activo' check (estado in ('activo', 'baja')),
  fecha_inicio date,
  objetivo text,
  created_at timestamptz default now()
);

-- 2. SERVICIOS (configuración de entrenamiento por cliente)
create table servicios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  modalidad text not null check (modalidad in ('online', 'hibrido')),
  tarifa_mensual numeric(8,2) not null default 0,
  tarifa_sesion numeric(8,2) default null,
  deporte text,
  dispositivo text,
  created_at timestamptz default now()
);

-- 3. PAGOS
create table pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text not null check (tipo in ('mensualidad', 'sesion')),
  importe numeric(8,2) not null,
  estado text not null default 'pendiente' check (estado in ('pagado', 'pendiente')),
  mes_facturado text not null,  -- formato: YYYY-MM
  fecha_pago date default null, -- null si pendiente
  metodo_pago text check (metodo_pago in ('efectivo', 'bizum')),
  notas text,
  created_at timestamptz default now()
);

-- 4. TAREAS
create table tareas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  titulo text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecho')),
  fecha_limite date default null,
  notas text,
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (básico - un solo usuario)
-- =============================================
alter table clientes enable row level security;
alter table servicios enable row level security;
alter table pagos enable row level security;
alter table tareas enable row level security;

-- Política: solo el usuario autenticado puede ver/editar sus datos
create policy "Usuario autenticado - clientes" on clientes for all using (auth.role() = 'authenticated');
create policy "Usuario autenticado - servicios" on servicios for all using (auth.role() = 'authenticated');
create policy "Usuario autenticado - pagos" on pagos for all using (auth.role() = 'authenticated');
create policy "Usuario autenticado - tareas" on tareas for all using (auth.role() = 'authenticated');

-- =============================================
-- DATOS INICIALES - tus 12 clientes
-- (ajusta los datos si algo no es exacto)
-- =============================================
insert into clientes (nombre, email, telefono, estado, fecha_inicio, objetivo) values
  ('Blanca Plana',       'bplanavilla@gmail.com',         '+34 608133257', 'activo', '2025-11-03', 'Carreras (1/2 maratón, 10k)'),
  ('Luis González',      'lluisgonzalezcanas@gmail.com',  '+34 620006305', 'activo', '2026-01-05', 'Salud. Coger rutina de entrenamiento'),
  ('Beatriz Gago Villa', 'beatrizgagovilla@gmail.com',    '+34 722414166', 'activo', '2026-03-16', 'Salud. Coger rutina de fuerza / perder peso'),
  ('Eva R',              'evarendon@hotmail.com',         '+34 619660716', 'activo', '2026-04-13', 'Salud. Coger rutina de fuerza'),
  ('Pablo Monsonet',     'jelerakmv@gmail.com',           '+34 679602884', 'activo', '2026-05-01', 'Salud. Coger rutina de fuerza / prevención lesiones'),
  ('Maite Martin Lavin', 'maitemartin91@gmail.com',       '+34 654076172', 'activo', '2026-05-01', 'Salud. Coger rutina de entrenamiento. Empezar a correr'),
  ('Xavi Lucas',         'xavilucasg@gmail.com',          '+34 617415070', 'activo', '2026-05-15', 'Salud. Mejorar síntomas hernia discal'),
  ('Carolina Fernández', 'carolina.ferfonseca@gmail.com', '+34 637422260', 'activo', '2026-05-24', 'Hyrox. Mejorar tiempos carrera'),
  ('Jose María Varela',  'josemariavarela7@gmail.com',    '+34 647404564', 'baja',   '2026-02-02', 'Carrera 1/2 maratón'),
  ('Raúl Suárez',        'raul_suareznuno@outlook.es',    '+34 628494261', 'baja',   '2026-02-02', 'Carrera 1/2 maratón'),
  ('Carla Suárez',       null,                            null,            'baja',   null,         null);
