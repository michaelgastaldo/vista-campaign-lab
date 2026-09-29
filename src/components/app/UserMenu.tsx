import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconLogout, IconSettings } from "@/components/ui-custom/CustomIcon";

function initialsFor(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  }
  const e = (email || "").trim();
  if (!e) return "?";
  return e[0]?.toUpperCase() ?? "?";
}

/**
 * Top-right user avatar with a dropdown for Profile / Settings / Sign out.
 * Mounted in the desktop app shell so sign-out is always reachable in one click.
 */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const userId = user?.id ?? null;
  const cacheKey = useMemo(() => (userId ? `um:name:${userId}` : null), [userId]);
  const [fullName, setFullName] = useState<string | null>(() => {
    if (typeof window === "undefined" || !cacheKey) return null;
    return window.localStorage.getItem(cacheKey);
  });

  useEffect(() => {
    if (!user || !cacheKey) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const name = data?.full_name ?? null;
        setFullName(name);
        try {
          if (name) window.localStorage.setItem(cacheKey, name);
          else window.localStorage.removeItem(cacheKey);
        } catch {
          /* ignore quota */
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, cacheKey]);

  if (!user) return null;

  // Derive a stable initial display from the email so we never flash "?".
  const emailFallbackName = user.email?.split("@")[0] ?? "Account";
  const initials = initialsFor(fullName, user.email);
  const displayName = fullName || emailFallbackName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="group inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass/50 py-1 pl-1 pr-3 text-xs text-muted-foreground backdrop-blur-xl transition hover:border-primary/30 hover:text-foreground"
        >
          <span
            className="inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-accent/70 font-display text-[11px] font-medium text-primary-foreground"
            aria-hidden
          >
            {initials}
          </span>
          <span className="hidden max-w-[140px] truncate md:inline">{displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 border-glass-border bg-popover/95 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="font-display text-sm text-foreground">{displayName}</div>
          {fullName && user.email && (
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings" className="flex items-center gap-2">
            <IconSettings size={14} />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await signOut();
            nav({ to: "/login", replace: true });
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <IconLogout size={14} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
