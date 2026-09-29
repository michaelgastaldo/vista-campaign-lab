/**
 * Public request status links use a random, expiring token — never the row id.
 * The token is generated in the browser at submit time and stored on the row,
 * so the requestor gets a capability URL that carries no PII and expires.
 */
export function newRequestStatusToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
