<?php
// Solo para probar en local con `php -S`: imita las reglas de public/.htaccess.
// Uso: php -S localhost:8080 -t <docroot> hostinger/dev-router.php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$docroot = $_SERVER['DOCUMENT_ROOT'];
// Detecta la carpeta de la app (donde está index.php + api/)
$app = '';
foreach (['', '/grilla'] as $candidate) {
    if (is_file($docroot . $candidate . '/api/rpc.php') && ($candidate === '' || str_starts_with($uri, $candidate . '/') || $uri === $candidate)) $app = $candidate;
}
$rel = substr($uri, strlen($app));
$dir = $docroot . $app;
$run = function (string $script, array $get = []) use ($dir, $app) {
    $_GET = array_merge($_GET, $get);
    $_SERVER['SCRIPT_NAME'] = $app . '/' . $script;
    $_SERVER['SCRIPT_FILENAME'] = $dir . '/' . $script;
    chdir(dirname($dir . '/' . $script));
    require $dir . '/' . $script;
    return true;
};
if (preg_match('#^/api/media/([A-Za-z0-9_-]+)$#', $rel, $m)) return $run('api/media.php', ['id' => $m[1]]);
if (preg_match('#^/api/uploads/([a-f0-9]{32})$#', $rel, $m)) return $run('api/uploads.php', ['id' => $m[1]]);
if (preg_match('#^/api/uploads/?$#', $rel)) return $run('api/uploads.php');
if ($rel === '/api/export/metricas') return $run('api/export.php');
if (preg_match('#^/(data|config\.php)#', $rel)) { http_response_code(403); return true; }
if ($rel !== '/' && is_file($dir . $rel)) {
    if (str_ends_with($rel, '.php')) return $run(ltrim($rel, '/'));
    return false; // archivo estático
}
return $run('index.php');
