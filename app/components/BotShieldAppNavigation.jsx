import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/app", label: "Overview", rel: "home" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/protection-rules", label: "Protection" },
  { href: "/app/fraud-orders", label: "Fraud Orders" },
  { href: "/app/settings", label: "Settings" },
];

/**
 * Shopify Admin loads polaris.js before React hydrates the document. polaris.js
 * upgrades s-app-nav/s-link internals, which breaks hydration if those tags are
 * present in SSR markup. Render App Bridge nav only after hydration completes.
 */
export default function BotShieldAppNavigation() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <s-app-nav>
      {NAV_ITEMS.map((item) => (
        <s-link href={item.href} key={item.href} {...(item.rel ? { rel: item.rel } : {})}>
          {item.label}
        </s-link>
      ))}
    </s-app-nav>
  );
}
