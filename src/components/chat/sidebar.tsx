"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Check,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Keyboard, Settings } from "lucide-react";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Marquage post-montage : le thème n'est connu qu'après hydratation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // Rendu déterministe avant montage (Moon sur serveur ET client) : zéro mismatch.
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Basculer le thème clair/sombre"
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export type ConversationItem = {
  id: string;
  title: string;
  updatedAt: string;
};

export function Sidebar({
  conversations,
  activeId,
  open,
  busy,
  collapsed = false,
  onClose,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onOpenShortcuts,
  onOpenSettings,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
  open: boolean;
  busy: boolean;
  collapsed?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (c: ConversationItem) => {
    setEditingId(c.id);
    setDraft(c.title);
  };
  const commitEdit = async () => {
    const id = editingId;
    const title = draft.trim();
    setEditingId(null);
    if (!id || !title) return;
    setSaving(true);
    await onRename(id, title);
    setSaving(false);
  };

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0 ${
          collapsed ? "md:hidden" : ""
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-black text-primary-foreground">G</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Grok Bot
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-3 pt-4">
          <button
            onClick={onNew}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Plus className="size-4" />
            Nouvelle conversation
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 [scrollbar-width:thin] [scrollbar-color:#333_transparent]">
          {conversations.length === 0 && (
            <p className="px-2 pt-6 text-center text-[13px] text-muted-foreground">
              Aucune conversation pour le moment.
            </p>
          )}
          {conversations.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                  aria-label="Nouveau titre"
                />
                <button
                  onClick={() => void commitEdit()}
                  aria-label="Valider le titre"
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <div
                key={c.id}
                className={`group relative flex items-center rounded-lg transition-colors ${
                  activeId === c.id ? "bg-accent" : "hover:bg-accent/60"
                }`}
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-[13.5px] text-foreground/90">{c.title}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label="Options de la conversation"
                      className="mr-1.5 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-border bg-popover">
                    <DropdownMenuItem onClick={() => startEdit(c)}>
                      <Pencil className="size-3.5" /> Renommer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(c.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5" /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          )}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] leading-4 text-muted-foreground">
              Grok Bot v1.2 — auto-hébergé
              <br />
              Sans abonnement, tes données restent locales.
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={onOpenSettings}
                aria-label="Paramètres des fournisseurs"
                title="Fournisseurs IA (BYOK)"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Settings className="size-4" />
              </button>
              <button
                onClick={onOpenShortcuts}
                aria-label="Raccourcis clavier"
                title="Raccourcis clavier (Ctrl/⌘ + /)"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Keyboard className="size-4" />
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
