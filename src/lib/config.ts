const env = (name: string, fallback: string): string =>
  process.env[name]?.trim() || fallback;

export const config = {
  baseUrl: env("KINOPOVAZAN_BASE_URL", "https://www.kinopovazan.sk").replace(
    /\/+$/,
    ""
  ),
  clientId: env("KINOPOVAZAN_CLIENT_ID", "218"),
  cinemaId: env("KINOPOVAZAN_CINEMA_ID", "57"),
  filmPageId: env("KINOPOVAZAN_FILM_PAGE_ID", "972"),
  timeZone: env("KINOPOVAZAN_TIMEZONE", "Europe/Bratislava"),
  calendarTtlMs: Number(env("KINOPOVAZAN_CALENDAR_TTL_SECONDS", "300")) * 1000,
  filmTtlMs: Number(env("KINOPOVAZAN_FILM_TTL_SECONDS", "900")) * 1000,
  requestTimeoutMs: Number(env("KINOPOVAZAN_REQUEST_TIMEOUT_MS", "15000")),
  userAgent: env(
    "KINOPOVAZAN_USER_AGENT",
    "kinopovazan-mcp/0.1 (+https://github.com/raiper34/kinopovazan-mcp)"
  ),
};

export const cinema = {
  name: "Kino Považan",
  address: "Hviezdoslavova 4, 915 01 Nové Mesto nad Váhom, Slovakia",
  website: config.baseUrl,
};
