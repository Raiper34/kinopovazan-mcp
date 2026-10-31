import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";
import { cinema } from "@/lib/config";
import { addDays, resolveDate } from "@/lib/dates";
import { MAX_RANGE_DAYS, getProgram } from "@/lib/program";

export const schema = {
  from: z
    .string()
    .optional()
    .describe('First day: "YYYY-MM-DD", "today" or "tomorrow". Defaults to "today".'),
  to: z
    .string()
    .optional()
    .describe(
      `Last day (inclusive): "YYYY-MM-DD", "today" or "tomorrow". Defaults to 6 days after "from". At most ${MAX_RANGE_DAYS} days in total.`
    ),
  includeDescription: z
    .boolean()
    .optional()
    .describe("Include the film synopsis for every screening. Defaults to false."),
};

export const metadata: ToolMetadata = {
  name: "get-program-range",
  description:
    "Get the Kino Považan cinema programme for a range of days (e.g. this week or the whole weekend). Days without screenings are returned with an empty list.",
  annotations: {
    title: "Cinema programme for a date range",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export default async function getProgramRange({
  from,
  to,
  includeDescription,
}: InferSchema<typeof schema>) {
  const start = resolveDate(from);
  const end = to ? resolveDate(to) : addDays(start, 6);
  const days = await getProgram(start, end, includeDescription ?? false);

  return {
    structuredContent: {
      cinema,
      from: start,
      to: end,
      days: days.map((d) => ({
        date: d.date,
        weekday: d.weekday,
        screeningCount: d.screenings.length,
        screenings: d.screenings,
      })),
    },
  };
}
