"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, CalendarClock, Flag, Link2, Plus, Trash2, UsersRound } from "lucide-react";
import type { Task, TaskStatus } from "@/lib/db/schema";
import { PRIORITY_LABEL, TASK_COLUMNS } from "@/lib/constants";
import { addDays, formatDayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/ui/page-header";
import { createTask, deleteTask, updateTask, type TaskPatch } from "../actions/tasks";

type Person = { id: string; name: string; color: string };
type PostRef = { id: string; title: string; date: string };

const COLUMN_TINT: Record<TaskStatus, string> = {
  todo: "var(--c-draft)",
  doing: "var(--c-scheduled)",
  review: "var(--c-review)",
  done: "var(--c-approved)",
};

export function Board({
  clientId,
  clientName,
  tasks: initial,
  people,
  posts,
  today,
}: {
  clientId: string;
  clientName: string;
  tasks: Task[];
  people: Person[];
  posts: PostRef[];
  today: string;
}) {
  const [tasks, setTasks] = useState(initial);
  useEffect(() => setTasks(initial), [initial]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [mobileCol, setMobileCol] = useState<TaskStatus>("todo");
  const scroller = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byCol = useMemo(() => {
    const map = Object.fromEntries(TASK_COLUMNS.map((c) => [c.id, [] as Task[]])) as Record<TaskStatus, Task[]>;
    for (const t of [...tasks].sort((a, b) => a.position - b.position)) map[t.status].push(t);
    return map;
  }, [tasks]);

  const findCol = (id: string): TaskStatus | null => {
    if (TASK_COLUMNS.some((c) => c.id === id)) return id as TaskStatus;
    return tasks.find((t) => t.id === id)?.status ?? null;
  };

  const patchLocal = (id: string, patch: Partial<Task>) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const persist = (id: string, patch: TaskPatch) => start(() => updateTask(id, patch));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findCol(String(active.id));
    const to = findCol(String(over.id));
    if (!from || !to || from === to) return;
    patchLocal(String(active.id), { status: to });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const col = findCol(String(over.id));
    if (!col) return;
    // byCol ya refleja el cambio de columna hecho en onDragOver.
    let full = byCol[col];
    if (!full.some((t) => t.id === id)) full = [...full, tasks.find((t) => t.id === id)!];
    const oldIndex = full.findIndex((t) => t.id === id);
    const overIndex = full.findIndex((t) => t.id === String(over.id));
    const moved = arrayMove(full, oldIndex, overIndex === -1 ? full.length - 1 : overIndex);
    const i = moved.findIndex((t) => t.id === id);
    const before = moved[i - 1]?.position;
    const after = moved[i + 1]?.position;
    const position =
      before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
    patchLocal(id, { status: col, position });
    persist(id, { status: col, position });
  };

  const active = tasks.find((t) => t.id === activeId) ?? null;
  const editingTask = tasks.find((t) => t.id === editing) ?? null;

  const scrollToCol = (id: TaskStatus) => {
    setMobileCol(id);
    const i = TASK_COLUMNS.findIndex((c) => c.id === id);
    const el = scroller.current;
    if (el) el.scrollTo({ left: (el.scrollWidth / TASK_COLUMNS.length) * i, behavior: "smooth" });
  };

  return (
    <div className="pb-8">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <PageHeader
          title="Tareas"
          subtitle={`Lo que falta para que la grilla de ${clientName} salga a tiempo.`}
          action={
            <Link href="/equipo" className="btn-ghost btn-sm">
              <UsersRound className="size-4" /> Equipo
            </Link>
          }
        />
        {/* Selector de columna (mobile) */}
        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 lg:hidden">
          {TASK_COLUMNS.map((c) => (
            <button key={c.id} className="chip" data-on={mobileCol === c.id} onClick={() => scrollToCol(c.id)}>
              {c.label} <span className="opacity-60">{byCol[c.id].length}</span>
            </button>
          ))}
        </div>
      </div>

      <DndContext id="tablero" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / (el.scrollWidth / TASK_COLUMNS.length));
            const col = TASK_COLUMNS[Math.min(TASK_COLUMNS.length - 1, Math.max(0, i))].id;
            if (col !== mobileCol) setMobileCol(col);
          }}
          className="no-scrollbar mx-auto flex max-w-[1400px] snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 lg:grid lg:snap-none lg:grid-cols-4 lg:overflow-visible lg:px-8"
        >
          {TASK_COLUMNS.map((c) => (
            <Column
              key={c.id}
              id={c.id}
              label={c.label}
              tasks={byCol[c.id]}
              people={people}
              posts={posts}
              today={today}
              onOpen={setEditing}
              onCreate={(title) =>
                start(async () => {
                  const t = await createTask(clientId, c.id, title);
                  if (t) setTasks((prev) => [...prev, t]);
                })
              }
            />
          ))}
        </div>
        <DragOverlay>{active ? <TaskCard task={active} people={people} posts={posts} today={today} overlay /> : null}</DragOverlay>
      </DndContext>

      <Sheet open={!!editingTask} onClose={() => setEditing(null)} title="Tarea">
        {editingTask && (
          <TaskEditor
            key={editingTask.id}
            task={editingTask}
            people={people}
            posts={posts}
            onChange={(patch) => {
              patchLocal(editingTask.id, patch as Partial<Task>);
              persist(editingTask.id, patch);
            }}
            onDelete={() => {
              setTasks((prev) => prev.filter((t) => t.id !== editingTask.id));
              setEditing(null);
              start(() => deleteTask(editingTask.id));
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function Column({
  id,
  label,
  tasks,
  people,
  posts,
  today,
  onOpen,
  onCreate,
}: {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  people: Person[];
  posts: PostRef[];
  today: string;
  onOpen: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    if (text.trim()) onCreate(text.trim());
    setText("");
  };

  return (
    <section className="flex w-[86vw] max-w-[380px] shrink-0 snap-center flex-col lg:w-auto lg:max-w-none">
      <header className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: COLUMN_TINT[id] }} />
          {label}
          <span className="font-normal text-muted">{tasks.length}</span>
        </h2>
        <button onClick={() => setAdding(true)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={`Agregar en ${label}`}>
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[55dvh] flex-1 flex-col gap-2 rounded-2xl bg-sunken/60 p-2 transition-colors lg:min-h-[60dvh]",
          isOver && "bg-accent-soft",
        )}
      >
        {adding && (
          <div className="rounded-xl border border-ink bg-surface p-2">
            <textarea
              autoFocus
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={() => {
                submit();
                setAdding(false);
              }}
              placeholder="¿Qué hay que hacer?"
              className="w-full resize-none bg-transparent px-1 text-[15px] outline-none"
            />
          </div>
        )}
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} people={people} posts={posts} today={today} onOpen={() => onOpen(t.id)} />
          ))}
        </SortableContext>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-[14px] font-medium text-muted hover:bg-surface hover:text-ink"
          >
            <Plus className="size-4" /> Agregar tarea
          </button>
        )}
      </div>
    </section>
  );
}

