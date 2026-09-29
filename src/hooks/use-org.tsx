import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type OrgCache = {
  userId: string | null;
  orgId: string | null;
  loaded: boolean;
  promise: Promise<string | null> | null;
};

type OrgSnapshot = {
  userId: string | null;
  orgId: string | null;
  loaded: boolean;
};

const orgCache: OrgCache = {
  userId: null,
  orgId: null,
  loaded: false,
  promise: null,
};

const listeners = new Set<() => void>();
let orgSnapshot: OrgSnapshot = { userId: null, orgId: null, loaded: false };
const EMPTY_ORG_SNAPSHOT: OrgSnapshot = { userId: null, orgId: null, loaded: false };

function notifyOrgListeners() {
  orgSnapshot = {
    userId: orgCache.userId,
    orgId: orgCache.orgId,
    loaded: orgCache.loaded,
  };
  listeners.forEach((listener) => listener());
}

function cachedOrgIdFor(userId: string | null) {
  return userId && orgCache.userId === userId && orgCache.loaded ? orgCache.orgId : null;
}

async function loadOrgId(userId: string) {
  if (orgCache.userId !== userId) {
    orgCache.userId = userId;
    orgCache.orgId = null;
    orgCache.loaded = false;
    orgCache.promise = null;
  }

  if (orgCache.loaded) return orgCache.orgId;
  if (orgCache.promise) return orgCache.promise;

  orgCache.promise = Promise.resolve(
    supabase.from("profiles").select("default_org_id").eq("id", userId).single(),
  )
    .then(({ data, error }) => {
      if (orgCache.userId !== userId) return null;
      if (error) {
        // Do not mark loaded on error — allow future retries.
        orgCache.promise = null;
        return null;
      }
      orgCache.orgId = data?.default_org_id ?? null;
      orgCache.loaded = true;
      orgCache.promise = null;
      notifyOrgListeners();
      return orgCache.orgId;
    })
    .catch(() => {
      if (orgCache.userId === userId) {
        orgCache.promise = null;
      }
      return null;
    });


  return orgCache.promise;
}

/** Returns the user's default organization id (or null until loaded). */
export function useOrgId() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => orgSnapshot,
    () => EMPTY_ORG_SNAPSHOT,
  );

  useEffect(() => {
    if (!userId) return;
    void loadOrgId(userId);
  }, [userId]);

  if (!userId) return null;
  if (snapshot.userId === userId && snapshot.loaded) return snapshot.orgId;
  return cachedOrgIdFor(userId);
}

/** Kick off org-id resolution before any page mounts. Safe to call repeatedly. */
export function prefetchOrgId(userId: string | null) {
  if (!userId) return;
  void loadOrgId(userId);
}
