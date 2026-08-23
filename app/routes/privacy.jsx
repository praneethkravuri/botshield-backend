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
        classification, and related threat evidence. When a merchant connects
        Fraud Orders, BotShield may process supported Shopify order and
        fraud/risk information such as order identifiers, order totals, payment
        and fulfillment status, and Shopify risk assessments. BotShield's v1
        Fraud Orders integration does not request customer name, customer email,
        phone, billing address, or shipping address. We do not intentionally
        collect payment card data or account passwords.
      </p>
      <h2>How We Use Information</h2>
      <p>
        We use information to provide and operate {publicInfo.appName}, detect
        suspicious or abusive traffic behavior, present supported Shopify order
        risk information in Fraud Orders, store merchant configuration and
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
        are automatically deleted after 30 days while the app remains installed.
        After uninstall or a valid deletion request, remaining shop-scoped data
        is deleted through Shopify&apos;s mandatory shop-redaction webhook, normally
        within 30 days unless a longer period is legally required. Fraud Orders
        order and risk data is fetched live from Shopify and is not stored by
        BotShield. Merchant settings, blocklists, whitelists, notes, and tags
        are deleted when Shopify sends the shop-redaction webhook. Cached
        network-intelligence records are automatically deleted after 24 hours.
      </p>
      <h2>Data Protection Agreement</h2>
      <p>
        By installing {publicInfo.appName}, merchants authorize BotShield to
        process the information described in this policy solely to provide the
        app&apos;s security, monitoring, and Fraud Orders functionality. BotShield
        processes personal data only for those stated purposes, does not sell
        merchant or customer personal data, and limits Fraud Orders v1 to
        supported Shopify order and risk fields without requesting customer
        name, email, phone, billing address, or shipping address. Merchants
        remain responsible for providing any required notices to their
        customers and for configuring protection settings appropriately for
        their store.
      </p>
      <h2>Privacy Requests</h2>
      <p>
        BotShield implements Shopify&apos;s mandatory customer data request,
        customer redaction, and shop redaction webhooks. Storefront security
        events are not linked to Shopify customer IDs, so customer-specific
        requests normally produce no matching customer record. Shop redaction
        deletes remaining shop-scoped BotShield data for that store.
      </p>
      <h2>Automated Decisions</h2>
      <p>
        BotShield may automatically allow, challenge, or block storefront
        requests based on configured risk rules. Merchants control protection
        settings, pausing, and trusted-visitor lists. BotShield does not make
        legal or credit decisions about Shopify customers on a merchant&apos;s
        behalf.
      </p>
      <h2>Security And International Processing</h2>
      <p>
        We use access controls, encrypted HTTPS transport, and restricted
        production credentials. Database storage is provided through
        Render-managed PostgreSQL, which provides provider-managed encryption
        in transit and at rest. No internet service can guarantee absolute
        security. Information may be processed in the United States where our
        infrastructure providers operate.
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
