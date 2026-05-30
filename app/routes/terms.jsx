import { PublicPage } from "../components/PublicPage";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Terms of Service | ${publicInfo.appName}` }];

export default function TermsPage() {
  return (
    <PublicPage title="Terms of Service">
      <p>
        Effective date: {publicInfo.effectiveDate}
      </p>
      <p>
        These terms govern access to and use of {publicInfo.appName}. By
        installing or using the app, you agree to use it only in compliance with
        Shopify policies, applicable laws, and these terms.
      </p>
      <h2>Service</h2>
      <p>
        {publicInfo.appName} provides storefront traffic monitoring, risk
        scoring, blocklist and whitelist controls, and related security
        workflows for Shopify merchants.
      </p>
      <h2>Merchant Responsibilities</h2>
      <p>
        You are responsible for configuring the app appropriately for your store,
        reviewing protection decisions, and ensuring that your use of the app is
        lawful for your business and customers.
      </p>
      <h2>Availability</h2>
      <p>
        We work to keep the app reliable, but we do not guarantee uninterrupted
        or error-free operation. Features may be updated to improve security,
        reliability, or compatibility with Shopify.
      </p>
      <h2>Support</h2>
      <p>
        For help, contact{" "}
        <a href={`mailto:${publicInfo.supportEmail}`}>
          {publicInfo.supportEmail}
        </a>
        .
      </p>
    </PublicPage>
  );
}
