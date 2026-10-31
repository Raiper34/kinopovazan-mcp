# AGENTS.md

MCP server (TypeScript, [xmcp](https://xmcp.dev/)) exposing the programme of Kino Považan
(`https://www.kinopovazan.sk`) via four read-only tools: `get-program`, `get-program-range`,
`list-screening-days`, `get-film`. Transports: stdio and Streamable HTTP.
Setup, env variables, Docker usage and the scraping approach are described in `README.md`; don't duplicate them here.

## Commands

- `npm run typecheck` and `npm test` must both pass after any change in `src/` or `test/`.
- `npm test` runs offline (`node --test` via tsx) against `test/fixtures`; it never touches the network.
- `npm run build` creates `dist/` (generated, git-ignored, as is `.xmcp/`). Run it before `npm run start:*`.
- `npm run dev` starts the xmcp dev server with reload.

## Code map

- `src/tools/*.ts`: one tool per file, auto-discovered by xmcp (see `xmcp.config.ts`). No registry to edit.
- `src/lib/config.ts`: all settings from `KINOPOVAZAN_*` env variables, read once at module load into the `config` object.
- `src/lib/http.ts`: `fetchText` (2 attempts, timeout, `UpstreamError`) and `cached` (in-memory TTL cache).
- `src/lib/parse.ts`: cheerio parsers for the month calendar and film pages (HTML + schema.org JSON-LD).
- `src/lib/program.ts`: merges calendar and film pages into screenings (film pages fetched with a pool of 4).
- `src/lib/dates.ts`: ISO date helpers; `todayIso`/`resolveDate` use `KINOPOVAZAN_TIMEZONE`.

## Conventions

- Tool file shape (copy `src/tools/get-program.ts`): export `schema` (Zod, with `.describe()` on every field),
  `metadata: ToolMetadata` (`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`,
  `openWorldHint: true`) and a default async handler returning `{ structuredContent }`.
  Tool and parameter descriptions are what the model reads to choose a tool, so keep them precise.
- Input and upstream errors: `throw new Error("<readable message>")` (validation) or `UpstreamError` (HTTP).
  Messages should tell the caller what to fix, e.g. `Invalid date "x". Use YYYY-MM-DD, "today" or "tomorrow".`
- Imports from `src/` use the `@/` alias; `src/lib` modules import each other relatively.
- Film titles, genres and language labels are returned in Slovak exactly as published. Don't translate them.
- Only read-only `GET` requests, always through `fetchText`/`cached`. Don't bypass the cache or the pool of 4.
- No new dependencies without a clear reason. The project is ESM and `strict` TypeScript.
- Never use `console.log` in server code: on stdio it corrupts the protocol (xmcp is configured with `stdio.silent`).

## Tests and fixtures

- Parser or date changes need a test in `test/parse.test.ts`; use the existing `fixture()` helper.
- Calendar fixtures contain the HTML from the `kalendar` field of the AJAX response, not the whole JSON:

  ```bash
  curl -s -H 'X-Requested-With: XMLHttpRequest' \
    'https://www.kinopovazan.sk/ajax/ajax_kalendar.php?mesiac=2026-11-01&klient=218&kino=57&jazyk=' \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).kalendar))' \
    > test/fixtures/calendar-2026-11.html
  ```

- Film fixture: save the page `https://www.kinopovazan.sk/klient-218/kino-57/stranka-972/film-<id>` as `film-<id>.html`.
- Fixtures contain real dates. When refreshing them, update the expected values in the tests too.
- Film pages list only upcoming screenings, so a fixture of a past film has no price or ticket link.

## Gotchas

- `MCP_HTTP_HOST` / `MCP_HTTP_PORT` are baked into `dist/` at build time (see `xmcp.config.ts` and the Dockerfile),
  not read at runtime. The Docker image builds with `0.0.0.0:3001`.
- The Docker entrypoint selects the transport by its first argument (`http` default, `stdio`).
- The HTTP endpoint has no authentication.
- The parsers depend on the website's undocumented HTML/AJAX structure. When the site changes, update `src/lib/parse.ts`
  and the fixtures together.
- Update `README.md` when you change tools, environment variables, ports or the Docker setup.
