import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SECTION_DEFS, DEFAULT_HOME_LAYOUT } from "../src/lib/sections";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@urltuneup.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Set ADMIN_PASSWORD in .env before seeding");
  await db.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Admin", passwordHash: await bcrypt.hash(password, 12) },
  });

  if ((await db.product.count()) === 0) {
    const in72h = new Date(Date.now() + 72 * 3600_000);
    await db.product.create({
      data: {
        slug: "ai-agency-automation-vault",
        title: "AI Agency Automation Vault",
        subtitle: "50+ plug-and-play n8n & Make workflows, voice-agent scripts and client SOPs",
        description:
          "## Stop building from scratch\n\nThis is the internal toolkit URL Tune Up uses to deliver AI automations for clients.\n\n- Lead-capture → CRM → WhatsApp follow-up flows\n- AI voice-agent prompts & call scripts\n- Proposal + onboarding templates\n- Step-by-step setup videos",
        images: [],
        price: 99900,
        compareAtPrice: 499900,
        salePrice: 199900,
        saleEndsAt: in72h,
        stockLimit: 100,
        soldCount: 87,
        badge: "BESTSELLER",
        videoUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
        status: "LIVE",
        sortOrder: 0,
        deliveryType: "LINK",
        externalUrl: "https://www.urltuneup.com",
        features: ["50+ ready workflows", "Voice agent prompt pack", "Client SOP templates", "Lifetime updates"],
        bonusItems: [
          { title: "50+ n8n / Make automation workflows", value: 1999900 },
          { title: "AI voice-agent prompt & script pack", value: 799900 },
          { title: "Agency proposal & onboarding templates", value: 499900 },
          { title: "BONUS: 2-hour setup video walkthrough", value: 999900 },
        ],
        guaranteeText: "7-day make-it-right guarantee",
      },
    });
    await db.product.create({
      data: {
        slug: "chatgpt-prompt-mega-pack",
        title: "Business Prompt Mega Pack",
        subtitle: "1,000+ battle-tested prompts for sales, marketing and ops",
        description: "Copy, paste, profit. Organized by department with Notion + PDF versions.",
        images: [],
        price: 29900,
        compareAtPrice: 99900,
        status: "LIVE",
        sortOrder: 1,
        badge: "70% OFF",
        deliveryType: "LICENSE",
        autoLicense: true,
        features: ["1,000+ prompts", "Notion + PDF", "Monthly additions"],
        bonusItems: [{ title: "1,000+ categorized prompts", value: 299900 }],
      },
    });
  }

  if ((await db.pageSection.count({ where: { page: "home" } })) === 0) {
    const featured = await db.product.findFirst({ where: { status: "LIVE" }, orderBy: { sortOrder: "asc" } });
    await db.pageSection.createMany({
      data: DEFAULT_HOME_LAYOUT.map((type, i) => {
        const def = SECTION_DEFS.find((d) => d.type === type)!;
        const cfg = { ...def.defaults } as Record<string, unknown>;
        if ("productSlug" in cfg && featured) cfg.productSlug = featured.slug;
        return { page: "home", type, sortOrder: i, config: cfg as object };
      }),
    });
  }

  if ((await db.video.count()) === 0) {
    await db.video.createMany({
      data: [
        { title: "What's inside the Vault", url: "https://www.youtube.com/watch?v=aircAruvnKk", featured: true, sortOrder: 0 },
        { title: "Building a WhatsApp lead bot in 10 min", url: "https://www.youtube.com/watch?v=wjZofJX0v4M", sortOrder: 1 },
        { title: "Voice agent demo", url: "https://vimeo.com/76979871", sortOrder: 2 },
      ],
    });
  }

  if ((await db.testimonial.count()) === 0) {
    await db.testimonial.createMany({
      data: [
        { name: "Sample Review", role: "Replace in Admin → Testimonials", quote: "Add real customer reviews here. Fake reviews are illegal in many countries.", rating: 5, sortOrder: 0 },
      ],
    });
  }

  if ((await db.faq.count()) === 0) {
    await db.faq.createMany({
      data: [
        { question: "How do I get my product?", answer: "Instantly. Right after payment you'll see your download/access on screen and get it by email.", sortOrder: 0 },
        { question: "Which payment methods are supported?", answer: "Any UPI app (GPay, PhonePe, Paytm, BHIM) and cards/netbanking via Razorpay.", sortOrder: 1 },
        { question: "Do I get future updates?", answer: "Yes, every update is free for life.", sortOrder: 2 },
        { question: "I paid but didn't get access?", answer: "UPI confirmations can take a minute. If it's longer, WhatsApp us with your UTR number.", sortOrder: 3 },
      ],
    });
  }

  if ((await db.coupon.count()) === 0) {
    await db.coupon.create({ data: { code: "STAYWITHUS10", type: "PERCENT", value: 10, active: true } });
  }

  console.log(`Seeded. Admin login: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
