export type GatewayMode = "youpi" | "razorpay" | "both";

export const DEFAULT_SETTINGS = {
  store: {
    name: "URL Tune Up Store",
    tagline: "AI-powered digital products that ship results",
    logoUrl: "",
    faviconUrl: "",
    supportWhatsapp: "916300983189",
    supportEmail: "urltuneup@gmail.com",
    mainSiteUrl: "https://www.urltuneup.com",
  },
  theme: {
    bg: "#0a0a0b",
    bg2: "#16213e",
    surface: "#12121a",
    text: "#e5e7eb",
    muted: "#9ca3af",
    primary: "#7e5bff",
    primary2: "#4f7dff",
    accent: "#ff7acb",
    urgency: "#ef4444",
    success: "#4ade80",
    radius: 16,
    font: "Inter",
  },
  announcement: {
    enabled: true,
    text: "LAUNCH WEEK: Prices go up when the timer hits zero",
    endsAt: "",
    ctaText: "Grab it now",
    ctaHref: "#products",
  },
  seo: {
    title: "URL Tune Up Store | AI Templates, Agents & Digital Products",
    description: "Done-for-you AI automation templates, agent packs and courses from URL Tune Up.",
    ogImage: "",
  },
  pixels: { ga4: "", metaPixel: "" },
  payments: { mode: "both" as GatewayMode, defaultGateway: "youpi" as "youpi" | "razorpay" },
  conversion: {
    liveToasts: false,
    stickyCta: true,
    exitIntent: {
      enabled: false,
      headline: "Wait! Don't leave empty-handed",
      text: "Take an extra 10% off your order, today only.",
      couponCode: "",
    },
  },
  delivery: { downloadExpiryDays: 7, maxDownloads: 5 },
};

export type SiteSettings = typeof DEFAULT_SETTINGS;
