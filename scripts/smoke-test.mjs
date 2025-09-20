import http from "http";

const tests = [
  {
    path: "/whop/ayecon-academy-lifetime-membership",
    must: [
      "$5,000.00 → $4,500.00 (ex-VAT)",
      "/images/howto/whop-ui-map-2025-09.png",
      "/images/howto/ayecon-academy-lifetime-membership-proof-2025-09.webp",
      "Ex-VAT before → after:",
      "Last tested:"
    ]
  },
  {
    path: "/whop/ayecon-academy-1-1-mentorship",
    must: ["/images/howto/whop-ui-map-2025-09.png"],
    mustNot: ["/images/howto/ayecon-academy-1-1-mentorship-proof-2025-09.webp"]
  }
];

function fetch(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: "localhost", port: 3000, path: pathname }, res => {
      let body = ""; res.on("data", c => body += c);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

let failed = 0;
for (const t of tests) {
  const { status, body } = await fetch(t.path);
  if (status !== 200) { console.error(`✗ ${t.path} -> ${status}`); failed++; continue; }

  // Clean up body by removing HTML comments for more reliable matching
  const cleanBody = body.replace(/<!--[\s\S]*?-->/g, '');

  let testFailed = false;
  for (const s of (t.must||[])) {
    if (!cleanBody.includes(s)) {
      console.error(`✗ ${t.path} missing: ${s}`);
      failed++;
      testFailed = true;
    }
  }
  for (const s of (t.mustNot||[])) {
    if (cleanBody.includes(s)) {
      console.error(`✗ ${t.path} should not include: ${s}`);
      failed++;
      testFailed = true;
    }
  }
  if (!testFailed) console.log(`✓ ${t.path}`);
}
process.exit(failed ? 1 : 0);