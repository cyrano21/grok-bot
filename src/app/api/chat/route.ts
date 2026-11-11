import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Tu es Grok Bot, un assistant IA vif, direct et perspicace avec un esprit légèrement taquin mais toujours utile et respectueux.

Règles :
- Réponds TOUJOURS dans la langue de l'utilisateur (français → français, anglais → anglais, etc.).
- Sois précis et concis : va droit au but, sans remplissage inutile.
- Utilise le formatage Markdown quand c'est pertinent : titres, listes, tableaux, blocs de code avec le langage indiqué.
- Si tu n'es pas sûr d'un fait, dis-le clairement au lieu d'inventer.
- Pour le code : donne du code complet, fonctionnel et commenté quand nécessaire.
- Tu peux avoir de l'humour, mais reste pertinent : l'utilité passe avant la blague.`;

const CONTEXT_LIMIT = 24;
const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 2_600_000; // ~2 Mo en base64

function sanitizeImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (u): u is string =>
        typeof u === "string" &&
        u.startsWith("data:image/") &&
        u.length <= MAX_IMAGE_CHARS,
    )
    .slice(0, MAX_IMAGES);
}

type Source = { name: string; url: string; host_name: string; date: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const message: string = (body?.message ?? "").toString().trim();
    const regenerate: boolean = body?.regenerate === true;
    const mode: string = body?.mode === "raisonnement" ? "raisonnement" : "standard";
    const images: string[] = regenerate ? [] : sanitizeImages(body?.images);
    const webSearchOn: boolean = body?.webSearch === true;
    let conversationId: string | null = (body?.conversationId ?? "").toString() || null;

    if (!regenerate && !message && images.length === 0) {
      return Response.json({ error: "Message requis" }, { status: 400 });
    }

    if (conversationId) {
      const existing = await db.conversation.findUnique({ where: { id: conversationId } });
      if (!existing) {
        return Response.json({ error: "Conversation introuvable" }, { status: 404 });
      }
    } else if (regenerate) {
      return Response.json({ error: "Conversation introuvable" }, { status: 404 });
    } else {
      const created = await db.conversation.create({
        data: { title: message.replace(/\s+/g, " ").slice(0, 80) },
      });
      conversationId = created.id;
    }

    if (regenerate) {
      // Supprime les réponses assistant terminales pour repartir de la dernière question.
      const all = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true },
      });
      while (all.length > 0 && all[all.length - 1].role === "assistant") {
        const last = all.pop();
        if (last) await db.message.delete({ where: { id: last.id } });
      }
      if (all.length === 0) {
        return Response.json({ error: "Rien à régénérer" }, { status: 400 });
      }
    } else {
      await db.message.create({
        data: {
          conversationId,
          role: "user",
          content: message,
          images: images.length ? JSON.stringify(images) : null,
        },
      });
    }

    const history = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: CONTEXT_LIMIT,
      select: { role: true, content: true, images: true },
    });

    const parseImages = (raw: string | null): string[] => {
      try {
        const arr = raw ? (JSON.parse(raw) as unknown) : [];
        return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === "string") : [];
      } catch {
        return [];
      }
    };

    const zai = await ZAI.create();

    // Recherche web optionnelle : résultats injectés comme contexte, sources persistées.
    let sources: Source[] = [];
    if (webSearchOn) {
      const query = message || history[history.length - 1]?.content || "";
      if (query.trim()) {
        try {
          const results = (await zai.functions.invoke("web_search", {
            query: query.slice(0, 400),
            num: 6,
          })) as Array<{
            url: string;
            name: string;
            snippet: string;
            host_name: string;
            date: string;
          }>;
          sources = (results ?? []).slice(0, 6).map((r) => ({
            name: String(r?.name ?? ""),
            url: String(r?.url ?? ""),
            host_name: String(r?.host_name ?? ""),
            date: String(r?.date ?? ""),
          }));
        } catch (e) {
          console.error("[chat] web_search failed:", e);
        }
      }
    }

    const llmMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT as string },
      ...(sources.length > 0
        ? [
            {
              role: "system" as const,
              content: `Résultats de recherche web (${new Date().toISOString().slice(0, 10)}) pour « ${
                message || history[history.length - 1]?.content || ""
              } » :
