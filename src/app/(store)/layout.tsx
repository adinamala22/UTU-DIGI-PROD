import Script from "next/script";
import { getSettings } from "@/lib/settings";
import { getRecentPurchases } from "@/lib/catalog";
import { AnnouncementBar, Footer, Header } from "@/components/store/Chrome";
import { ExitIntent, LiveToasts } from "@/components/store/Engagement";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const purchases = s.conversion.liveToasts ? await getRecentPurchases() : [];
  const ga = /^G-[A-Z0-9]+$/i.test(s.pixels.ga4) ? s.pixels.ga4 : "";
  const meta = /^\d{6,20}$/.test(s.pixels.metaPixel) ? s.pixels.metaPixel : "";
  return (
    <>
      {s.announcement.enabled && (
        <AnnouncementBar text={s.announcement.text} endsAt={s.announcement.endsAt} ctaText={s.announcement.ctaText} ctaHref={s.announcement.ctaHref} />
      )}
      <Header name={s.store.name} logoUrl={s.store.logoUrl} mainSiteUrl={s.store.mainSiteUrl} />
      <main>{children}</main>
      <Footer name={s.store.name} supportEmail={s.store.supportEmail} supportWhatsapp={s.store.supportWhatsapp} mainSiteUrl={s.store.mainSiteUrl} />
      {purchases.length > 0 && <LiveToasts purchases={purchases} />}
      {s.conversion.exitIntent.enabled && s.conversion.exitIntent.couponCode && (
        <ExitIntent headline={s.conversion.exitIntent.headline} text={s.conversion.exitIntent.text} couponCode={s.conversion.exitIntent.couponCode} />
      )}
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}</Script>
        </>
      )}
      {meta && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}</Script>
      )}
    </>
  );
}
