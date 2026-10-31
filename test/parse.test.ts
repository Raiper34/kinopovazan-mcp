import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCalendar, parseFilmPage } from "../src/lib/parse";
import { addDays, daysBetween, isValidIsoDate, monthsBetween } from "../src/lib/dates";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8");

test("parseCalendar returns screenings of the requested month only", () => {
  const entries = parseCalendar(fixture("calendar-2026-11.html"), "2026-11");
  assert.deepEqual(
    entries.map((e) => [e.date, e.time, e.title, e.filmId]),
    [
      ["2026-11-01", "16:00", "Ovečka Shaun vo filme Príšera z Mossy Bottom", 841389],
      ["2026-11-01", "18:00", "Pád veľryby", 841397],
      ["2026-11-01", "20:00", "TANGO PRE 3", 841399],
    ]
  );
});

test("parseCalendar trims titles and skips days of adjacent months", () => {
  const entries = parseCalendar(fixture("calendar-2026-10.html"), "2026-10");
  const third = entries.filter((e) => e.date === "2026-10-03");
  assert.equal(third.length, 3);
  assert.ok(third.some((e) => e.title === "AVENGERS: ENDGAME ENCORE"));
  assert.ok(entries.every((e) => e.date.startsWith("2026-10-")));
});

test("parseFilmPage extracts metadata and screenings", () => {
  const film = parseFilmPage(fixture("film-841387.html"), 841387);
  assert.equal(film.title, "Street Fighter");
  assert.equal(film.director, "Kitao Sakurai");
  assert.equal(film.durationMinutes, 125);
  assert.equal(film.ageRating, 15);
  assert.deepEqual(film.genres, ["Akcia", "Komédia"]);
  assert.deepEqual(film.formats, ["2D"]);
  assert.equal(film.language?.code, "ST");
  assert.equal(film.trailerUrl, "https://www.youtube.com/watch?v=YYZY2aK2gM0");
  assert.match(film.description ?? "", /^Príbeh akčnej komédie/);

  assert.equal(film.screenings.length, 2);
  const [first] = film.screenings;
  assert.equal(first.date, "2026-10-17");
  assert.equal(first.time, "20:00");
  assert.equal(first.endTime, "22:20");
  assert.equal(first.priceEur, 6);
  assert.equal(first.available, true);
  assert.match(first.ticketUrl ?? "", /^https:\/\/system\.cinemaware\.eu\//);
});

test("parseFilmPage rejects pages that are not films", () => {
  assert.throws(() => parseFilmPage("<html></html>", 1), /not found/);
});

test("date helpers", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.deepEqual(monthsBetween("2026-10-30", "2026-12-01"), [
    "2026-10",
    "2026-11",
    "2026-12",
  ]);
});
