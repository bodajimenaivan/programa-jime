<?php
// Punto de entrada JSON: el front llama { fn, args } y recibe { ok, data } o { error }.
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_SERVER['HTTP_X_GRILLA'] ?? '') !== '1') {
    json_out(['error' => 'Método no permitido'], 405);
    exit;
}

$body = json_decode((string)file_get_contents('php://input'), true);
$fn = is_array($body) ? (string)($body['fn'] ?? '') : '';
$args = is_array($body['args'] ?? null) ? $body['args'] : [];

$API = [
    // sesión
    'setupState', 'me', 'login', 'register', 'logout',
    // shell y clientes
    'shell', 'switchClient', 'saveClient', 'archiveClient', 'resetShareLink', 'clientsPage',
    // calendario y piezas
    'calendarData', 'saveEvent', 'deleteEvent', 'postPage', 'savePost', 'deletePost', 'movePost', 'setPostStatus', 'addTeamComment', 'savePostMetrics', 'duplicatePost',
    // tareas
    'tasksPage', 'createTask', 'updateTask', 'deleteTask',
    // métricas
    'metricsData', 'saveMonthMetrics',
    // link del cliente
    'portalPage', 'clientFeedback',
];

if (!in_array($fn, $API, true)) {
    json_out(['error' => 'Función desconocida'], 404);
    exit;
}

