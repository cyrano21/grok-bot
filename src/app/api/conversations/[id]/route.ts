import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    return Response.json({ error: "Conversation introuvable" }, { status: 404 });
  }
  return Response.json(conversation);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").toString().trim();
  if (!title) {
    return Response.json({ error: "Titre requis" }, { status: 400 });
  }
  const updated = await db.conversation.update({
    where: { id },
    data: { title: title.slice(0, 120) },
  });
  return Response.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.conversation.delete({ where: { id } });
  return Response.json({ ok: true });
}
