"use server";

import { redirect } from "next/navigation";
import { DisputeError, submitDispute } from "@/lib/dispute";
import { IntakeStoreError } from "@/lib/intake-store";

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
    const notice = result.stored
      ? "Dispute stored. It stays open until an operator marks it resolved."
      : "Received.";
    redirect(`${back}&notice=${encodeURIComponent(notice)}`);
  } catch (error) {
    if (error instanceof DisputeError || error instanceof IntakeStoreError) {
      redirect(`${back}&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
