"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminSessionValue, sessionMatches, tokenMatches } from "@/lib/admin-auth";
import { IntakeError, ingestManualText, ingestStatusUrl, reviewIntakePost, type ReviewFields } from "@/lib/intake-service";
import { IntakeStoreError } from "@/lib/intake-store";
import { DisputeError, setDisputeStatus } from "@/lib/dispute";
import { OembedError, OembedUnavailableError } from "@/lib/oembed";

function bail(message: string): never {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

async function assertAdmin() {
  const jar = await cookies();
  if (!sessionMatches(jar.get(ADMIN_COOKIE)?.value)) {
    bail("Sign in with ADMIN_TOKEN first.");
  }
}

function fieldsFrom(formData: FormData): ReviewFields {
  return {
    symbol: String(formData.get("symbol") ?? ""),
    direction: String(formData.get("direction") ?? ""),
    horizon: String(formData.get("horizon") ?? ""),
    conviction: String(formData.get("conviction") ?? ""),
    sentiment: String(formData.get("sentiment") ?? ""),
    postedAt: String(formData.get("postedAt") ?? ""),
    target: String(formData.get("target") ?? ""),
    invalidation: String(formData.get("invalidation") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

export async function loginAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!tokenMatches(token)) bail("That token does not match ADMIN_TOKEN.");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  redirect("/admin");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin");
}

export async function ingestAction(formData: FormData) {
  await assertAdmin();
  try {
    const post = await ingestStatusUrl(String(formData.get("url") ?? ""));
    redirect(`/admin?notice=${encodeURIComponent(`Stored ${post.sourceUrl} for review.`)}`);
  } catch (error) {
    if (error instanceof OembedUnavailableError) {
      const params = new URLSearchParams({
        manual: "1",
        url: error.sourceUrl,
        error: error.message,
      });
      redirect(`/admin?${params.toString()}`);
    }
    if (error instanceof IntakeError || error instanceof OembedError || error instanceof IntakeStoreError) {
      bail(error.message);
    }
    throw error;
  }
}

export async function manualIngestAction(formData: FormData) {
  await assertAdmin();
  try {
    const post = await ingestManualText(String(formData.get("url") ?? ""), String(formData.get("text") ?? ""), {
      authorName: String(formData.get("authorName") ?? ""),
    });
    redirect(`/admin?notice=${encodeURIComponent(`Stored ${post.sourceUrl} from pasted text for review.`)}`);
  } catch (error) {
    if (error instanceof IntakeError || error instanceof IntakeStoreError) bail(error.message);
    throw error;
  }
}

export async function disputeStatusAction(formData: FormData) {
  await assertAdmin();
  const status = formData.get("status") === "resolved" ? "resolved" : "open";
  try {
    await setDisputeStatus(String(formData.get("id") ?? ""), status);
    const notice = status === "resolved" ? "Dispute marked resolved." : "Dispute reopened.";
    redirect(`/admin?notice=${encodeURIComponent(notice)}`);
  } catch (error) {
    if (error instanceof DisputeError || error instanceof IntakeStoreError) bail(error.message);
    throw error;
  }
}

export async function reviewAction(formData: FormData) {
  await assertAdmin();
  const action = formData.get("action") === "reject" ? "reject" : "confirm";
  try {
    const post = await reviewIntakePost(String(formData.get("id") ?? ""), action, fieldsFrom(formData));
    const notice =
      post.status === "rejected"
        ? "Post rejected. It stays out of the public book."
        : post.status === "not_gradable"
          ? "Saved as not gradable yet. No score was written."
          : "Confirmed. Grades use recorded Yahoo prints where that week has them.";
    redirect(`/admin?notice=${encodeURIComponent(notice)}`);
  } catch (error) {
    if (error instanceof IntakeError || error instanceof IntakeStoreError) bail(error.message);
    throw error;
  }
}
