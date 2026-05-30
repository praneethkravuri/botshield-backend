# Shopify Submission Checklist

## App configuration

- Replace `application_url` in `shopify.app.toml`
- Replace `redirect_urls` in `shopify.app.toml`
- Confirm production hosting is live
- Confirm embedded app loads correctly from Shopify admin
- Confirm compliance webhooks are configured and reachable

## Product QA

- Open `Dashboard`
- Open `Security`
- Open `Policy Settings`
- Run `Run Live Scan`
- Run `Generate Test Traffic`
- Save policy settings
- Toggle auto-block
- Toggle strict mode
- Change block level
- Block an IP
- Unblock an IP
- Whitelist an IP
- Remove an IP from whitelist
- Save a team note
- Save a trusted tag
- Clear test data
- Open chatbot and submit prompts
- Refresh the app and confirm state reloads

## Reviewer readiness

- No broken pages
- No runtime errors in browser console
- No placeholder URLs
- No fake-looking copy in the main merchant journey
- Clear value visible on first screen
- Merchant can understand app in under 10 seconds

## App Store assets

- App icon
- Desktop screenshots
- Short demo video if available
- Free app pricing details
- Support email
- Support URL
- Privacy policy URL
- Terms of service URL if available

## Listing quality

- App title finalized
- Subtitle finalized
- Description finalized
- Feature bullets finalized
- Free app pricing explanation finalized
- No paid plan, trial, discount, or upgrade wording present until billing is implemented

## Final pre-submit check

- Run `npm run build`
- Run app in dev and do one final click-through
- Confirm production URLs one more time
- Submit from Shopify Partner Dashboard
