import { handleWebhook } from "@/lib/webhook-handler";

export const runtime = "nodejs";

export function POST(req: Request) {
  return handleWebhook("razorpay", req);
}
