import { hasFraudOrderReadAccess } from "../lib/fraud-order-access.server.js";
import {
  fetchFraudOrders,
  resolveFraudOrdersMerchantError,
} from "../lib/fraud-orders.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const connected = hasFraudOrderReadAccess(session?.scope);

  if (!connected) {
    return Response.json({
      connected: false,
      orders: [],
      error: null,
      errorCode: null,
    });
  }

  try {
    const result = await fetchFraudOrders(admin, session.shop);
    const status =
      result.errorCode === "protected_customer_data"
        ? 403
        : result.error
          ? 502
          : 200;

    return Response.json(
      {
        connected: true,
        orders: result.orders,
        error: result.error,
        errorCode: result.errorCode,
      },
      { status },
    );
  } catch (error) {
    console.error("Fraud orders fetch failed", error);
    const merchantError = resolveFraudOrdersMerchantError(error);
    return Response.json(
      {
        connected: true,
        orders: [],
        error: merchantError.message,
        errorCode: merchantError.code,
      },
      { status: merchantError.status },
    );
  }
}
