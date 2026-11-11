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
      <div className="flex items-end gap-2 rounded-[26px] border border-white/15 bg-[#141414] p-2 pl-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-colors focus-within:border-white/30">
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
          className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        {streaming ? (
          <button
            onClick={onStop}
            aria-label="Arrêter la génération"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-black transition-transform hover:scale-105"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Envoyer"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 disabled:scale-100 disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-neutral-600">
        Grok Bot peut se tromper. Vérifie les informations importantes.
      </p>
    </div>
  );
}
