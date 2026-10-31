import { cinema, config } from "./config";
import {
  addDays,
  addMonths,
  daysBetween,
  monthOf,
  monthsBetween,
  todayIso,
  weekday,
} from "./dates";
import { cached, fetchText, UpstreamError } from "./http";
import {
  filmUrl,
  parseCalendar,
  parseFilmPage,
  type CalendarEntry,
  type FilmDetail,
  type Tag,
} from "./parse";

export const MAX_RANGE_DAYS = 31;

export interface Screening {
  date: string;
  time: string;
  endTime?: string;
  title: string;
  originalTitle?: string;
  filmId: number;
  filmUrl: string;
  durationMinutes?: number;
  ageRating?: number;
  genres?: string[];
  formats?: string[];
  language?: Tag;
  priceEur?: number;
  available?: boolean;
  ticketUrl?: string;
  description?: string;
}

export interface DayProgram {
  date: string;
  weekday: string;
  screenings: Screening[];
}

export async function getMonthEntries(month: string): Promise<CalendarEntry[]> {
  return cached(`calendar:${month}`, config.calendarTtlMs, async () => {
    const qs = new URLSearchParams({
      mesiac: `${month}-01`,
      klient: config.clientId,
      kino: config.cinemaId,
      jazyk: "",
    });
    const raw = await fetchText(`${config.baseUrl}/ajax/ajax_kalendar.php?${qs}`, {
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json",
    });
    let payload: { kalendar?: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new UpstreamError("Unexpected calendar response from kinopovazan.sk");
    }
    if (typeof payload.kalendar !== "string") {
      throw new UpstreamError("Calendar response is missing the 'kalendar' field");
    }
    return parseCalendar(payload.kalendar, month);
  });
}

export async function getFilm(id: number): Promise<FilmDetail> {
  return cached(`film:${id}`, config.filmTtlMs, async () => {
    try {
      return parseFilmPage(await fetchText(filmUrl(id)), id);
    } catch (err) {
      if (err instanceof UpstreamError && err.status === 404) {
        throw new Error(`Film ${id} was not found.`);
      }
      throw err;
    }
  });
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

async function enrich(
  entries: CalendarEntry[],
  withDescription: boolean
): Promise<Screening[]> {
  const ids = [...new Set(entries.map((e) => e.filmId))];
  const films = new Map<number, FilmDetail | undefined>();
  await mapPool(ids, 4, async (id) => {
    try {
      films.set(id, await getFilm(id));
    } catch {
      films.set(id, undefined);
    }
  });

  return entries.map((entry) => {
    const film = films.get(entry.filmId);
    const detail = film?.screenings.find(
      (s) => s.date === entry.date && s.time === entry.time
    );
    return {
      date: entry.date,
      time: entry.time,
      endTime: detail?.endTime,
      title: film?.title ?? entry.title,
      originalTitle: film?.originalTitle,
      filmId: entry.filmId,
      filmUrl: filmUrl(entry.filmId),
      durationMinutes: film?.durationMinutes,
      ageRating: film?.ageRating,
      genres: film?.genres.length ? film.genres : undefined,
      formats: detail?.formats.length ? detail.formats : film?.formats,
      language: detail?.language ?? film?.language,
      priceEur: detail?.priceEur,
      available: detail?.available,
      ticketUrl: detail?.ticketUrl,
      description: withDescription ? film?.description : undefined,
    };
  });
}

export async function getProgram(
  from: string,
  to: string,
  withDescription = false
): Promise<DayProgram[]> {
  const span = daysBetween(from, to);
  if (span < 0) throw new Error(`"to" (${to}) must not be before "from" (${from}).`);
  if (span + 1 > MAX_RANGE_DAYS) {
    throw new Error(`The range is limited to ${MAX_RANGE_DAYS} days.`);
  }

  const monthEntries = await Promise.all(
    monthsBetween(from, to).map((month) => getMonthEntries(month))
  );
  const entries = monthEntries
    .flat()
    .filter((e) => e.date >= from && e.date <= to);

  const screenings = await enrich(entries, withDescription);

  const days: DayProgram[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    days.push({
      date,
      weekday: weekday(date),
      screenings: screenings.filter((s) => s.date === date),
    });
  }
  return days;
}

export async function listScreeningDays(month: string) {
  const entries = await getMonthEntries(month);
  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return [...byDate.entries()].map(([date, list]) => ({
    date,
    weekday: weekday(date),
    screeningCount: list.length,
    films: [...new Set(list.map((e) => e.title))],
  }));
}

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export async function findFilmIds(
  query: string,
  monthsAhead = 2
): Promise<{ id: number; title: string }[]> {
  const q = normalize(query);
  if (!q) return [];
  const start = monthOf(todayIso());
  const months = Array.from({ length: monthsAhead + 1 }, (_, i) =>
    addMonths(start, i)
  );
  const entries = (await Promise.all(months.map(getMonthEntries))).flat();

  const films = new Map<number, string>();
  for (const e of entries) films.set(e.filmId, e.title);
  const all = [...films.entries()].map(([id, title]) => ({ id, title }));

  const exact = all.filter((f) => normalize(f.title) === q);
  return exact.length ? exact : all.filter((f) => normalize(f.title).includes(q));
}

export { cinema };
