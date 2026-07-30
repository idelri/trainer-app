# Arquitectura de seguridad — Acceso público y tabla `clientes`

> Fecha de implementación: 2026-07-30  
> Commit de referencia: `8b084a8`  
> Afecta a: todas las rutas públicas (portales de cliente sin autenticación)  
> Estado: activo en producción

---

## El problema original

La tabla `clientes` contiene información personal de todas las clientas de la aplicación: nombre, email, teléfono, objetivos, disponibilidad, consideraciones de entrenamiento y configuración del portal.

Antes de este cambio existía la siguiente política RLS en la tabla `clientes`:

```sql
-- POLÍTICA ELIMINADA — no recrear
CREATE POLICY "público - clientes lectura"
ON public.clientes FOR SELECT TO public USING (true);
```

Esta política permitía que **cualquier petición anónima** leyera cualquier fila de la tabla `clientes` sin ninguna restricción. Cualquiera que conociera la URL de la API de Supabase podía hacer:

```
GET /rest/v1/clientes
```

y obtener los datos completos de todas las clientas: nombres, emails, teléfonos y toda la información de planificación.

La política existía porque los portales públicos (accesibles por token sin login) necesitaban leer el nombre de la clienta para mostrarlo en cabecera. En lugar de diseñar un acceso mínimo y contextual, se abrió la tabla entera al rol anónimo. Eso es inseguro aunque los tokens sean difíciles de adivinar: la vulnerabilidad está en la tabla, no en el token.

---

## Por qué era inseguro

1. **Exposición total sin autenticación.** `USING (true)` no filtra por ningún valor. El rol anónimo podía leer todos los registros, no solo el del cliente que poseía el token.

2. **Sin límite de campos.** Las consultas del frontend usaban `select('*')`, devolviendo las 15 columnas de la tabla, incluidas columnas sensibles que no se mostraban visualmente pero viajaban por la red.

3. **Independiente del token.** La política no estaba condicionada a que el solicitante conociera ningún secreto. Bastaba con hacer una petición HTTP sin credenciales.

4. **Join transitivo.** `SesionPublica.jsx` usaba `.select('*, clientes(nombre)')` sobre `sesiones`. PostgREST resuelve los joins con los permisos del rol llamante, por lo que el join también exponía datos de `clientes` a través de `sesiones`.

---

## La solución

Se eliminó la política pública y se sustituyó por funciones SQL de mínimo privilegio con las siguientes propiedades:

- **SECURITY DEFINER**: la función se ejecuta con los permisos de su propietario (`postgres`), no con los del rol llamante (`anon`). Puede leer `clientes` aunque el rol anónimo no tenga acceso directo.
- **`SET search_path = public`**: evita ataques de inyección de `search_path`.
- **Columnas explícitas**: ninguna función usa `SELECT *`. Cada una devuelve únicamente los campos que el portal necesita.
- **`LIMIT 1`**: ninguna función puede devolver más de una fila.
- **Acceso contextual**: ninguna función acepta un `cliente_id` directamente. El llamante debe conocer un token público válido (de sesión, semana, pack o cliente) para obtener cualquier dato.
- **Permisos explícitos**: `REVOKE EXECUTE FROM PUBLIC` + `GRANT EXECUTE TO anon, authenticated, service_role`. Sin roles implícitos.

---

## RPC públicas actuales

Todas las funciones viven en el esquema `public` y tienen `SECURITY DEFINER` + `SET search_path = public`.

### `get_cliente_por_token(p_token text)`

```sql
SELECT id, nombre, portal_config
FROM clientes
WHERE token_cliente = p_token
LIMIT 1;
```

| Campo devuelto | Tipo | Usado en |
|---|---|---|
| `id` | `uuid` | Queries de sesiones, packs, notas, competiciones, controles, checkins |
| `nombre` | `text` | Cabecera del portal |
| `portal_config` | `jsonb` | Control de pestañas visibles en el portal |

**Usada por:** `ClientePortal.jsx` (`/cliente/[token_cliente]`) y `CheckinPortal.jsx` (`/checkin-portal/[token_cliente]`).

---

### `get_nombre_por_token_semana` — ELIMINADA

> Eliminada 2026-07-30 junto con `CheckinSemanal.jsx` y `VistaSemanalCliente.jsx`. La columna `semanas.token_publico` también fue eliminada. No quedan consumidores.

---

### `get_nombre_por_token_pack(p_token text)`

```sql
SELECT c.nombre
FROM   packs_flexibles pk
JOIN   clientes        c ON c.id = pk.cliente_id
WHERE  pk.token_publico = p_token
LIMIT  1;
```

