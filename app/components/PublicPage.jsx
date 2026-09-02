import { PublicLegalShell } from "./public/PublicLegalShell";

export function PublicPage({ title, children }) {
  return <PublicLegalShell title={title}>{children}</PublicLegalShell>;
}
