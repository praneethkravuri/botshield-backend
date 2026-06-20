import { PublicPage } from "../components/PublicPage";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Support | ${publicInfo.appName}` }];

export default function SupportPage() {
  return (
    <PublicPage title="Support">
      <p>
        Need help with installation, configuration, access review, or app
        behavior? Contact the {publicInfo.appName} support team.
      </p>
      <h2>Email</h2>
      <p>
        {publicInfo.supportEmail === "SUPPORT_EMAIL_NOT_CONFIGURED" ? (
          <strong>Support email must be configured before public launch.</strong>
        ) : (
          <a href={`mailto:${publicInfo.supportEmail}`}>
            {publicInfo.supportEmail}
          </a>
        )}
      </p>
      <h2>What To Include</h2>
      <p>
        Please include your Shopify store domain, the page or workflow involved,
        screenshots if helpful, and any BotShield reference code shown on screen.
      </p>
      <h2>Response</h2>
      <p>
        Urgent storefront-access or false-positive reports are prioritized.
        Standard support requests are reviewed during normal business
        operations.
      </p>
      <h2>False Positives</h2>
      <p>
        Merchants can open the Incident Timeline and use Unblock or Whitelist
        for a blocked event. If the storefront cannot be accessed, include the
        BotShield reference code from the blocked page in the support request.
      </p>
      <h2>What BotShield Protects</h2>
      <p>
        BotShield monitors browsers that run the enabled theme app embed. It is
        not an edge WAF and cannot guarantee inspection of clients that bypass
        storefront JavaScript.
      </p>
    </PublicPage>
  );
}
