import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";
import { cinema } from "@/lib/config";
import { isValidMonth, monthOf, todayIso } from "@/lib/dates";
import { listScreeningDays } from "@/lib/program";

export const schema = {
  month: z
    .string()
    .optional()
    .describe('Month as "YYYY-MM". Defaults to the current month.'),
};

export const metadata: ToolMetadata = {
  name: "list-screening-days",
  description:
    "List the days of a month on which Kino Považan has screenings, with the film titles for each day. A fast overview; use get-program for times and prices.",
  annotations: {
    title: "Days with screenings in a month",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export default async function listDays({ month }: InferSchema<typeof schema>) {
  const target = month?.trim() || monthOf(todayIso());
  if (!isValidMonth(target)) {
    throw new Error(`Invalid month "${month}". Use YYYY-MM.`);
  }
  const days = await listScreeningDays(target);

  return {
    structuredContent: {
      cinema,
      month: target,
      dayCount: days.length,
      days,
    },
  };
}
