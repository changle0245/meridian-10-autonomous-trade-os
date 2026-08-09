import { createHash, createHmac, randomBytes } from "node:crypto";

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashPortalToken(token: string): string {
  return sha256(`meridian:portal:v1:${token}`);
}

export function derivePortalToken(secret: string, organizationId: string, orderId: string, requestId: string): string {
  return createHmac("sha256", secret)
    .update(`meridian:portal:v1:${organizationId}:${orderId}:${requestId}`)
    .digest("base64url");
}