${sources.map((s, i) => `[${i + 1}] ${s.name} — ${s.host_name}${s.date ? ` (${s.date})` : ""}\n    ${s.url}\n    ${s.snippet}`).join("\n")}

Utilise ces résultats pour fonder ta réponse. Cite les sources concernées avec des références du type [1], [2] à la fin des phrases concernées. Si les résultats sont insuffisants ou périmés, dis-le clairement. Ne cite QUE les résultats ci-dessus comme sources web.`,
            },
          ]
        : []),
      ...history.map((m) => {
        const imgs = parseImages(m.images);
        if (imgs.length === 0) {
          return {
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content as string,
          };
        }
        return {
          role: "user" as const,
          content: [
            { type: "text" as const, text: m.content || " " },
            ...imgs.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        };
      }),
    ];

    const useVision = history.some((m) => parseImages(m.images).length > 0);

    // Fournisseur BYOK (OpenAI-compatible) si fourni, sinon moteur intégré.
    const custom = body?.provider as
      | { baseUrl?: unknown; apiKey?: unknown; model?: unknown }
      | undefined;
    const useCustom =
      typeof custom?.baseUrl === "string" &&
      custom.baseUrl.startsWith("http") &&
      typeof custom?.apiKey === "string" &&
      custom.apiKey.length > 0 &&
      typeof custom?.model === "string" &&
      custom.model.length > 0;

    let sdkStream: ReadableStream<Uint8Array>;
    if (useCustom) {
      const upstream = await fetch(
        `${(custom as { baseUrl: string }).baseUrl.replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(custom as { apiKey: string }).apiKey}`,
          },
          body: JSON.stringify({
            model: (custom as { model: string }).model,
            messages: llmMessages,
            stream: true,
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => "");
        return Response.json(
          {
            error: `Fournisseur « ${(custom as { model: string }).model} » : HTTP ${upstream.status}${
              text ? ` — ${text.slice(0, 220)}` : ""
            }`,
          },
          { status: 502 },
        );
      }
      sdkStream = upstream.body;
    } else {
      sdkStream = (await (useVision
        ? zai.chat.completions.createVision({
            messages: llmMessages,
            stream: true,
            thinking: { type: mode === "raisonnement" ? "enabled" : "disabled" },
          })
        : zai.chat.completions.create({
            messages: llmMessages,
            stream: true,
            thinking: { type: mode === "raisonnement" ? "enabled" : "disabled" },
          }))) as ReadableStream<Uint8Array>;
    }

    const [toClient, toPersist] = sdkStream.tee();
    const convId = conversationId;
    const finalSources = sources;

    // Enveloppe SSE : ajoute les sources en fin de flux (frame grok_sources) avant rendu client.
    const enc = new TextEncoder();
    const sourcesFrame = finalSources.length
      ? `data: ${JSON.stringify({ grok_sources: finalSources })}\n\n`
      : "";
    const clientStream = sourcesFrame
      ? toClient.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              controller.enqueue(chunk);
            },
            flush(controller) {
              controller.enqueue(enc.encode(sourcesFrame));
            },
          }),
        )
      : toClient;

    // Background: accumulate SSE deltas and persist the full assistant message
    void (async () => {
      try {
        const dec = new TextDecoder();
        const reader = toPersist.getReader();
        let buf = "";
        let full = "";
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
              full += j?.choices?.[0]?.delta?.content ?? "";
            } catch {
              /* frame partielle — ignoré */
            }
          }
        }
        if (full.trim()) {
          await db.message.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: full,
              sources: finalSources.length ? JSON.stringify(finalSources) : null,
            },
          });
        }
        await db.conversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        });
      } catch (e) {
        console.error("[chat] persist error:", e);
      }
    })();

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (e) {
    console.error("[chat] error:", e);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
