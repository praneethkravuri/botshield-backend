export const FRAUD_ORDERS_PAGE_SIZE = 50;

const RISK_PRIORITY = {
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NONE: 1,
  PENDING: 0,
};

const RECOMMENDATION_LABELS = {
  ACCEPT: "Accept",
  CANCEL: "Cancel",
  INVESTIGATE: "Investigate",
  NONE: "Pending",
};

const FRAUD_ORDERS_QUERY = `#graphql
  query BotShieldFraudOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          risk {
            recommendation
            assessments {
              riskLevel
              provider {
                title
              }
              facts {
                description
                sentiment
              }
            }
          }
        }
      }
    }
  }
`;

export function formatShopifyDisplayStatus(value) {
  if (!value) return null;
  return String(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatOrderAmount(amount, currencyCode) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return null;
  const currency = currencyCode || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${currency}`;
  }
}

export function mapRecommendationLabel(recommendation) {
  if (!recommendation) return "Pending";
  const normalized = String(recommendation).trim().toUpperCase();
  return RECOMMENDATION_LABELS[normalized] || "Pending";
}

export function mapRiskLevel(riskLevel) {
  const normalized = String(riskLevel || "PENDING").trim().toUpperCase();
  if (normalized === "HIGH") return "high";
  if (normalized === "MEDIUM") return "medium";
  if (normalized === "LOW") return "low";
  return "pending";
}

function compareRiskLevels(left, right) {
  return (RISK_PRIORITY[String(right || "").toUpperCase()] || 0)
    - (RISK_PRIORITY[String(left || "").toUpperCase()] || 0);
}

export function pickPrimaryAssessment(assessments) {
  const safeAssessments = Array.isArray(assessments)
    ? assessments.filter((assessment) => assessment && typeof assessment === "object")
    : [];
  if (!safeAssessments.length) return null;

  const shopifyAssessment = safeAssessments.find((assessment) => !assessment.provider);
  const ranked = [...safeAssessments].sort((left, right) =>
    compareRiskLevels(left.riskLevel, right.riskLevel),
  );

  return shopifyAssessment && compareRiskLevels(shopifyAssessment.riskLevel, ranked[0]?.riskLevel) >= 0
    ? shopifyAssessment
    : ranked[0];
}

export function collectRiskSignals(assessments) {
  const safeAssessments = Array.isArray(assessments)
    ? assessments.filter((assessment) => assessment && typeof assessment === "object")
    : [];
  const signals = [];

  safeAssessments.forEach((assessment) => {
    const facts = Array.isArray(assessment.facts) ? assessment.facts : [];
    facts.forEach((fact) => {
      const description = String(fact?.description || "").trim();
      if (!description || signals.includes(description)) return;
      signals.push(description);
    });
  });

  return signals;
}

export function buildShopifyOrderAdminUrl(shop, orderGid) {
  const match = String(orderGid || "").match(/Order\/(\d+)/i);
  const orderId = match?.[1];
  const storeHandle = String(shop || "").trim().split(".")[0];
  if (!orderId || !storeHandle) return null;
  return `https://admin.shopify.com/store/${storeHandle}/orders/${orderId}`;
}

export function mapShopifyOrderNode(node, shop) {
  if (!node || typeof node !== "object") return null;

  const assessments = node.risk?.assessments;
  const primaryAssessment = pickPrimaryAssessment(assessments);
  const signals = collectRiskSignals(assessments);
  const primarySignal = signals[0] || null;
  const secondarySignal = signals[1] || null;
  const providerTitle = primaryAssessment?.provider?.title;
  const money = node.totalPriceSet?.shopMoney;

  return {
    id: node.id,
    name: node.name || "Order",
    amount: formatOrderAmount(money?.amount, money?.currencyCode),
    total: formatOrderAmount(money?.amount, money?.currencyCode),
    risk: mapRiskLevel(primaryAssessment?.riskLevel),
    riskLevel: mapRiskLevel(primaryAssessment?.riskLevel),
    recommendation: mapRecommendationLabel(node.risk?.recommendation),
    reason: primarySignal,
    primarySignal,
    secondarySignal,
    secondaryReason: secondarySignal,
    signals,
    fulfillmentStatus: formatShopifyDisplayStatus(node.displayFulfillmentStatus),
    financialStatus: formatShopifyDisplayStatus(node.displayFinancialStatus),
    createdAt: node.createdAt || null,
    adminUrl: buildShopifyOrderAdminUrl(shop, node.id),
    assessmentSource: providerTitle || "Shopify order risk assessment",
  };
}

export function mapShopifyOrdersResponse(payload, shop) {
  const edges = payload?.data?.orders?.edges;
  if (!Array.isArray(edges)) return [];

  return edges
    .map((edge) => mapShopifyOrderNode(edge?.node, shop))
    .filter(Boolean);
}

export function isProtectedCustomerDataError(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("not approved to access the order") ||
    normalized.includes("protected customer data") ||
    normalized.includes("customer_data")
  );
}

export function resolveFraudOrdersMerchantError(error) {
  const message = String(error?.message || error || "");
  if (isProtectedCustomerDataError(message)) {
    return {
      message:
        "BotShield can't load Shopify orders until protected customer data access is approved for this app.",
      code: "protected_customer_data",
      status: 403,
    };
  }

  return {
    message: "Couldn't load Shopify orders right now. Try again in a moment.",
    code: "fetch_failed",
    status: 502,
  };
}

function extractGraphqlErrorMessage(payload) {
  if (!payload) return null;
  if (Array.isArray(payload.errors) && payload.errors.length) {
    return payload.errors.map((entry) => entry?.message).filter(Boolean).join("; ");
  }
  return null;
}

export async function fetchFraudOrders(admin, shop) {
  const response = await admin.graphql(FRAUD_ORDERS_QUERY, {
    variables: { first: FRAUD_ORDERS_PAGE_SIZE },
  });
  const payload = await response.json();
  const graphqlError = extractGraphqlErrorMessage(payload);

  if (graphqlError) {
    const merchantError = resolveFraudOrdersMerchantError(new Error(graphqlError));
    console.error("Fraud orders GraphQL error:", graphqlError);
    return {
      orders: [],
      error: merchantError.message,
      errorCode: merchantError.code,
    };
  }

  return {
    orders: mapShopifyOrdersResponse(payload, shop),
    error: null,
    errorCode: null,
  };
}
