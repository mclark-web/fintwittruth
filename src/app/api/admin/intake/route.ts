import { bearerMatches, sessionMatches } from "@/lib/admin-auth";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { IntakeError, ingestManualText, ingestStatusUrl, reviewIntakePost, type ReviewFields } from "@/lib/intake-service";
import { IntakeStoreError } from "@/lib/intake-store";
import { OembedError, OembedUnavailableError } from "@/lib/oembed";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  if (bearerMatches(request.headers.get("authorization"))) return true;
  const jar = await cookies();
  return sessionMatches(jar.get(ADMIN_COOKIE)?.value);
}

function failure(error: unknown): Response {
  if (error instanceof IntakeError || error instanceof OembedError || error instanceof IntakeStoreError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  throw error;
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { url?: string; text?: string; authorName?: string };
  try {
    if ((body.text ?? "").trim()) {
      const post = await ingestManualText(body.url ?? "", body.text ?? "", { authorName: body.authorName });
      return Response.json({ post });
    }
    const post = await ingestStatusUrl(body.url ?? "");
    return Response.json({ post });
  } catch (error) {
    if (error instanceof OembedUnavailableError) {
      return Response.json(
        {
          needsText: true,
          sourceUrl: error.sourceUrl,
          handle: error.handle,
          statusId: error.statusId,
          error: error.message,
        },
        { status: 422 },
      );
    }
    return failure(error);
  }
}

export async function PUT(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { id?: string; action?: "confirm" | "reject" } & Partial<ReviewFields>;
  const fields: ReviewFields = {
    symbol: body.symbol ?? "",
    direction: body.direction ?? "",
    horizon: body.horizon ?? "",
    conviction: body.conviction ?? "",
    sentiment: body.sentiment ?? "",
    postedAt: body.postedAt ?? "",
    target: body.target ?? "",
    invalidation: body.invalidation ?? "",
    note: body.note ?? "",
  };
  try {
    const post = await reviewIntakePost(body.id ?? "", body.action === "reject" ? "reject" : "confirm", fields);
    return Response.json({ post });
  } catch (error) {
    return failure(error);
  }
}
