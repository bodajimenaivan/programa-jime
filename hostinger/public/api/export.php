<?php
// Exporta las métricas del cliente activo en CSV (12 meses + publicaciones del mes).
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$u = current_user();
if (!$u) {
    http_response_code(401);
    exit('No autorizado');
}
$client = active_client($u);
if (!$client) {
    http_response_code(404);
    exit('Sin clientes');
}
$month = (string)($_GET['mes'] ?? '');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    http_response_code(400);
    exit('Mes inválido');
}

$labels = ['instagram' => 'Instagram', 'tiktok' => 'TikTok', 'facebook' => 'Facebook', 'linkedin' => 'LinkedIn'];
$networks = json_decode($client['networks'], true) ?: [];
[$y, $mo] = array_map('intval', explode('-', $month));
$months = [];
for ($i = 11; $i >= 0; $i--) {
    $idx = $y * 12 + ($mo - 1) - $i;
    $months[] = sprintf('%04d-%02d', intdiv($idx, 12), $idx % 12 + 1);
}
$rows = all('SELECT * FROM g_metrics WHERE client_id = ? AND month BETWEEN ? AND ?', [$client['id'], $months[0], $month]);
$by = [];
foreach ($rows as $r) $by[$r['month']][$r['network']] = $r;

$slug = preg_replace('/[^a-z0-9._-]/i', '', $client['handle']);
header('Content-Type: text/csv; charset=utf-8');
header("Content-Disposition: attachment; filename=\"metricas-$slug-$month.csv\"");
$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF"); // BOM para que Excel respete los acentos
fputcsv($out, ['Mes', 'Red', 'Seguidores', 'Alcance', 'Impresiones', 'Interacciones', 'Visitas al perfil'], ',', '"', '');
foreach ($months as $m) {
    foreach ($networks as $n) {
        $r = $by[$m][$n] ?? null;
        fputcsv($out, [$m, $labels[$n] ?? $n, $r['followers'] ?? '', $r['reach'] ?? '', $r['impressions'] ?? '', $r['interactions'] ?? '', $r['profile_visits'] ?? ''], ',', '"', '');
    }
}
fputcsv($out, [], ',', '"', '');
fputcsv($out, ['Publicaciones del mes', 'Fecha', 'Formato', 'Alcance', 'Me gusta', 'Comentarios', 'Guardados', 'Compartidos', 'Reproducciones'], ',', '"', '');
$posts = all("SELECT * FROM g_posts WHERE client_id = ? AND status = 'published' AND `date` BETWEEN ? AND ? ORDER BY `date`", [$client['id'], "$month-01", "$month-31"]);
foreach ($posts as $p) {
    $x = $p['post_metrics'] ? json_decode($p['post_metrics'], true) : null;
    if (!$x) continue;
    fputcsv($out, [$p['title'], $p['date'], $p['format'], $x['reach'] ?? 0, $x['likes'] ?? 0, $x['comments'] ?? 0, $x['saves'] ?? 0, $x['shares'] ?? 0, $x['views'] ?? 0], ',', '"', '');
}
fclose($out);
