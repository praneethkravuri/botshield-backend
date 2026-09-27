import {
  botShieldBlockedPageResponseHeaders,
  buildBotShieldBlockedPageHtml,
} from "../lib/botshield-blocked-page-html.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.public.appProxy(request);

  return new Response(buildBotShieldBlockedPageHtml(), {
    headers: botShieldBlockedPageResponseHeaders(),
  });
}
