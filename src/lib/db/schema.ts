import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  color: text("color").notNull(),
  role: text("role", { enum: ["owner", "member"] }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    color: text("color").notNull(),
    avatarId: text("avatar_id"),
    networks: text("networks", { mode: "json" }).$type<Network[]>().notNull(),
    shareToken: text("share_token").notNull().unique(),
    position: integer("position").notNull(),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("clients_ws").on(t.workspaceId)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    clientId: text("client_id").notNull(),
    title: text("title").notNull(),
    caption: text("caption").notNull(),
    format: text("format", { enum: FORMATS() }).notNull(),
    networks: text("networks", { mode: "json" }).$type<Network[]>().notNull(),
    date: text("date").notNull(),
    time: text("time"),
    status: text("status", { enum: STATUSES() }).notNull(),
    notes: text("notes").notNull(),
    postMetrics: text("post_metrics", { mode: "json" }).$type<PostMetrics | null>(),
    /** Persona del equipo a cargo de la pieza. */
    assigneeId: text("assignee_id"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("posts_client_date").on(t.clientId, t.date)],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    postId: text("post_id"),
    kind: text("kind", { enum: ["image", "video"] }).notNull(),
    mime: text("mime").notNull(),
    filename: text("filename").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    duration: real("duration"),
    posterId: text("poster_id"),
    position: integer("position").notNull(),
    status: text("status", { enum: ["uploading", "ready"] }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("media_post").on(t.postId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    authorKind: text("author_kind", { enum: ["team", "client"] }).notNull(),
    authorName: text("author_name").notNull(),
    userId: text("user_id"),
    kind: text("kind", { enum: ["comment", "approved", "changes", "status"] }).notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_post").on(t.postId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    clientId: text("client_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: ["todo", "doing", "review", "done"] }).notNull(),
    priority: text("priority", { enum: ["low", "normal", "high"] }).notNull(),
    dueDate: text("due_date"),
    assigneeId: text("assignee_id"),
    postId: text("post_id"),
    position: real("position").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("tasks_client").on(t.clientId)],
);

export const metrics = sqliteTable(
  "metrics",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    network: text("network", { enum: NETWORKS() }).notNull(),
    month: text("month").notNull(),
    followers: integer("followers").notNull(),
    reach: integer("reach").notNull(),
    impressions: integer("impressions").notNull(),
    interactions: integer("interactions").notNull(),
    profileVisits: integer("profile_visits").notNull(),
  },
  (t) => [uniqueIndex("metrics_unique").on(t.clientId, t.network, t.month)],
);

/** Agenda interna del equipo (rodajes, reuniones, entregas). El cliente nunca la ve. */
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    clientId: text("client_id"),
    type: text("type", { enum: ["shoot", "meeting", "delivery", "other"] }).notNull(),
    title: text("title").notNull(),
    date: text("date").notNull(),
    time: text("time"),
    notes: text("notes").notNull(),
    /** Personas del equipo que participan (ids de team). */
    people: text("people", { mode: "json" }).$type<string[]>(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("events_ws_date").on(t.workspaceId, t.date)],
);

/** Personas del equipo (no necesitan cuenta). La dueña de la cuenta también figura acá, con el mismo id. */
export const team = sqliteTable(
  "team",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id"),
    name: text("name").notNull(),
    role: text("role").notNull(),
    color: text("color").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("team_ws").on(t.workspaceId)],
);

// Los enums viven en funciones para que el orden de declaración no importe.
function FORMATS() {
  return ["post", "carousel", "reel", "story", "tiktok"] as const;
}
function STATUSES() {
  return ["draft", "review", "changes", "approved", "scheduled", "published"] as const;
}
function NETWORKS() {
  return ["instagram", "tiktok", "facebook", "linkedin"] as const;
}

export type Network = ReturnType<typeof NETWORKS>[number];
export type PostFormat = ReturnType<typeof FORMATS>[number];
export type PostStatus = ReturnType<typeof STATUSES>[number];
export type TaskStatus = "todo" | "doing" | "review" | "done";

export type PostMetrics = {
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
};

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type TeamEvent = typeof events.$inferSelect;
export type TeamMember = typeof team.$inferSelect;
export type EventType = TeamEvent["type"];
