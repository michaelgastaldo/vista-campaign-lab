import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconPlus, IconCheck, IconClose } from "@/components/ui-custom/CustomIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  workspace_id: string;
  org_id: string;
  label: string;
  kind: string;
  url: string;
  storage_path: string | null;
  mime_type: string | null;
  version: number;
};

type Review = {
  id: string;
  asset_id: string;
  reviewer_id: string;
  status: "pending" | "approved" | "changes_requested";
  comment: string | null;
};

type Assignment = {
  id: string;
  asset_id: string;
  reviewer_id: string;
  required: boolean;
};

type Pin = {
  id: string;
  asset_id: string;
  author_id: string;
  x: number;
  y: number;
  body: string;
  resolved: boolean;
  created_at: string;
};

type Member = { user_id: string; full_name: string | null };

export function AssetsSection({ workspaceId, orgId }: { workspaceId: string; orgId: string }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [uploading, setUploading] = useState(false);
  const [openAssetId, setOpenAssetId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [aRes, rRes, asRes, pRes, mRes] = await Promise.all([
        supabase.from("workspace_assets").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
        supabase.from("asset_reviews").select("*").eq("workspace_id", workspaceId),
        supabase.from("asset_reviewer_assignments").select("*").eq("workspace_id", workspaceId),
        supabase.from("asset_pin_comments").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
        supabase.from("org_members").select("user_id").eq("org_id", orgId),
      ]);
      if (cancelled) return;
      const loadedAssets = (aRes.data as Asset[]) ?? [];
      setAssets(loadedAssets);
      setReviews((rRes.data as Review[]) ?? []);
      setAssignments((asRes.data as Assignment[]) ?? []);
      setPins((pRes.data as Pin[]) ?? []);

      // Generate fresh signed URLs from storage_path — the persisted url column
      // holds an expiring signed URL and can't be trusted for display.
      const pathAssets = loadedAssets.filter((a): a is Asset & { storage_path: string } => !!a.storage_path);
      if (pathAssets.length) {
        try {
          const { data: signedList, error: signErr } = await supabase
            .storage
            .from("workspace-assets")
            .createSignedUrls(pathAssets.map((a) => a.storage_path), 3600);
          if (!cancelled && !signErr && signedList) {
            const map: Record<string, string> = {};
            signedList.forEach((entry, i) => {
              const asset = pathAssets[i];
              if (asset && entry.signedUrl) map[asset.id] = entry.signedUrl;
            });
            setSignedUrls(map);
          } else if (!cancelled) {
            setSignedUrls({});
          }
        } catch {
          if (!cancelled) setSignedUrls({});
        }
      } else if (!cancelled) {
        setSignedUrls({});
      }

      const uids = ((mRes.data as Array<{ user_id: string }>) ?? []).map((m) => m.user_id);
      if (uids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uids);
        if (cancelled) return;
        setMembers(((profs as Array<{ id: string; full_name: string | null }>) ?? []).map((p) => ({ user_id: p.id, full_name: p.full_name })));
      }
    };
    load();
    const ch = supabase
      .channel(`assets-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_assets", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "asset_reviews", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "asset_reviewer_assignments", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "asset_pin_comments", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workspaceId, orgId]);

  const onUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${orgId}/${workspaceId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("workspace-assets").upload(path, file);
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      // Do NOT store an expiring signed URL — display always signs fresh from storage_path.
      const { error } = await supabase.from("workspace_assets").insert({
        workspace_id: workspaceId,
        org_id: orgId,
        label: file.name,
        kind: file.type.startsWith("image/") ? "image" : "file",
        url: "",
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
      });
      if (error) toast.error(error.message);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const review = async (assetId: string, status: Review["status"], comment?: string) => {
    if (!user) return;
    const existing = reviews.find((r) => r.asset_id === assetId && r.reviewer_id === user.id);
    if (existing) {
      await supabase.from("asset_reviews").update({ status, comment: comment ?? existing.comment }).eq("id", existing.id);
    } else {
      await supabase.from("asset_reviews").insert({
        asset_id: assetId,
        workspace_id: workspaceId,
        org_id: orgId,
        reviewer_id: user.id,
        status,
        comment: comment ?? null,
      });
    }
  };

  const remove = async (a: Asset) => {
    if (!confirm(`Delete "${a.label}"?`)) return;
    if (a.storage_path) await supabase.storage.from("workspace-assets").remove([a.storage_path]);
    await supabase.from("workspace_assets").delete().eq("id", a.id);
  };

  const toggleReviewer = async (assetId: string, reviewerId: string) => {
    if (!user) return;
    const existing = assignments.find((a) => a.asset_id === assetId && a.reviewer_id === reviewerId);
    if (existing) {
      await supabase.from("asset_reviewer_assignments").delete().eq("id", existing.id);
    } else {
      await supabase.from("asset_reviewer_assignments").insert({
        asset_id: assetId,
        workspace_id: workspaceId,
        org_id: orgId,
        reviewer_id: reviewerId,
        required: true,
        assigned_by: user.id,
      });
    }
  };

  const reviewsFor = (id: string) => reviews.filter((r) => r.asset_id === id);
  const assignedFor = (id: string) => assignments.filter((a) => a.asset_id === id);
  const pinsFor = (id: string) => pins.filter((p) => p.asset_id === id);

  // Required reviewers all approved? If none required, any approval counts.
  const isAssetCleared = (id: string) => {
    const required = assignedFor(id).filter((a) => a.required);
    const approvedReviewers = new Set(reviewsFor(id).filter((r) => r.status === "approved").map((r) => r.reviewer_id));
    if (required.length === 0) return approvedReviewers.size > 0;
    return required.every((r) => approvedReviewers.has(r.reviewer_id));
  };

  const openAsset = openAssetId ? assets.find((a) => a.id === openAssetId) ?? null : null;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Assets &amp; approvals</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            Upload creative, assign reviewers, drop pin comments. Workspace can&apos;t go live until every required reviewer approves.
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <IconPlus size={14} /> {uploading ? "Uploading…" : "Upload"}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
        </label>
      </div>

      {assets.length === 0 ? (
        <GlassPanel className="p-6 text-center text-sm text-muted-foreground">
          No assets yet. Drop in creative once it&apos;s ready for review.
        </GlassPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => {
            const rs = reviewsFor(a.id);
            const approved = rs.filter((r) => r.status === "approved").length;
            const changes = rs.filter((r) => r.status === "changes_requested").length;
            const assigned = assignedFor(a.id);
            const cleared = isAssetCleared(a.id);
            const pinCount = pinsFor(a.id).length;
            return (
              <GlassPanel key={a.id} className="flex flex-col gap-3 overflow-hidden p-0">
                <button
                  onClick={() => setOpenAssetId(a.id)}
                  className="block aspect-video w-full overflow-hidden bg-black/30 text-left"
                >
                  {a.kind === "image" && signedUrls[a.id] ? (
                    <img src={signedUrls[a.id]} alt={a.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      {a.mime_type ?? "file"}
                    </div>
                  )}
                </button>
                <div className="flex items-start justify-between gap-2 px-4">
                  <div className="min-w-0">
                    <button onClick={() => setOpenAssetId(a.id)} className="truncate text-left text-sm hover:underline">
                      {a.label}
                    </button>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>v{a.version}</span>
                      <span>·</span>
                      <span className={cleared ? "text-primary" : "text-amber-500"}>
                        {cleared ? "Approved" : `${assigned.length ? `${approved}/${assigned.filter((x) => x.required).length} req` : "Awaiting review"}`}
                      </span>
                      {pinCount > 0 && <><span>·</span><span>{pinCount} pin{pinCount === 1 ? "" : "s"}</span></>}
                    </div>
                  </div>
                  <button onClick={() => remove(a)} className="text-muted-foreground/50 hover:text-destructive" aria-label="Delete">
                    <IconClose size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 px-4 pb-4">
                  <button
                    onClick={() => review(a.id, "approved")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition",
                      approved > 0 ? "bg-primary/20 text-primary" : "bg-glass/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <IconCheck size={11} /> Approve ({approved})
                  </button>
                  <button
                    onClick={() => {
                      const c = prompt("What needs to change?");
                      if (c !== null) review(a.id, "changes_requested", c);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition",
                      changes > 0 ? "bg-destructive/20 text-destructive" : "bg-glass/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Changes ({changes})
                  </button>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}

      <Dialog open={!!openAsset} onOpenChange={(o) => !o && setOpenAssetId(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{openAsset?.label ?? "Asset"}</DialogTitle>
          </DialogHeader>
          {openAsset && (
            <AssetDetail
              asset={openAsset}
              signedUrl={signedUrls[openAsset.id] ?? ""}
              reviews={reviewsFor(openAsset.id)}
              assignments={assignedFor(openAsset.id)}
              pins={pinsFor(openAsset.id)}
              members={members}
              workspaceId={workspaceId}
              orgId={orgId}
              userId={user?.id ?? null}
              onToggleReviewer={(rid) => toggleReviewer(openAsset.id, rid)}
              onReview={(s, c) => review(openAsset.id, s, c)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetDetail({
  asset,
  signedUrl,
  reviews,
  assignments,
  pins,
  members,
  workspaceId,
  orgId,
  userId,
  onToggleReviewer,
  onReview,
}: {
  asset: Asset;
  signedUrl: string;
  reviews: Review[];
  assignments: Assignment[];
  pins: Pin[];
  members: Member[];
  workspaceId: string;
  orgId: string;
  userId: string | null;
  onToggleReviewer: (reviewerId: string) => void;
  onReview: (status: Review["status"], comment?: string) => void;
}) {
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);

  const onStageClick = (e: React.MouseEvent) => {
    if (!userId) return;
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setDraftPin({ x, y });
    setDraftBody("");
  };

  const savePin = async () => {
    if (!draftPin || !userId || !draftBody.trim()) return;
    const { error } = await supabase.from("asset_pin_comments").insert({
      asset_id: asset.id,
      workspace_id: workspaceId,
      org_id: orgId,
      author_id: userId,
      x: draftPin.x,
      y: draftPin.y,
      body: draftBody.trim(),
    });
    if (error) toast.error(error.message);
    setDraftPin(null);
    setDraftBody("");
  };

  const resolvePin = async (id: string, resolved: boolean) => {
    await supabase.from("asset_pin_comments").update({ resolved }).eq("id", id);
  };
  const deletePin = async (id: string) => {
    await supabase.from("asset_pin_comments").delete().eq("id", id);
  };

  const memberName = (id: string) => members.find((m) => m.user_id === id)?.full_name ?? "Member";

  const sortedPins = useMemo(() => pins.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)), [pins]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-2 text-sm font-medium">{asset.label}</div>
        <div
          ref={stageRef}
          className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/40"
          onClick={onStageClick}
        >
          {asset.kind === "image" && signedUrl ? (
            <img src={signedUrl} alt={asset.label} className="pointer-events-none h-full w-full object-contain" />
          ) : signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              Open {asset.mime_type ?? "file"}
            </a>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Preview unavailable
            </div>
          )}
          {sortedPins.map((p, i) => (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById(`pin-thread-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full font-mono text-[10px] font-bold shadow-lg transition hover:scale-110",
                p.resolved ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                "size-6",
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title={p.body}
            >
              {i + 1}
            </button>
          ))}
          {draftPin && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 font-mono text-[10px] font-bold text-white shadow-lg"
              style={{ left: `${draftPin.x}%`, top: `${draftPin.y}%`, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ?
            </div>
          )}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Click anywhere on the asset to drop a pin comment.
        </div>

        {draftPin && (
          <div className="mt-3 rounded-lg border border-glass-border bg-background/40 p-3">
            <div className="mb-2 text-xs text-muted-foreground">New pin comment</div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              autoFocus
              rows={2}
              placeholder="Describe the issue or suggestion…"
              className="w-full rounded-md border border-glass-border bg-background/40 p-2 text-sm outline-none focus:border-primary/50"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => { setDraftPin(null); setDraftBody(""); }}
                className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={savePin}
                disabled={!draftBody.trim()}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Save pin
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Reviewers</div>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-glass-border bg-background/40 p-2">
            {members.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">No org members.</div>
            ) : (
              members.map((m) => {
                const assigned = assignments.some((a) => a.reviewer_id === m.user_id);
                const r = reviews.find((rv) => rv.reviewer_id === m.user_id);
                return (
                  <label key={m.user_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-glass/40">
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={() => onToggleReviewer(m.user_id)}
                      className="size-3.5 accent-primary"
                    />
                    <span className="flex-1 truncate">{m.full_name ?? "Member"}</span>
                    {r && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px]",
                        r.status === "approved" ? "bg-primary/20 text-primary" : r.status === "changes_requested" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground",
                      )}>
                        {r.status === "approved" ? "Approved" : r.status === "changes_requested" ? "Changes" : "Pending"}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Your decision</div>
          <div className="flex gap-2">
            <button
              onClick={() => onReview("approved")}
              className="flex-1 rounded-md bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25"
            >
              Approve
            </button>
            <button
              onClick={() => {
                const c = prompt("What needs to change?");
                if (c !== null) onReview("changes_requested", c);
              }}
              className="flex-1 rounded-md bg-destructive/15 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/25"
            >
              Request changes
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Pins ({sortedPins.length})
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {sortedPins.length === 0 ? (
              <div className="rounded border border-dashed border-glass-border p-3 text-center text-xs text-muted-foreground">
                No pin comments yet.
              </div>
            ) : (
              sortedPins.map((p, i) => (
                <div
                  key={p.id}
                  id={`pin-thread-${p.id}`}
                  className={cn("rounded border border-glass-border bg-background/40 p-2 text-xs", p.resolved && "opacity-50")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{memberName(p.author_id)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => resolvePin(p.id, !p.resolved)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {p.resolved ? "Reopen" : "Resolve"}
                      </button>
                      {p.author_id === userId && (
                        <button
                          onClick={() => deletePin(p.id)}
                          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{p.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
