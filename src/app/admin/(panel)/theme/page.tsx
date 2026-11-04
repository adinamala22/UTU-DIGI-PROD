import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { ThemeEditor } from "./ThemeEditor";

export default async function ThemePage() {
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Theme" description="Colours, font, corner radius and branding. Changes apply to the whole store instantly." />
      <ThemeEditor theme={s.theme} store={s.store} />
    </div>
  );
}
