import {
  PublicLegalRelatedLinks,
  PublicLegalSection,
} from "../components/public/PublicLegalContent";
import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

const sections = [
  { id: "service", label: "Service" },
  { id: "data-processing", label: "Data processing" },
  { id: "security-limitations", label: "Security limitations" },
  { id: "merchant-responsibilities", label: "Merchant responsibilities" },
  { id: "availability", label: "Availability" },
  { id: "billing", label: "Billing" },
  { id: "liability", label: "Liability" },
  { id: "support", label: "Support" },
];

export const meta = () => [{ title: `Terms of Service | ${publicInfo.appName}` }];

export default function TermsPage() {
  return (
    <PublicLegalShell
      title="Terms of Service"
      summary="Terms governing access to and use of BotShield on Shopify."
      sections={sections}
    >
      <PublicLegalSection id="service" title="Service">
        <p>
          {publicInfo.appName} provides storefront traffic monitoring, risk scoring,
          blocklist and trusted visitor controls, browser-based challenge and blocking
          responses, incident history, optional Fraud Orders review of supported
          Shopify order-risk information, and related security workflows.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="data-processing" title="Data Processing">
        <p>
          Your use of {publicInfo.appName} is also governed by the{" "}
          <a href={publicInfo.privacyUrl}>BotShield Privacy Policy</a>, which describes
          what information BotShield processes, why it is processed, retention and
          deletion practices, and how Fraud Orders handles supported Shopify order and
          order-risk data without requesting customer name, email, phone, billing
          address, or shipping address.
        </p>
        <p>
          By installing or using the app, you acknowledge that BotShield will process
          information as described there to provide the app functionality and that
          BotShield does not sell personal data.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="security-limitations" title="Security Limitations">
        <p>
          BotShield operates through a Shopify theme app embed and storefront browser
          integration. It is not an edge firewall, reverse proxy, or server-side
          interception service. Visitors that block or bypass storefront integration
          may not be inspected or challenged. Detection is risk-based and can produce
          false positives or false negatives. BotShield does not guarantee that every
          automated visitor or attack will be blocked.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="merchant-responsibilities" title="Merchant Responsibilities">
        <p>
          You are responsible for configuring the app appropriately for your store,
          reviewing protection decisions, and ensuring that your use of the app is
          lawful for your business and customers.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="availability" title="Availability">
        <p>
          We work to keep the app reliable, but we do not guarantee uninterrupted or
          error-free operation. Features may be updated to improve security,
          reliability, or compatibility with Shopify.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="billing" title="Billing And Cancellation">
        <p>
          Paid plans are billed through Shopify according to the price and trial shown
          on Shopify&apos;s plan approval page. Merchants may cancel through Shopify.
          BotShield does not process payment card details directly. Access to paid
          enforcement features may end when a subscription is canceled, frozen, or
          expires, while legally required data-handling obligations continue.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="liability" title="Limitation Of Liability">
        <p>
          To the maximum extent permitted by law, BotShield is provided without a
          guarantee of uninterrupted operation or complete threat prevention.
          Merchants remain responsible for store operations, customer support, legal
          compliance, and reviewing security decisions.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="support" title="Support">
        <p>
          For help, contact <PublicSupportEmailLink /> or visit our{" "}
          <a href={publicInfo.supportUrl}>Support page</a>.
        </p>
      </PublicLegalSection>

      <PublicLegalRelatedLinks
        links={[
          { href: publicInfo.privacyUrl, label: "Privacy Policy" },
          { href: publicInfo.dataUseUrl, label: "Data use" },
          { href: publicInfo.dataRetentionUrl, label: "Data retention" },
          { href: publicInfo.dataDeletionUrl, label: "Data deletion" },
        ]}
      />
    </PublicLegalShell>
  );
}
