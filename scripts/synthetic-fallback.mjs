// Synthetic low-evidence fallback content builder

export function buildSyntheticFallback(task) {
  const name = task.displayName || task.name || task.slug;
  return {
    slug: task.slug,
    aboutcontent:
      `<p>${name} is listed on our platform; we're verifying specific offer details.</p>
       <p>Discounts and availability vary by creator and platform. We'll update this page after verification.</p>`,
    howtoredeemcontent:
      `<ol>
        <li>Visit the creator's official page linked from this listing.</li>
        <li>Locate the current deal or code on the creator's page.</li>
        <li>Copy the code or follow the offer button to checkout.</li>
        <li>Apply the code and confirm the final price before paying.</li>
      </ol>`,
    promodetailscontent:
      `<ul><li>Specific discounts vary.</li><li>Offers may change or expire.</li><li>Creator terms apply.</li><li>Taxes/fees may apply.</li><li>We'll publish verified details once confirmed.</li></ul>`,
    termscontent:
      `<ul><li>Subject to platform and creator policies.</li><li>Non-transferable unless stated.</li><li>Misuse may void eligibility.</li><li>Refunds follow creator terms.</li></ul>`,
    faqcontent: [
      { question: "Are details verified?", answerHtml: `<p>We couldn't verify this from the available sources.</p>` },
      { question: "Will this page be updated?", answerHtml: `<p>Yes—once we verify details from official sources.</p>` }
    ],
    __flags: { indexable:false, confidence:"low", evidence_status:"synthetic" }
  };
}
