"use client";
import { useEffect } from "react";

export function DebugHydrationLogger() {
  useEffect(() => {
    const section = document.querySelector("[data-recs-count]");
    if (section) {
      console.log("CLIENT RECS COUNT =", section.getAttribute("data-recs-count"));
    } else {
      console.log("No recs section found on client");
    }
  }, []);
  return null;
}
