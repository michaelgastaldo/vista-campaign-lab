import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/r/$slug")({
  component: ShortLinkRedirect,
});

function ShortLinkRedirect() {
  const { slug } = useParams({ from: "/r/$slug" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("resolve_short_link", { _slug: slug });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setError("This link doesn't exist or has been removed.");
        return;
      }
      // fire-and-forget click record
      void supabase.rpc("record_link_click", {
        _short_link_id: row.id,
        _org_id: row.org_id,
        _ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        _ref: typeof document !== "undefined" ? document.referrer || "" : "",
      });
      window.location.replace(row.target_url);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-ink)] px-6 text-foreground">
      <div className="text-center">
        {error ? (
          <>
            <div className="font-display text-3xl">404</div>
            <div className="mt-2 text-sm text-muted-foreground">{error}</div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Redirecting…</div>
        )}
      </div>
    </div>
  );
}
