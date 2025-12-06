import proofManifest from "@data/proof-manifest.json";

// Check if proof exists for a slug using the manifest
function proofExists(slug: string) {
  return (proofManifest.slugs || []).includes(slug);
}

// Generate proof path for a given slug
function proofPathForSlug(slug: string) {
  const PROOF_VERSION = proofManifest.version || "2025-09";
  return `/images/howto/${slug}-proof-${PROOF_VERSION}.webp`;
}

type Props = {
  slug: string;
  brand: string;
  currency: string;
  hasTrial?: boolean;
  siteOrigin: string; // e.g., https://digitalpromocodes.com
};

export default function HowToSchema({
  slug, brand, currency, hasTrial, siteOrigin
}: Props) {
  const a = `${siteOrigin}/images/howto/whop-ui-map-2025-09.png`;
  const bPath = proofPathForSlug(slug);
  const b = `${siteOrigin}${bPath}`;

  const images = [a];
  // Check if B exists and include it
  const hasB = proofExists(slug);
  if (hasB) {
    images.push(b);
  }

  const json = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `How to redeem a ${brand} promo code`,
    "image": images,
    "tool": [{ "@type": "HowToTool", "name": "Online Checkout" }],
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "name": "Choose plan", "text": `Visit ${brand} and select your preferred plan.` },
      { "@type": "HowToStep", "name": "Add coupon", "text": "Click 'Add coupon' or 'Apply promo code' and paste your code." },
      { "@type": "HowToStep", "name": "Confirm totals", "text": `Verify the updated total in ${currency}. ${hasTrial ? "If there's a trial, note when billing begins." : ""}` },
      { "@type": "HowToStep", "name": "Complete checkout", "text": "Finish payment to unlock your access and any included bonuses." }
    ]
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}