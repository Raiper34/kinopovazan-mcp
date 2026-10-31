import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";
import { cinema } from "@/lib/config";
import { resolveDate } from "@/lib/dates";
import { getProgram } from "@/lib/program";

export const schema = {
  date: z
    .string()
    .optional()
    .describe(
      'Day to look up: "YYYY-MM-DD", "today" or "tomorrow" (Europe/Bratislava time). Defaults to "today".'
    ),
  includeDescription: z
    .boolean()
    .optional()
    .describe("Include the film synopsis for every screening. Defaults to false."),
};

export const metadata: ToolMetadata = {
  name: "get-program",
  description:
    "Get the Kino Považan (Nové Mesto nad Váhom, Slovakia) cinema programme for a single day: film titles, start/end times, duration, age rating, format (2D/3D), language (dubbing/subtitles), ticket price in EUR and a ticket purchase link.",
  annotations: {
    title: "Cinema programme for a day",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export default async function getProgramTool({
  date,
  includeDescription,
}: InferSchema<typeof schema>) {
  const day = resolveDate(date);
  const [program] = await getProgram(day, day, includeDescription ?? false);

  return {
    structuredContent: {
      cinema,
      date: program.date,
      weekday: program.weekday,
      screeningCount: program.screenings.length,
      screenings: program.screenings,
      ...(program.screenings.length === 0
        ? { note: "No screenings are scheduled for this day." }
        : {}),
    },
  };
}
