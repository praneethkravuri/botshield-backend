import { BOT_EVENT_RETENTION_DAYS } from "../config/data-retention.js";
import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Data Retention | ${publicInfo.appName}` }];

export default function DataRetentionPage() {
  return (
    <PublicLegalShell title="Data Retention">
      <p>
        This page describes how long {publicInfo.appName} retains different
        categories of information based on the app&apos;s current implementation.
        Retention periods vary by data type.
      </p>
      <h2>Storefront Security Events</h2>
      <p>
        Storefront security events recorded in BotShield&apos;s event history,
        including IP addresses, paths, user-agent strings, risk scores, decision
        outcomes, reason codes, and related request evidence, are automatically
        deleted after {BOT_EVENT_RETENTION_DAYS} days while the app remains
        installed.
      </p>
      <p>
        Automatic deletion runs on a recurring schedule from the production web
        service and also during startup maintenance.
      </p>
      <h2>Network Intelligence Cache</h2>
      <p>
        Cached IP network-intelligence lookups are stored with a 24-hour expiry
        timestamp and are automatically deleted after they expire.
      </p>
      <h2>Merchant Configuration And Lists</h2>
      <p>
        Merchant settings, blocklists, whitelists, analyst notes, trusted tags,
        billing status metadata, and related shop-scoped app records are
        retained while the app remains installed so the merchant can operate
        BotShield normally.
      </p>
      <h2>Fraud Orders Data</h2>
      <p>
        Supported Shopify order and order-risk information shown in Fraud Orders
        is fetched live from Shopify for display and is not stored by BotShield as
        Shopify order records.
      </p>
      <h2>Simulation And Test Activity</h2>
      <p>
        Simulation records are kept separate from real storefront metrics. They
        may remain visible in the admin app until the merchant clears simulation
        data using the supported in-app control. Clearing simulation data does
        not delete real storefront events, merchant settings, or list data.
      </p>
      <h2>App Sessions</h2>
      <p>
        Shopify app authentication sessions are retained while needed to keep
        the merchant signed in to the embedded app. Sessions are removed on app
        uninstall.
      </p>
      <h2>Email Delivery Records</h2>
      <p>
        BotShield may retain alert and weekly-report delivery status metadata
        associated with the merchant&apos;s shop while the app remains installed
        so merchants can confirm whether notifications were sent.
      </p>
      <h2>Related Documents</h2>
      <p>
        Deletion and redaction behavior is described on the{" "}
        <a href={publicInfo.dataDeletionUrl}>Data deletion</a> page and in the{" "}
        <a href={publicInfo.privacyUrl}>Privacy Policy</a>.
      </p>
      <p>
        Retention questions can be sent to <PublicSupportEmailLink />.
      </p>
    </PublicLegalShell>
  );
}
