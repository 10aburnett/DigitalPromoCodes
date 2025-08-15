"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const LOCALE_RE = /^\/(es|nl|fr|de|it|pt|zh)(?=\/|$)/;

export function useLocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return (nextLocale: string) => {
    const qs = search?.toString();
    const clean = pathname.replace(LOCALE_RE, "");        // remove current prefix
    const target = nextLocale === "en"
      ? `${clean}${qs ? `?${qs}` : ""}`
      : `/${nextLocale}${clean}${qs ? `?${qs}` : ""}`;

    if (target !== pathname + (qs ? `?${qs}` : "")) {
      router.push(target);
    }
  };
}