#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITEMAP_URL = 'https://whpcodes.com/sitemaps/noindex.xml';
const URLS_PER_SITEMAP = 386; // ~5795 URLs / 15 sitemaps
const OUTPUT_DIR = './public/sitemaps';

async function fetchSitemap() {
  return new Promise((resolve, reject) => {
    https.get(SITEMAP_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function extractUrls(xmlContent) {
  const urlRegex = /<url>([\s\S]*?)<\/url>/g;
  const urls = [];
  let match;

  while ((match = urlRegex.exec(xmlContent)) !== null) {
    urls.push(match[1].trim());
  }

  return urls;
}

function createSitemapXml(urls, sitemapNumber) {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const footer = `</urlset>`;

  const urlEntries = urls.map(urlContent => `  <url>
    ${urlContent}
  </url>`).join('\n');

  return `${header}
${urlEntries}
${footer}`;
}

async function main() {
  try {
    console.log('Fetching original sitemap...');
    const xmlContent = await fetchSitemap();

    console.log('Extracting URLs...');
    const urls = extractUrls(xmlContent);
    console.log(`Found ${urls.length} URLs`);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Split URLs into chunks
    const chunks = [];
    for (let i = 0; i < urls.length; i += URLS_PER_SITEMAP) {
      chunks.push(urls.slice(i, i + URLS_PER_SITEMAP));
    }

    console.log(`Creating ${chunks.length} sitemap files...`);

    // Create individual sitemap files
    for (let i = 0; i < chunks.length; i++) {
      const sitemapNumber = i + 1;
      const filename = `noindex${sitemapNumber}.xml`;
      const filepath = path.join(OUTPUT_DIR, filename);

      const sitemapXml = createSitemapXml(chunks[i], sitemapNumber);
      fs.writeFileSync(filepath, sitemapXml);

      console.log(`Created ${filename} with ${chunks[i].length} URLs`);
    }

    console.log(`\nSuccessfully split sitemap into ${chunks.length} files!`);
    console.log(`Files saved to: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();