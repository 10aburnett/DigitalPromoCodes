import Image from "next/image";
import proofManifest from "@data/proof-manifest.json";

// Check if proof exists for a slug using the manifest
function proofExists(slug: string) {
  return (proofManifest.slugs || []).includes(slug);
}

// Generate proof path for a given slug
function proofPathForSlug(slug: string) {
  const PROOF_VERSION = proofManifest.version || "2025-09";
  return `/images/howto/${slug}-proof-${PROOF_VERSION}.png`;
}

// Format currency from cents
function fmt(cents?: number, cur?: string) {
  if (cents == null || !cur) return null;
  return new Intl.NumberFormat("en", { style: "currency", currency: cur }).format(cents / 100);
}

type Props = {
  slug: string;
  brand: string;
  currency: string; // e.g., "USD"
  hasTrial?: boolean;
  lastTestedISO?: string; // e.g. "2025-09-19T10:55:00Z"
  beforeCents?: number;    // numbers from verification ledger
  afterCents?: number;
};

export default function HowToSection({ slug, brand, currency, hasTrial, lastTestedISO, beforeCents, afterCents }: Props) {
  // Debug logging for production troubleshooting
  console.log('HowToSection props:', { slug, brand, currency, lastTestedISO, beforeCents, afterCents });

  const A = "/images/howto/whop-ui-map-2025-09.png";
  const B = proofPathForSlug(slug);
  const hasB = proofExists(slug);
  const before = fmt(beforeCents, currency);
  const after = fmt(afterCents, currency);

  console.log('HowToSection formatted:', { before, after, hasB });

  return (
    <section aria-labelledby="howto-title" className="mt-3">
      <h2 id="howto-title" className="text-xl sm:text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
        Checkout specifics (Whop)
      </h2>

      <div className="space-y-4 mb-6">
        <p>
          <strong>Totals & tax:</strong> Prices show ex-VAT; VAT/GST appears after you choose your country. The currency label is next to Total due today.
        </p>

        <p>
          <strong>Code behavior:</strong> Whop accepts one code at a time (case-insensitive). If a code is prefilled or you tried another earlier, click Remove, then Add coupon and paste your best code again.
        </p>

        <p>
          <strong>No price change?</strong> It usually means the code is restricted to a different plan/SKU or new customers. Reselect the correct tier and re-apply.
        </p>

        <p>
          <strong>Trials / renewals:</strong> If a trial exists, check the first paid charge line for date/amount; most codes apply to the first paid period only (not ongoing renewals).
        </p>

        <p>
          <strong>Extensions & autofill:</strong> Coupon extensions or aggressive autofill can block updates—try Incognito or temporarily disable extensions.
        </p>

        <p>
          <strong>After purchase:</strong> Find access in your Whop Library. For Discord, go Manage → Connect Discord. Need paperwork? Use View receipt / Download invoice on the order.
        </p>

        <p className="text-sm italic text-gray-600">
          (Screenshots show where to enter the code, see totals, VAT, and currency.)
        </p>
      </div>

      {/* Figure A: Reusable UI map */}
      <figure className="mb-6">
        <Image
          src={A}
          alt="Whop checkout: where to enter a coupon and where totals, VAT and currency appear."
          width={1200}
          height={750}
          sizes="(max-width: 768px) 100vw, 900px"
          loading="lazy"
        />
        <figcaption className="text-sm text-muted-foreground mt-2">
          Coupon field and total/VAT/currency areas on Whop checkout.
        </figcaption>
      </figure>

      {/* Figure B: Merchant-specific proof (optional) */}
      {hasB && (
        <figure>
          <Image
            src={B}
            alt={`${brand} on Whop: coupon applied showing discounted total (including VAT) for our test region; ex-VAT amounts are listed above.`}
            width={1200}
            height={750}
            sizes="(max-width: 768px) 100vw, 900px"
            loading="lazy"
          />
          <figcaption className="text-sm text-muted-foreground mt-2">
            Example checkout total includes VAT for our test region; your VAT may differ.
            {before && after ? (
              <> Ex-VAT before → after: {before} → {after}.</>
            ) : (
              <> Ex-VAT pricing verification in progress.</>
            )}
          </figcaption>
        </figure>
      )}

      {/* Last tested verification line */}
      {(lastTestedISO && before && after) && (
        <p className="mt-3 text-sm">
          <strong>Last tested:</strong> {new Date(lastTestedISO).toLocaleString("en-GB", { hour12: false })} — {before} → <strong>{after}</strong> (ex-VAT).
        </p>
      )}
    </section>
  );
}