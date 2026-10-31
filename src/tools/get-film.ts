import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";
import { cinema } from "@/lib/config";
import { findFilmIds, getFilm } from "@/lib/program";

export const schema = {
  filmId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Film ID as returned by get-program (the `filmId` field)."),
  title: z
    .string()
    .optional()
    .describe(
      "Film title (diacritics and case are ignored). Searches films screened in the current and the next two months. Ignored when filmId is given."
    ),
};

export const metadata: ToolMetadata = {
  name: "get-film",
  description:
    "Get details of a film shown at Kino Považan: synopsis, director, cast, genres, duration, age rating, trailer, poster and all its upcoming screenings with prices and ticket links. Provide either filmId or title.",
  annotations: {
    title: "Film details",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export default async function getFilmTool({
  filmId,
  title,
}: InferSchema<typeof schema>) {
  if (!filmId && !title?.trim()) {
    throw new Error("Provide either filmId or title.");
  }

  let id = filmId;
  if (!id) {
    const matches = await findFilmIds(title!);
    if (matches.length === 0) {
      throw new Error(
        `No film matching "${title}" was found in the programme for the next three months.`
      );
    }
    if (matches.length > 1) {
      return {
        structuredContent: {
          cinema,
          ambiguous: true,
          message: `Several films match "${title}". Call get-film again with one of the filmId values.`,
          matches,
        },
      };
    }
    id = matches[0].id;
  }

  return { structuredContent: { cinema, film: await getFilm(id) } };
}
