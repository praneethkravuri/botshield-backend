import {
  PublicLegalRelatedLinks,
  PublicLegalSection,
} from "../components/public/PublicLegalContent";
import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

const sections = [
  { id: "email", label: "Email" },
  { id: "product-support", label: "Product support" },
  { id: "privacy-support", label: "Privacy and data" },
  { id: "storefront-access", label: "Storefront access" },
  { id: "service-scope", label: "Service scope" },
];

export const meta = () => [{ title: `Support | ${publicInfo.appName}` }];

export default function SupportPage() {
  return (
    <PublicLegalShell
      title="Support"
      summary="Contact BotShield for product help, billing questions, and privacy or data requests."
      sections={sections}
    >
      <PublicLegalSection id="email" title="Email">
        <p>
          {publicInfo.supportEmail === "SUPPORT_EMAIL_NOT_CONFIGURED" ? (
            <>
              Support email is configured through the app&apos;s published Shopify App
              Store listing. Check the listing for the current contact address.
            </>
          ) : (
            <>
              Email: <PublicSupportEmailLink />
            </>
          )}
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="product-support" title="Product Support">
        <p>For product issues, include:</p>
        <ul>
          <li>Your Shopify store domain (for example, your-store.myshopify.com)</li>
          <li>The BotShield page or workflow involved, such as Overview, Analytics, Protection, Fraud Orders, or Settings</li>
          <li>A short description of what you expected and what happened</li>
          <li>Screenshots if helpful</li>
          <li>Any BotShield reference code shown on a blocked storefront page</li>
        </ul>
      </PublicLegalSection>

      <PublicLegalSection id="privacy-support" title="Privacy And Data Questions">
        <p>
          For privacy, retention, deletion, or data-use questions, contact{" "}
          <PublicSupportEmailLink /> with your store domain and the nature of the
          request. Review the documentation below before writing when possible.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="storefront-access" title="False Positives And Storefront Access">
        <p>
          Merchants can review storefront activity in Analytics and use Unblock or
          Trusted visitor controls for a blocked event when appropriate. If the
          storefront cannot be accessed, include the BotShield reference code from the
          blocked page in your support request.
        </p>
      </PublicLegalSection>

      <PublicLegalSection id="service-scope" title="Service Scope">
        <p>
          BotShield monitors compatible storefront browsers through the enabled theme
          app embed. It is not an edge firewall and cannot guarantee inspection of
          clients that bypass storefront integration.
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
