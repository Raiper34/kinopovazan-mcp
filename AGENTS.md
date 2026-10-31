# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## What this project is

An [MCP](https://modelcontextprotocol.io) server written in TypeScript with
[xmcp](https://xmcp.dev/) that exposes the programme of **Kino Považan**
(Nové Mesto nad Váhom, Slovakia) from the public website `https://www.kinopovazan.sk`.

It exposes four read-only tools: `get-program`, `get-program-range`,
`list-screening-days` and `get-film`. It runs over **stdio** and **Streamable HTTP**.

Data is scraped from the cinema's Cinemaware website: a monthly AJAX calendar
(`/ajax/ajax_kalendar.php`) plus per-film pages containing schema.org JSON-LD.
The source site is unofficial and can change without notice.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies (Node.js ≥ 22, ESM only). |
| `npm run dev` | xmcp dev server with reload. |
| `npm run typecheck` | `tsc --noEmit`. Must pass. |
| `npm test` | Offline parser/date tests (`node --test` + tsx, fixtures in `test/fixtures`). |
| `npm run build` | Production build → `dist/http.js`, `dist/stdio.js`. |
| `npm run start:http` / `npm run start:stdio` | Run the built server. |
| `docker build -t kinopovazan-mcp .` | Build the multi-stage image. |

Always run `npm run typecheck` and `npm test` after changing `src/`.

## Layout

```
src/tools/       xmcp tools, auto-discovered (default export + schema + metadata)
src/lib/
  config.ts      environment-based settings, parsed once
  http.ts        fetch with retry, timeout, in-memory TTL cache
  dates.ts       Europe/Bratislava date helpers (today/tomorrow/formatting)
  parse.ts       HTML + JSON-LD parsers (cheerio)
  program.ts     merges calendar + film pages into screenings
test/            parser and date tests, saved fixtures (no network)
xmcp.config.ts   transports, HTTP host/port/endpoint, server metadata
Dockerfile       multi-stage image with http + stdio entrypoints
```

## Conventions

- **Tools:** add a file in `src/tools/` exporting `schema` (Zod), `metadata`
  (`ToolMetadata` with `readOnlyHint: true`, `destructiveHint: false`) and a
  default async handler returning `{ structuredContent: ... }`. xmcp registers it
  automatically — do not edit a registry. Keep tool descriptions precise, since
  they are what the model uses to pick a tool.
- **Returned data:** film titles, genres and language labels stay in **Slovak**,
  exactly as published by the cinema. Do not translate them.
- **Errors:** upstream failures are turned into readable MCP errors; never return
  raw HTML or stack traces to the client.
- **Network:** only read-only `GET` requests to the configured base URL. Respect
  the existing concurrency limit (max. 4 film pages) and caching.
- **Tests:** parser changes should be covered by `test/parse.test.ts` using saved
  fixtures. Tests must never hit the network; if the site changes, refresh the
  fixtures manually.
- **Style:** ESM, TypeScript strict mode, `@/` path alias for `src/`, small
  focused modules, no new dependencies without a clear reason.

## Gotchas

- `MCP_HTTP_HOST` / `MCP_HTTP_PORT` are baked into the bundle by `npm run build`,
  not read at runtime. The Dockerfile sets `0.0.0.0`; the container listens on
  port `3001`.
- stdio must stay clean: logs go to stderr (`stdio.silent: true`). Never
  `console.log` in server code.
- The HTTP endpoint has **no authentication**; do not expose it publicly without
  a reverse proxy or xmcp auth.
- Past screenings have no price or ticket link, because film pages only list
  upcoming screenings.
- Data comes from undocumented HTML/DOM structures. Prefer defensive parsing and
  update fixtures when the site changes.

## Documentation

`README.md` is the user-facing documentation (English). Keep it in sync when you
change tools, environment variables, ports or the Docker setup.
