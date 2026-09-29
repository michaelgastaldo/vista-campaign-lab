import { supabase } from "@/integrations/supabase/client";

type OnboardingCache = {
  userId: string | null;
  onboardedAt: string | null;
  loaded: boolean;
  promise: Promise<string | null> | null;
};

const cache: OnboardingCache = {
  userId: null,
  onboardedAt: null,
  loaded: false,
  promise: null,
};

export async function getCachedOnboardedAt(userId: string) {
  if (cache.userId !== userId) {
    cache.userId = userId;
    cache.onboardedAt = null;
    cache.loaded = false;
    cache.promise = null;
  }

  if (cache.loaded) return cache.onboardedAt;
  if (cache.promise) return cache.promise;

  // Fragile: app shell and dashboard both need this profile bit. Share the
  // request so initial navigation doesn't paint once per consumer.
  cache.promise = Promise.resolve(
    supabase.from("profiles").select("onboarded_at").eq("id", userId).maybeSingle(),
  ).then(({ data }) => {
    if (cache.userId !== userId) return null;
    cache.onboardedAt = data?.onboarded_at ?? null;
    cache.loaded = true;
    cache.promise = null;
    return cache.onboardedAt;
  });

  return cache.promise;
}

export function markOnboarded(userId: string, onboardedAt = new Date().toISOString()) {
  cache.userId = userId;
  cache.onboardedAt = onboardedAt;
  cache.loaded = true;
  cache.promise = null;
}