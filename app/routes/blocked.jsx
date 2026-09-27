import {
  botShieldBlockedPageResponseHeaders,
  buildBotShieldBlockedPageHtml,
} from "../lib/botshield-blocked-page-html.server.js";

export async function loader() {
  return new Response(buildBotShieldBlockedPageHtml(), {
    headers: botShieldBlockedPageResponseHeaders(),
  });
}

export default function BlockedPage() {
  return null;
}
