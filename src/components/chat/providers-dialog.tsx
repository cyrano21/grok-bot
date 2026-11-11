"use client";

import { useState } from "react";
import { Check, Loader2, PlugZap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUILTIN_PROVIDER_ID,
  makeId,
  type Provider,
} from "@/lib/providers";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/40";

export function ProvidersDialog({
  open,
  onOpenChange,
  providers,
  activeProviderId,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: Provider[];
  activeProviderId: string;
  onChange: (providers: Provider[]) => void;
}) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testedId, setTestedId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Provider>) => {
    onChange(providers.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setTestedId(null);
  };

  const remove = (id: string) => {
    onChange(providers.filter((p) => p.id !== id));
  };

  const add = () => {
    onChange([
      ...providers,
      { id: makeId(), name: "", baseUrl: "", apiKey: "", model: "" },
    ]);
  };

  const test = async (p: Provider) => {
    setTestingId(p.id);
    setTestedId(null);
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          model: p.model,
        }),
      });
      const data = (await res.json()) as { ok: boolean; reply?: string; error?: string };
      if (data.ok) {
        setTestedId(p.id);
        toast.success(`« ${p.name || p.model} » répond : ${data.reply || "OK"}`);
      } else {
        toast.error(data.error || "Test échoué");
      }
    } catch {
      toast.error("Test impossible");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto border-border bg-popover sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Fournisseurs IA (BYOK)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Branche n&apos;importe quelle API compatible OpenAI : Groq, OpenRouter, Mistral, Ollama local…
            Les clés restent dans ton navigateur, jamais stockées sur le serveur.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded bg-primary">
              <Check className="size-3 text-primary-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-popover-foreground">
                Grok Bot (intégré)
              </p>
              <p className="text-xs text-muted-foreground">
                Moteur intégré gratuit — aucune clé nécessaire.
              </p>
            </div>
            {activeProviderId === BUILTIN_PROVIDER_ID && (
              <span className="text-[11px] text-muted-foreground">Actif</span>
            )}
          </div>
        </div>

        {providers.map((p) => (
          <div key={p.id} className="space-y-2.5 rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
                placeholder="Nom (ex : Groq gratuit)"
                aria-label="Nom du fournisseur"
                className={`${inputCls} flex-1 font-medium`}
              />
              <button
                onClick={() => void test(p)}
                disabled={testingId === p.id || !p.baseUrl || !p.apiKey || !p.model}
                aria-label={`Tester ${p.name || "le fournisseur"}`}
                title="Tester la connexion"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                {testingId === p.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : testedId === p.id ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <PlugZap className="size-4" />
                )}
              </button>
              <button
                onClick={() => remove(p.id)}
                aria-label={`Supprimer ${p.name || "le fournisseur"}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-destructive transition-colors hover:bg-accent"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <Field label="URL de base (terminée par /v1)">
              <input
                value={p.baseUrl}
                onChange={(e) => update(p.id, { baseUrl: e.target.value })}
                placeholder="https://api.groq.com/openai/v1"
                aria-label="URL de base de l'API"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Modèle">
                <input
                  value={p.model}
                  onChange={(e) => update(p.id, { model: e.target.value })}
                  placeholder="llama-3.3-70b-versatile"
                  aria-label="Nom du modèle"
                  className={inputCls}
                />
              </Field>
              <Field label="Clé API">
                <input
                  type="password"
                  value={p.apiKey}
                  onChange={(e) => update(p.id, { apiKey: e.target.value })}
                  placeholder="gsk_…"
                  aria-label="Clé API"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        ))}

        <button
          onClick={add}
          className="w-full rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          + Ajouter un fournisseur
        </button>
      </DialogContent>
    </Dialog>
  );
}
