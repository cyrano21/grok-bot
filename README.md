# grok-bot

Grok-style AI chatbot (Next.js 16 + TypeScript + Prisma + streaming LLM).
Self-hosted alternative — **no subscription required**.

## Features

- **Streaming chat** — real-time SSE responses with typing cursor and stop button
- **Modes** — `Standard` (fast answers) and `Raisonnement` (deep reasoning), persisted in localStorage
- **Conversations** — full history persisted in SQLite (Prisma), auto-titled from the first message
- **Sidebar** — rename, delete, switch conversations; mobile drawer + desktop collapse (Ctrl/⌘+B)
- **Markdown rendering** — headings, lists, tables, code blocks with per-block copy button
- **Message actions** — copy answer, regenerate the last response
- **Light / dark theme** — Grok-style palettes, toggle in the sidebar (Ctrl/⌘+Maj+L)
- **Image upload (vision)** — attach up to 4 images, resized client-side, understood by the model
- **Web search** — Globe toggle: results injected as context, sources persisted and shown as clickable chips
- **BYOK providers** — plug any OpenAI-compatible API (Groq, OpenRouter, Mistral, Ollama…) with a built-in connection tester; keys live in your browser only
- **Keyboard shortcuts** — `Ctrl/⌘+Maj+O` new chat · `Ctrl/⌘+B` sidebar · `Ctrl/⌘+K` composer · `Ctrl/⌘+Maj+L` theme · `Échap` stop · `Ctrl/⌘+/` help
- **Responsive** — desktop sidebar + mobile drawer, no horizontal overflow at 390 px

## Stack

- Next.js 16 (App Router), TypeScript, React 19
- Tailwind CSS 4 + shadcn/ui (48 components), next-themes
- Prisma ORM (SQLite) — `Conversation` / `Message` (images, sources, cascade delete, indexed)
- Built-in engine: `z-ai-web-dev-sdk` server-side (chat, vision, web_search) — no API key, no subscription
- BYOK: OpenAI-compatible streaming proxy (`/api/chat` + `/api/providers/test`)
- react-markdown + remark-gfm

## Dev

```bash
bun install
bun run db:push          # create/update db/custom.db (Conversation + Message)
bun run dev              # http://localhost:3005
```

> Note: if the shell exports a global `DATABASE_URL` (or `bunx prisma` picks the wrong `.env`), force it:
> `DATABASE_URL="file:<abs-path>/grok-bot/db/custom.db" bunx prisma db push`
> The server must also be started with the same `DATABASE_URL` (env vars override `.env` files).

## API

| Route | Method | Description |
| --- | --- | --- |
| `/api/chat` | POST | `{ message, conversationId?, mode?, images?, webSearch?, provider?, regenerate? }` → SSE stream (`X-Conversation-Id` header, `grok_sources` end-frame) |
| `/api/conversations` | GET | List conversations (with message counts) |
| `/api/conversations/[id]` | GET / PATCH / DELETE | Load messages / rename / delete (cascades) |
| `/api/providers/test` | POST | `{ baseUrl, apiKey, model }` → connection test (nothing persisted) |

## Production

```bash
bun run build            # standalone build
bun run start            # serves .next/standalone/server.js
```
