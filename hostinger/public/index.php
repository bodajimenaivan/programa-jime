<?php
// Entrada de la app: entrega el HTML con la ruta base y los archivos compilados.
declare(strict_types=1);

$script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
$base = rtrim(dirname($script), '/') . '/';
$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$maxMb = (int)($cfg['max_upload_mb'] ?? 1024);

$manifest = @json_decode((string)@file_get_contents(__DIR__ . '/assets/.vite/manifest.json'), true) ?: [];
$entry = $manifest['index.html'] ?? null;
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
?><!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f2ec">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#13120f">
  <meta name="robots" content="noindex">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Grilla</title>
  <base href="<?= $h($base) ?>">
  <link rel="icon" href="<?= $h($base) ?>favicon.svg" type="image/svg+xml">
  <script>window.__GRILLA__ = <?= json_encode(['base' => $base, 'maxMb' => $maxMb, 'chunkMb' => 4, 'overridePatch' => true]) ?>;</script>
<?php if ($entry): ?>
<?php foreach (($entry['css'] ?? []) as $css): ?>
  <link rel="stylesheet" href="<?= $h($base . 'assets/' . $css) ?>">
<?php endforeach; ?>
  <script type="module" src="<?= $h($base . 'assets/' . $entry['file']) ?>"></script>
<?php endif; ?>
</head>
<body class="min-h-dvh font-sans antialiased">
  <div id="root"></div>
<?php if (!$entry): ?>
  <p style="font-family:sans-serif;padding:24px">Falta la carpeta <code>assets/</code>. Volvé a subir el ZIP completo.</p>
<?php endif; ?>
</body>
</html>
