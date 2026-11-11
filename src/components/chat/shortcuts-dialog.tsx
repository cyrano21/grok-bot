"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl/⌘", "Maj", "O"], label: "Nouvelle conversation" },
  { keys: ["Ctrl/⌘", "B"], label: "Afficher / masquer la barre latérale" },
  { keys: ["Ctrl/⌘", "K"], label: "Aller au champ de saisie" },
  { keys: ["Ctrl/⌘", "Maj", "L"], label: "Thème clair / sombre" },
  { keys: ["Échap"], label: "Arrêter la génération" },
  { keys: ["Entrée"], label: "Envoyer (Maj + Entrée : nouvelle ligne)" },
  { keys: ["Ctrl/⌘", "/"], label: "Afficher cette aide" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-popover sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Raccourcis clavier</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Navigue dans Grok Bot sans quitter le clavier.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-popover-foreground">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
