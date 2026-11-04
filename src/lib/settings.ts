import { cache } from "react";
import { db } from "./db";
import { deepMerge } from "./utils";

import { DEFAULT_SETTINGS, type SiteSettings } from "./settings-defaults";
export { DEFAULT_SETTINGS, type SiteSettings, type GatewayMode } from "./settings-defaults";

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const row = await db.setting.findUnique({ where: { key: "site" } }).catch(() => null);
  return deepMerge(DEFAULT_SETTINGS, row?.value ?? {});
});

export async function saveSettings(patch: Partial<SiteSettings>) {
  const current = await getSettings();
  const next = deepMerge(current, patch);
  await db.setting.upsert({
    where: { key: "site" },
    create: { key: "site", value: next as object },
    update: { value: next as object },
  });
  return next;
}

export function enabledGateways(s: SiteSettings): ("youpi" | "razorpay")[] {
  const configured = {
    youpi: !!process.env.YOUPI_API_URL,
    razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  };
  const wanted: ("youpi" | "razorpay")[] = s.payments.mode === "both" ? ["youpi", "razorpay"] : [s.payments.mode];
  return wanted.filter((g) => configured[g]);
}
