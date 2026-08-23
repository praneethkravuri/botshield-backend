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
        scoring, blocklist and whitelist controls, browser-based challenge and
        blocking responses, incident history, optional Fraud Orders review of
        supported Shopify order-risk information, and related security
        workflows.
      </p>
      <h2>Data Processing</h2>
      <p>
        Your use of {publicInfo.appName} is also governed by the{" "}
        <a href="/privacy">BotShield Privacy Policy</a>, which describes what
        information BotShield processes, why it is processed, retention and
        deletion practices, and how Fraud Orders v1 handles supported Shopify
        order and risk data without requesting customer name, email, phone,
        billing address, or shipping address. By installing or using the app,
        you acknowledge that BotShield will process information as described
        there to provide the app functionality.
      </p>
      <h2>Security Limitations</h2>
      <p>
        BotShield operates through a Shopify theme app embed and storefront
        JavaScript. It is not an edge firewall, reverse proxy, or server-side
        interception service. Visitors that block or bypass JavaScript may not
        be inspected or challenged. Detection is risk-based and can produce
        false positives or false negatives. BotShield does not guarantee that
        every automated visitor or attack will be blocked.
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
      <h2>Billing And Cancellation</h2>
      <p>
        Paid plans are billed through Shopify according to the price and trial
        shown on Shopify's plan approval page. Merchants may cancel through
        Shopify. Access to paid enforcement features may end when a subscription
        is canceled, frozen, or expires, while legally required data-handling
        obligations continue.
      </p>
      <h2>Limitation Of Liability</h2>
      <p>
        To the maximum extent permitted by law, BotShield is provided without a
        guarantee of uninterrupted operation or complete threat prevention.
        Merchants remain responsible for store operations, customer support,
        legal compliance, and reviewing security decisions.
      </p>
      <h2>Support</h2>
      <p>
        For help, contact{" "}
        {publicInfo.supportEmail === "SUPPORT_EMAIL_NOT_CONFIGURED" ? (
          <strong>the support address published in the Shopify App Store listing</strong>
        ) : (
          <a href={`mailto:${publicInfo.supportEmail}`}>
            {publicInfo.supportEmail}
          </a>
        )}
        .
      </p>
    </PublicPage>
  );
}
