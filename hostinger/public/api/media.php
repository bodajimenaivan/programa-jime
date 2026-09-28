<?php
// Sirve fotos y videos con soporte de rangos (Safari lo necesita para reproducir y adelantar).
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = (string)($_GET['id'] ?? '');
$share = (string)($_GET['s'] ?? '');

function deny(int $code, string $msg): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

if (!preg_match('/^[A-Za-z0-9_-]{8,64}$/', $id)) deny(404, 'No encontrado');
$m = one("SELECT * FROM g_media WHERE id = ? AND status = 'ready'", [$id]);
if (!$m) deny(404, 'No encontrado');

// El equipo entra con su sesión; el cliente con el token de su link.
$allowed = false;
$u = current_user();
if ($u && $u['workspace_id'] === $m['workspace_id']) $allowed = true;
if (!$allowed && $share !== '') {
    $c = one('SELECT * FROM g_clients WHERE share_token = ? AND archived_at IS NULL', [$share]);
    if ($c && $c['workspace_id'] === $m['workspace_id']) {
        if ($c['avatar_id'] === $m['id']) $allowed = true;
        elseif ($m['post_id'] && one('SELECT id FROM g_posts WHERE id = ? AND client_id = ?', [$m['post_id'], $c['id']])) $allowed = true;
    }
}
if (!$allowed) deny(403, 'Sin acceso');

$file = media_path($m['id']);
if (!is_file($file)) deny(404, 'Archivo faltante');
$size = filesize($file);

header('Content-Type: ' . $m['mime']);
header('Accept-Ranges: bytes');
header('Cache-Control: private, max-age=31536000, immutable');
header('ETag: "' . $m['id'] . '"');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
if (!empty($_GET['download'])) {
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($m['filename']));
}
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === '"' . $m['id'] . '"') {
    http_response_code(304);
    exit;
}

$start = 0;
$end = $size - 1;
$range = $_SERVER['HTTP_RANGE'] ?? '';
if ($range !== '' && preg_match('/bytes=(\d*)-(\d*)/', $range, $mm)) {
    if ($mm[1] === '' && $mm[2] !== '') {
        $start = max(0, $size - (int)$mm[2]);
    } else {
        $start = (int)$mm[1];
        if ($mm[2] !== '') $end = min((int)$mm[2], $size - 1);
    }
    if ($start > $end || $start >= $size) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}
header('Content-Length: ' . ($end - $start + 1));

if (function_exists('set_time_limit')) @set_time_limit(0);
while (ob_get_level() > 0) ob_end_clean();
$fh = fopen($file, 'rb');
fseek($fh, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($fh) && !connection_aborted()) {
    $chunk = fread($fh, (int)min(1024 * 1024, $left));
    if ($chunk === false) break;
    echo $chunk;
    flush();
    $left -= strlen($chunk);
}
fclose($fh);
