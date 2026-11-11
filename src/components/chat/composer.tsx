"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_IMAGES, resizeImage } from "@/lib/image";

export function Composer({
  streaming,
  onSend,
  onStop,
}: {
  streaming: boolean;
  onSend: (text: string, images: string[]) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - pending.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images par message`);
      return;
    }
    const list = Array.from(files)
      .slice(0, room)
      .filter((f) => f.type.startsWith("image/"));
    if (list.length < files.length) toast.error("Seules les images sont acceptées");
    try {
      const dataUrls = await Promise.all(list.map((f) => resizeImage(f)));
      setPending((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES));
    } catch {
      toast.error("Impossible de lire une image");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = () => {
    const text = value.trim();
    if ((!text && pending.length === 0) || streaming) return;
    onSend(text || "Décris-moi cette image.", pending);
    setValue("");
    setPending([]);
    requestAnimationFrame(resize);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:px-6">
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {pending.map((src, i) => (
            <div key={i} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Pièce jointe ${i + 1}`}
                className="h-16 w-16 rounded-xl border border-border object-cover"
              />
              <button
                onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Retirer l'image ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-[26px] border border-border bg-card p-2 pl-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition-colors focus-within:border-foreground/30 dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={streaming || pending.length >= MAX_IMAGES}
          aria-label="Joindre des images"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ImagePlus className="size-5" />
        </button>
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
            disabled={!value.trim() && pending.length === 0}
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
