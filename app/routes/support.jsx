import { PublicLegalShell, PublicSupportEmailLink } from "../components/public/PublicLegalShell";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Support | ${publicInfo.appName}` }];

export default function SupportPage() {
  return (
    <PublicLegalShell title="Support">
      <p>
        Need help with installation, configuration, billing, storefront
        protection, Fraud Orders setup, or privacy questions? Contact the{" "}
        {publicInfo.appName} support team using the information below.
      </p>
      <h2>Email</h2>
      <p>
        {publicInfo.supportEmail === "SUPPORT_EMAIL_NOT_CONFIGURED" ? (
          <>
            Support email is configured through the app&apos;s published Shopify
            App Store listing. Check the listing for the current contact
            address.
          </>
        ) : (
          <>
            Email: <PublicSupportEmailLink />
          </>
        )}
      </p>
      <h2>Product Support</h2>
      <p>For product issues, include:</p>
      <ul>
        <li>Your Shopify store domain (for example, your-store.myshopify.com)</li>
        <li>The BotShield page or workflow involved, such as Overview, Analytics, Protection, Fraud Orders, or Settings</li>
        <li>A short description of what you expected and what happened</li>
        <li>Screenshots if helpful</li>
        <li>Any BotShield reference code shown on a blocked storefront page</li>
      </ul>
      <h2>Privacy And Data Questions</h2>
      <p>
        For privacy, retention, deletion, or data-use questions, contact{" "}
        <PublicSupportEmailLink /> with your store domain and the nature of the
        request. Review the <a href={publicInfo.privacyUrl}>Privacy Policy</a>,{" "}
        <a href={publicInfo.dataUseUrl}>Data use</a>,{" "}
        <a href={publicInfo.dataRetentionUrl}>Data retention</a>, and{" "}
        <a href={publicInfo.dataDeletionUrl}>Data deletion</a> pages before
        writing when possible.
      </p>
      <h2>False Positives And Storefront Access</h2>
      <p>
        Merchants can review storefront activity in Analytics and use Unblock or
        Trusted visitor controls for a blocked event when appropriate. If the
        storefront cannot be accessed, include the BotShield reference code from
        the blocked page in your support request.
      </p>
      <h2>Service Scope</h2>
      <p>
        BotShield monitors compatible storefront browsers through the enabled
        theme app embed. It is not an edge firewall and cannot guarantee
        inspection of clients that bypass storefront integration.
      </p>
    </PublicLegalShell>
  );
}
