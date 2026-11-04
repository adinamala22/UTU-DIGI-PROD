"use client";
import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { Loader2, Lock } from "lucide-react";
import { formatINR } from "@/lib/money";

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void };
  }
}

export function RazorpayLauncher(props: {
  keyId: string;
  rzpOrderId: string;
  orderId: string;
  accessKey: string;
  amount: number;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  color: string;
  logo?: string;
  returnUrl: string;
}) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"idle" | "verifying" | "error">("idle");

  const open = useCallback(() => {
    if (!window.Razorpay) return;
    const rzp = new window.Razorpay({
      key: props.keyId,
      order_id: props.rzpOrderId,
      amount: props.amount,
      currency: "INR",
      name: props.name,
      description: props.description.slice(0, 250),
      image: props.logo || undefined,
      prefill: props.prefill,
      theme: { color: props.color },
      handler: async (r: RzpResponse) => {
        setState("verifying");
        await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...r, orderId: props.orderId, k: props.accessKey }),
        }).catch(() => null);
        // Webhook is the source of truth; the order page polls either way.
        window.location.href = props.returnUrl;
      },
    });
    rzp.open();
  }, [props]);

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return (
    <div className="mx-auto max-w-md">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onReady={() => setReady(true)} />
      <div className="card space-y-4 p-8">
        <Lock className="mx-auto h-10 w-10 text-primary" />
        <h1 className="font-display text-2xl font-black text-white">Complete your payment</h1>
        <p className="text-4xl font-black text-white">{formatINR(props.amount)}</p>
        {state === "verifying" ? (
          <p className="flex items-center justify-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…</p>
        ) : (
          <button onClick={open} disabled={!ready} className="btn-cta w-full">
            {ready ? "Pay securely" : <Loader2 className="h-5 w-5 animate-spin" />}
          </button>
        )}
        <a href={props.returnUrl} className="block text-sm text-muted hover:text-white">Already paid? Check order status →</a>
      </div>
    </div>
  );
}
