"use client";

// Aperçu live des pages HTML générées par le modèle.
// L'iframe est sandboxée : allow-scripts + allow-forms + allow-popups
// SANS allow-same-origin → le code généré ne peut pas toucher au DOM
// parent, aux cookies ni au localStorage de Grok Bot.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Code2,
  GripHorizontal,
} from "lucide-react";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const MIN_H = 220;
const MAX_H = 900;

export function HtmlPreview({ code, lang }: { code: string; lang?: string }) {
  const [tab, setTab] = useState<"code" | "apercu">("code");
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(440);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const urlRef = useRef<string | null>(null);
  const debouncedCode = useDebounced(code, 400);
  // Recharge l'iframe à chaque version stabilisée du code.
  const srcDoc = useMemo(() => debouncedCode, [debouncedCode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  const fileName = useMemo(() => {
    const t = code.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const slug = (t || "page")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40);
    return `${slug || "page"}.html`;
  }, [code]);

  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      /* téléchargement impossible */
    }
  };

  const openInTab = () => {
    try {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
      urlRef.current = url;
      window.open(url, "_blank", "noopener");
    } catch {
      /* ouverture impossible */
    }
  };

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-border bg-muted">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div
          role="tablist"
          aria-label="Vue du code généré"
          className="flex items-center gap-1 rounded-lg bg-background p-0.5"
        >
          <button
            role="tab"
            aria-selected={tab === "code"}
            onClick={() => setTab("code")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === "code"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="size-3.5" />
            Code
          </button>
          <button
            role="tab"
            aria-selected={tab === "apercu"}
            onClick={() => setTab("apercu")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === "apercu"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="size-3.5" />
            Aperçu
          </button>
          <span className="ml-1 hidden pr-1 font-mono text-[11px] text-muted-foreground sm:inline">
            {lang || "html"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            aria-label="Copier le code"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copié" : "Copier"}
          </button>
          <button
            onClick={download}
            aria-label={`Télécharger ${fileName}`}
            title="Télécharger le fichier HTML"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          <button
            onClick={openInTab}
            aria-label="Ouvrir dans un nouvel onglet"
            title="Ouvrir dans un nouvel onglet"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">Ouvrir</span>
          </button>
        </div>
      </div>
      {tab === "code" ? (
        <pre className="max-h-[420px] overflow-auto p-4 text-[13px] leading-relaxed">
          <code className="font-mono text-foreground">{code}</code>
        </pre>
      ) : (
        <div className="bg-background p-2">
          <iframe
            title="Aperçu de la page générée"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
            style={{ height: `${height}px` }}
            className="w-full rounded-lg border border-border bg-white"
          />
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Redimensionner l'aperçu"
            title="Glisser pour redimensionner"
            onPointerDown={(e) => {
              dragRef.current = { startY: e.clientY, startH: height };
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* capture indisponible : le drag fonctionne quand même */
              }
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              const h = d.startH + (e.clientY - d.startY);
              setHeight(Math.min(MAX_H, Math.max(MIN_H, h)));
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            className="mt-1.5 flex h-5 cursor-row-resize touch-none items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground select-none"
          >
            <GripHorizontal className="size-4" />
          </div>
          <p className="px-1 pt-1 text-[11px] text-muted-foreground/80">
            Aperçu isolé (sandbox) — le code généré ne peut pas accéder à Grok Bot.
          </p>
        </div>
      )}
    </div>
  );
}

/** Détecte les blocs HTML prévisualisables. */
export function isPreviewableHtml(code: string, lang?: string): boolean {
  if (lang === "html") return true;
  const head = code.slice(0, 400).trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}
