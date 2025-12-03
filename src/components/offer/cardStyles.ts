// src/components/whop/cardStyles.ts
// Shared styles for whop recommendation and alternative cards
// Single source of truth to prevent style drift

export const CARD_LINK =
  "block rounded-xl border p-4 hover:shadow-sm hover:bg-gray-50 transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const CARD_ROW = "flex flex-col gap-3";

export const CARD_LOGO_WRAPPER =
  "w-12 h-12 rounded-md overflow-hidden bg-[var(--background-secondary)] shrink-0";

export const CARD_LOGO_IMG = "w-full h-full object-contain rounded";

export const CARD_TITLE = "font-semibold text-base line-clamp-2 break-words mb-1";

export const CARD_DESC = "text-sm line-clamp-2 break-words";

export const CARD_META = "mt-2 text-xs flex items-center gap-2";

export const CARD_BADGE = "px-2 py-0.5 rounded-full border";

export const CARD_CONTAINER = "flex gap-3 items-center";

// Section-level styles
export const SECTION_HEADING = "text-xl sm:text-2xl font-bold mb-2";
export const SECTION_SUBTITLE = "text-sm mb-4";