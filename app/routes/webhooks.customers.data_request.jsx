import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(
    `Received ${topic} webhook for ${shop}: data_request=${payload?.data_request?.id ?? "unknown"}`,
  );

  return new Response();
};
