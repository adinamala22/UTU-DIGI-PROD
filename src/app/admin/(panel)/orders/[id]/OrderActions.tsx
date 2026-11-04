"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/admin/ui";
import { orderAction } from "../../../actions";

export function OrderActions({ id, status, settlement, gateway }: { id: string; status: string; settlement: string; gateway: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (action: "approve" | "revoke" | "resend" | "reconcile", confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const r = await orderAction(id, action);
      toast(r.ok ? "Done" : r.error, !r.ok);
      router.refresh();
    });
  };
  return (
    <>
      {["REVIEW", "PENDING", "FAILED", "EXPIRED", "CANCELLED", "REVOKED"].includes(status) && (
        <button disabled={pending} className="btn-primary" onClick={() => run("approve", "Mark this order as paid and deliver the product? Only do this after confirming the money arrived (check UTR in your bank app).")}>
          ✓ Approve &amp; deliver
        </button>
      )}
      {status === "FULFILLED" && (
        <>
          <button disabled={pending} className="btn-secondary" onClick={() => run("resend")}>Resend email</button>
          {gateway === "youpi" && settlement !== "RECONCILED" && (
            <button disabled={pending} className="btn-secondary" onClick={() => run("reconcile", "Confirm you found this UTR in your bank statement?")}>Mark reconciled</button>
          )}
          <button disabled={pending} className="btn-danger" onClick={() => run("revoke", "Revoke access? All download links for this order stop working immediately.")}>Revoke access</button>
        </>
      )}
    </>
  );
}
