// SQL de creación de tablas. Se aplica al abrir la base (idempotente).
export const MIGRATION = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  color TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  color TEXT NOT NULL,
  avatar_id TEXT,
  networks TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS clients_ws ON clients(workspace_id);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  caption TEXT NOT NULL,
  format TEXT NOT NULL,
  networks TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  status TEXT NOT NULL,
  notes TEXT NOT NULL,
  post_metrics TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_client_date ON posts(client_id, date);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  post_id TEXT,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration REAL,
  poster_id TEXT,
  position INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS media_post ON media(post_id);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL,
  author_name TEXT NOT NULL,
  user_id TEXT,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_date TEXT,
  assignee_id TEXT,
  post_id TEXT,
  position REAL NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_client ON tasks(client_id);
CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  network TEXT NOT NULL,
  month TEXT NOT NULL,
  followers INTEGER NOT NULL,
  reach INTEGER NOT NULL,
  impressions INTEGER NOT NULL,
  interactions INTEGER NOT NULL,
  profile_visits INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS metrics_unique ON metrics(client_id, network, month);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  notes TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_ws_date ON events(workspace_id, date);
CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  color TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS team_ws ON team(workspace_id);
`;

/** Cambios sobre tablas existentes (se ignoran si ya estaban aplicados). */
export const ALTERS = [
  "ALTER TABLE posts ADD COLUMN assignee_id TEXT",
  "ALTER TABLE events ADD COLUMN people TEXT",
];

/** Cada usuario figura en el equipo con su mismo id (así las tareas ya asignadas siguen apuntando bien). */
export const TEAM_BACKFILL = `
INSERT INTO team (id, workspace_id, user_id, name, role, color, email, phone, created_at)
SELECT u.id, u.workspace_id, u.id, u.name, '', u.color, u.email, '', u.created_at
FROM users u WHERE NOT EXISTS (SELECT 1 FROM team t WHERE t.id = u.id);
`;
