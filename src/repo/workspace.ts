import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { logAudit } from "@/db/audit";
import { memberships, orgs, shops, violations } from "@/db/schema";

export async function createOrg(input: {
  userId: string;
  name: string;
  role?: "owner" | "member" | "client_viewer";
}) {
  const orgId = await db.transaction(async (tx) => {
    const [org] = await tx.insert(orgs).values({ name: input.name }).returning();
    await tx.insert(memberships).values({
      orgId: org.id,
      userId: input.userId,
      role: input.role ?? "owner",
    });
    return org.id;
  });
  await logAudit({ orgId, actorUserId: input.userId, action: "org_created", entity: "org", entityId: orgId });
  return orgId;
}

export type ShopRow = typeof shops.$inferSelect;
export async function createShop(input: {
  orgId: string;
  actorUserId: string;
  name: string;
  region?: string;
  tiktokShopId?: string | null;
  timezone?: string;
}) {
  const [shop] = await db
    .insert(shops)
    .values({
      orgId: input.orgId,
      name: input.name,
      region: input.region ?? "US",
      tiktokShopId: input.tiktokShopId ?? null,
      timezone: input.timezone ?? "UTC",
    })
    .returning();
  await logAudit({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: "shop_created",
    entity: "shop",
    entityId: shop.id,
  });
  return shop;
}

export async function listShops(orgId: string): Promise<ShopRow[]> {
  return db.select().from(shops).where(eq(shops.orgId, orgId)).orderBy(shops.createdAt);
}

export async function getShop(orgId: string, shopId: string): Promise<ShopRow | null> {
  const [row] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.orgId, orgId), eq(shops.id, shopId)))
    .limit(1);
  return row ?? null;
}

/** Inbox address stub — real addresses issue in Phase 2 against the owned domain. */
export function previewInboxAddress(): string {
  return `shop-${nanoid(6).toLowerCase()}@in.<inbox-domain>`;
}

export async function orgViolationCount(orgId: string): Promise<number> {
  const rows = await db.select({ id: violations.id }).from(violations).where(eq(violations.orgId, orgId));
  return rows.length;
}
