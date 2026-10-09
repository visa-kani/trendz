"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, FlaskConical } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { createPaymentSession, payWithMock, payWithRazorpay, type PaymentOutcome } from "@/lib/payment";
import { money } from "@/lib/format";
import type { PaymentSession, StoreConfig } from "@/lib/types";

/** Starts payment for an existing order and reports the verified outcome. */
export function PayButton({ orderId, amount, onOutcome, label = "Pay now", size = "lg" }: { orderId: string; amount: number; onOutcome: (o: PaymentOutcome) => void; label?: string; size?: "md" | "lg" }) {
  const { data: config } = useQuery({ queryKey: ["store-config"], queryFn: () => api.get<StoreConfig>("/store/config"), staleTime: 300_000 });
  const [busy, setBusy] = useState(false);
  const [mockSession, setMockSession] = useState<PaymentSession | null>(null);

  const start = async () => {
    setBusy(true);
    try {
      const session = await createPaymentSession(orderId);
      if (session.provider === "mock") {
        setMockSession(session);
        return;
      }
      onOutcome(await payWithRazorpay(session));
    } catch (err) {
      onOutcome({ status: "failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const simulate = async (outcome: "success" | "failure") => {
    if (!mockSession) return;
    setBusy(true);
    try {
      onOutcome(await payWithMock(mockSession, outcome));
    } catch (err) {
      onOutcome({ status: "failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
      setMockSession(null);
    }
  };

  return (
    <>
      <Button size={size} className="w-full" icon={<CreditCard size={16} />} loading={busy} onClick={start}>
        {label} · {money(amount)}
      </Button>
      {config?.payments.provider === "mock" && <p className="mt-2 text-center text-xs text-warning">Test mode: no real money is charged.</p>}
      <Modal open={!!mockSession} onClose={() => setMockSession(null)} title="Test payment (development)">
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 text-warning">
            <FlaskConical size={18} className="mt-0.5 shrink-0" />
            <p>
              Razorpay keys are not configured, so this local test gateway stands in for the Razorpay popup. The server still verifies the payment signature and
              processes the webhook exactly as in production.
            </p>
          </div>
          <p>
            Amount: <strong>{money(mockSession?.amount ?? 0)}</strong> for order <strong>{mockSession?.orderNumber}</strong>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" loading={busy} onClick={() => simulate("success")}>
              Simulate successful payment
            </Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => simulate("failure")}>
              Simulate failure
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
