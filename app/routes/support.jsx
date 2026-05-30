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
        <a href={`mailto:${publicInfo.supportEmail}`}>
          {publicInfo.supportEmail}
        </a>
      </p>
      <h2>What To Include</h2>
      <p>
        Please include your Shopify store domain, the page or workflow involved,
        screenshots if helpful, and any BotShield reference code shown on screen.
      </p>
      <h2>Response</h2>
      <p>
        Support requests are reviewed as soon as practical during normal
        business operations.
      </p>
    </PublicPage>
  );
}
