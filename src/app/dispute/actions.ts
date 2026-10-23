"use server";

import { redirect } from "next/navigation";
import { DisputeError, submitDispute } from "@/lib/dispute";
import { IntakeStoreError, isOperatorStorageMessage } from "@/lib/intake-store";

export async function submitDisputeAction(formData: FormData) {
  const callId = String(formData.get("callId") ?? "");
  const back = `/dispute?call=${encodeURIComponent(callId)}`;
  try {
    const result = await submitDispute({
      callId,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      company: String(formData.get("company") ?? ""),
    });
    if (!result.stored) redirect(back);
    redirect(`${back}&notice=${encodeURIComponent("Dispute stored. It stays open until an operator marks it resolved.")}`);
  } catch (error) {
    if (error instanceof DisputeError || error instanceof IntakeStoreError) {
      const message = error.message;
      if (isOperatorStorageMessage(message)) {
        console.error(message);
        redirect(`${back}&error=${encodeURIComponent("This dispute could not be saved.")}`);
      }
      redirect(`${back}&error=${encodeURIComponent(message)}`);
    }
    throw error;
  }
}
