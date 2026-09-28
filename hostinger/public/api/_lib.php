<?php
// Núcleo del backend PHP: configuración, base de datos, sesión y utilidades.
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

$CONFIG_FILE = dirname(__DIR__) . '/config.php';
if (!is_file($CONFIG_FILE)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Falta config.php. Copiá config.sample.php como config.php y completá los datos de la base.";
    exit;
}
$GLOBALS['GRILLA_CFG'] = $CFG = require $CONFIG_FILE;

define('DATA_DIR', rtrim($CFG['data_dir'] ?? (dirname(__DIR__) . '/data'), '/'));
define('UPLOAD_DIR', DATA_DIR . '/uploads');
define('MAX_UPLOAD_BYTES', (int)($CFG['max_upload_mb'] ?? 1024) * 1024 * 1024);
define('DEFAULT_TZ', $CFG['timezone'] ?? 'America/Argentina/Buenos_Aires');
define('SESSION_COOKIE', 'grilla_session');
define('CLIENT_COOKIE', 'grilla_client');
define('SESSION_DAYS', 30);

const NETWORKS = ['instagram', 'tiktok', 'facebook', 'linkedin'];
const FORMATS = ['post', 'carousel', 'reel', 'story', 'tiktok'];
const STATUSES = ['draft', 'review', 'changes', 'approved', 'scheduled', 'published'];
const TASK_STATUSES = ['todo', 'doing', 'review', 'done'];
const STATUS_LABEL = [
    'draft' => 'Borrador', 'review' => 'Para aprobar', 'changes' => 'Con cambios',
    'approved' => 'Aprobado', 'scheduled' => 'Programado', 'published' => 'Publicado',
];
const SWATCHES = ['#FF5B2E', '#1F6FEB', '#1E9E63', '#C2410C', '#7C3AED', '#DB2777', '#0E7490', '#A16207'];

/** Ruta base pública de la app (ej. "/" o "/grilla/"), calculada desde el script actual. */
function app_base(): string
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
    $dir = rtrim(dirname($script), '/');
    if (substr($dir, -4) === '/api') $dir = substr($dir, 0, -4);
    return $dir . '/';
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $CFG = $GLOBALS['GRILLA_CFG'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $CFG['db_host'], (int)($CFG['db_port'] ?? 3306), $CFG['db_name']);
    $pdo = new PDO($dsn, $CFG['db_user'], $CFG['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $flag = DATA_DIR . '/.schema-v1';
    if (is_file($flag)) return;
    $t = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $sql = [
        "CREATE TABLE IF NOT EXISTS g_workspaces (id VARCHAR(32) PRIMARY KEY, name VARCHAR(200) NOT NULL, timezone VARCHAR(64) NOT NULL, created_at BIGINT NOT NULL) $t",
        "CREATE TABLE IF NOT EXISTS g_users (id VARCHAR(32) PRIMARY KEY, workspace_id VARCHAR(32) NOT NULL, name VARCHAR(120) NOT NULL, email VARCHAR(191) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, color VARCHAR(16) NOT NULL, role VARCHAR(16) NOT NULL, created_at BIGINT NOT NULL, KEY (workspace_id)) $t",
        "CREATE TABLE IF NOT EXISTS g_sessions (id CHAR(43) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, expires_at BIGINT NOT NULL, KEY (user_id)) $t",
        "CREATE TABLE IF NOT EXISTS g_clients (id VARCHAR(32) PRIMARY KEY, workspace_id VARCHAR(32) NOT NULL, name VARCHAR(160) NOT NULL, handle VARCHAR(80) NOT NULL, color VARCHAR(16) NOT NULL, avatar_id VARCHAR(40) NULL, networks TEXT NOT NULL, share_token VARCHAR(40) NOT NULL UNIQUE, position INT NOT NULL, archived_at BIGINT NULL, created_at BIGINT NOT NULL, KEY (workspace_id)) $t",
        "CREATE TABLE IF NOT EXISTS g_posts (id VARCHAR(32) PRIMARY KEY, workspace_id VARCHAR(32) NOT NULL, client_id VARCHAR(32) NOT NULL, title VARCHAR(300) NOT NULL, caption TEXT NOT NULL, format VARCHAR(16) NOT NULL, networks TEXT NOT NULL, `date` CHAR(10) NOT NULL, `time` CHAR(5) NULL, status VARCHAR(16) NOT NULL, notes TEXT NOT NULL, post_metrics TEXT NULL, created_by VARCHAR(32) NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, KEY (client_id, `date`)) $t",
        "CREATE TABLE IF NOT EXISTS g_media (id VARCHAR(40) PRIMARY KEY, workspace_id VARCHAR(32) NOT NULL, post_id VARCHAR(32) NULL, kind VARCHAR(8) NOT NULL, mime VARCHAR(100) NOT NULL, filename VARCHAR(255) NOT NULL, size BIGINT NOT NULL, width INT NULL, height INT NULL, duration DOUBLE NULL, poster_id VARCHAR(40) NULL, position INT NOT NULL, status VARCHAR(16) NOT NULL, created_by VARCHAR(32) NOT NULL, created_at BIGINT NOT NULL, KEY (post_id), KEY (workspace_id)) $t",
        "CREATE TABLE IF NOT EXISTS g_comments (id VARCHAR(32) PRIMARY KEY, post_id VARCHAR(32) NOT NULL, author_kind VARCHAR(8) NOT NULL, author_name VARCHAR(80) NOT NULL, user_id VARCHAR(32) NULL, kind VARCHAR(16) NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL, KEY (post_id)) $t",
        "CREATE TABLE IF NOT EXISTS g_tasks (id VARCHAR(32) PRIMARY KEY, workspace_id VARCHAR(32) NOT NULL, client_id VARCHAR(32) NOT NULL, title VARCHAR(200) NOT NULL, description TEXT NOT NULL, status VARCHAR(16) NOT NULL, priority VARCHAR(8) NOT NULL, due_date CHAR(10) NULL, assignee_id VARCHAR(32) NULL, post_id VARCHAR(32) NULL, position DOUBLE NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, KEY (client_id)) $t",
        "CREATE TABLE IF NOT EXISTS g_metrics (id VARCHAR(32) PRIMARY KEY, client_id VARCHAR(32) NOT NULL, network VARCHAR(16) NOT NULL, month CHAR(7) NOT NULL, followers BIGINT NOT NULL, reach BIGINT NOT NULL, impressions BIGINT NOT NULL, interactions BIGINT NOT NULL, profile_visits BIGINT NOT NULL, UNIQUE KEY metrics_unique (client_id, network, month)) $t",
    ];
    foreach ($sql as $q) $pdo->exec($q);
    ensure_data_dir();
    @file_put_contents($flag, (string)time());
}

function ensure_data_dir(): void
{
    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);
    $deny = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
    if (!is_file(DATA_DIR . '/.htaccess')) @file_put_contents(DATA_DIR . '/.htaccess', $deny);
    if (!is_file(DATA_DIR . '/index.html')) @file_put_contents(DATA_DIR . '/index.html', '');
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}
function one(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->fetch();
    return $r === false ? null : $r;
}
function all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}
/** Arma "(?,?,?)" para listas IN. */
function in_list(array $values): string
{
    return implode(',', array_fill(0, max(1, count($values)), '?'));
}

