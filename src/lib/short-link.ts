import { supabase } from "@/integrations/supabase/client";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomSlug(len = 6): string {
  let out = "";
  const buf = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export async function mintShortLink(args: {
  orgId: string;
  userId: string;
  workspaceId?: string | null;
  utmLinkId?: string | null;
  targetUrl: string;
  label?: string;
}): Promise<{ slug: string; id: string } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = randomSlug(6);
    const { data, error } = await supabase
      .from("short_links")
      .insert({
        org_id: args.orgId,
        created_by: args.userId,
        workspace_id: args.workspaceId ?? null,
        utm_link_id: args.utmLinkId ?? null,
        target_url: args.targetUrl,
        label: args.label ?? null,
        slug,
      })
      .select("id, slug")
      .single();
    if (data) return { slug: data.slug, id: data.id };
    // unique violation → try again
    if (error && (error as { code?: string }).code !== "23505") return null;
  }
  return null;
}

export function shortLinkUrl(slug: string): string {
  if (typeof window === "undefined") return `/r/${slug}`;
  return `${window.location.origin}/r/${slug}`;
}
