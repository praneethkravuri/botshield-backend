import {
  PublicLegalFact,
  PublicLegalRelatedLinks,
  PublicLegalSection,
} from "../components/public/PublicLegalContent";
import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

const sections = [
  { id: "automatic-retention", label: "Automatic retention deletion" },
  { id: "simulation-cleanup", label: "Simulation cleanup" },
  { id: "uninstall", label: "App uninstall" },
  { id: "shop-redaction", label: "Shop redaction" },
  { id: "customer-requests", label: "Customer requests" },
  { id: "manual-deletion", label: "Manual deletion" },
  { id: "privacy-requests", label: "Privacy requests" },
];

export const meta = () => [{ title: `Data Deletion | ${publicInfo.appName}` }];

export default function DataDeletionPage() {
  return (
    <PublicLegalShell
      title="Data Deletion"
      summary="How BotShield handles deletion, redaction, and uninstall-related data removal for Shopify merchants."
      sections={sections}
    >
      <PublicLegalSection id="automatic-retention" title="Automatic Retention Deletion">
        <p>
          Storefront security events older than 30 days are automatically deleted
          according to BotShield&apos;s retention schedule. Expired network-intelligence
          cache records are also deleted automatically. These processes do not require
          merchant action.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="simulation-cleanup" title="Merchant-Controlled Simulation Cleanup">
        <p>
          Merchants can clear simulation and diagnostic test activity from the BotShield
          admin app using the supported simulation cleanup control. This action removes
          simulated records only and does not delete live storefront security events,
          merchant settings, blocklists, or trusted visitor lists.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="uninstall" title="App Uninstall">
        <p>
          When a merchant uninstalls BotShield, Shopify sends an app/uninstalled webhook
          and BotShield removes stored Shopify app sessions for that store.
        </p>
        <PublicLegalFact title="Uninstall is not full shop deletion">
          <p>
            Uninstall removes app sessions immediately. Other shop-scoped BotShield data
            is not deleted at uninstall time and is handled through Shopify&apos;s shop
            redaction workflow.
          </p>
        </PublicLegalFact>
      </PublicLegalSection>

      <PublicLegalSection id="shop-redaction" title="Shop Redaction">
        <p>
          When Shopify sends the mandatory shop/redact webhook for a store, BotShield
          deletes remaining shop-scoped data for that shop, including:
        </p>
        <ul>
          <li>App sessions</li>
          <li>Storefront security events</li>
          <li>Blocked and trusted visitor list entries</li>
          <li>Merchant app settings and related shop-scoped configuration records</li>
        </ul>
        <p>
          Shopify controls the timing of shop-redaction requests. BotShield processes
          valid shop-redaction webhooks when received and does not promise instantaneous
          deletion at the moment of uninstall.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="customer-requests" title="Customer Data Request And Customer Redaction">
        <p>
          BotShield implements Shopify&apos;s mandatory customers/data_request and
          customers/redact webhooks. Storefront security events are not linked to
          Shopify customer IDs, so customer-specific requests normally produce no
          matching customer record in BotShield.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="manual-deletion" title="Manual Support-Verified Deletion">
        <p>
          Support may verify store ownership before manually deleting shop-scoped data
          when a valid merchant request requires it. Manual deletion uses the same
          shop-scoped deletion process as the shop-redaction workflow.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="privacy-requests" title="Privacy Requests">
        <p>
          Valid privacy requests are handled within 30 days unless a longer retention
          period is legally required. Contact <PublicSupportEmailLink /> with your
          Shopify store domain and a description of the request.
        </p>
      </PublicLegalSection>

      <PublicLegalRelatedLinks
        links={[
          { href: publicInfo.privacyUrl, label: "Privacy Policy" },
          { href: publicInfo.dataRetentionUrl, label: "Data retention" },
          { href: publicInfo.supportUrl, label: "Support" },
        ]}
      />
    </PublicLegalShell>
  );
}
