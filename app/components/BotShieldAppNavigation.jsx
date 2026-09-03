const NAV_ITEMS = [
  { href: "/app", label: "Overview", rel: "home" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/protection-rules", label: "Protection" },
  { href: "/app/fraud-orders", label: "Fraud Orders" },
  { href: "/app/settings", label: "Settings" },
];

export default function BotShieldAppNavigation() {
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
