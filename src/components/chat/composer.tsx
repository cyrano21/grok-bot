"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export function Composer({
  streaming,
  onSend,
  onStop,
}: {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  useEffect(() => {
    resize();
  }, [value]);

  useEffect(() => {
    if (!streaming) ref.current?.focus();
  }, [streaming]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(resize);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:px-6">
      <div className="flex items-end gap-2 rounded-[26px] border border-border bg-card p-2 pl-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition-colors focus-within:border-foreground/30 dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Pose ta question à Grok Bot…"
          aria-label="Message"
          className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
        />
        {streaming ? (
          <button
            onClick={onStop}
            aria-label="Arrêter la génération"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Envoyer"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 disabled:scale-100 disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
        Grok Bot peut se tromper. Vérifie les informations importantes.
      </p>
    </div>
  );
}