**Usada por:** `PackPublico.jsx` (`/pack/[token]`).

---

### `get_nombre_por_token_sesion(p_token text)`

```sql
SELECT c.nombre
FROM   sesiones  s
JOIN   clientes  c ON c.id = s.cliente_id
WHERE  s.token_publico = p_token
LIMIT  1;
```

Reemplaza el join `clientes(nombre)` que `SesionPublica.jsx` hacía directamente en la query de `sesiones`. La sesión se carga por separado sin join a `clientes`; el nombre se obtiene a través de esta función.

**Usada por:** `SesionPublica.jsx` (`/sesion/[token]`), ejecutada en paralelo dentro del `Promise.all` de carga.

---

## Relación con las políticas RLS

Después del cambio, la tabla `clientes` tiene exactamente **una política**:

```sql
CREATE POLICY "Usuario autenticado - clientes"
ON public.clientes FOR ALL
USING (auth.role() = 'authenticated');
```

Esta política da acceso completo a Irene desde el panel autenticado. Ningún rol anónimo puede leer la tabla directamente.

Las funciones `SECURITY DEFINER` no están sujetas a la RLS del rol llamante: se ejecutan como `postgres`, que tiene acceso completo. La RLS sigue activa en la tabla, pero las funciones la pasan por alto legítimamente porque el propietario tiene permisos de superusuario. Por eso el patrón es seguro: el control de acceso se mueve de "¿puede este rol leer la tabla?" a "¿conoce este llamante un token válido?".

---

## Tipos de token públicos (referencia)

| Tabla | Columna | Tipo SQL | Ruta pública |
|---|---|---|---|
| `clientes` | `token_cliente` | `text` | `/cliente/[token]`, `/checkin-portal/[token]` |
| `semanas` | `token_publico` | `uuid` | **ELIMINADO** — columna y constraint UNIQUE eliminados 2026-07-30 |
| `packs_flexibles` | `token_publico` | `text` | `/pack/[token]` |
| `sesiones` | `token_publico` | `text` | `/sesion/[token]` |

Los tokens son opacos y permanentes. **Nunca deben modificarse** salvo decisión expresa de Irene, porque los enlaces ya enviados a las clientas dejarían de funcionar.

---

## Reglas de desarrollo

Estas reglas son obligatorias para cualquier desarrollo presente y futuro que toque rutas públicas o la tabla `clientes`.

**1. Nunca consultar la tabla `clientes` desde una ruta pública.**  
Las páginas accesibles sin autenticación (`/cliente/`, `/sesion/`, `/checkin-portal/`, `/pack/`) no pueden contener `.from('clientes')`. El acceso debe ir siempre a través de una RPC contextual.

**2. Nunca crear políticas RLS `USING (true)` sobre `clientes`.**  
Una política con condición `true` sobre `clientes` equivale a publicar la tabla entera. Aunque la intención sea dar acceso a un solo campo, la política no puede hacer esa distinción de columnas. Usar siempre funciones en lugar de políticas permisivas.

**3. Todo acceso público a datos de cliente debe realizarse mediante RPCs contextuales.**  
La RPC debe recibir el token público como único argumento de entrada. No puede aceptar `cliente_id` directamente porque ese UUID no es un secreto: cualquiera que lo observe en tráfico de red podría reutilizarlo.

**4. Cada RPC debe devolver únicamente las columnas necesarias.**  
Antes de crear una función, identificar exactamente qué campos usa el componente. Si solo necesita el nombre, devolver solo `nombre`. No devolver `id` salvo que el componente lo use para queries posteriores.

**5. Prohibido `SELECT *` en funciones públicas.**  
`SELECT *` devuelve todas las columnas actuales y futuras de la tabla. Si en el futuro se añade una columna sensible a `clientes`, una función con `SELECT *` la expondría automáticamente sin que nadie lo decida conscientemente.

**6. Toda nueva ruta pública debe revisarse desde el punto de vista de seguridad antes de desplegarse.**  
Usar el checklist de la sección siguiente. La revisión debe incluir comprobación en Network del navegador y verificación de que ninguna llamada devuelve datos de `clientes` directamente.

**7. Mantener compatibilidad con los tokens públicos existentes.**  
Los tokens de cliente, semana, pack y sesión son permanentes. No renombrar columnas, no regenerar valores, no cambiar tipos. Los enlaces ya enviados a las clientas no tienen fecha de caducidad.

