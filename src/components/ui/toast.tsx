"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setMounted(true), []);

  const show = useCallback((text: string) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  const node =
    mounted && msg
      ? createPortal(
          <div
            role="status"
            className="fixed inset-x-0 z-[60] flex justify-center px-4"
            style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
          >
            <div className="animate-pop-in rounded-full bg-inverse px-4 py-2.5 text-[14px] font-semibold text-inverse-ink shadow-pop">{msg}</div>
          </div>,
          document.body,
        )
      : null;

  return [node, show] as const;
}
