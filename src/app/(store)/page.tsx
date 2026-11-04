import { getFaqs, getLiveProducts, getSections, getTestimonials, getVideos } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { RenderSection, type SectionData } from "@/components/store/sections/Sections";
import { StickyCta } from "@/components/store/Chrome";
import { effectivePrice } from "@/lib/pricing";

export default async function Home() {
  const [sections, products, videos, testimonials, faqs, settings] = await Promise.all([
    getSections("home"),
    getLiveProducts(),
    getVideos(),
    getTestimonials(),
    getFaqs(),
    getSettings(),
  ]);
  const data: SectionData = { products, videos, testimonials, faqs };
  const hero = sections.find((s) => s.type === "hero");
  const featured = products.find((p) => p.slug === hero?.config.productSlug) ?? products[0];

  if (!sections.length) {
    return <div className="section text-center text-muted">The store is being set up. Check back soon!</div>;
  }
  return (
    <>
      {sections.map((s) => (
        <RenderSection key={s.id} type={s.type} config={s.config} data={data} />
      ))}
      {settings.conversion.stickyCta && featured && (
        <StickyCta
          href={`/checkout/${featured.slug}`}
          label="Get it now"
          price={effectivePrice({ ...featured, saleEndsAt: featured.saleEndsAt ? new Date(featured.saleEndsAt) : null })}
          compareAt={featured.compareAtPrice}
        />
      )}
    </>
  );
}
