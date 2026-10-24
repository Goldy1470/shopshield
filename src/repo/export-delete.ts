import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import {
  auditLog,
  connections,
  deadlines,
  drafts,
  evidenceFiles,
  filings,
  notificationPrefs,
  orgs,
  outcomes,
  shops,
  violations,
} from "@/db/schema";

/**
 * Account export & deletion. All deletes rely on the FK cascade from orgs;
 * we still delete the big tenant tables explicitly first to keep the count
 * returned accurate and the transaction short.
 */

export async function exportOrgData(orgId: string): Promise<string> {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  const shopRows = await db.select().from(shops).where(eq(shops.orgId, orgId)).orderBy(shops.createdAt);
  const violationRows = await db.select().from(violations).where(eq(violations.orgId, orgId));
  const deadlineRows = await db.select().from(deadlines).where(eq(deadlines.orgId, orgId));
  const draftRows = await db.select().from(drafts).where(eq(drafts.orgId, orgId));
  const filingRows = await db.select().from(filings).where(eq(filings.orgId, orgId));
  const outcomeRows = await db.select().from(outcomes).where(eq(outcomes.orgId, orgId));
  const evidenceRows = await db.select().from(evidenceFiles).where(eq(evidenceFiles.orgId, orgId));
  const connectionRows = await db.select().from(connections).where(eq(connections.orgId, orgId));
  const prefRows = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.orgId, orgId));

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      org,
      shops: shopRows,
      violations: violationRows,
      deadlines: deadlineRows,
      drafts: draftRows,
      filings: filingRows,
      outcomes: outcomeRows,
      evidenceFiles: evidenceRows,
      connections: connectionRows.length, // token values are never exported; count only
      notificationPrefs: prefRows,
    },
    null,
    2,
  );
}

export async function deleteOrgData(orgId: string): Promise<number> {
  const [{ n: auditRows }] = await db
    .select({ n: auditLog.id })
    .from(auditLog)
    .where(eq(auditLog.orgId, orgId))
    .then((rows) => rows.map((r) => ({ n: r.n })));

  await db.transaction(async (tx) => {
    await tx.insert(auditLog).values({
      orgId,
      action: "org_data_deleted",
      entity: "org",
      entityId: orgId,
    });
  });

  await db.transaction(async (tx) => {
    await tx.delete(outcomes).where(eq(outcomes.orgId, orgId));
    await tx.delete(filings).where(eq(filings.orgId, orgId));
    await tx.delete(drafts).where(eq(drafts.orgId, orgId));
    await tx.delete(evidenceFiles).where(eq(evidenceFiles.orgId, orgId));
    await tx.delete(deadlines).where(eq(deadlines.orgId, orgId));
    await tx.delete(violations).where(eq(violations.orgId, orgId));
    await tx.delete(connections).where(eq(connections.orgId, orgId));
    await tx.delete(notificationPrefs).where(eq(notificationPrefs.orgId, orgId));
    await tx.delete(auditLog).where(eq(auditLog.orgId, orgId));
    await tx.delete(shops).where(eq(shops.orgId, orgId));
    await tx.delete(orgs).where(eq(orgs.id, orgId)); // cascades members
  });

  return auditRows + 1;
}
