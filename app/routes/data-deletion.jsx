import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Data Deletion | ${publicInfo.appName}` }];

export default function DataDeletionPage() {
  return (
    <PublicLegalShell title="Data Deletion">
      <p>
        This page explains how {publicInfo.appName} handles deletion,
        redaction, and uninstall-related data removal based on the app&apos;s
        current Shopify compliance workflows and implementation.
      </p>
      <h2>Automatic Retention Deletion</h2>
      <p>
        Storefront security events older than 30 days are automatically deleted
        on a recurring schedule. Expired network-intelligence cache records are
        also deleted automatically. These processes do not require merchant
        action.
      </p>
      <h2>Merchant-Controlled Simulation Cleanup</h2>
      <p>
        Merchants can clear simulation and diagnostic test activity from the
        BotShield admin app using the supported simulation cleanup control.
        This action removes simulated records only and does not delete real
        storefront events, merchant settings, blocklists, or whitelists.
      </p>
      <h2>App Uninstall</h2>
      <p>
        When a merchant uninstalls BotShield, Shopify sends an app/uninstalled
        webhook and BotShield removes stored Shopify app sessions for that
        store. Remaining shop-scoped application data is handled through
        Shopify&apos;s mandatory shop-redaction workflow rather than instant
        deletion at uninstall time.
      </p>
      <h2>Shop Redaction</h2>
      <p>
        When Shopify sends the mandatory shop/redact webhook for a store,
        BotShield deletes remaining shop-scoped data for that shop, including:
      </p>
      <ul>
        <li>App sessions</li>
        <li>Storefront security events</li>
        <li>Blocked and trusted visitor list entries</li>
        <li>Merchant app settings and related shop-scoped configuration records</li>
      </ul>
      <p>
        Shopify controls the timing of shop-redaction requests. BotShield
        processes valid shop-redaction webhooks when received and does not
        promise instantaneous deletion at the moment of uninstall.
      </p>
      <h2>Customer Data Request And Customer Redaction</h2>
      <p>
        BotShield implements Shopify&apos;s mandatory customers/data_request and
        customers/redact webhooks. Storefront security events are not linked to
        Shopify customer IDs, so customer-specific requests normally produce no
        matching customer record in BotShield.
      </p>
      <h2>Manual Support-Verified Deletion</h2>
      <p>
        Support may verify store ownership before manually deleting shop-scoped
        data when a valid merchant request requires it. Manual deletion uses the
        same shop-scoped deletion process as the shop-redaction workflow.
      </p>
      <h2>Privacy Requests</h2>
      <p>
        Valid privacy requests are handled within 30 days unless a longer
        retention period is legally required. Contact <PublicSupportEmailLink />{" "}
        with your Shopify store domain and a description of the request.
      </p>
      <h2>Related Documents</h2>
      <p>
        See also the <a href={publicInfo.privacyUrl}>Privacy Policy</a> and{" "}
        <a href={publicInfo.dataRetentionUrl}>Data retention</a> pages.
      </p>
    </PublicLegalShell>
  );
}
