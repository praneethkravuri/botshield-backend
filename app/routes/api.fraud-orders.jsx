import { hasFraudOrderReadAccess } from "../lib/fraud-order-access.server.js";
import { logPersonalDataAccess } from "../lib/personal-data-access-audit.server.js";
import { logSafeError } from "../lib/safe-log.server.js";
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

    logPersonalDataAccess({
      shop: session.shop,
      resource: "fraud_orders",
      operation: "fetch",
      success: !result.error,
      errorCode: result.errorCode,
    });

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
    const merchantError = resolveFraudOrdersMerchantError(error);
    logPersonalDataAccess({
      shop: session.shop,
      resource: "fraud_orders",
      operation: "fetch",
      success: false,
      errorCode: merchantError.code,
    });
    logSafeError("Fraud orders fetch failed", error, {
      errorCode: merchantError.code,
      shop: session.shop,
    });
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
