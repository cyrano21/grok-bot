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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const message: string = (body?.message ?? "").toString().trim();
    const regenerate: boolean = body?.regenerate === true;
    const mode: string = body?.mode === "raisonnement" ? "raisonnement" : "standard";
    let conversationId: string | null = (body?.conversationId ?? "").toString() || null;

    if (!regenerate && !message) {
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
        data: { conversationId, role: "user", content: message },
      });
    }

    const history = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: CONTEXT_LIMIT,
      select: { role: true, content: true },
    });

    const zai = await ZAI.create();
    const sdkStream = (await zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
      ],
      stream: true,
      thinking: { type: mode === "raisonnement" ? "enabled" : "disabled" },
    })) as ReadableStream<Uint8Array>;

    const [toClient, toPersist] = sdkStream.tee();
    const convId = conversationId;

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
            data: { conversationId: convId, role: "assistant", content: full },
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

    return new Response(toClient, {
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
