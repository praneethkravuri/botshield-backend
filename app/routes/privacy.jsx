import { PublicPage } from "../components/PublicPage";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Privacy Policy | ${publicInfo.appName}` }];

export default function PrivacyPage() {
  return (
    <PublicPage title="Privacy Policy">
      <p>
        Effective date: {publicInfo.effectiveDate}
      </p>
      <p>
        {publicInfo.appName} provides JavaScript-based storefront traffic
        monitoring, risk scoring, challenge and blocking responses, incident
        history, and merchant-managed security controls.
      </p>
      <h2>Information We Collect</h2>
      <p>
        We may process Shopify store domain details, app installation records,
        app configuration, scan records, IP addresses, paths, user-agent strings,
        referrer data, network intelligence such as ASN or hosting-provider
        classification, and related threat evidence. We do not intentionally
        collect Shopify customer names, order contents, payment data, or account
        passwords.
      </p>
      <h2>How We Use Information</h2>
      <p>
        We use information to provide and operate {publicInfo.appName}, detect
        suspicious or abusive traffic behavior, store merchant configuration and
        scan history, improve reliability, and provide support.
      </p>
      <h2>Sharing</h2>
      <p>
        We do not sell merchant data. We may share information with service
        providers when needed to host, secure, support, or operate the app, or
        when required by law.
      </p>
      <h2>Service Providers</h2>
      <p>
        Data is processed using infrastructure and service providers that may
        include Shopify, Render, PostgreSQL hosting, Resend for merchant email
        delivery, and an IP-network intelligence provider. These providers
        process information only to operate BotShield.
      </p>
      <h2>Retention And Deletion</h2>
      <p>
        Storefront security events, including IP addresses and request evidence,
        are retained while the app is installed and for no longer than 30 days
        after a valid deletion request or Shopify shop-redaction webhook, unless
        a longer period is legally required. Merchant settings, blocklists,
        whitelists, notes, and tags are deleted following Shopify's shop
        redaction process. Network-intelligence cache records expire after 24
        hours.
      </p>
      <h2>Privacy Requests</h2>
      <p>
        BotShield responds to Shopify's mandatory customer data request,
        customer redaction, and shop redaction webhooks. BotShield does not
        associate security events with Shopify customer IDs, so customer-specific
        requests normally produce no matching customer record.
      </p>
      <h2>Security And International Processing</h2>
      <p>
        We use access controls, encrypted HTTPS transport, restricted production
        credentials, and operational monitoring. No internet service can
        guarantee absolute security. Information may be processed in the United
        States where our infrastructure providers operate.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions can be sent to{" "}
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
