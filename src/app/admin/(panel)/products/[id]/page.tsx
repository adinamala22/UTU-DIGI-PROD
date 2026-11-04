import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm, type ProductFormValue } from "./ProductForm";

const rupees = (p: number | null) => (p == null ? "" : String(p / 100));

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const p = isNew ? null : await db.product.findUnique({ where: { id } });
  if (!isNew && !p) notFound();
  const others = await db.product.findMany({
    where: isNew ? {} : { NOT: { id } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  const keyStats =
    p && p.deliveryType === "LICENSE"
      ? {
          total: await db.licenseKey.count({ where: { productId: p.id } }),
          free: await db.licenseKey.count({ where: { productId: p.id, orderId: null } }),
        }
      : null;

  const value: ProductFormValue = {
    id: p?.id,
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    subtitle: p?.subtitle ?? "",
    description: p?.description ?? "",
    price: rupees(p?.price ?? null),
    compareAtPrice: rupees(p?.compareAtPrice ?? null),
    salePrice: rupees(p?.salePrice ?? null),
    saleEndsAt: p?.saleEndsAt?.toISOString() ?? "",
    stockLimit: p?.stockLimit == null ? "" : String(p.stockLimit),
    badge: p?.badge ?? "",
    videoUrl: p?.videoUrl ?? "",
    status: p?.status ?? "DRAFT",
    deliveryType: p?.deliveryType ?? "FILE",
    externalUrl: p?.externalUrl ?? "",
    autoLicense: p?.autoLicense ?? false,
    allowedGateways: (p?.allowedGateways as ("youpi" | "razorpay")[]) ?? ["youpi", "razorpay"],
    features: p?.features ?? [],
    bonusItems: ((p?.bonusItems as { title: string; value: number }[]) ?? []).map((b) => ({ title: b.title, value: b.value })),
    images: p?.images ?? [],
    orderBumpProductId: p?.orderBumpProductId ?? "",
    orderBumpPrice: rupees(p?.orderBumpPrice ?? null),
    guaranteeText: p?.guaranteeText ?? "",
    fileName: p?.fileName ?? null,
  };

  return (
    <div>
      <PageHeader title={isNew ? "New product" : `Edit: ${p!.title}`} />
      <ProductForm initial={value} otherProducts={others} keyStats={keyStats} />
    </div>
  );
}
