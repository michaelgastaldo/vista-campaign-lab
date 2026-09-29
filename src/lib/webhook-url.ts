/**
 * Validation for user-registered outbound webhook URLs (SSRF guard).
 *
 * Shared by the client (write time, in WebhooksSection) and the server
 * dispatcher, so a bad URL can neither be stored nor requested.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "[::1]", "::1", "metadata", "metadata.google.internal"]);

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true; // loopback, private, this-host
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10
  return false;
}

/** Returns an error message when the URL is not a safe public https target. */
export function validatePublicHttpUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return "Enter a full URL, e.g. https://hooks.example.com/abc";
  }
  if (u.protocol !== "https:") return "Webhook URLs must use https://";
  const host = u.hostname.toLowerCase();
  if (!host) return "Missing hostname";
  if (BLOCKED_HOSTNAMES.has(host)) return "That host isn't reachable from the app";
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return "Internal hostnames aren't allowed";
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return "Private and link-local addresses aren't allowed";
  }
  return null;
}

/** Throws when the URL is not a safe public https target. */
export function assertPublicHttpUrl(raw: string): void {
  const err = validatePublicHttpUrl(raw);
  if (err) throw new Error(`Blocked webhook URL: ${err}`);
}