function SortableCard(props: { task: Task; people: Person[]; posts: PostRef[]; today: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={props.onOpen}
    >
      <TaskCard {...props} />
    </div>
  );
}

function dueTone(due: string | null, today: string, done: boolean) {
  if (!due || done) return "text-muted";
  if (due < today) return "text-st-changes";
  if (due <= addDays(today, 1)) return "text-st-review";
  return "text-muted";
}

function TaskCard({ task, people, posts, today, overlay }: { task: Task; people: Person[]; posts: PostRef[]; today: string; overlay?: boolean }) {
  const person = people.find((p) => p.id === task.assigneeId);
  const post = posts.find((p) => p.id === task.postId);
  const done = task.status === "done";
  return (
    <article
      className={cn(
        "cursor-grab select-none rounded-xl border border-line bg-surface p-3 active:cursor-grabbing",
        overlay && "rotate-[1.5deg] shadow-pop",
      )}
    >
      <div className="flex items-start gap-2">
        {task.priority === "high" && <Flag className="mt-0.5 size-3.5 shrink-0 fill-accent text-accent-strong" />}
        <p className={cn("flex-1 text-[14.5px] font-medium leading-snug", done && "text-muted line-through decoration-line-strong")}>{task.title}</p>
      </div>
      {(task.dueDate || person || post || task.description) && (
        <div className="mt-2.5 flex items-center gap-3 text-[12.5px]">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1 font-medium", dueTone(task.dueDate, today, done))}>
              <CalendarClock className="size-3.5" />
              {task.dueDate === today ? "Hoy" : formatDayShort(task.dueDate)}
            </span>
          )}
          {task.description && <AlignLeft className="size-3.5 text-muted" />}
          {post && (
            <span className="flex min-w-0 items-center gap-1 text-muted">
              <Link2 className="size-3.5 shrink-0" />
              <span className="truncate">{post.title}</span>
            </span>
          )}
          {person && (
            <span className="ml-auto">
              <PersonAvatar name={person.name} color={person.color} size={22} />
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function TaskEditor({
  task,
  people,
  posts,
  onChange,
  onDelete,
}: {
  task: Task;
  people: Person[];
  posts: PostRef[];
  onChange: (patch: TaskPatch) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const linked = posts.find((p) => p.id === task.postId);

  return (
    <div className="space-y-5">
      <textarea
        value={title}
        rows={2}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== task.title && onChange({ title })}
        className="w-full resize-none bg-transparent font-display text-[21px] font-bold leading-tight outline-none"
      />
      <div>
        <p className="label">Columna</p>
        <div className="flex flex-wrap gap-2">
          {TASK_COLUMNS.map((c) => (
            <button key={c.id} className="chip" data-on={task.status === c.id} onClick={() => onChange({ status: c.id })}>
              <span className="size-2 rounded-full" style={{ background: COLUMN_TINT[c.id] }} /> {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="due">Vence</label>
          <input id="due" type="date" className="field" value={task.dueDate ?? ""} onChange={(e) => onChange({ dueDate: e.target.value || null })} />
        </div>
        <div>
          <label className="label" htmlFor="prio">Prioridad</label>
          <select id="prio" className="field" value={task.priority} onChange={(e) => onChange({ priority: e.target.value as Task["priority"] })}>
            {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <p className="label">Responsable</p>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              className="chip pl-1.5"
              data-on={task.assigneeId === p.id}
              onClick={() => onChange({ assigneeId: task.assigneeId === p.id ? null : p.id })}
            >
              <PersonAvatar name={p.name} color={p.color} size={24} /> {p.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="post">Pieza relacionada</label>
        <select id="post" className="field" value={task.postId ?? ""} onChange={(e) => onChange({ postId: e.target.value || null })}>
          <option value="">Ninguna</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {formatDayShort(p.date)} · {p.title}
            </option>
          ))}
        </select>
        {linked && (
          <Link href={`/posts/${linked.id}`} className="mt-1.5 inline-block text-[13px] font-semibold text-ink-2 underline underline-offset-4">
            Abrir pieza
          </Link>
        )}
      </div>
      <div>
        <label className="label" htmlFor="desc">Detalle</label>
        <textarea
          id="desc"
          className="field min-h-[110px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== task.description && onChange({ description })}
          placeholder="Links, referencias, checklist…"
        />
      </div>
      <button className="flex items-center gap-1.5 text-[14px] font-medium text-st-changes" onClick={() => confirm("¿Borrar la tarea?") && onDelete()}>
        <Trash2 className="size-4" /> Borrar tarea
      </button>
    </div>
  );
}
