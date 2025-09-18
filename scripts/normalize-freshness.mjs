import fs from "node:fs/promises";
import path from "node:path";

const PAGES_DIR = path.join(process.cwd(), "data", "pages");

async function main() {
  try {
    const files = await fs.readdir(PAGES_DIR);
    let updated = 0;

    for (const f of files) {
      if (!f.endsWith(".json")) continue;

      const filePath = path.join(PAGES_DIR, f);
      let json;

      try {
        json = JSON.parse(await fs.readFile(filePath, "utf8"));
      } catch (error) {
        console.warn(`Skipping invalid JSON file: ${f}`);
        continue;
      }

      let changed = false;

      if (Array.isArray(json.ledger)) {
        json.ledger.forEach(row => {
          // Convert observedAt to checkedAt
          if (row.observedAt) {
            row.checkedAt = row.observedAt;
            delete row.observedAt;
            changed = true;
          }

          // Clean up payload references in notes
          if (typeof row.notes === "string" && /payload/i.test(row.notes)) {
            row.notes = "";
            changed = true;
          }

          // Add maskInLedger flag if missing
          if (row.maskInLedger === undefined) {
            row.maskInLedger = true;
            changed = true;
          }
        });
      }

      if (changed) {
        await fs.writeFile(filePath, JSON.stringify(json, null, 2));
        console.log(`Updated: ${f}`);
        updated++;
      }
    }

    console.log(`Normalization complete. Updated ${updated} files.`);
  } catch (error) {
    console.error('Error during normalization:', error);
    process.exit(1);
  }
}

main();