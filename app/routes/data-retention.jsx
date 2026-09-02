import { BOT_EVENT_RETENTION_DAYS, NETWORK_INTEL_CACHE_HOURS } from "../config/data-retention.js";
import {
  PublicLegalFact,
  PublicLegalRelatedLinks,
  PublicLegalSection,
} from "../components/public/PublicLegalContent";
import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

const sections = [
  { id: "storefront-events", label: "Storefront security events" },
  { id: "network-intelligence", label: "Network intelligence" },
  { id: "merchant-config", label: "Merchant configuration" },
  { id: "fraud-orders", label: "Fraud Orders" },
  { id: "simulation", label: "Simulation data" },
  { id: "sessions", label: "App sessions" },
  { id: "notifications", label: "Notification records" },
];

export const meta = () => [{ title: `Data Retention | ${publicInfo.appName}` }];

export default function DataRetentionPage() {
  return (
    <PublicLegalShell
      title="Data Retention"
      summary="How long BotShield retains different categories of merchant, storefront, and operational data."
      sections={sections}
    >
      <p>
        Retention periods vary by data category. BotShield applies automatic deletion
        where supported and retains other shop-scoped records while the app remains
        installed unless a valid deletion workflow applies.
      </p>

      <PublicLegalSection id="storefront-events" title="Storefront Security Events">
        <p>
          Storefront security events recorded in BotShield&apos;s event history,
          including IP addresses, paths, user-agent strings, risk scores, decision
          outcomes, reason codes, network intelligence fields attached to the event,
          and related request evidence, are automatically deleted after{" "}
          {BOT_EVENT_RETENTION_DAYS} days while the app remains installed.
        </p>
        <PublicLegalFact title="Automatic deletion">
          <p>
            Eligible storefront security events are removed automatically according
            to BotShield&apos;s retention schedule.
          </p>
        </PublicLegalFact>
      </PublicLegalSection>

      <PublicLegalSection id="network-intelligence" title="Network Intelligence Cache">
        <p>
          Cached IP network-intelligence lookups are stored with a{" "}
          {NETWORK_INTEL_CACHE_HOURS}-hour expiry timestamp and are automatically
          deleted after they expire. This cache is keyed by IP address and is not
          shop-specific.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="merchant-config" title="Merchant Configuration And Lists">
        <p>
          Merchant settings, blocklists, trusted visitor lists, billing status
          metadata, alert delivery metadata, and related shop-scoped app records are
          retained while the app remains installed so the merchant can operate
          BotShield normally. These records are deleted when Shopify sends the shop
          redaction webhook for the store.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="fraud-orders" title="Fraud Orders Data">
        <p>
          Supported Shopify order and order-risk information shown in Fraud Orders is
          fetched live from Shopify for display and is not stored by BotShield as
          Shopify order records.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="simulation" title="Simulation Data">
        <p>
          Simulation records are kept separate from live storefront metrics. They may
          remain visible in the admin app until the merchant clears simulation data
          using the supported in-app control. Clearing simulation data does not delete
          live storefront security events, merchant settings, or list data.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="sessions" title="App Sessions">
        <p>
          Shopify app authentication sessions are retained while needed to keep the
          merchant signed in to the embedded app. Sessions are removed when the app is
          uninstalled.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="notifications" title="Email Delivery Records">
        <p>
          BotShield may retain alert and weekly-report delivery status metadata
          associated with the merchant&apos;s shop while the app remains installed so
          merchants can confirm whether notifications were sent.
        </p>
      </PublicLegalSection>

      <PublicLegalRelatedLinks
        links={[
          { href: publicInfo.dataDeletionUrl, label: "Data deletion" },
          { href: publicInfo.privacyUrl, label: "Privacy Policy" },
          { href: publicInfo.dataUseUrl, label: "Data use" },
        ]}
      />
      <p>
        Retention questions can be sent to <PublicSupportEmailLink />.
      </p>
    </PublicLegalShell>
  );
}
