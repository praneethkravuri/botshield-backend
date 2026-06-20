import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(
    `Received ${topic} webhook for ${shop}; BotShield stores no customer-linked records`,
  );

  return new Response();
};
