# grok-bot

Grok-style AI chatbot (Next.js 16 + TypeScript + Prisma + streaming LLM).
Self-hosted alternative — **no subscription required**.

## Features

- **Streaming chat** — real-time SSE responses with typing cursor and stop button
- **Modes** — `Standard` (fast answers) and `Raisonnement` (deep reasoning), persisted in localStorage
- **Conversations** — full history persisted in SQLite (Prisma), auto-titled from the first message
- **Sidebar** — rename, delete, switch conversations; mobile drawer with overlay
- **Markdown rendering** — headings, lists, tables, syntax-styled code blocks with per-block copy button
- **Message actions** — copy answer, regenerate the last response
- **Responsive** — desktop sidebar + mobile drawer, no horizontal overflow at 390 px

## Stack

- Next.js 16 (App Router), TypeScript, React 19
- Tailwind CSS 4 + shadcn/ui (48 components)
- Prisma ORM (SQLite) — `Conversation` / `Message` (cascade delete, indexed)
- Server-side LLM streaming (SSE) via `z-ai-web-dev-sdk` — no API key needed, no subscription
- react-markdown + remark-gfm + react-syntax-highlighter

## Dev

```bash
bun install
bun run db:push          # create/update db/custom.db (tables Conversation + Message)
bun run dev              # http://localhost:3005
```

> Note: if `bunx prisma db push` picks up the wrong `.env` (parent folder), force it:
> `DATABASE_URL="file:<abs-path>/db/custom.db" bunx prisma db push --accept-data-loss`

## API

| Route | Method | Description |
| --- | --- | --- |
| `/api/chat` | POST | `{ message, conversationId?, mode?, regenerate? }` → SSE stream (`X-Conversation-Id` header) |
| `/api/conversations` | GET | List conversations (with message counts) |
| `/api/conversations/[id]` | GET / PATCH / DELETE | Load messages / rename / delete (cascades) |

## Production

```bash
bun run build            # standalone build
bun run start            # serves .next/standalone/server.js
```
