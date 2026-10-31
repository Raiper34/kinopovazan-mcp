# kinopovazan-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the programme of
**[Kino Považan](https://www.kinopovazan.sk/)** (Nové Mesto nad Váhom, Slovakia) to AI assistants.
Ask things like *"What's on at the cinema tomorrow?"*, *"Is there anything for kids this weekend?"* or
*"When can I see Street Fighter and how much is the ticket?"*

Built with [xmcp](https://xmcp.dev/) (TypeScript). Runs over **stdio** and **Streamable HTTP**, locally or in Docker.

> Unofficial project, not affiliated with Kino Považan. The data is read from the public website.

## Tools

| Tool | Description |
| --- | --- |
| `get-program` | Programme for **one day** (`YYYY-MM-DD`, `today` or `tomorrow`). |
| `get-program-range` | Programme for **several days** (up to 31), e.g. a week or a weekend. |
| `list-screening-days` | Which days of a month (`YYYY-MM`) have screenings, with film titles. |
| `get-film` | Film details: synopsis, director, cast, genres, trailer, poster, upcoming screenings. Look up by `filmId` or `title`. |

Each screening contains: date, start/end time, title (+ original title), duration, age rating, genres,
format (`2D`/`3D`), language (`SD` dubbing, `ST` subtitles, `OR` original…), price in EUR,
availability and a ticket link.

Example (`get-program` with `{ "date": "2026-10-17" }`, shortened):

```json
{
  "cinema": { "name": "Kino Považan", "address": "Hviezdoslavova 4, 915 01 Nové Mesto nad Váhom, Slovakia" },
  "date": "2026-10-17",
  "weekday": "Saturday",
  "screeningCount": 3,
  "screenings": [
    {
      "time": "20:00",
      "endTime": "22:20",
      "title": "Street Fighter",
      "filmId": 841387,
      "durationMinutes": 125,
      "ageRating": 15,
      "genres": ["Akcia", "Komédia"],
      "formats": ["2D"],
      "language": { "code": "ST", "label": "Slovenské titulky" },
      "priceEur": 6,
      "available": true,
      "ticketUrl": "https://system.cinemaware.eu/wstep1.php?id=..."
    }
  ]
}
```

Note: film titles, genres and language labels are returned in Slovak, exactly as published by the cinema.

## Quick start

### Docker (recommended)

```bash
docker build -t kinopovazan-mcp .

# HTTP  ->  http://localhost:3001/mcp
docker run --rm -p 3001:3001 kinopovazan-mcp

# stdio (the MCP client launches the container and talks over stdin/stdout)
docker run --rm -i kinopovazan-mcp stdio
```

Or with Docker Compose (HTTP):

```bash
docker compose up -d
```

The container listens on port **3001**; change the published port with `-p <host-port>:3001`.
The image contains both entrypoints; the first argument selects the transport (`http` is the default, `stdio` the alternative).

### Local (Node.js ≥ 22)

```bash
npm install
npm run build

npm run start:http    # http://127.0.0.1:3001/mcp
npm run start:stdio   # stdio transport
```

For development with auto-reload use `npm run dev`.

## Connecting a client

### stdio

Claude Desktop / Cursor / any client with an `mcpServers` config:

```json
{
  "mcpServers": {
    "kinopovazan": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "kinopovazan-mcp", "stdio"]
    }
  }
}
```

Without Docker (after `npm run build`):

```json
{
  "mcpServers": {
    "kinopovazan": {
      "command": "node",
      "args": ["/absolute/path/to/kinopovazan-mcp/dist/stdio.js"]
    }
  }
}
```

### HTTP

Point the client at `http://localhost:3001/mcp`, for example in Claude Code:

```bash
claude mcp add --transport http kinopovazan http://localhost:3001/mcp
```

Quick check with curl:

```bash
curl -s http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get-program","arguments":{"date":"today"}}}'
```

> The HTTP endpoint has **no authentication**. Do not expose it publicly without a reverse proxy
> that adds auth (or use xmcp's [authentication](https://xmcp.dev/docs/authentication/api-key) options).

## Configuration

### Runtime (environment variables)

| Variable | Default | Description |
| --- | --- | --- |
| `KINOPOVAZAN_BASE_URL` | `https://www.kinopovazan.sk` | Website base URL. |
| `KINOPOVAZAN_CLIENT_ID` | `218` | Cinemaware client id used in the site's URLs/AJAX calls. |
| `KINOPOVAZAN_CINEMA_ID` | `57` | Cinemaware cinema id. |
| `KINOPOVAZAN_FILM_PAGE_ID` | `972` | Id of the film detail page in the site's URLs. |
| `KINOPOVAZAN_TIMEZONE` | `Europe/Bratislava` | Used to resolve `today` / `tomorrow`. |
| `KINOPOVAZAN_CALENDAR_TTL_SECONDS` | `300` | In-memory cache for monthly calendars. |
| `KINOPOVAZAN_FILM_TTL_SECONDS` | `900` | In-memory cache for film pages. |
| `KINOPOVAZAN_REQUEST_TIMEOUT_MS` | `15000` | Timeout of a single upstream request. |
| `KINOPOVAZAN_USER_AGENT` | `kinopovazan-mcp/0.1 …` | User-Agent sent to the website. |

### Build time

xmcp bakes the HTTP settings into the bundle during `npm run build`:

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_HTTP_HOST` | `127.0.0.1` (`0.0.0.0` in the Dockerfile) | Interface the HTTP server binds to. |
| `MCP_HTTP_PORT` | `3001` | Port of the HTTP server. |

## How it works

I investigated the website in a browser first. The relevant findings:

- The home page only shows the next ~6 days that have screenings, so it is **not** enough to answer questions about arbitrary days.
- The "calendar" widget loads a whole month from a small AJAX endpoint:
  `GET /ajax/ajax_kalendar.php?mesiac=YYYY-MM-01&klient=218&kino=57`
  → JSON whose `kalendar` field is HTML with every screening of the month (date, time, title, film id).
- Each film page (`/klient-218/kino-57/stranka-972/film-<id>`) contains the metadata, the synopsis and a
  **schema.org JSON-LD** block with every upcoming screening (full start/end datetime, price, ticket URL),
  plus the format/language badges.

The server therefore:

1. fetches the month calendar(s) covering the requested days,
2. loads the film pages of the films screened on those days (max. 4 in parallel),
3. merges both sources into a single screening list.

Responses are cached in memory (see the TTL variables above), so repeated questions don't hit the website.
Only read-only `GET` requests are made.

### Limitations

- Film pages list only **upcoming** screenings, so past days return time and title only (no price/ticket link).
- The calendar shows screenings the cinema has already published; days further in the future may be empty.
- This relies on the website's current HTML/AJAX structure. If the site changes, the parsers in
  `src/lib/parse.ts` need an update (the fixtures in `test/fixtures` make this easy to verify).
- Seat availability is only `available: true/false` as published; sold-out details are not exposed.

## Project structure

```
src/
  tools/            xmcp tools (auto-discovered): get-program, get-program-range, list-screening-days, get-film
  lib/
    config.ts       environment-based settings
    http.ts         fetch with retry, timeout and an in-memory TTL cache
    dates.ts        date helpers (Europe/Bratislava aware)
    parse.ts        HTML/JSON-LD parsers (cheerio)
    program.ts      merges calendar + film pages into screenings
test/               parser tests with saved fixtures (no network needed)
xmcp.config.ts      xmcp configuration (transports, server info)
Dockerfile          multi-stage image with http + stdio entrypoints
```

## Development

```bash
npm run dev         # xmcp dev server with reload
npm run typecheck   # tsc --noEmit
npm test            # parser/date tests (offline)
npm run build       # production build -> dist/http.js and dist/stdio.js
```

To add a tool, create a file in `src/tools/` exporting a default handler, an optional Zod `schema` and
`metadata` – xmcp registers it automatically.
