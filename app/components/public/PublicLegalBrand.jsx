import { Link } from "react-router";
import { publicInfo } from "../../config/public-info";

export function PublicLegalWordmark({
  iconClassName = "public-legal-brand-icon",
  textClassName = "public-legal-wordmark-text",
  size = "header",
}) {
  const iconSize = size === "footer" ? 26 : size === "page" ? 40 : 34;

  return (
    <span className={`public-legal-wordmark public-legal-wordmark--${size}`}>
      <img
        className={iconClassName}
        src={publicInfo.logoUrl}
        alt=""
        width={iconSize}
        height={iconSize}
        decoding="async"
      />
      <span className={textClassName} aria-hidden="true">
        <span className="public-legal-wordmark-bot">Bot</span>
        <span className="public-legal-wordmark-shield">Shield</span>
      </span>
    </span>
  );
}

export function PublicLegalBrandLink({ to = "/privacy" }) {
  return (
    <Link className="public-legal-brand" to={to}>
      <PublicLegalWordmark size="header" />
      <span className="public-legal-sr-only">{publicInfo.appName}</span>
    </Link>
  );
}