**8. Toda nueva función SECURITY DEFINER debe incluir `SET search_path = public`.**  
Sin esta cláusula, un atacante con permisos de creación de esquemas podría crear objetos en un esquema con mayor precedencia en el `search_path` y redirigir la ejecución de la función.

---

## Checklist antes de desplegar una ruta pública nueva

```
□ No existen consultas .from('clientes') en páginas públicas.
□ No existen JOINs hacia clientes en queries de páginas públicas
  (p.ej. .select('*, clientes(nombre)')).
□ Las RPCs devuelven únicamente los campos mínimos necesarios.
□ Las funciones SECURITY DEFINER tienen SET search_path = public.
□ No existe SELECT * en ninguna función pública.
□ Las políticas RLS públicas son las estrictamente necesarias.
□ Los enlaces existentes siguen siendo compatibles (tokens sin cambios).
□ Se han probado todas las rutas públicas en modo incógnito (rol anónimo).
□ Se ha comprobado la pestaña Network en producción:
    - Las RPCs devuelven HTTP 200.
    - No hay llamadas directas a /rest/v1/clientes desde rutas públicas.
□ Se ha verificado que /rest/v1/clientes con rol anónimo devuelve 0 filas.
```

---

## Cómo añadir una nueva ruta pública

Seguir este procedimiento cada vez que se cree un nuevo portal accesible sin autenticación.

### Paso 1 — Identificar el token de acceso

Determinar qué token público identifica el recurso. Debe ser un valor existente en la base de datos (`token_publico`, `token_cliente`, etc.), no un `id` de tabla. El token actúa como contraseña implícita: conocerlo equivale a tener acceso al recurso.

### Paso 2 — Listar los datos de `clientes` que necesita la ruta

Ser estricto. Si solo se muestra el nombre en la cabecera, la función solo devolverá `nombre`. Añadir columnas individualmente y solo cuando el componente las use de verdad.

### Paso 3 — Diseñar la RPC contextual

```sql
CREATE FUNCTION public.get_[campo]_por_token_[recurso](p_token [tipo])
RETURNS TABLE([columnas_mínimas])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT [columnas_mínimas]
  FROM   [tabla_del_recurso] r
  JOIN   clientes c ON c.id = r.cliente_id
  WHERE  r.token_publico = p_token
  LIMIT  1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_[campo]_por_token_[recurso]([tipo]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_[campo]_por_token_[recurso]([tipo]) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_[campo]_por_token_[recurso]([tipo]) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_[campo]_por_token_[recurso]([tipo]) TO service_role;
```

Aplicar en Supabase **antes** de escribir el código del componente.

### Paso 4 — Implementar el componente

En el componente React:

```js
// Correcto — usa RPC contextual
const { data: cliArr } = await supabase.rpc('get_nombre_por_token_[recurso]', { p_token: token })
setCliente(cliArr?.[0] ?? null)

// Incorrecto — nunca hacer esto desde una ruta pública
const { data } = await supabase.from('clientes').select('nombre').eq('id', clienteId)
```

### Paso 5 — Probar con rol anónimo

Antes del commit, abrir la ruta en modo incógnito y verificar en DevTools → Network:
- La RPC devuelve `200` con los datos esperados.
- No aparece ninguna llamada a `/rest/v1/clientes`.
- Con un token inválido, la RPC devuelve array vacío (no error).

### Paso 6 — Verificar RLS

Comprobar en Supabase SQL Editor:
```sql
-- Simular rol anónimo
SET LOCAL role = anon;
SELECT count(*) FROM clientes; -- debe devolver 0
```

### Paso 7 — Documentar la nueva RPC

Añadir una entrada en la sección "RPC públicas actuales" de este documento con: nombre de la función, SQL completo, campos devueltos y componente que la usa.

---

## Estado actual verificado (2026-07-30)

```sql
-- Consulta anónima directa tras eliminar la política:
SET LOCAL role = anon;
SELECT count(*) FROM clientes;
-- Resultado: 0 filas
```

Todas las rutas públicas verificadas en producción tras el despliegue del commit `8b084a8`:

| Ruta | RPC utilizada | Estado |
|---|---|---|
| `/cliente/[token]` | `get_cliente_por_token` | ✓ Verificada |
| `/checkin-portal/[token]` | `get_cliente_por_token` | ✓ Verificada |
| `/semana/[token]` | — | **ELIMINADA** 2026-07-30 |
| `/checkin/[token]` | — | **ELIMINADA** 2026-07-30 |
| `/pack/[token]` | `get_nombre_por_token_pack` | ✓ Verificada |
| `/sesion/[token]` | `get_nombre_por_token_sesion` | ✓ Verificada |
