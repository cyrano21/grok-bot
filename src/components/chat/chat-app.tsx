"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Globe,
  Menu,
  PanelLeft,
  Plus,
  RefreshCw,
  Settings,
  Zap,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar, type ConversationItem } from "./sidebar";
import { Composer } from "./composer";
import { MessageContent } from "./message-content";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { ProvidersDialog } from "./providers-dialog";
import {
  BUILTIN_PROVIDER_ID,
  loadActiveProviderId,
  loadProviders,
  saveActiveProviderId,
  saveProviders,
  type Provider,
} from "@/lib/providers";

type Msg = {
  id: string;
  role: string;
  content: string;
  images?: string[];
  sources?: { name: string; url: string; host_name: string; date: string }[];
};
type Mode = "standard" | "raisonnement";

const MODES: { id: Mode; label: string; desc: string; icon: typeof Zap }[] = [
  { id: "standard", label: "Standard", desc: "Réponses rapides pour le quotidien", icon: Zap },
  { id: "raisonnement", label: "Raisonnement", desc: "Réflexion approfondie pour les problèmes complexes", icon: Brain },
];

const SUGGESTIONS = [
  "Explique-moi les trous noirs comme si j'avais 10 ans",
  "Écris un haïku sur le café du matin",
  "Aide-moi à rédiger un e-mail professionnel",
  "Donne-moi une idée de projet web original",
];

