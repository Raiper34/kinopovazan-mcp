import * as cheerio from "cheerio";
import { config } from "./config";

export interface CalendarEntry {
  date: string;
  time: string;
  title: string;
  filmId: number;
}

export interface Tag {
  code: string;
  label?: string;
}

export interface FilmScreening {
  date: string;
  time: string;
  endTime?: string;
  priceEur?: number;
  ticketUrl?: string;
  available?: boolean;
  formats: string[];
  language?: Tag;
}

export interface FilmDetail {
  id: number;
  url: string;
  title: string;
  originalTitle?: string;
  tagline?: string;
  description?: string;
  director?: string;
  cast: string[];
  genres: string[];
  premiere?: string;
  durationMinutes?: number;
  yearOfProduction?: number;
  countries: string[];
  ageRating?: number;
  formats: string[];
  language?: Tag;
  posterUrl?: string;
  trailerUrl?: string;
  screenings: FilmScreening[];
}

const clean = (s: string | undefined | null): string =>
  (s ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export function filmUrl(id: number): string {
  return `${config.baseUrl}/klient-${config.clientId}/kino-${config.cinemaId}/stranka-${config.filmPageId}/film-${id}`;
}

export function parseCalendar(html: string, month: string): CalendarEntry[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const $ = cheerio.load(html);
  const entries: CalendarEntry[] = [];

  $("span.cal-event").each((_, cell) => {
    const $cell = $(cell);
    if ($cell.hasClass("cal-inactive")) return;

    const dm = /^(\d{1,2})-(\d{1,2})$/.exec($cell.attr("data-dm") ?? "");
    if (!dm || Number(dm[2]) !== monthNumber) return;
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;

    $cell.find("a").each((__, a) => {
      const filmId = Number(/film-(\d+)/.exec($(a).attr("href") ?? "")?.[1]);
      if (!filmId) return;

      const segments: string[] = [""];
      $(a)
        .find("strong")
        .first()
        .contents()
        .each((___, node) => {
          if (node.type === "tag" && node.name === "br") segments.push("");
          else segments[segments.length - 1] += $(node).text();
        });
      const parts = segments.map(clean).filter(Boolean);
      const time = parts.find((p) => /^\d{1,2}:\d{2}$/.test(p));
      const title = parts.filter((p) => p !== time).join(" ");
      if (!time || !title) return;

      entries.push({ date, time: time.padStart(5, "0"), title, filmId });
    });
  });

  return entries.sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );
}

function readIcons($: cheerio.CheerioAPI, scope: cheerio.Cheerio<any>) {
  const formats: string[] = [];
  let language: Tag | undefined;
  let ageRating: number | undefined;

  scope.find("span.btn").each((_, el) => {
    const $el = $(el);
    const cls = $el.attr("class") ?? "";
    const text = clean($el.text());
    const format = /frmt_(\w+)/.exec(cls)?.[1];
    const age = /pristupnost_(\d+)/.exec(cls)?.[1];
    if (format) formats.push(text || format);
    else if (age !== undefined) ageRating = Number(age);
    else if (text) language = { code: text, label: clean($el.attr("title")) || undefined };
  });

  return { formats, language, ageRating };
}

function parseJsonLd($: cheerio.CheerioAPI): any[] {
  const events: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      for (const item of Array.isArray(data) ? data : [data]) {
        if (item && typeof item === "object") events.push(item);
      }
    } catch {
      // ignore malformed blocks
    }
  });
  return events;
}

export function parseFilmPage(html: string, id: number): FilmDetail {
  const $ = cheerio.load(html);

  const title = clean($("div.info div.right h1").first().text());
  if (!title) throw new Error(`Film ${id} was not found on the page.`);

  const originalTitle =
    clean($("div.detail_filmu_program h1 small").first().text()).replace(
      /^\(|\)$/g,
      ""
    ) || undefined;

  const rows: Record<string, string> = {};
  $("div.info div.right table tr").each((_, tr) => {
    const cells = $(tr).find("td");
    const key = clean(cells.eq(0).text()).replace(/:$/, "");
    if (key) rows[key] = clean(cells.eq(1).text());
  });

  const icons = readIcons($, $("div.info div.iconsContainer").first());

  const durationMinutes = Number(/\d+/.exec(rows["Dĺžka"] ?? "")?.[0]) || undefined;

  let tagline: string | undefined;
  let yearOfProduction: number | undefined;
  const paragraphs: string[] = [];
  const $body = $("div.detailtabs.detailfullsize > div.padding")
    .filter((_, el) => $(el).children("p").length > 0)
    .first();
  tagline = clean($body.children("h2").first().text()) || undefined;
  $body.children("p").each((_, p) => {
    const $p = $(p);
    const lead = clean($p.children("strong").first().text());
    const text = clean($p.text());
    if (/^Rok výroby/i.test(lead)) {
      yearOfProduction = Number(/Rok výroby:\s*(\d{4})/i.exec(text)?.[1]) || undefined;
    } else if (
      $p.hasClass("flagsTitle") ||
      /^(Réžia|Hrajú|Dátum lokálnej|Krajina)/i.test(lead) ||
      !text
    ) {
      // metadata paragraphs are exposed as structured fields instead
    } else {
      paragraphs.push(text);
    }
  });
  const countries = $body
    .find("ul.flags li")
    .map((_, li) => clean($(li).text()))
    .get()
    .filter(Boolean);

  const ytId = $("[data-ytid]").first().attr("data-ytid");

  const screenings: FilmScreening[] = [];
  const items = $("div.programKina-datum div.item").toArray();
  const iconsByTicket = new Map<string, ReturnType<typeof readIcons>>();
  for (const item of items) {
    const href = $(item).find("a[href*='wstep1']").first().attr("href");
    if (href) iconsByTicket.set(href, readIcons($, $(item).find(".icons")));
  }

  for (const event of parseJsonLd($)) {
    if (event["@type"] !== "Event" || typeof event.startDate !== "string") continue;
    const start = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(event.startDate);
    if (!start) continue;
    const end = /T(\d{2}:\d{2})/.exec(event.endDate ?? "");
    const offer = event.offers ?? {};
    const ticketUrl: string | undefined = offer.url || undefined;
    const itemIcons = ticketUrl ? iconsByTicket.get(ticketUrl) : undefined;
    const price = Number(offer.price);

    screenings.push({
      date: start[1],
      time: start[2],
      endTime: end?.[1],
      priceEur: Number.isFinite(price) && offer.price !== undefined ? price : undefined,
      ticketUrl,
      available:
        typeof offer.availability === "string"
          ? /InStock/i.test(offer.availability)
          : undefined,
      formats: itemIcons?.formats.length ? itemIcons.formats : icons.formats,
      language: itemIcons?.language ?? icons.language,
    });
  }
  screenings.sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );

  return {
    id,
    url: filmUrl(id),
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    tagline,
    description: paragraphs.join("\n\n") || undefined,
    director: rows["Réžia"] || undefined,
    cast: (rows["Hrajú"] ?? "")
      .split(",")
      .map(clean)
      .filter(Boolean),
    genres: (rows["Žáner"] ?? "")
      .split(",")
      .map(clean)
      .filter(Boolean),
    premiere: rows["Premiéra"] || undefined,
    durationMinutes,
    yearOfProduction,
    countries,
    ageRating: icons.ageRating,
    formats: icons.formats,
    language: icons.language,
    posterUrl: $('meta[property="og:image"]').attr("content") || undefined,
    trailerUrl: ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined,
    screenings,
  };
}
