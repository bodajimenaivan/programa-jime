# Instalar grilla en Hostinger (plan WordPress Starter o cualquier hosting con PHP)

Esta versión corre con **PHP y MySQL**, sin nada que instalar en el servidor. Tu WordPress sigue funcionando: la app va en una carpeta aparte.

## Lo que necesitás

- El archivo **`grilla-hostinger.zip`**.
- Una base de datos MySQL creada en hPanel. Si el ZIP ya trae `config.php` con tus datos, no tenés que tocar nada.

## Paso a paso

### 1. Revisá la versión de PHP
hPanel → **Sitios web** → tu sitio → **Avanzado** → **Configuración de PHP**. Tiene que ser **8.1 o más nueva**. Si dice 7.x, cambiala y guardá.

### 2. Subí los archivos
1. hPanel → **Archivos** → **Administrador de archivos**.
2. Entrá a la carpeta **`public_html`**.
3. Creá una carpeta nueva llamada **`grilla`** (botón de carpeta con el +) y entrá.
4. Subí **`grilla-hostinger.zip`** ahí adentro.
5. Clic derecho sobre el ZIP → **Extraer** → dejá la carpeta actual (`public_html/grilla`) y confirmá.
6. Borrá el ZIP; ya no hace falta.

Te tiene que quedar así:

```
public_html/
  grilla/
    .htaccess   ← archivo oculto: si no lo ves, activá "Mostrar archivos ocultos"
    index.php
    config.php
    api/
    assets/
    data/
```

### 3. Entrá y creá tu cuenta
Abrí **`https://TU-DOMINIO/grilla/`**. Con tu dominio temporal es:

**https://rosybrown-walrus-174656.hostingersite.com/grilla/**

La primera vez te pide crear la cuenta principal. Después **el registro se cierra solo**: nadie más puede crearse una cuenta en tu hosting.

Las tablas de la base se crean solas en esa primera visita.

### 4. Listo
Agregá tus clientes y empezá a cargar la grilla. Para que un cliente apruebe, en **Clientes** tocá **Compartir** y mandale el link.

## Si algo no anda

| Qué pasa | Qué revisar |
|---|---|
| “Algo salió mal en el servidor” al crear la cuenta o entrar | Los datos de la base en `config.php`. En hPanel → **Bases de datos** fijate el nombre de la base, el usuario y la contraseña. El host casi siempre es `localhost`. |
| Página de error 404 al recargar o al abrir un link | Que el archivo **`.htaccess`** se haya extraído (es oculto). |
| “Falta config.php” | Renombrá `config.sample.php` a `config.php` y completalo. |
| La subida de un video falla | Que la carpeta `data/` tenga permisos **755** (clic derecho → Permisos). Revisá también el espacio libre en hPanel → **Uso de recursos**. |
| La app se ve sin estilos | Que la carpeta `assets/` se haya subido completa. |

## Espacio en disco

Los videos se guardan en `public_html/grilla/data/uploads/`. Con videos de hasta 1 GB el espacio se llena rápido. Mirá cuánto te queda en hPanel y borrá piezas viejas cuando ya estén publicadas.

## Seguridad

- **Cambiá la contraseña de la base de datos** si la compartiste por chat o por mail. Se hace en hPanel → **Bases de datos** → **Cambiar contraseña**. Después actualizala en `config.php` (Administrador de archivos → clic derecho → Editar).
- `config.php` y la carpeta `data/` están bloqueados desde afuera. Solo se accede a los archivos a través de la app: el equipo con su sesión y el cliente con su link.

## Copias de seguridad

1. **Base de datos:** hPanel → **Bases de datos** → **phpMyAdmin** → elegí la base → **Exportar**.
2. **Archivos:** descargá la carpeta `grilla/data/uploads` desde el Administrador de archivos.

## Actualizar a una versión nueva

Subí el ZIP nuevo a `public_html/grilla` y extraelo encima. **No borres la carpeta `data/`**: ahí están tus fotos y videos.
