"use client";

import { useState, useTransition } from "react";
import { ArrowUp, CheckCircle2, RotateCcw } from "lucide-react";
import type { Comment } from "@/lib/db/schema";
import { timeAgo } from "@/lib/dates";
import { ClientAvatar, PersonAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { addTeamComment } from "@/app/(app)/actions/posts";

type ClientLike = { name: string; color: string; avatarId: string | null };

export function CommentList({ comments, client, share }: { comments: Comment[]; client: ClientLike; share?: string }) {
  if (comments.length === 0) return null;
  return (
    <ol className="space-y-3">
      {comments.map((c) => {
        if (c.kind === "status") {
          return (
            <li key={c.id} className="flex items-center gap-2 pl-1 text-[12.5px] text-muted">
              <span className="h-px w-3 bg-line-strong" />
              {c.authorName} cambió el estado a <span className="font-semibold text-ink-2">{c.body}</span> · {timeAgo(c.createdAt)}
            </li>
          );
        }
        const fromClient = c.authorKind === "client";
        return (
          <li key={c.id} className="flex gap-2.5">
            {fromClient ? (
              <ClientAvatar client={client} size={30} share={share} />
            ) : (
              <PersonAvatar name={c.authorName} color="#4a463e" size={30} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-muted">
                <span className="font-semibold text-ink">{c.authorName}</span>
                {fromClient && <span className="ml-1.5 rounded-full bg-sunken px-1.5 py-px text-[11px] font-semibold">Cliente</span>} ·{" "}
                {timeAgo(c.createdAt)}
              </p>
              {c.kind === "approved" && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-st-approved">
                  <CheckCircle2 className="size-4" /> Aprobó la pieza
                </p>
              )}
              {c.kind === "changes" && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-st-changes">
                  <RotateCcw className="size-4" /> Pidió cambios
                </p>
              )}
              {c.body && (
                <p
                  className={cn(
                    "mt-1 whitespace-pre-line rounded-2xl rounded-tl-md px-3 py-2 text-[14.5px] leading-snug",
                    fromClient ? "bg-accent-soft" : "bg-sunken",
                  )}
                >
                  {c.body}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CommentThread({ postId, comments, client }: { postId: string; comments: Comment[]; client: ClientLike }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const send = () => {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      await addTeamComment(postId, body);
      setText("");
    });
  };
  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-[14px] text-muted">Todavía no hay comentarios. Lo que escriba el cliente desde su link aparece acá.</p>
      ) : (
        <CommentList comments={comments} client={client} />
      )}
      <div className="mt-4 flex items-end gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-3.5 focus-within:border-ink">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Responder…"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none [field-sizing:content]"
        />
        <button
          onClick={send}
          disabled={pending || !text.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-inverse text-inverse-ink disabled:opacity-30"
          aria-label="Enviar"
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