export function ChatApp() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("standard");
  const [modeOpen, setModeOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>(BUILTIN_PROVIDER_ID);
  const { resolvedTheme, setTheme } = useTheme();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const savedMode = window.localStorage.getItem("grok-mode");
    // Lecture post-montage obligatoire : localStorage indisponible côté serveur (SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture post-montage (SSR)
    if (savedMode === "standard" || savedMode === "raisonnement") setMode(savedMode);
    if (window.localStorage.getItem("grok-web") === "1") setWebSearch(true);
    setProviders(loadProviders());
    setActiveProviderId(loadActiveProviderId());
  }, []);

  const updateProviders = (list: Provider[]) => {
    setProviders(list);
    saveProviders(list);
    if (activeProviderId !== BUILTIN_PROVIDER_ID && !list.some((p) => p.id === activeProviderId)) {
      setActiveProviderId(BUILTIN_PROVIDER_ID);
      saveActiveProviderId(BUILTIN_PROVIDER_ID);
    }
  };

  const selectProvider = (id: string) => {
    setActiveProviderId(id);
    saveActiveProviderId(id);
    setModeOpen(false);
  };

  const activeProvider =
    activeProviderId !== BUILTIN_PROVIDER_ID
      ? providers.find((p) => p.id === activeProviderId) ?? null
      : null;

  const toggleWeb = () => {
    setWebSearch((v) => {
      window.localStorage.setItem("grok-web", v ? "0" : "1");
      return !v;
    });
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setModeOpen(false);
    window.localStorage.setItem("grok-mode", m);
  };

  const abortRef = useRef<AbortController | null>(null);
  const accRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {
      /* hors ligne */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConversationItem[]) => {
        if (alive) setConversations(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const activeTitle = conversations.find((c) => c.id === activeId)?.title;

  const loadConversation = useCallback(
    async (id: string) => {
      if (streaming) return;
      setActiveId(id);
      setSidebarOpen(false);
      setLoadingConv(true);
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) throw new Error("Conversation introuvable");
        const data = await res.json();
        setMessages(
          (data.messages ?? []).map(
            (m: {
              id: string;
              role: string;
              content: string;
              images?: string | null;
              sources?: string | null;
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              images: m.images ? (JSON.parse(m.images) as string[]) : undefined,
              sources: m.sources
                ? (JSON.parse(m.sources) as Msg["sources"])
                : undefined,
            }),
          ),
        );
        stickRef.current = true;
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingConv(false);
      }
    },
    [streaming]
  );

  const newChat = useCallback(() => {
    if (abortRef.current) return;
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      toast.success("Conversation supprimée");
    } catch {
      toast.error("Suppression impossible");
    }
  };

  const renameConversation = async (id: string, title: string) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    } catch {
      toast.error("Renommage impossible");
    }
  };

  const send = async (text: string, images: string[] = []) => {
    if (streaming || (!text.trim() && images.length === 0)) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    stickRef.current = true;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text, images: images.length ? images : undefined },
    ]);
    setStreamingText("");
    accRef.current = "";

    try {
      const payload: Record<string, unknown> = {
        conversationId: activeId,
        message: text,
        mode,
        images,
        webSearch,
      };
      if (activeProvider) {
        payload.provider = {
          baseUrl: activeProvider.baseUrl,
          apiKey: activeProvider.apiKey,
          model: activeProvider.model,
        };
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const newConvId = res.headers.get("X-Conversation-Id");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let receivedSources: Msg["sources"];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (j?.grok_sources) {
              receivedSources = j.grok_sources as Msg["sources"];
              continue;
            }
            accRef.current += j?.choices?.[0]?.delta?.content ?? "";
            setStreamingText(accRef.current);
          } catch {
            /* frame partielle */
          }
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: accRef.current,
          sources: receivedSources,
        },
      ]);
      setStreamingText(null);
      if (newConvId) setActiveId(newConvId);
      void refreshList();
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: accRef.current || "_Génération arrêtée._",
          },
        ]);
        setStreamingText(null);
        void refreshList();
      } else {
        setStreamingText(null);
        toast.error(err.message || "Erreur inconnue");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Raccourcis clavier globaux (Ctrl/⌘ + …)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "O" || e.key === "o")) {
        e.preventDefault();
        newChat();
      } else if (mod && !e.shiftKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        if (window.innerWidth < 768) setSidebarOpen((v) => !v);
        else setCollapsed((v) => !v);
      } else if (mod && !e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (mod && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (e.key === "Escape") {
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat, stop, resolvedTheme, setTheme]);

  const regenerate = async () => {
    if (streaming || !activeId) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    stickRef.current = true;
    setMessages((prev) => prev.slice(0, -1));
    setStreamingText("");
    accRef.current = "";

    try {
      const regenPayload: Record<string, unknown> = {
        conversationId: activeId,
        regenerate: true,
        mode,
        webSearch,
      };
      if (activeProvider) {
        regenPayload.provider = {
          baseUrl: activeProvider.baseUrl,
          apiKey: activeProvider.apiKey,
          model: activeProvider.model,
        };
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regenPayload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let receivedSources: Msg["sources"];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (j?.grok_sources) {
              receivedSources = j.grok_sources as Msg["sources"];
              continue;
            }
            accRef.current += j?.choices?.[0]?.delta?.content ?? "";
            setStreamingText(accRef.current);
          } catch {
            /* frame partielle */
          }
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: accRef.current,
          sources: receivedSources,
        },
      ]);
      setStreamingText(null);
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: accRef.current || "_Génération arrêtée._",
          },
        ]);
        setStreamingText(null);
      } else {
        setStreamingText(null);
        toast.error(err.message || "Erreur inconnue");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      void refreshList();
    }
  };

  const copyMessage = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  const empty = messages.length === 0 && streamingText === null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        busy={streaming}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
        onSelect={loadConversation}
        onNew={newChat}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenSettings={() => setProvidersOpen(true)}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ProvidersDialog
        open={providersOpen}
        onOpenChange={setProvidersOpen}
        providers={providers}
        activeProviderId={activeProviderId}
        onChange={updateProviders}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:px-5">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="size-5" />
          </button>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Afficher la barre latérale"
              className="hidden rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:block"
            >
              <PanelLeft className="size-5" />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setModeOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={modeOpen}
              aria-label="Choisir le mode du modèle"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {mode === "standard" ? (
                <Zap className="size-4 text-muted-foreground" />
              ) : (
                <Brain className="size-4 text-muted-foreground" />
              )}
              {mode === "standard" ? "Standard" : "Raisonnement"}
              <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${modeOpen ? "rotate-180" : ""}`} />
            </button>
            {modeOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setModeOpen(false)} aria-hidden="true" />
                <div
                  role="listbox"
                  aria-label="Modes disponibles"
                  className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[0_12px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
                >
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        role="option"
                        aria-selected={active}
                        onClick={() => changeMode(m.id)}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          active ? "bg-accent" : "hover:bg-accent/60"
                        }`}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-popover-foreground">{m.label}</span>
                          <span className="block text-xs leading-4 text-muted-foreground">{m.desc}</span>
                        </span>
                        {active && <Check className="mt-1 size-4 shrink-0 text-foreground" />}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-border" />
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Fournisseur
                  </p>
                  <button
                    role="option"
                    aria-selected={activeProviderId === BUILTIN_PROVIDER_ID}
                    onClick={() => selectProvider(BUILTIN_PROVIDER_ID)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      activeProviderId === BUILTIN_PROVIDER_ID ? "bg-accent" : "hover:bg-accent/60"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-popover-foreground">Grok Bot (intégré)</span>
                      <span className="block text-xs text-muted-foreground">Moteur gratuit, sans clé</span>
                    </span>
                    {activeProviderId === BUILTIN_PROVIDER_ID && (
                      <Check className="size-4 shrink-0 text-foreground" />
                    )}
                  </button>
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      role="option"
                      aria-selected={activeProviderId === p.id}
                      onClick={() => selectProvider(p.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        activeProviderId === p.id ? "bg-accent" : "hover:bg-accent/60"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-popover-foreground">
                          {p.name || "Fournisseur sans nom"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{p.model}</span>
                      </span>
                      {activeProviderId === p.id && (
                        <Check className="size-4 shrink-0 text-foreground" />
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setModeOpen(false);
                      setProvidersOpen(true);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  >
                    <Settings className="size-3.5" />
                    Gérer les fournisseurs…
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground md:block">
            {activeTitle || ""}
          </span>
          <span className="flex-1 md:hidden" />
          <button
            onClick={newChat}
            aria-label="Nouvelle conversation"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-5" />
          </button>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto [scrollbar-width:thin]"
        >
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center px-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_60px_rgba(0,0,0,0.12)] dark:shadow-[0_0_60px_rgba(255,255,255,0.12)]">
                <span className="text-2xl font-black">G</span>
              </div>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground">
                Grok <span className="text-muted-foreground">Bot</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ton assistant IA, sans abonnement.
              </p>
              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s, [])}
                    className="rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
              {loadingConv ? (
                <div className="flex justify-center py-16">
                  <Bot className="size-6 animate-pulse text-muted-foreground" />
                </div>
              ) : (
                <>
                  {messages.map((m) =>
                    m.role === "user" ? (
                      <div key={m.id} className="mb-5 flex justify-end">
                        <div className="max-w-[85%] space-y-1.5">
                          {m.images && m.images.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {m.images.map((src, i) => (
                                <a
                                  key={i}
                                  href={src}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={src}
                                    alt={`Image jointe ${i + 1}`}
                                    className="max-h-56 rounded-2xl border border-border object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                          {m.content && (
                            <div className="inline-block whitespace-pre-wrap rounded-[20px] bg-secondary px-4 py-2.5 text-[15px] leading-6 text-secondary-foreground">
                              {m.content}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div key={m.id} className="group mb-6 flex gap-3">
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                          <span className="text-xs font-black text-primary-foreground">G</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <MessageContent content={m.content} />
                          {m.sources && m.sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {m.sources.map((s, i) => (
                                <a
                                  key={i}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex max-w-[260px] items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  <Globe className="size-3 shrink-0" />
                                  <span className="truncate">{s.name || s.host_name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              onClick={() => void copyMessage(m)}
                              aria-label="Copier la réponse"
                              className="rounded-md p-1.5 text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                            >
                              {copiedId === m.id ? (
                                <Check className="size-3.5" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                            {m.id === messages[messages.length - 1]?.id && (
                              <button
                                onClick={() => void regenerate()}
                                aria-label="Régénérer la réponse"
                                className="rounded-md p-1.5 text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                              >
                                <RefreshCw className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                  {streamingText !== null && (
                    <div className="mb-6 flex gap-3">
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                        <span className="text-xs font-black text-primary-foreground">G</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        {streamingText === "" ? (
                          <div className="flex gap-1 py-2" aria-label="Génération en cours">
                            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                          </div>
                        ) : (
                          <>
                            <MessageContent content={streamingText} />
                            <span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse bg-foreground align-text-bottom" />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Composer
          streaming={streaming}
          webSearch={webSearch}
          onToggleWeb={toggleWeb}
          onSend={(t, imgs) => void send(t, imgs)}
          onStop={stop}
          composerRef={composerRef}
        />
      </main>
    </div>
  );
}
