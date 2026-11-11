# grok-bot

Grok-style AI chatbot (Next.js 16 + TypeScript + Prisma + streaming LLM).
Self-hosted alternative — no subscription required.

## Stack
- Next.js 16 (App Router), TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma (SQLite) for conversation persistence
- Streaming chat completions (server-side SDK)

## Dev
```bash
bun install
bun run db:push
bun run dev -- -p 3005
```
