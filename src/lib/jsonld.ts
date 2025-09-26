// src/lib/jsonld.ts
import 'server-only';

export function jsonLdScript(data: unknown) {
  // NOTE: never import DB here; accepts only plain objects from page/layout.
  return { __html: JSON.stringify(data, null, 0) };
}

type OrgParams = {
  name: string;              // e.g., "whpcodes"
  url: string;               // absolute
  logo: string;              // absolute
  sameAs?: string[];         // optional, only real profiles
};

type SiteParams = {
  name: string;              // e.g., "whpcodes"
  url: string;               // absolute homepage
  searchTarget: string;      // e.g., "https://whpcodes.com/search?q={search_term_string}"
};

export function buildOrgSite({ org, site }: { org: OrgParams; site: SiteParams }) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${org.url}#org`,
    name: org.name,
    url: org.url,
    logo: org.logo,
    ...(org.sameAs && org.sameAs.length ? { sameAs: org.sameAs } : {})
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}#website`,
    url: site.url,
    name: site.name,
    potentialAction: {
      "@type": "SearchAction",
      target: site.searchTarget,
      "query-input": "required name=search_term_string"
    }
  };

  return [organization, website];
}