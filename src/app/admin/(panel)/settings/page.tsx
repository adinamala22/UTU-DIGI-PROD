import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const s = await getSettings();
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const env = {
    youpi: !!process.env.YOUPI_API_URL,
    youpiUrl: process.env.YOUPI_API_URL ?? "",
    youpiSecret: !!process.env.YOUPI_WEBHOOK_SECRET,
    razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhook: !!process.env.RAZORPAY_WEBHOOK_SECRET,
    resend: !!process.env.RESEND_API_KEY,
    s3: !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET),
    webhookYoupi: `${appUrl}/api/webhooks/youpi`,
    webhookRazorpay: `${appUrl}/api/webhooks/razorpay`,
  };
  const { theme: _theme, ...rest } = s;
  void _theme;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings & payments" />
      <SettingsForm initial={rest} env={env} />
    </div>
  );
}
