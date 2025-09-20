import path from "path";
import fs from "fs";

// Util: returns true if the public file exists
function publicFileExists(relPath: string) {
  try {
    fs.accessSync(path.join(process.cwd(), "public", relPath));
    return true;
  } catch {
    return false;
  }
}

type Props = {
  slug: string;
  brand: string;
  currency: string;
  hasTrial?: boolean;
  siteOrigin: string; // e.g., https://whpcodes.com
};

export default function HowToSchema({
  slug, brand, currency, hasTrial, siteOrigin
}: Props) {
  const a = `${siteOrigin}/images/howto/whop-ui-map-2025-09.png`;
  const b = `${siteOrigin}/images/howto/${slug}-proof-2025-09.webp`;

  const images = [a];
  // Check if B exists and include it
  const hasB = publicFileExists(`/images/howto/${slug}-proof-2025-09.webp`);
  if (hasB) {
    images.push(b);
  }

  const json = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `Apply a ${brand} promo code on Whop`,
    "image": images,
    "tool": [{ "@type": "HowToTool", "name": "Whop Checkout" }],
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "name": "Choose plan", "text": `Open ${brand} on Whop and pick a plan.` },
      { "@type": "HowToStep", "name": "Add coupon", "text": "Click 'Add coupon' and paste your code." },
      { "@type": "HowToStep", "name": "Confirm totals", "text": `Check updated total (ex-VAT) and ${currency}. ${hasTrial ? "If there's a trial, note the first billing after trial." : ""}` },
      { "@type": "HowToStep", "name": "Complete checkout", "text": "Finish payment; Discord access appears after purchase if included." }
    ]
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}