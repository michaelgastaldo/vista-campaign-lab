import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  fetchConnectionStatus,
  createCampaignBundle,
  fetchCampaigns,
  fetchCampaignAssets,
} from "./gateway.server";

export const getCrmStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return fetchConnectionStatus();
  });

const campaignBundleSchema = z.object({
  generated_name: z.string().min(1).max(200),
  campaign_type: z.string().min(1).max(80),
  audience: z.enum(["b2b", "b2c"]),
  brief_name: z.string().min(1).max(20),
  promotion_start: z.string().min(8).max(40),
  promotion_end: z.string().min(8).max(40),
  event_start: z.string().min(8).max(40).nullable(),
  event_end: z.string().min(8).max(40).nullable(),
  budget_cents: z.number().int().min(0).max(1_000_000_000),
  notes: z.string().max(2000).nullable(),
});

export const createCampaignBundleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => campaignBundleSchema.parse(d))
  .handler(async ({ data }) => {
    return createCampaignBundle(data);
  });

export const listCrmCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return fetchCampaigns();
  });

export const listCrmCampaignAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaign_id: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    return fetchCampaignAssets(data.campaign_id);
  });
