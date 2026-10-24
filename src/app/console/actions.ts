"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/index";
import { logAudit } from "@/db/audit";
import { memberships, orgs, users } from "@/db/schema";
import { approveDraft, rejectDraft, saveDraftBody } from "@/repo/cases";
import { createOrg, createShop, getShop } from "@/repo/workspace";
import { deleteOrgData, exportOrgData } from "@/repo/export-delete";

const orgNameSchema = z.string().trim().min(2).max(120);

async function currentUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  const cu = await currentUser();
  if (!cu) return null;
  const display = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
  const email = cu.primaryEmailAddress?.emailAddress ?? null;
  const [row] = await db
    .insert(users)
    .values({ externalId: cu.id, email, name: display })
    .onConflictDoUpdate({ target: users.externalId, set: { email, name: display } })
    .returning();
  return row.id;
}

export async function createOrgAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const parsed = orgNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) throw new Error("Workspace name must be 2 to 120 characters");
  await createOrg({ userId, name: parsed.data });
  revalidatePath("/console");
  redirect("/console");
}

export async function approveDraftAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const wsId = await viewerOrgId(userId);
  if (!wsId) throw new Error("No workspace");
  const draftId = z.string().uuid().parse(formData.get("draftId"));
  await approveDraft({ orgId: wsId, actorUserId: userId, draftId });
  revalidatePath("/console");
}

export async function rejectDraftAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const wsId = await viewerOrgId(userId);
  if (!wsId) throw new Error("No workspace");
  const draftId = z.string().uuid().parse(formData.get("draftId"));
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim() : null;
  await rejectDraft({ orgId: wsId, actorUserId: userId, draftId, reason });
  revalidatePath("/console");
}

export async function saveDraftAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const wsId = await viewerOrgId(userId);
  if (!wsId) throw new Error("No workspace");
  const draftId = z.string().uuid().parse(formData.get("draftId"));
  const body = z.string().trim().min(20).max(20000).parse(formData.get("body"));
  await saveDraftBody({ orgId: wsId, actorUserId: userId, draftId, body });
  revalidatePath("/console");
}

export async function exportOrgAction(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const wsId = await viewerOrgId(userId);
  if (!wsId) throw new Error("No workspace");
  const json = await exportOrgData(wsId);
  await logAudit({ orgId: wsId, actorUserId: userId, action: "org_exported", entity: "org", entityId: wsId });
  const { writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const file = path.join(tmpdir(), `shopshield-export-${wsId}.json`);
  await writeFile(file, json, "utf8");
  redirect(`/api/downloads?file=${encodeURIComponent(path.basename(file))}`);
}

export async function deleteOrgAction(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const wsId = await viewerOrgId(userId);
  if (!wsId) throw new Error("No workspace");
  const [m] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId));
  if (!m || m.role !== "owner") throw new Error("Only the owner can delete the workspace");
  await logAudit({ orgId: wsId, actorUserId: userId, action: "org_delete_requested", entity: "org", entityId: wsId });
  await deleteOrgData(wsId);
  await db.delete(users).where(eq(users.id, userId));
  redirect("/console");
}

export async function addShopAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in");
  const wsId = await viewerOrgId(userId);
  if (!wsId) throw new Error("No workspace");
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  const region = z.enum(["US", "UK", "SEA"]).default("US").parse(formData.get("region") ?? "US");
  await createShop({ orgId: wsId, actorUserId: userId, name, region });
  revalidatePath("/console");
}

async function viewerOrgId(userId: string): Promise<string | null> {
  const [m] = await db.select({ orgId: memberships.orgId, role: memberships.role }).from(memberships).where(eq(memberships.userId, userId)).limit(1);
  if (!m) return null;
  const [org] = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.id, m.orgId)).limit(1);
  return org?.id ?? null;
}
