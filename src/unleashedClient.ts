import crypto from "node:crypto";

const BASE_URL = "https://api.unleashedsoftware.com";

function getSignature(queryString: string, apiKey: string): string {
  const hmac = crypto.createHmac("sha256", apiKey);
  hmac.update(queryString, "utf8");
  return hmac.digest("base64");
}

export interface UnleashedCredentials {
  apiId: string;
  apiKey: string;
}

function getCredentials(): UnleashedCredentials {
  const apiId = process.env.UNLEASHED_API_ID;
  const apiKey = process.env.UNLEASHED_API_KEY;
  if (!apiId || !apiKey) {
    throw new Error(
      "Missing UNLEASHED_API_ID / UNLEASHED_API_KEY environment variables."
    );
  }
  return { apiId, apiKey };
}

/**
 * Calls an Unleashed API GET endpoint.
 * `path` is the resource path (e.g. "Products" or "SalesOrders/3"), no leading slash.
 * `query` params are appended to the URL; the signature is computed over the raw
 * query string only (no leading '?'), per Unleashed's HMAC-SHA256 auth scheme.
 */
export async function unleashedGet<T = unknown>(
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const { apiId, apiKey } = getCredentials();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const queryString = params.toString();

  const signature = getSignature(queryString, apiKey);

  const url = `${BASE_URL}/${path}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-auth-id": apiId,
      "api-auth-signature": signature,
      "client-type": "unleashed-mcp-server/1.0",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Unleashed API error ${response.status} ${response.statusText} for ${path}: ${body.slice(0, 1000)}`
    );
  }

  return (await response.json()) as T;
}