function now_ms(): int
{
    return (int)floor(microtime(true) * 1000);
}
function new_id(int $bytes = 12): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function today_in(string $tz): string
{
    try {
        return (new DateTime('now', new DateTimeZone($tz)))->format('Y-m-d');
    } catch (Throwable $e) {
        return date('Y-m-d');
    }
}

class ApiError extends Exception
{
    public int $status;
    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

/* ---------------- Sesión ---------------- */

function cookie_secure(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function set_cookie(string $name, string $value, int $expires): void
{
    setcookie($name, $value, [
        'expires' => $expires,
        'path' => app_base(),
        'secure' => cookie_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function hash_token(string $token): string
{
    return rtrim(strtr(base64_encode(hash('sha256', $token, true)), '+/', '-_'), '=');
}

function create_session(string $userId): void
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $exp = now_ms() + SESSION_DAYS * 86400 * 1000;
    q('INSERT INTO g_sessions (id, user_id, expires_at) VALUES (?,?,?)', [hash_token($token), $userId, $exp]);
    set_cookie(SESSION_COOKIE, $token, (int)($exp / 1000));
}

function destroy_session(): void
{
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if ($token) q('DELETE FROM g_sessions WHERE id = ?', [hash_token($token)]);
    set_cookie(SESSION_COOKIE, '', time() - 3600);
}

function current_user(): ?array
{
    static $cached = false;
    if ($cached !== false) return $cached;
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if (!$token) return $cached = null;
    $u = one(
        'SELECT u.* FROM g_sessions s JOIN g_users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?',
        [hash_token($token), now_ms()]
    );
    return $cached = $u;
}

function require_user(): array
{
    $u = current_user();
    if (!$u) throw new ApiError('Tenés que iniciar sesión.', 401);
    return $u;
}

function workspace_of(array $user): array
{
    return one('SELECT * FROM g_workspaces WHERE id = ?', [$user['workspace_id']]);
}

function client_access(string $workspaceId, string $clientId): array
{
    $c = one('SELECT * FROM g_clients WHERE id = ? AND workspace_id = ?', [$clientId, $workspaceId]);
    if (!$c) throw new ApiError('Cliente no encontrado', 404);
    return $c;
}

function active_clients(string $workspaceId): array
{
    return all('SELECT * FROM g_clients WHERE workspace_id = ? AND archived_at IS NULL ORDER BY position, created_at', [$workspaceId]);
}

/** Cliente elegido en el selector (cookie) o el primero. */
function active_client(array $user): ?array
{
    $clients = active_clients($user['workspace_id']);
    $wanted = $_COOKIE[CLIENT_COOKIE] ?? '';
    foreach ($clients as $c) if ($c['id'] === $wanted) return $c;
    return $clients[0] ?? null;
}

/* ---------------- DTOs (mismas formas que usa el front) ---------------- */

function media_url(string $id, ?string $share = null): string
{
    return app_base() . 'api/media/' . $id . ($share ? '?s=' . rawurlencode($share) : '');
}

function dto_client(array $c): array
{
    return [
        'id' => $c['id'],
        'workspaceId' => $c['workspace_id'],
        'name' => $c['name'],
        'handle' => $c['handle'],
        'color' => $c['color'],
        'avatarId' => $c['avatar_id'],
        'networks' => json_decode($c['networks'], true) ?: [],
        'shareToken' => $c['share_token'],
        'position' => (int)$c['position'],
        'archivedAt' => $c['archived_at'] === null ? null : (int)$c['archived_at'],
        'createdAt' => (int)$c['created_at'],
    ];
}

function dto_media(array $m, ?string $share = null): array
{
    return [
        'id' => $m['id'],
        'kind' => $m['kind'],
        'url' => media_url($m['id'], $share),
        'posterUrl' => $m['poster_id'] ? media_url($m['poster_id'], $share) : null,
        'width' => $m['width'] === null ? null : (int)$m['width'],
        'height' => $m['height'] === null ? null : (int)$m['height'],
        'duration' => $m['duration'] === null ? null : (float)$m['duration'],
        'filename' => $m['filename'],
        'size' => (int)$m['size'],
    ];
}

function dto_post(array $p): array
{
    return [
        'id' => $p['id'],
        'workspaceId' => $p['workspace_id'],
        'clientId' => $p['client_id'],
        'title' => $p['title'],
        'caption' => $p['caption'],
        'format' => $p['format'],
        'networks' => json_decode($p['networks'], true) ?: [],
        'date' => $p['date'],
        'time' => $p['time'],
        'status' => $p['status'],
        'notes' => $p['notes'],
        'postMetrics' => $p['post_metrics'] ? json_decode($p['post_metrics'], true) : null,
        'createdBy' => $p['created_by'],
        'createdAt' => (int)$p['created_at'],
        'updatedAt' => (int)$p['updated_at'],
    ];
}

function dto_comment(array $c): array
{
    return [
        'id' => $c['id'],
        'postId' => $c['post_id'],
        'authorKind' => $c['author_kind'],
        'authorName' => $c['author_name'],
        'userId' => $c['user_id'],
        'kind' => $c['kind'],
        'body' => $c['body'],
        'createdAt' => (int)$c['created_at'],
    ];
}

function dto_task(array $t): array
{
    return [
        'id' => $t['id'],
        'workspaceId' => $t['workspace_id'],
        'clientId' => $t['client_id'],
        'title' => $t['title'],
        'description' => $t['description'],
        'status' => $t['status'],
        'priority' => $t['priority'],
        'dueDate' => $t['due_date'],
        'assigneeId' => $t['assignee_id'],
        'postId' => $t['post_id'],
        'position' => (float)$t['position'],
        'createdAt' => (int)$t['created_at'],
        'updatedAt' => (int)$t['updated_at'],
    ];
}

/** Archivos listos por pieza (sin las portadas de video), ordenados. */
function media_by_post(array $postIds): array
{
    if (!$postIds) return [];
    $rows = all("SELECT * FROM g_media WHERE status = 'ready' AND post_id IN (" . in_list($postIds) . ') ORDER BY position', $postIds);
    $posters = [];
    foreach ($rows as $r) if ($r['poster_id']) $posters[$r['poster_id']] = true;
    $map = [];
    foreach ($rows as $r) {
        if (isset($posters[$r['id']])) continue;
        $map[$r['post_id']][] = $r;
    }
    return $map;
}

/* ---------------- Archivos ---------------- */

function media_path(string $id): string
{
    if (!preg_match('/^[A-Za-z0-9_-]+$/', $id)) throw new ApiError('id inválido');
    return UPLOAD_DIR . '/' . $id;
}

function delete_media(string $workspaceId, array $ids): void
{
    if (!$ids) return;
    $rows = all('SELECT id, poster_id FROM g_media WHERE workspace_id = ? AND id IN (' . in_list($ids) . ')', array_merge([$workspaceId], $ids));
    $list = [];
    foreach ($rows as $r) {
        $list[$r['id']] = true;
        if ($r['poster_id']) $list[$r['poster_id']] = true;
    }
    $list = array_keys($list);
    if (!$list) return;
    q('DELETE FROM g_media WHERE workspace_id = ? AND id IN (' . in_list($list) . ')', array_merge([$workspaceId], $list));
    foreach ($list as $id) @unlink(media_path($id));
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
