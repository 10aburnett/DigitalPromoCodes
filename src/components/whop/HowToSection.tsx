import Image from "next/image";
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
  currency: string; // e.g., "USD"
  hasTrial?: boolean;
};

export default function HowToSection({ slug, brand, currency, hasTrial }: Props) {
  const A = "/images/howto/whop-ui-map-2025-09.png";
  const B = `/images/howto/${slug}-proof-2025-09.webp`;
  const hasB = publicFileExists(B);

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
          alt="Whop checkout: where to add a coupon, see totals, VAT, and currency."
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
            alt={`${brand} on Whop: coupon applied showing discounted total (ex-VAT) and ${currency}.`}
            width={1200}
            height={750}
            sizes="(max-width: 768px) 100vw, 900px"
            loading="lazy"
          />
          <figcaption className="text-sm text-muted-foreground mt-2">
            Discount applied: shows {brand} plan after code (ex-VAT) with {currency} total
            {hasTrial && " and trial → first billing details"}.
          </figcaption>
        </figure>
      )}
    </section>
  );
}