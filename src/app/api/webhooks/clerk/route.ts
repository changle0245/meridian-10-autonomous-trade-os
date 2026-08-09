import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { getDatabase } from "@/db/client";
import { getRuntimeConfig } from "@/server/config";
import { sha256 } from "@/server/crypto";
import { AppError, errorResponse } from "@/server/errors";
import { processClerkWebhook } from "@/server/services/clerk-provisioning";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const config = getRuntimeConfig();
    if (config.dataMode !== "database" || config.authMode !== "clerk") {
      throw new AppError("NOT_FOUND", "Webhook endpoint is disabled");
    }

    let event;
    try {
      event = await verifyWebhook(request);
    } catch {
      return Response.json({ error: { code: "BAD_REQUEST", message: "Webhook signature verification failed" } }, { status: 400 });
    }

    const eventId = request.headers.get("svix-id") ?? `derived_${sha256(`${event.type}:${JSON.stringify(event.data)}`).slice(0, 32)}`;
    const result = await processClerkWebhook(getDatabase(), eventId, event);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
