import { useBotShieldClientMount } from "../hooks/use-botshield-client-mount";

const NAV_ITEMS = [
  { href: "/app", label: "Overview" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/protection-rules", label: "Protection" },
  { href: "/app/fraud-orders", label: "Fraud Orders" },
  { href: "/app/settings", label: "Settings" },
];

export default function BotShieldAppNavigation() {
  const mounted = useBotShieldClientMount();

  if (!mounted) {
    return (
      <nav aria-label="BotShield" className="botshield-app-nav-fallback">
        {NAV_ITEMS.map((item) => (
          <a href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <s-app-nav>
      {NAV_ITEMS.map((item) => (
        <s-link href={item.href} key={item.href}>
          {item.label}
        </s-link>
      ))}
    </s-app-nav>
  );
}
