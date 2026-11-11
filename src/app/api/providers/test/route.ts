// Test de connectivité d'un fournisseur OpenAI-compatible (BYOK).
// Reçoit { baseUrl, apiKey, model } du client, ne persiste rien.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const baseUrl = (body?.baseUrl ?? "").toString().replace(/\/+$/, "");
    const apiKey = (body?.apiKey ?? "").toString();
    const model = (body?.model ?? "").toString();

    if (!baseUrl || !apiKey || !model) {
      return Response.json(
        { ok: false, error: "baseUrl, apiKey et model sont requis" },
        { status: 400 },
      );
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Réponds uniquement : OK" }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json({
        ok: false,
        error: `HTTP ${res.status} — ${text.slice(0, 220) || "réponse vide"}`,
      });
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const reply = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return Response.json({ ok: true, reply: reply.slice(0, 60) });
  } catch (e) {
    const err = e as Error;
    return Response.json({
      ok: false,
      error:
        err.name === "TimeoutError"
          ? "Délai dépassé (20 s) — vérifie l'URL du fournisseur"
          : err.message || "Erreur inconnue",
    });
  }
}
