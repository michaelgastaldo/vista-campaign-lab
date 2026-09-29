import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";

/**
 * Domains that are sandbox / preview hosts, never safe for a user-facing
 * shareable link. If `window.location.origin` matches any of these, we
 * pretend the public origin is unset.
 */
const SANDBOX_HOST_PATTERNS = [/lovableproject\.com$/i, /lovable\.dev$/i];

function isSandboxOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return SANDBOX_HOST_PATTERNS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

function normalize(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (isSandboxOrigin(trimmed)) return null;
  return trimmed;
}

/**
 * Returns the org's configured public app URL, or null when:
 *  - it isn't set, OR
 *  - it points at a sandbox/preview host.
 *
 * Use this for every user-facing shareable link (referral, invite,
 * workspace share, short links). Never fall back to
 * `window.location.origin` if it's a sandbox host.
 */
export function usePublicOrigin() {
  const orgId = useOrgId();
  const [origin, setOrigin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("public_url")
        .eq("id", orgId)
        .single();
      if (cancelled) return;
      setOrigin(normalize(data?.public_url as string | null | undefined));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { origin, loading, isSet: origin !== null };
}

/**
 * Synchronous resolver. Pass the org row's `public_url` value and get back
 * a safe origin or null. Never falls back to the sandbox origin.
 */
export function resolvePublicOrigin(publicUrl: string | null | undefined): string | null {
  return normalize(publicUrl);
}

export function buildShareUrl(publicUrl: string | null | undefined, path: string): string | null {
  const origin = normalize(publicUrl);
  if (!origin) return null;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}