try {
    $data = ('api_' . $fn)(...array_values($args));
    json_out(['ok' => true, 'data' => $data]);
} catch (ApiError $e) {
    json_out(['error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log('[grilla] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    json_out(['error' => 'Algo salió mal en el servidor. Probá de nuevo.'], 500);
}

/* ======================= Sesión ======================= */

function api_setupState(): array
{
    $n = (int)one('SELECT COUNT(*) AS n FROM g_users')['n'];
    return ['needsSetup' => $n === 0];
}

function api_me(): ?array
{
    $u = current_user();
    return $u ? ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email']] : null;
}

function api_login(string $email, string $password): array
{
    $email = strtolower(trim($email));
    if ($email === '' || $password === '') return ['error' => 'Completá email y contraseña.', 'email' => $email];
    $u = one('SELECT * FROM g_users WHERE email = ?', [$email]);
    if (!$u || !password_verify($password, $u['password_hash'])) {
        usleep(300000); // frena intentos a lo bruto
        return ['error' => 'El email o la contraseña no coinciden.', 'email' => $email];
    }
    create_session($u['id']);
    return ['ok' => true];
}

/** Solo se puede crear la primera cuenta: así nadie más se registra en tu hosting. */
function api_register(string $name, string $agency, string $email, string $password): array
{
    $name = trim($name);
    $agency = trim($agency);
    $email = strtolower(trim($email));
    if (!api_setupState()['needsSetup']) return ['error' => 'El registro está cerrado. Pedile acceso a quien administra la cuenta.', 'email' => $email];
    if ($name === '' || $email === '' || $password === '') return ['error' => 'Completá todos los campos.', 'email' => $email];
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return ['error' => 'Ese email no parece válido.', 'email' => $email];
    if (strlen($password) < 8) return ['error' => 'La contraseña necesita al menos 8 caracteres.', 'email' => $email];

    $now = now_ms();
    $ws = new_id();
    $uid = new_id();
    $first = explode(' ', $name)[0];
    db()->beginTransaction();
    q('INSERT INTO g_workspaces (id, name, timezone, created_at) VALUES (?,?,?,?)', [$ws, $agency !== '' ? $agency : "Equipo de $first", DEFAULT_TZ, $now]);
    q('INSERT INTO g_users (id, workspace_id, name, email, password_hash, color, role, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [$uid, $ws, $name, $email, password_hash($password, PASSWORD_DEFAULT), SWATCHES[0], 'owner', $now]);
    db()->commit();
    create_session($uid);
    return ['ok' => true];
}

function api_logout(): bool
{
    destroy_session();
    return true;
}

/* ======================= Shell y clientes ======================= */

function api_shell(): array
{
    $u = require_user();
    $ws = workspace_of($u);
    $clients = active_clients($u['workspace_id']);
    $active = active_client($u);
    $attention = [];
    if ($clients) {
        $ids = array_column($clients, 'id');
        foreach (all("SELECT client_id, COUNT(*) AS n FROM g_posts WHERE status = 'changes' AND client_id IN (" . in_list($ids) . ') GROUP BY client_id', $ids) as $r) {
            $attention[$r['client_id']] = (int)$r['n'];
        }
    }
    return [
        'user' => ['name' => $u['name'], 'email' => $u['email'], 'color' => $u['color']],
        'workspaceName' => $ws['name'],
        'timezone' => $ws['timezone'],
        'today' => today_in($ws['timezone']),
        'clients' => array_map(fn($c) => [
            'id' => $c['id'], 'name' => $c['name'], 'handle' => $c['handle'], 'color' => $c['color'],
            'avatarId' => $c['avatar_id'], 'networks' => json_decode($c['networks'], true) ?: [],
            'attention' => $attention[$c['id']] ?? 0,
        ], $clients),
        'activeId' => $active['id'] ?? null,
        'activeClient' => $active ? dto_client($active) : null,
    ];
}

function set_active_client(string $id): void
{
    setcookie(CLIENT_COOKIE, $id, ['expires' => time() + 365 * 86400, 'path' => app_base(), 'samesite' => 'Lax', 'secure' => cookie_secure()]);
}

function api_switchClient(string $id): bool
{
    $u = require_user();
    client_access($u['workspace_id'], $id);
    set_active_client($id);
    return true;
}

function clean_networks($value): array
{
    $picked = is_array($value) ? $value : [];
    $nets = array_values(array_filter(NETWORKS, fn($n) => in_array($n, $picked, true)));
    return $nets ?: ['instagram'];
}

function api_saveClient(array $f): array
{
    $u = require_user();
    $id = (string)($f['id'] ?? '');
    $name = trim((string)($f['name'] ?? ''));
    if ($name === '') return ['error' => 'Poné el nombre del cliente.'];
    $handle = strtolower(preg_replace('/\s+/', '', ltrim(trim((string)($f['handle'] ?? '')), '@')));
    if ($handle === '') {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', mb_strtolower($name)) ?: mb_strtolower($name);
        $handle = preg_replace('/[^a-z0-9]+/', '', $ascii);
    }
    $color = preg_match('/^#[0-9A-Fa-f]{6}$/', (string)($f['color'] ?? '')) ? $f['color'] : SWATCHES[0];
    $avatarId = (string)($f['avatarId'] ?? '') ?: null;
    if ($avatarId && !one('SELECT id FROM g_media WHERE id = ? AND workspace_id = ?', [$avatarId, $u['workspace_id']])) $avatarId = null;
    $networks = json_encode(clean_networks($f['networks'] ?? []));

    if ($id !== '') {
        client_access($u['workspace_id'], $id);
        q('UPDATE g_clients SET name=?, handle=?, color=?, networks=?, avatar_id=? WHERE id=?', [$name, $handle, $color, $networks, $avatarId, $id]);
    } else {
        $id = new_id();
        $pos = (int)(one('SELECT COALESCE(MAX(position), -1) AS p FROM g_clients WHERE workspace_id = ?', [$u['workspace_id']])['p']) + 1;
        q('INSERT INTO g_clients (id, workspace_id, name, handle, color, avatar_id, networks, share_token, position, archived_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,NULL,?)',
            [$id, $u['workspace_id'], $name, $handle, $color, $avatarId, $networks, new_id(18), $pos, now_ms()]);
        set_active_client($id);
    }
    if ($avatarId) q("UPDATE g_media SET post_id = 'avatar' WHERE id = ?", [$avatarId]);
    return ['ok' => true];
}

function api_archiveClient(string $id): bool
{
    $u = require_user();
    client_access($u['workspace_id'], $id);
    q('UPDATE g_clients SET archived_at = ? WHERE id = ?', [now_ms(), $id]);
    if (($_COOKIE[CLIENT_COOKIE] ?? '') === $id) setcookie(CLIENT_COOKIE, '', ['expires' => time() - 3600, 'path' => app_base()]);
    return true;
}

function api_resetShareLink(string $id): bool
{
    $u = require_user();
    client_access($u['workspace_id'], $id);
    q('UPDATE g_clients SET share_token = ? WHERE id = ?', [new_id(18), $id]);
    return true;
}

function api_clientsPage(): array
{
    $u = require_user();
    $clients = active_clients($u['workspace_id']);
    $active = active_client($u);
    $counts = [];
    $totals = [];
    if ($clients) {
        $ids = array_column($clients, 'id');
        foreach (all("SELECT client_id, status, COUNT(*) AS n FROM g_posts WHERE status IN ('review','changes','approved') AND client_id IN (" . in_list($ids) . ') GROUP BY client_id, status', $ids) as $r) {
            $counts[$r['client_id']][$r['status']] = (int)$r['n'];
        }
        foreach (all('SELECT client_id, COUNT(*) AS n FROM g_posts WHERE client_id IN (' . in_list($ids) . ') GROUP BY client_id', $ids) as $r) {
            $totals[$r['client_id']] = (int)$r['n'];
        }
    }
    return [
        'activeId' => $active['id'] ?? null,
        'clients' => array_map(fn($c) => [
            'id' => $c['id'], 'name' => $c['name'], 'handle' => $c['handle'], 'color' => $c['color'],
            'avatarId' => $c['avatar_id'], 'networks' => json_decode($c['networks'], true) ?: [],
            'shareToken' => $c['share_token'],
            'review' => $counts[$c['id']]['review'] ?? 0,
            'changes' => $counts[$c['id']]['changes'] ?? 0,
            'approved' => $counts[$c['id']]['approved'] ?? 0,
            'total' => $totals[$c['id']] ?? 0,
        ], $clients),
    ];
}

/* ======================= Calendario y piezas ======================= */

function comment_counts(array $postIds): array
{
    if (!$postIds) return [];
    $out = [];
    foreach (all("SELECT post_id, COUNT(*) AS n FROM g_comments WHERE kind <> 'status' AND post_id IN (" . in_list($postIds) . ') GROUP BY post_id', $postIds) as $r) {
        $out[$r['post_id']] = (int)$r['n'];
    }
    return $out;
}

function to_cards(array $posts): array
{
    $ids = array_column($posts, 'id');
    $media = media_by_post($ids);
    $comments = comment_counts($ids);
    return array_map(function ($p) use ($media, $comments) {
        $list = $media[$p['id']] ?? [];
        return [
            'id' => $p['id'], 'clientId' => $p['client_id'], 'title' => $p['title'], 'caption' => $p['caption'], 'format' => $p['format'],
            'status' => $p['status'], 'date' => $p['date'], 'time' => $p['time'],
            'networks' => json_decode($p['networks'], true) ?: [],
            'thumb' => $list ? dto_media($list[0]) : null,
            'mediaCount' => count($list),
            'comments' => $comments[$p['id']] ?? 0,
        ];
    }, $posts);
}

/** $scope = 'todos' junta a todos los clientes; si no, el cliente activo. */
function api_calendarData(string $from, string $to, bool $withFeed, string $scope = ''): array
{
    $u = require_user();
    $client = active_client($u);
    if (!$client) return ['redirect' => '/clientes?nuevo=1'];
    $all = $scope === 'todos';
    $ids = $all ? array_column(active_clients($u['workspace_id']), 'id') : [$client['id']];
    $posts = all("SELECT * FROM g_posts WHERE client_id IN (" . in_list($ids) . ") AND `date` BETWEEN ? AND ? ORDER BY `date`, COALESCE(`time`, '99:99'), created_at", array_merge($ids, [$from, $to]));
    $evSql = 'SELECT id, client_id, type, title, `date`, `time`, notes FROM g_events WHERE workspace_id = ? AND `date` BETWEEN ? AND ?' . ($all ? '' : ' AND (client_id = ? OR client_id IS NULL)') . " ORDER BY `date`, COALESCE(`time`, '00:00')";
    $evParams = $all ? [$u['workspace_id'], $from, $to] : [$u['workspace_id'], $from, $to, $client['id']];
    $events = array_map(fn($e) => [
        'id' => $e['id'], 'clientId' => $e['client_id'], 'type' => $e['type'], 'title' => $e['title'],
        'date' => $e['date'], 'time' => $e['time'], 'notes' => $e['notes'],
    ], all($evSql, $evParams));
    $feed = [];
    if ($withFeed) {
        $rows = all("SELECT * FROM g_posts WHERE client_id = ? AND format IN ('post','carousel','reel') ORDER BY `date` DESC, COALESCE(`time`, '00:00') DESC LIMIT 60", [$client['id']]);
        $rows = array_values(array_filter($rows, fn($p) => in_array('instagram', json_decode($p['networks'], true) ?: [], true)));
        $feed = to_cards($rows);
    }
    return ['clientId' => $client['id'], 'posts' => to_cards($posts), 'feed' => $feed, 'events' => $events];
}

function api_saveEvent(array $in): array
{
    $u = require_user();
    $title = mb_substr(trim((string)($in['title'] ?? '')), 0, 160);
    $date = (string)($in['date'] ?? '');
    $time = (string)($in['time'] ?? '');
    $type = (string)($in['type'] ?? '');
    $clientId = (string)($in['clientId'] ?? '');
    if ($title === '') return ['error' => 'Poné un nombre para el evento.'];
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return ['error' => 'Elegí una fecha.'];
    if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) return ['error' => 'La hora no es válida.'];
    if (!in_array($type, ['shoot', 'meeting', 'delivery', 'other'], true)) return ['error' => 'Tipo inválido.'];
    if ($clientId !== '') client_access($u['workspace_id'], $clientId);
    $notes = mb_substr((string)($in['notes'] ?? ''), 0, 4000);
    $id = (string)($in['id'] ?? '');
    if ($id !== '') {
        if (!one('SELECT id FROM g_events WHERE id = ? AND workspace_id = ?', [$id, $u['workspace_id']])) return ['error' => 'Evento no encontrado.'];
        q('UPDATE g_events SET client_id=?, type=?, title=?, `date`=?, `time`=?, notes=? WHERE id=?', [$clientId ?: null, $type, $title, $date, $time ?: null, $notes, $id]);
    } else {
        $id = new_id();
        q('INSERT INTO g_events (id, workspace_id, client_id, type, title, `date`, `time`, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$id, $u['workspace_id'], $clientId ?: null, $type, $title, $date, $time ?: null, $notes, $u['id'], now_ms()]);
    }
    return ['id' => $id];
}

function api_deleteEvent(string $id): bool
{
    $u = require_user();
    q('DELETE FROM g_events WHERE id = ? AND workspace_id = ?', [$id, $u['workspace_id']]);
    return true;
}

function own_post(string $workspaceId, string $id): array
{
    $p = one('SELECT * FROM g_posts WHERE id = ? AND workspace_id = ?', [$id, $workspaceId]);
    if (!$p) throw new ApiError('Pieza no encontrada', 404);
    return $p;
}

function api_postPage(string $id, string $fecha): array
{
    $u = require_user();
    $ws = workspace_of($u);
    if ($id === 'nuevo') {
        $client = active_client($u);
        if (!$client) return ['redirect' => '/clientes?nuevo=1'];
        $c = dto_client($client);
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) ? $fecha : today_in($ws['timezone']);
        return [
            'client' => $c,
            'clients' => array_map('dto_client', active_clients($u['workspace_id'])),
            'initial' => [
                'format' => 'post',
                'networks' => in_array('instagram', $c['networks'], true) ? ['instagram'] : [$c['networks'][0] ?? 'instagram'],
                'date' => $date, 'time' => null, 'title' => '', 'caption' => '', 'status' => 'draft', 'notes' => '', 'postMetrics' => null,
            ],
            'media' => [], 'comments' => [],
        ];
    }
    $p = one('SELECT * FROM g_posts WHERE id = ? AND workspace_id = ?', [$id, $u['workspace_id']]);
    if (!$p) return ['notFound' => true];
    $client = one('SELECT * FROM g_clients WHERE id = ?', [$p['client_id']]);
    $media = array_map(fn($m) => dto_media($m), media_by_post([$p['id']])[$p['id']] ?? []);
    $comments = array_map('dto_comment', all('SELECT * FROM g_comments WHERE post_id = ? ORDER BY created_at', [$p['id']]));
    return ['id' => $p['id'], 'client' => dto_client($client), 'clients' => array_map('dto_client', active_clients($u['workspace_id'])), 'initial' => dto_post($p), 'media' => $media, 'comments' => $comments];
}

function status_comment(string $postId, array $u, string $status, int $now): void
{
    q('INSERT INTO g_comments (id, post_id, author_kind, author_name, user_id, kind, body, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [new_id(), $postId, 'team', $u['name'], $u['id'], 'status', STATUS_LABEL[$status], $now]);
}

function api_savePost(array $in): array
{
    $u = require_user();
    $clientId = (string)($in['clientId'] ?? '');
    client_access($u['workspace_id'], $clientId);
    $date = (string)($in['date'] ?? '');
    $time = (string)($in['time'] ?? '');
    $format = (string)($in['format'] ?? '');
    $status = (string)($in['status'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return ['error' => 'Elegí una fecha.'];
    if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) return ['error' => 'La hora no es válida.'];
    if (!in_array($format, FORMATS, true)) return ['error' => 'Formato inválido.'];
    if (!in_array($status, STATUSES, true)) return ['error' => 'Estado inválido.'];
    $picked = is_array($in['networks'] ?? null) ? $in['networks'] : [];
    $networks = array_values(array_filter(NETWORKS, fn($n) => in_array($n, $picked, true)));
    if (!$networks) return ['error' => 'Elegí al menos una red.'];

    $now = now_ms();
    $title = trim((string)($in['title'] ?? '')) ?: 'Sin título';
    $title = mb_substr($title, 0, 300);
    $caption = mb_substr((string)($in['caption'] ?? ''), 0, 2200);
    $notes = mb_substr((string)($in['notes'] ?? ''), 0, 8000);
    $id = (string)($in['id'] ?? '');
    $mediaIds = array_values(array_unique(array_map('strval', is_array($in['mediaIds'] ?? null) ? $in['mediaIds'] : [])));

    $valid = [];
    if ($mediaIds) {
        $params = array_merge([$u['workspace_id']], $mediaIds);
        $sql = "SELECT * FROM g_media WHERE workspace_id = ? AND status = 'ready' AND id IN (" . in_list($mediaIds) . ') AND (post_id IS NULL' . ($id ? ' OR post_id = ?' : '') . ')';
        if ($id) $params[] = $id;
        foreach (all($sql, $params) as $m) $valid[$m['id']] = $m;
    }
    $ordered = array_values(array_filter($mediaIds, fn($m) => isset($valid[$m])));

    $removed = [];
    db()->beginTransaction();
    try {
        if ($id !== '') {
            $existing = own_post($u['workspace_id'], $id);
            q('UPDATE g_posts SET client_id=?, title=?, caption=?, format=?, networks=?, `date`=?, `time`=?, status=?, notes=?, updated_at=? WHERE id=?',
                [$clientId, $title, $caption, $format, json_encode($networks), $date, $time ?: null, $status, $notes, $now, $id]);
            $current = all('SELECT id, poster_id FROM g_media WHERE post_id = ?', [$id]);
            $posterIds = array_filter(array_column($current, 'poster_id'));
            foreach ($current as $c) {
                if (!in_array($c['id'], $ordered, true) && !in_array($c['id'], $posterIds, true)) $removed[] = $c['id'];
            }
            if ($existing['status'] !== $status) status_comment($id, $u, $status, $now);
        } else {
            $id = new_id();
            q('INSERT INTO g_posts (id, workspace_id, client_id, title, caption, format, networks, `date`, `time`, status, notes, post_metrics, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)',
                [$id, $u['workspace_id'], $clientId, $title, $caption, $format, json_encode($networks), $date, $time ?: null, $status, $notes, $u['id'], $now, $now]);
        }
        foreach ($ordered as $pos => $mid) {
            q('UPDATE g_media SET post_id = ?, position = ? WHERE id = ?', [$id, $pos, $mid]);
            if (!empty($valid[$mid]['poster_id'])) {
                q('UPDATE g_media SET post_id = ? WHERE id = ? AND workspace_id = ?', [$id, $valid[$mid]['poster_id'], $u['workspace_id']]);
            }
        }
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        throw $e;
    }
    delete_media($u['workspace_id'], $removed);
    return ['id' => $id];
}

function api_deletePost(string $id): bool
{
    $u = require_user();
    own_post($u['workspace_id'], $id);
    $files = array_column(all('SELECT id FROM g_media WHERE post_id = ?', [$id]), 'id');
    q('DELETE FROM g_posts WHERE id = ?', [$id]);
    q('DELETE FROM g_comments WHERE post_id = ?', [$id]);
    q('UPDATE g_tasks SET post_id = NULL WHERE post_id = ?', [$id]);
    delete_media($u['workspace_id'], $files);
    return true;
}

function api_movePost(string $id, string $date): bool
{
    $u = require_user();
    own_post($u['workspace_id'], $id);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) throw new ApiError('Fecha inválida');
    q('UPDATE g_posts SET `date` = ?, updated_at = ? WHERE id = ?', [$date, now_ms(), $id]);
    return true;
}

function api_setPostStatus(string $id, string $status): bool
{
    $u = require_user();
    $p = own_post($u['workspace_id'], $id);
    if (!in_array($status, STATUSES, true) || $p['status'] === $status) return true;
    $now = now_ms();
    q('UPDATE g_posts SET status = ?, updated_at = ? WHERE id = ?', [$status, $now, $id]);
    status_comment($id, $u, $status, $now);
    return true;
}

function api_addTeamComment(string $postId, string $body): bool
{
    $u = require_user();
    own_post($u['workspace_id'], $postId);
    $text = mb_substr(trim($body), 0, 4000);
    if ($text === '') return true;
    q('INSERT INTO g_comments (id, post_id, author_kind, author_name, user_id, kind, body, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [new_id(), $postId, 'team', $u['name'], $u['id'], 'comment', $text, now_ms()]);
    return true;
}

function api_savePostMetrics(string $postId, array $m): bool
{
    $u = require_user();
    own_post($u['workspace_id'], $postId);
    $clean = [];
    foreach (['reach', 'likes', 'comments', 'saves', 'shares', 'views'] as $k) $clean[$k] = max(0, (int)round((float)($m[$k] ?? 0)));
    q('UPDATE g_posts SET post_metrics = ?, updated_at = ? WHERE id = ?', [json_encode($clean), now_ms(), $postId]);
    return true;
}

function api_duplicatePost(string $id): array
{
    $u = require_user();
    $p = own_post($u['workspace_id'], $id);
    $newId = new_id();
    $now = now_ms();
    q('INSERT INTO g_posts (id, workspace_id, client_id, title, caption, format, networks, `date`, `time`, status, notes, post_metrics, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)',
        [$newId, $p['workspace_id'], $p['client_id'], mb_substr($p['title'] . ' (copia)', 0, 300), $p['caption'], $p['format'], $p['networks'], $p['date'], $p['time'], 'draft', $p['notes'], $u['id'], $now, $now]);
    // Copia de archivos (en hosting compartido no siempre hay hard links).
    $files = all('SELECT * FROM g_media WHERE post_id = ?', [$id]);
    $map = [];
    foreach ($files as $f) $map[$f['id']] = bin2hex(random_bytes(16));
    foreach ($files as $f) {
        $src = media_path($f['id']);
        $dst = media_path($map[$f['id']]);
        if (!@link($src, $dst)) @copy($src, $dst);
        q('INSERT INTO g_media (id, workspace_id, post_id, kind, mime, filename, size, width, height, duration, poster_id, position, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$map[$f['id']], $f['workspace_id'], $newId, $f['kind'], $f['mime'], $f['filename'], $f['size'], $f['width'], $f['height'], $f['duration'],
                $f['poster_id'] ? ($map[$f['poster_id']] ?? null) : null, $f['position'], $f['status'], $u['id'], $now]);
    }
    return ['id' => $newId];
}

/* ======================= Tareas ======================= */

function api_tasksPage(): array
{
    $u = require_user();
    $client = active_client($u);
    if (!$client) return ['redirect' => '/clientes?nuevo=1'];
    $ws = workspace_of($u);
    return [
        'clientId' => $client['id'],
        'clientName' => $client['name'],
        'today' => today_in($ws['timezone']),
        'tasks' => array_map('dto_task', all('SELECT * FROM g_tasks WHERE client_id = ? ORDER BY position', [$client['id']])),
        'people' => all('SELECT id, name, color FROM g_users WHERE workspace_id = ?', [$u['workspace_id']]),
        'posts' => all('SELECT id, title, `date` FROM g_posts WHERE client_id = ? ORDER BY `date` DESC LIMIT 80', [$client['id']]),
    ];
}

function own_task(string $workspaceId, string $id): array
{
    $t = one('SELECT * FROM g_tasks WHERE id = ? AND workspace_id = ?', [$id, $workspaceId]);
    if (!$t) throw new ApiError('Tarea no encontrada', 404);
    return $t;
}

function api_createTask(string $clientId, string $status, string $title): ?array
{
    $u = require_user();
    client_access($u['workspace_id'], $clientId);
    $text = mb_substr(trim($title), 0, 200);
    if ($text === '' || !in_array($status, TASK_STATUSES, true)) return null;
    $top = (float)(one('SELECT COALESCE(MAX(position), 0) AS p FROM g_tasks WHERE client_id = ? AND status = ?', [$clientId, $status])['p']);
    $now = now_ms();
    $id = new_id();
    q('INSERT INTO g_tasks (id, workspace_id, client_id, title, description, status, priority, due_date, assignee_id, post_id, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NULL,?,NULL,?,?,?)',
        [$id, $u['workspace_id'], $clientId, $text, '', $status, 'normal', $u['id'], $top + 1, $now, $now]);
    return dto_task(one('SELECT * FROM g_tasks WHERE id = ?', [$id]));
}

function api_updateTask(string $id, array $patch): bool
{
    $u = require_user();
    $t = own_task($u['workspace_id'], $id);
    $set = [];
    $params = [];
    if (array_key_exists('title', $patch)) { $set[] = 'title = ?'; $params[] = mb_substr(trim((string)$patch['title']), 0, 200) ?: $t['title']; }
    if (array_key_exists('description', $patch)) { $set[] = 'description = ?'; $params[] = mb_substr((string)$patch['description'], 0, 4000); }
    if (in_array($patch['status'] ?? null, TASK_STATUSES, true)) { $set[] = 'status = ?'; $params[] = $patch['status']; }
    if (in_array($patch['priority'] ?? null, ['low', 'normal', 'high'], true)) { $set[] = 'priority = ?'; $params[] = $patch['priority']; }
    if (array_key_exists('dueDate', $patch)) {
        $d = (string)($patch['dueDate'] ?? '');
        $set[] = 'due_date = ?';
        $params[] = preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? $d : null;
    }
    if (isset($patch['position']) && is_numeric($patch['position'])) { $set[] = 'position = ?'; $params[] = (float)$patch['position']; }
    if (array_key_exists('assigneeId', $patch)) {
        $a = (string)($patch['assigneeId'] ?? '');
        $ok = $a !== '' && one('SELECT id FROM g_users WHERE id = ? AND workspace_id = ?', [$a, $u['workspace_id']]);
        $set[] = 'assignee_id = ?';
        $params[] = $ok ? $a : null;
    }
    if (array_key_exists('postId', $patch)) {
        $p = (string)($patch['postId'] ?? '');
        $ok = $p !== '' && one('SELECT id FROM g_posts WHERE id = ? AND client_id = ?', [$p, $t['client_id']]);
        $set[] = 'post_id = ?';
        $params[] = $ok ? $p : null;
    }
    if (!$set) return true;
    $set[] = 'updated_at = ?';
    $params[] = now_ms();
    $params[] = $id;
    q('UPDATE g_tasks SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
    return true;
}

function api_deleteTask(string $id): bool
{
    $u = require_user();
    own_task($u['workspace_id'], $id);
    q('DELETE FROM g_tasks WHERE id = ?', [$id]);
    return true;
}

/* ======================= Métricas ======================= */

/** Filas crudas: el front arma los totales y gráficos. */
function api_metricsData(string $fromMonth, string $toMonth): array
{
    $u = require_user();
    $client = active_client($u);
    if (!$client) return ['redirect' => '/clientes?nuevo=1'];
    $ws = workspace_of($u);
    if (!preg_match('/^\d{4}-\d{2}$/', $fromMonth) || !preg_match('/^\d{4}-\d{2}$/', $toMonth)) throw new ApiError('Mes inválido');
    $rows = all('SELECT network, month, followers, reach, impressions, interactions, profile_visits FROM g_metrics WHERE client_id = ? AND month BETWEEN ? AND ?', [$client['id'], $fromMonth, $toMonth]);
    $published = all("SELECT * FROM g_posts WHERE client_id = ? AND status = 'published' AND `date` BETWEEN ? AND ?", [$client['id'], "$toMonth-01", "$toMonth-31"]);
    $thumbs = media_by_post(array_column($published, 'id'));
    return [
        'client' => dto_client($client),
        'workspaceName' => $ws['name'],
        'today' => today_in($ws['timezone']),
        'rows' => array_map(fn($r) => [
            'network' => $r['network'], 'month' => $r['month'], 'followers' => (int)$r['followers'], 'reach' => (int)$r['reach'],
            'impressions' => (int)$r['impressions'], 'interactions' => (int)$r['interactions'], 'profileVisits' => (int)$r['profile_visits'],
        ], $rows),
        'published' => array_map(fn($p) => [
            'id' => $p['id'], 'title' => $p['title'], 'date' => $p['date'], 'format' => $p['format'],
            'networks' => json_decode($p['networks'], true) ?: [],
            'postMetrics' => $p['post_metrics'] ? json_decode($p['post_metrics'], true) : null,
            'thumb' => isset($thumbs[$p['id']][0]) ? dto_media($thumbs[$p['id']][0]) : null,
        ], $published),
    ];
}

function api_saveMonthMetrics(string $clientId, string $month, array $rows): bool
{
    $u = require_user();
    client_access($u['workspace_id'], $clientId);
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) throw new ApiError('Mes inválido');
    $n = fn($v) => max(0, (int)round((float)$v));
    foreach ($rows as $r) {
        if (!in_array($r['network'] ?? '', NETWORKS, true)) continue;
        q('INSERT INTO g_metrics (id, client_id, network, month, followers, reach, impressions, interactions, profile_visits) VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE followers=VALUES(followers), reach=VALUES(reach), impressions=VALUES(impressions), interactions=VALUES(interactions), profile_visits=VALUES(profile_visits)',
            [new_id(), $clientId, $r['network'], $month, $n($r['followers'] ?? 0), $n($r['reach'] ?? 0), $n($r['impressions'] ?? 0), $n($r['interactions'] ?? 0), $n($r['profileVisits'] ?? 0)]);
    }
    return true;
}

/* ======================= Link del cliente ======================= */

function client_by_token(string $token): ?array
{
    if ($token === '') return null;
    $c = one('SELECT * FROM g_clients WHERE share_token = ? AND archived_at IS NULL', [$token]);
    return $c ?: null;
}

function api_portalPage(string $token): array
{
    $client = client_by_token($token);
    if (!$client) return ['notFound' => true];
    $ws = one('SELECT * FROM g_workspaces WHERE id = ?', [$client['workspace_id']]);
    $posts = all("SELECT * FROM g_posts WHERE client_id = ? ORDER BY `date`, COALESCE(`time`, '99:99')", [$client['id']]);
    $ids = array_column($posts, 'id');
    $media = media_by_post($ids);
    $comments = $ids ? all('SELECT * FROM g_comments WHERE post_id IN (' . in_list($ids) . ') ORDER BY created_at', $ids) : [];
    $byPost = [];
    foreach ($comments as $c) $byPost[$c['post_id']][] = dto_comment($c);
    return [
        'today' => today_in($ws['timezone']),
        'agency' => $ws['name'],
        'client' => ['name' => $client['name'], 'handle' => $client['handle'], 'color' => $client['color'], 'avatarId' => $client['avatar_id']],
        'items' => array_map(fn($p) => [
            'id' => $p['id'], 'title' => $p['title'], 'caption' => $p['caption'], 'format' => $p['format'],
            'networks' => json_decode($p['networks'], true) ?: [], 'status' => $p['status'], 'date' => $p['date'], 'time' => $p['time'],
            'media' => array_map(fn($m) => dto_media($m, $token), $media[$p['id']] ?? []),
            'comments' => $byPost[$p['id']] ?? [],
        ], $posts),
    ];
}

function api_clientFeedback(string $token, string $postId, string $kind, string $name, string $body): array
{
    $client = client_by_token($token);
    if (!$client) return ['error' => 'El link ya no es válido.'];
    if (!in_array($kind, ['approved', 'changes', 'comment'], true)) return ['error' => 'Acción inválida.'];
    $post = one('SELECT * FROM g_posts WHERE id = ? AND client_id = ?', [$postId, $client['id']]);
    if (!$post) return ['error' => 'No encontramos esa pieza.'];
    $author = mb_substr(trim($name), 0, 60) ?: $client['name'];
    $text = mb_substr(trim($body), 0, 4000);
    if ($kind === 'comment' && $text === '') return ['error' => 'Escribí algo antes de enviar.'];
    if ($kind === 'changes' && $text === '') return ['error' => 'Contanos qué te gustaría cambiar.'];
    if ($kind !== 'comment' && $post['status'] === 'draft') return ['error' => 'Esta pieza todavía está en preparación.'];
    if ($kind !== 'comment' && in_array($post['status'], ['published', 'scheduled'], true)) return ['error' => 'Esta pieza ya está programada o publicada.'];
    $now = now_ms();
    q('INSERT INTO g_comments (id, post_id, author_kind, author_name, user_id, kind, body, created_at) VALUES (?,?,?,?,NULL,?,?,?)',
        [new_id(), $postId, 'client', $author, $kind, $text, $now]);
    if ($kind !== 'comment') q('UPDATE g_posts SET status = ?, updated_at = ? WHERE id = ?', [$kind, $now, $postId]);
    return ['ok' => true];
}
