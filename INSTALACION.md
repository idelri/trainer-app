# Trainer App — Guía de instalación

## Lo que necesitas (gratis todo)
- Cuenta en **Supabase** → https://supabase.com
- Cuenta en **Vercel** → https://vercel.com
- **Node.js** instalado en tu ordenador → https://nodejs.org (versión 18+)

---

## Paso 1 — Configura Supabase (base de datos)

1. Entra en https://supabase.com y crea un proyecto nuevo (elige un nombre y contraseña)
2. Espera ~2 minutos a que se cree
3. Ve a **SQL Editor** en el menú lateral
4. Copia el contenido de `supabase-schema.sql` y pégalo en el editor
5. Haz clic en **Run** — esto crea las 4 tablas e inserta tus 12 clientes
6. Ve a **Authentication > Users** y haz clic en **Add user**
   - Introduce tu email y una contraseña
   - Activa "Auto Confirm User"
7. Ve a **Project Settings > API** y copia:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (la clave larga)

---

## Paso 2 — Configura el proyecto localmente

1. Abre una terminal en la carpeta `trainer-app`
2. Copia el archivo de variables de entorno:
   ```
   cp .env.example .env.local
   ```
3. Abre `.env.local` y pega tus credenciales de Supabase:
   ```
   REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=tu-clave-aqui
   ```
4. Instala las dependencias:
   ```
   npm install
   ```
5. Arranca la app en local para probar:
   ```
   npm start
   ```
   Se abrirá en http://localhost:3000

---

## Paso 3 — Despliega en Vercel (acceso desde cualquier dispositivo)

1. Instala Vercel CLI (opcional) o usa la web
2. **Opción web (más fácil)**:
   - Sube la carpeta `trainer-app` a GitHub
   - Ve a https://vercel.com > New Project > importa el repo
   - En **Environment Variables** añade las dos variables de `.env.local`
   - Haz clic en **Deploy**
3. Vercel te dará una URL tipo `https://trainer-app-xxx.vercel.app`
4. Esa URL funciona igual en móvil y ordenador

---

## Copia de seguridad

En la app, el botón **"Exportar CSV"** (sidebar, abajo) descarga 4 archivos:
- `clientes_FECHA.csv`
- `servicios_FECHA.csv`
- `pagos_FECHA.csv`
- `tareas_FECHA.csv`

Guárdalos en una carpeta en tu ordenador o iCloud/Google Drive una vez al mes.

---

## Generación automática de pagos

Cada vez que entras en la app al inicio de un mes nuevo, se generan automáticamente
las mensualidades pendientes para todos los clientes activos. No tienes que hacer nada.

Las sesiones sueltas (clientes híbridos como Luis González o Xavi Lucas) se añaden
manualmente desde **Pagos > Añadir sesión**.
