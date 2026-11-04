// Schema for every page-builder section. The admin forms are generated from this.

export type FieldType = "text" | "textarea" | "url" | "product" | "boolean" | "number" | "lines";

export type FieldDef = { key: string; label: string; type: FieldType; help?: string };

export type SectionDef = {
  type: string;
  label: string;
  description: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
};

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Giant headline, price slash, pulsing CTA and hero video.",
    fields: [
      { key: "eyebrow", label: "Eyebrow pill", type: "text" },
      { key: "headline", label: "Headline", type: "text" },
      { key: "highlight", label: "Gradient highlight (part of headline)", type: "text" },
      { key: "subheadline", label: "Sub-headline", type: "textarea" },
      { key: "ctaText", label: "CTA button text", type: "text" },
      { key: "productSlug", label: "Featured product", type: "product", help: "Price, timer & CTA use this product" },
      { key: "videoUrl", label: "Hero video (YouTube/Vimeo)", type: "url" },
      { key: "showCountdown", label: "Show countdown", type: "boolean" },
      { key: "trustLine", label: "Trust line under CTA", type: "text" },
    ],
    defaults: {
      eyebrow: "🔥 LAUNCH PRICING · LIMITED SEATS",
      headline: "Steal our AI automation playbook and",
      highlight: "ship 10x faster",
      subheadline:
        "The exact templates, agents and workflows URL Tune Up uses to build automations for clients, packaged so you can plug them in today.",
      ctaText: "Get instant access",
      productSlug: "",
      videoUrl: "",
      showCountdown: true,
      trustLine: "⚡ Instant delivery · 🔒 Secure UPI checkout · ♾️ Lifetime updates",
    },
  },
  {
    type: "ticker",
    label: "Scrolling ticker",
    description: "High-energy infinite marquee strip.",
    fields: [{ key: "items", label: "Items (one per line)", type: "lines" }],
    defaults: {
      items: ["INSTANT DOWNLOAD", "LIFETIME UPDATES", "BUILT BY AN AGI-FIRST AGENCY", "NO FLUFF, JUST SYSTEMS", "PAY WITH ANY UPI APP"],
    },
  },
  {
    type: "scarcity",
    label: "Scarcity meter",
    description: "Real stock-left bar for a product (hidden if no stock limit).",
    fields: [
      { key: "productSlug", label: "Product", type: "product" },
      { key: "headline", label: "Headline", type: "text", help: "Use {left} and {total}" },
    ],
    defaults: { productSlug: "", headline: "Only {left} of {total} copies left at this price" },
  },
  {
    type: "products",
    label: "Product grid",
    description: "All live products as animated cards.",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "subheading", label: "Sub-heading", type: "textarea" },
    ],
    defaults: { heading: "Pick your unfair advantage", subheading: "Every product ships instantly after payment." },
  },
  {
    type: "video",
    label: "Video section",
    description: "Featured video + carousel (manage videos under Videos).",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "subheading", label: "Sub-heading", type: "textarea" },
    ],
    defaults: { heading: "See it in action", subheading: "Watch what's inside before you buy." },
  },
  {
    type: "valueStack",
    label: "Value stack",
    description: "Everything you get + total value vs today's price.",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "productSlug", label: "Product", type: "product" },
      { key: "ctaText", label: "CTA text", type: "text" },
    ],
    defaults: { heading: "Here's everything you get today", productSlug: "", ctaText: "Claim the bundle" },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Infinite scrolling wall of reviews.",
    fields: [{ key: "heading", label: "Heading", type: "text" }],
    defaults: { heading: "Builders are already shipping with it" },
  },
  {
    type: "guarantee",
    label: "Guarantee",
    description: "Risk-reversal badge.",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "days", label: "Days", type: "number" },
    ],
    defaults: {
      heading: "Zero-risk guarantee",
      text: "If it doesn't save you hours in the first week, message us and we'll make it right.",
      days: 7,
    },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Accordion (manage questions under FAQ).",
    fields: [{ key: "heading", label: "Heading", type: "text" }],
    defaults: { heading: "Questions? Answered." },
  },
  {
    type: "finalCta",
    label: "Final CTA",
    description: "Last-chance block with countdown.",
    fields: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "subheadline", label: "Sub-headline", type: "textarea" },
      { key: "ctaText", label: "CTA text", type: "text" },
      { key: "productSlug", label: "Product", type: "product" },
      { key: "showCountdown", label: "Show countdown", type: "boolean" },
    ],
    defaults: {
      headline: "This price disappears when the timer hits zero",
      subheadline: "Join now and lock in launch pricing plus every future update.",
      ctaText: "Yes, I want in",
      productSlug: "",
      showCountdown: true,
    },
  },
];

export const sectionDef = (type: string) => SECTION_DEFS.find((d) => d.type === type);

export const DEFAULT_HOME_LAYOUT = [
  "hero",
  "ticker",
  "scarcity",
  "products",
  "video",
  "valueStack",
  "testimonials",
  "guarantee",
  "faq",
  "finalCta",
];
