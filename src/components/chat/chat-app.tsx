"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Copy, Menu, Plus, RefreshCw, Zap, Brain } from "lucide-react";
import { toast } from "sonner";
import { Sidebar, type ConversationItem } from "./sidebar";
import { Composer } from "./composer";
import { MessageContent } from "./message-content";

type Msg = { id: string; role: string; content: string };
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

  useEffect(() => {
    const saved = window.localStorage.getItem("grok-mode");
    // Lecture post-montage obligatoire : localStorage indisponible côté serveur (SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "standard" || saved === "raisonnement") setMode(saved);
  }, []);

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
        setMessages(data.messages ?? []);
        stickRef.current = true;
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingConv(false);
      }
    },
    [streaming]
  );

  const newChat = () => {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

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

  const send = async (text: string) => {
    if (streaming || !text.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    stickRef.current = true;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setStreamingText("");
    accRef.current = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message: text, mode }),
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
            accRef.current += j?.choices?.[0]?.delta?.content ?? "";
            setStreamingText(accRef.current);
          } catch {
            /* frame partielle */
          }
        }
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: accRef.current },
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

  const stop = () => abortRef.current?.abort();

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, regenerate: true, mode }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
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
            accRef.current += j?.choices?.[0]?.delta?.content ?? "";
            setStreamingText(accRef.current);
          } catch {
            /* frame partielle */
          }
        }
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: accRef.current },
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
    <div className="flex h-dvh overflow-hidden bg-[#050505]">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        busy={streaming}
        onClose={() => setSidebarOpen(false)}
        onSelect={loadConversation}
        onNew={newChat}
        onRename={renameConversation}
        onDelete={deleteConversation}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 md:px-5">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-neutral-300 hover:bg-white/10 md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setModeOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={modeOpen}
              aria-label="Choisir le mode du modèle"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-neutral-100 transition-colors hover:bg-white/10"
            >
              {mode === "standard" ? (
                <Zap className="size-4 text-neutral-300" />
              ) : (
                <Brain className="size-4 text-neutral-300" />
              )}
              {mode === "standard" ? "Standard" : "Raisonnement"}
              <ChevronDown className={`size-3.5 text-neutral-500 transition-transform ${modeOpen ? "rotate-180" : ""}`} />
            </button>
            {modeOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setModeOpen(false)} aria-hidden="true" />
                <div
                  role="listbox"
                  aria-label="Modes disponibles"
                  className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#141414] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
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
                          active ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-neutral-300" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-neutral-100">{m.label}</span>
                          <span className="block text-xs leading-4 text-neutral-500">{m.desc}</span>
                        </span>
                        {active && <Check className="mt-1 size-4 shrink-0 text-neutral-200" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <span className="hidden min-w-0 flex-1 truncate text-sm text-neutral-500 md:block">
            {activeTitle || ""}
          </span>
          <span className="flex-1 md:hidden" />
          <button
            onClick={newChat}
            aria-label="Nouvelle conversation"
            className="rounded-lg p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Plus className="size-5" />
          </button>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#2a2a2a_transparent]"
        >
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center px-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-[0_0_60px_rgba(255,255,255,0.12)]">
                <span className="text-2xl font-black text-black">G</span>
              </div>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-neutral-100">
                Grok <span className="text-neutral-500">Bot</span>
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Ton assistant IA, sans abonnement.
              </p>
              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-neutral-100"
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
                  <Bot className="size-6 animate-pulse text-neutral-600" />
                </div>
              ) : (
                <>
                  {messages.map((m) =>
                    m.role === "user" ? (
                      <div key={m.id} className="mb-5 flex justify-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] bg-[#1e1e1e] px-4 py-2.5 text-[15px] leading-6 text-neutral-100">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div key={m.id} className="group mb-6 flex gap-3">
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white">
                          <span className="text-xs font-black text-black">G</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <MessageContent content={m.content} />
                          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              onClick={() => void copyMessage(m)}
                              aria-label="Copier la réponse"
                              className="rounded-md p-1.5 text-neutral-600 hover:bg-white/10 hover:text-neutral-300"
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
                                className="rounded-md p-1.5 text-neutral-600 hover:bg-white/10 hover:text-neutral-300"
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
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white">
                        <span className="text-xs font-black text-black">G</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        {streamingText === "" ? (
                          <div className="flex gap-1 py-2" aria-label="Génération en cours">
                            <span className="size-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:0ms]" />
                            <span className="size-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:150ms]" />
                            <span className="size-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:300ms]" />
                          </div>
                        ) : (
                          <>
                            <MessageContent content={streamingText} />
                            <span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse bg-neutral-300 align-text-bottom" />
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

        <Composer streaming={streaming} onSend={(t) => void send(t)} onStop={stop} />
      </main>
    </div>
  );
}
