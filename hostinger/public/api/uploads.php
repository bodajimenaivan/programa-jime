<?php
// Subidas reanudables (protocolo tus, versión mínima). El navegador manda el archivo en partes
// de pocos MB: así un video de 1 GB entra aunque el hosting limite el tamaño de cada envío.
declare(strict_types=1);
require __DIR__ . '/_lib.php';

header('Tus-Resumable: 1.0.0');
header('Cache-Control: no-store');

function tus_fail(int $code, string $msg): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg . "\n";
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$override = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '');
if ($method === 'POST' && $override !== '') $method = $override;

if ($method === 'OPTIONS') {
    header('Tus-Version: 1.0.0');
    header('Tus-Extension: creation,termination');
    header('Tus-Max-Size: ' . MAX_UPLOAD_BYTES);
    http_response_code(204);
    exit;
}

$user = current_user();
if (!$user) tus_fail(401, 'Tenés que iniciar sesión para subir archivos.');
ensure_data_dir();

function parse_metadata(string $header): array
{
    $out = [];
    foreach (explode(',', $header) as $pair) {
        $parts = explode(' ', trim($pair), 2);
        if ($parts[0] === '') continue;
        $out[$parts[0]] = isset($parts[1]) ? (string)base64_decode($parts[1]) : '';
    }
    return $out;
}

function positive(?string $v): ?float
{
    if ($v === null || !is_numeric($v)) return null;
    $n = (float)$v;
    return $n > 0 ? $n : null;
}

$id = (string)($_GET['id'] ?? '');

/* ---------- Crear ---------- */
if ($method === 'POST' && $id === '') {
    $length = $_SERVER['HTTP_UPLOAD_LENGTH'] ?? '';
    if (!ctype_digit($length)) tus_fail(400, 'Falta Upload-Length.');
    $size = (int)$length;
    if ($size > MAX_UPLOAD_BYTES) tus_fail(413, 'El archivo supera el máximo de ' . round(MAX_UPLOAD_BYTES / 1073741824, 1) . ' GB.');
    $meta = parse_metadata($_SERVER['HTTP_UPLOAD_METADATA'] ?? '');
    $mime = strtolower($meta['filetype'] ?? '');
    $kind = str_starts_with($mime, 'video/') ? 'video' : (str_starts_with($mime, 'image/') ? 'image' : null);
    if (!$kind || str_contains($mime, 'svg')) tus_fail(415, 'Solo se pueden subir fotos o videos.');
    $posterId = $meta['posterId'] ?? '';
    if ($posterId !== '' && !one('SELECT id FROM g_media WHERE id = ? AND workspace_id = ?', [$posterId, $user['workspace_id']])) $posterId = '';

    $newId = bin2hex(random_bytes(16));
    if (@file_put_contents(media_path($newId), '') === false) tus_fail(500, 'No se pudo guardar el archivo. Revisá que la carpeta data/ tenga permisos de escritura.');
    q('INSERT INTO g_media (id, workspace_id, post_id, kind, mime, filename, size, width, height, duration, poster_id, position, status, created_by, created_at) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,0,?,?,?)', [
        $newId, $user['workspace_id'], $kind, $mime, mb_substr($meta['filename'] ?? 'archivo', 0, 200), $size,
        positive($meta['width'] ?? null), positive($meta['height'] ?? null), positive($meta['duration'] ?? null),
        $posterId ?: null, $size === 0 ? 'ready' : 'uploading', $user['id'], now_ms(),
    ]);
    header('Location: ' . app_base() . 'api/uploads/' . $newId);
    http_response_code(201);
    exit;
}

/* ---------- Operaciones sobre una subida existente ---------- */
if (!preg_match('/^[a-f0-9]{32}$/', $id)) tus_fail(404, 'Subida no encontrada.');
$m = one('SELECT * FROM g_media WHERE id = ? AND workspace_id = ?', [$id, $user['workspace_id']]);
$path = media_path($id);
if (!$m || !is_file($path)) tus_fail(404, 'Subida no encontrada.');
clearstatcache(true, $path);
$offset = filesize($path);

if ($method === 'HEAD') {
    header('Upload-Offset: ' . $offset);
    header('Upload-Length: ' . $m['size']);
    http_response_code(200);
    exit;
}

if ($method === 'DELETE') {
    delete_media($user['workspace_id'], [$id]);
    http_response_code(204);
    exit;
}

if ($method === 'PATCH') {
    if (($_SERVER['CONTENT_TYPE'] ?? '') !== 'application/offset+octet-stream') tus_fail(415, 'Content-Type inválido.');
    $claimed = $_SERVER['HTTP_UPLOAD_OFFSET'] ?? '';
    if (!ctype_digit($claimed)) tus_fail(400, 'Falta Upload-Offset.');
    if (function_exists('set_time_limit')) @set_time_limit(0);

    $out = fopen($path, 'ab');
    if (!$out || !flock($out, LOCK_EX)) tus_fail(423, 'La subida está ocupada, reintentando.');
    clearstatcache(true, $path);
    $offset = filesize($path);
    if ((int)$claimed !== $offset) {
        flock($out, LOCK_UN);
        fclose($out);
        header('Upload-Offset: ' . $offset);
        tus_fail(409, 'El desplazamiento no coincide.');
    }
    $in = fopen('php://input', 'rb');
    $limit = (int)$m['size'] - $offset;
    $written = 0;
    while (!feof($in) && $written < $limit) {
        $buf = fread($in, (int)min(1024 * 1024, $limit - $written));
        if ($buf === false || $buf === '') break;
        fwrite($out, $buf);
        $written += strlen($buf);
    }
    fflush($out);
    flock($out, LOCK_UN);
    fclose($out);
    fclose($in);
    clearstatcache(true, $path);
    $offset = filesize($path);
    if ($offset >= (int)$m['size']) q("UPDATE g_media SET status = 'ready' WHERE id = ?", [$id]);
    header('Upload-Offset: ' . $offset);
    http_response_code(204);
    exit;
}

tus_fail(405, 'Método no permitido.');
