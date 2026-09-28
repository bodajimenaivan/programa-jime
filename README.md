# grilla

Calendario de contenido, aprobaciones y tareas para community managers y agencias. Cada cliente es un perfil propio (se cambia de cuenta como en Instagram), cada pieza se ve tal como va a quedar publicada, y el cliente aprueba o pide cambios desde un link, sin crearse una cuenta.

Diseñada mobile first: barra inferior en el celular, barra lateral en desktop, modo oscuro automático.

## Qué hace

**Clientes (multi-perfil)**
- Un perfil por marca, con foto, color, @usuario y las redes que manejás.
- Selector tipo Instagram desde el nombre de arriba. Un aro de color marca a los clientes que te pidieron cambios.
- Cada cliente tiene un link de aprobación privado. Se puede regenerar si se filtra.

**Calendario**
- Vista **Mes** con miniaturas por día y color de estado. En mobile se desliza para cambiar de mes; en desktop arrastrás una pieza a otro día para moverla.
- Vista **Lista** agrupada por día, con filtro por estado.
- Vista **Feed**: la grilla del perfil de Instagram como va a quedar.
- Formatos: post, carrusel, reel, historia y TikTok. Redes: Instagram, TikTok, Facebook y LinkedIn.
- Estados: borrador → para aprobar → con cambios / aprobado → programado → publicado.

**Piezas y archivos**
- Fotos y videos de **hasta 1 GB por archivo** (configurable). La subida va por partes de 8 MB con el protocolo [tus](https://tus.io): si se corta el wifi, sigue desde donde quedó, incluso después de recargar la página.
- Para los videos se genera una portada en el navegador, así el calendario carga rápido.
- Vista previa en vivo: post y carrusel como en el feed, reel y TikTok en 9:16 con sus íconos, historia con barras de progreso. El video se reproduce y se puede adelantar.
- Copy con contador de caracteres y hashtags, notas internas que el cliente no ve, duplicar y eliminar.
- Botón **Pedir aprobación**: pasa la pieza a “Para aprobar” y copia (o comparte, en el celu) un link directo a esa pieza.

**Link del cliente** (`/p/<token>`)
- Pestaña “Para aprobar” y calendario completo. Cada pieza se ve con la vista previa real.
- **Aprobar**, **Pedir cambios** (con comentario obligatorio) o dejar un comentario. La primera vez se le pide el nombre, así el equipo sabe quién aprobó.
- Los comentarios aparecen en la conversación de cada pieza, del lado del equipo.

**Tareas (Kanban)**
- Por cliente: Por hacer, En curso, En revisión y Listo.
- Arrastrar y soltar (con mouse o con el dedo, manteniendo apretado). En mobile, las columnas se recorren deslizando.
- Vencimiento (en rojo si está vencida), prioridad, responsable y pieza relacionada.

**Métricas y reportes**
- Carga mensual por red: seguidores, alcance, impresiones, interacciones y visitas al perfil.
- Tarjetas con variación contra el mes anterior, seguidores por red (últimos 6 meses) y alcance mensual.
- Mejores publicaciones del mes (los resultados se cargan desde la ficha de cada pieza publicada).
- **Reporte para el cliente** listo para imprimir o guardar como PDF, y exportación a **CSV** para Excel o Google Sheets.

## Cómo correrlo

Requiere Node 22.6 o superior.

```bash
npm install
npm run seed      # opcional: carga un espacio de demo
npm run dev
```

Abrí http://localhost:3000. Con la demo, entrá con **demo@grilla.app / demo1234**. Si no, creá una cuenta en `/registro`.

Para producción:

```bash
npm run build
npm start
```

### Variables de entorno

Copiá `.env.example` a `.env.local` y ajustá lo que necesites.

| Variable | Default | Para qué |
|---|---|---|
| `DATA_DIR` | `./data` | Carpeta con la base SQLite (`grilla.db`) y los archivos subidos (`uploads/`). |
| `MAX_UPLOAD_MB` | `1024` | Tamaño máximo por archivo, en MB. |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `1024` | Lo mismo, para el aviso en el navegador. Mantenelo igual al anterior. |
| `DEFAULT_TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria de los espacios nuevos (define qué día es “hoy”). |
| `INSECURE_COOKIES` | — | Ponelo en `1` solo si corrés en producción sin HTTPS (por ejemplo, en una red local). |

## Dónde publicarlo

Los archivos se guardan en disco, así que necesita un servidor con **disco persistente**: un VPS, Railway, Fly.io o Render con volumen. Hay un `Dockerfile` que guarda todo en `/data`; montá ahí un volumen.

- **No sirve en Vercel tal como está**: el disco es efímero y hay límites de tamaño por request. Para eso habría que mover los archivos a S3 o Cloudflare R2 (`@tus/s3-store` ya está pensado para eso).
- Si ponés **nginx** adelante, subí `client_max_body_size` a `20m` como mínimo (cada parte pesa 8 MB) y usá `proxy_request_buffering off;`.
- Con Cloudflare adelante no hay problema: cada request queda muy por debajo de su límite de 100 MB.
- Para backups alcanza con copiar la carpeta `DATA_DIR`.

## Cómo está hecho

- **Next.js 16** (App Router, Server Actions) + **React 19** + **Tailwind CSS 4**.
- **SQLite** con `better-sqlite3` y **Drizzle ORM**. Las tablas se crean solas al arrancar (`src/lib/db/migration.ts`).
- Subidas: servidor tus en `src/app/api/uploads` (`@tus/server` + `@tus/file-store`), cliente `tus-js-client` en `src/lib/uploader.ts`.
- Los archivos se sirven desde `src/app/api/media/[id]` con soporte de rangos, que Safari necesita para reproducir y adelantar video. El equipo accede con su sesión y el cliente con el token de su link.
- Sesiones propias: cookie httpOnly y contraseñas con scrypt.
- Fechas “de pared” (`YYYY-MM-DD` + `HH:MM`), así el calendario nunca se corre por zona horaria.

```
src/
  app/
    (auth)/          login y registro
    (app)/           calendario, piezas, tareas, métricas, clientes (+ actions/)
    p/[token]/       link de aprobación del cliente
    api/             subidas (tus), archivos, exportación CSV
  components/        shell, vistas previas, gráficos, UI
  lib/               base de datos, sesión, consultas, fechas, subidas
scripts/seed.mts     datos de demo
```

## Lo que todavía no hace

- **Publicar solo en las redes.** Hoy el calendario planifica y aprueba, pero no publica. Publicar solo requiere apps aprobadas en Meta (Instagram/Facebook) y TikTok, con su revisión.
- **Traer métricas automáticamente.** Se cargan a mano por mes y por pieza. Conectar la API de Meta o TikTok usaría esas mismas tablas.
- **Invitar a más gente del equipo** desde la interfaz. El modelo de datos ya contempla varios usuarios por espacio.
- **Avisos por mail o WhatsApp** cuando el cliente aprueba o pide cambios.
