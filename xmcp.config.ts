import { type XmcpConfig } from "xmcp";

// NOTE: xmcp bakes this configuration into the bundle at build time, so
// MCP_HTTP_HOST / MCP_HTTP_PORT are read by `npm run build`, not at runtime.
// The Dockerfile sets host 0.0.0.0 so the container is reachable; map the
// container port with `docker run -p <host-port>:3001`.
const config: XmcpConfig = {
  paths: {
    tools: "./src/tools",
    prompts: false,
    resources: false,
  },
  http: {
    host: process.env.MCP_HTTP_HOST ?? "127.0.0.1",
    port: Number(process.env.MCP_HTTP_PORT ?? 3001),
    endpoint: "/mcp",
  },
  template: {
    name: "Kino Považan",
    description:
      "Programme, prices and ticket links for Kino Považan (Nové Mesto nad Váhom, Slovakia), scraped from kinopovazan.sk.",
    instructions:
      "Use get-program for one day (supports 'today' / 'tomorrow'), get-program-range for several days, " +
      "list-screening-days to see which days of a month have screenings, and get-film for synopsis, cast and trailer " +
      "(by filmId from get-program, or by title). Prices are in EUR; ticketUrl opens the online booking page. " +
      "Past screenings have no price or ticket link.",
  },
  // Console output goes to stderr so it can never corrupt the stdio protocol.
  stdio: {
    silent: true,
  },
};

export default config;
