import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index";
import {
  deadlines,
  drafts,
  evidenceFiles,
  filings,
  outcomes,
  shops,
  violations,
  auditLog,
} from "@/db/schema";

export type ViolationRow = typeof violations.$inferSelect;
export type DeadlineRow = typeof deadlines.$inferSelect;
export type DraftRow = typeof drafts.$inferSelect;
export type EvidenceRow = typeof evidenceFiles.$inferSelect;
export type FilingRow = typeof filings.$inferSelect;
export type OutcomeRow = typeof outcomes.$inferSelect;

export type QueueRow = {
  violation: ViolationRow;
  shopName: string;
  nextDeadline: { kind: string; dueAt: Date } | null;
};

/** The queue: open and in-review violations for the org, deadline soonest first. */
export async function listQueue(orgId: string, limit = 50): Promise<QueueRow[]> {
  const rows = await db
    .select({ violation: violations, shopName: shops.name })
    .from(violations)
    .innerJoin(shops, eq(shops.id, violations.shopId))
    .where(and(eq(violations.orgId, orgId), inArray(violations.status, ["open", "under_review"])))
    .orderBy(violations.deadlineAt, violations.createdAt)
    .limit(limit);
  if (rows.length === 0) {
    const recent = await db
      .select({ violation: violations, shopName: shops.name })
      .from(violations)
      .innerJoin(shops, eq(shops.id, violations.shopId))
      .where(eq(violations.orgId, orgId))
      .orderBy(desc(violations.createdAt))
      .limit(8);
    return decorate(orgId, recent);
  }
  return decorate(orgId, rows);
}

async function decorate(
  orgId: string,
  rows: { violation: ViolationRow; shopName: string }[],
): Promise<QueueRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.violation.id);
  const active = await db
    .select()
    .from(deadlines)
    .where(
      and(eq(deadlines.orgId, orgId), inArray(deadlines.violationId, ids), eq(deadlines.status, "active")),
    )
    .orderBy(deadlines.dueAt);
  const byViolation = new Map<string, { kind: string; dueAt: Date }>();
  for (const d of active) {
    if (!byViolation.has(d.violationId)) byViolation.set(d.violationId, { kind: d.kind, dueAt: d.dueAt });
  }
  return rows.map((r) => ({
    violation: r.violation,
    shopName: r.shopName,
    nextDeadline: byViolation.get(r.violation.id) ?? null,
  }));
}

export type CaseDetail = {
  violation: ViolationRow;
  shopName: string;
  draft: DraftRow | null;
  evidence: EvidenceRow[];
  filings: FilingRow[];
  outcomes: OutcomeRow[];
};

export async function getCaseDetail(orgId: string, violationId: string): Promise<CaseDetail | null> {
  const [v] = await db
    .select({ violation: violations, shopName: shops.name })
    .from(violations)
    .innerJoin(shops, eq(shops.id, violations.shopId))
    .where(and(eq(violations.orgId, orgId), eq(violations.id, violationId)))
    .limit(1);
  if (!v) return null;
  const [caseDraft] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.orgId, orgId), eq(drafts.violationId, violationId)))
    .orderBy(desc(drafts.version), desc(drafts.createdAt))
    .limit(1);
  const evidence = await db
    .select()
    .from(evidenceFiles)
    .where(and(eq(evidenceFiles.orgId, orgId), eq(evidenceFiles.violationId, violationId)))
    .orderBy(desc(evidenceFiles.createdAt));
  const caseFilings = await db
    .select()
    .from(filings)
    .where(and(eq(filings.orgId, orgId), eq(filings.violationId, violationId)))
    .orderBy(desc(filings.filedAt));
  const caseOutcomes = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.orgId, orgId), eq(outcomes.violationId, violationId)))
    .orderBy(desc(outcomes.receivedAt));
  return {
    violation: v.violation,
    shopName: v.shopName,
    draft: caseDraft ?? null,
    evidence,
    filings: caseFilings,
    outcomes: caseOutcomes,
  };
}

/** Real month strip: new violations per day over the trailing window. */
export type MonthStats = {
  windowStart: Date;
  perDay: { date: string; count: number }[];
  newViolations: number;
  filed: number;
  open: number;
};

export async function monthStats(orgId: string, windowDays = 30): Promise<MonthStats> {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const perDayRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${violations.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(violations)
    .where(and(eq(violations.orgId, orgId), gte(violations.createdAt, windowStart)))
    .groupBy(sql`date_trunc('day', ${violations.createdAt})`);

  const map = new Map(perDayRows.map((r) => [r.day, r.count]));
  const perDay: MonthStats["perDay"] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    perDay.push({ date: key, count: map.get(key) ?? 0 });
  }
  const [{ n: newCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(violations)
    .where(and(eq(violations.orgId, orgId), gte(violations.createdAt, windowStart)));
  const [{ n: filedCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(filings)
    .where(and(eq(filings.orgId, orgId), gte(filings.createdAt, windowStart)));
  const [{ n: openCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(violations)
    .where(and(eq(violations.orgId, orgId), eq(violations.status, "open")));

  return { windowStart, perDay, newViolations: newCount, filed: filedCount, open: openCount };
}

/**
 * Approve: the seller's word. Marks the draft approved and writes the audit row
 * inside the same transaction (no approve without a receipt).
 */
export async function approveDraft(input: { orgId: string; actorUserId: string; draftId: string }) {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(drafts)
      .where(and(eq(drafts.orgId, input.orgId), eq(drafts.id, input.draftId)))
      .limit(1);
    if (!draft) throw new Error("Draft not found");
    if (draft.status === "superseded") throw new Error("Draft version already superseded");
    await tx
      .update(drafts)
      .set({ status: "approved" })
      .where(and(eq(drafts.orgId, input.orgId), eq(drafts.id, draft.id)));
    await tx
      .update(violations)
      .set({ status: "under_review", updatedAt: new Date() })
      .where(and(eq(violations.orgId, input.orgId), eq(violations.id, draft.violationId)));
    await tx.insert(auditLog).values({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "draft_approved",
      entity: "draft",
      entityId: draft.id,
      meta: { violationId: draft.violationId, version: draft.version },
    });
    return { draftId: draft.id, violationId: draft.violationId };
  });
}

/** Reject: the agent redrafts; the seller's reason is kept for Phase 3 redrafting. */
export async function rejectDraft(input: {
  orgId: string;
  actorUserId: string;
  draftId: string;
  reason?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(drafts)
      .where(and(eq(drafts.orgId, input.orgId), eq(drafts.id, input.draftId)))
      .limit(1);
    if (!draft) throw new Error("Draft not found");
    await tx
      .update(drafts)
      .set({ status: "rejected" })
      .where(and(eq(drafts.orgId, input.orgId), eq(drafts.id, draft.id)));
    await tx.insert(auditLog).values({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "draft_rejected",
      entity: "draft",
      entityId: draft.id,
      meta: { violationId: draft.violationId, reason: input.reason ?? null },
    });
    return { draftId: draft.id, violationId: draft.violationId };
  });
}

/** In-place manual edit audit (version-aware redrafting lands with Phase 3). */
export async function saveDraftBody(input: {
  orgId: string;
  actorUserId: string;
  draftId: string;
  body: string;
}) {
  const [draft] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.orgId, input.orgId), eq(drafts.id, input.draftId)))
    .limit(1);
  if (!draft) throw new Error("Draft not found");
  await db
    .update(drafts)
    .set({ body: input.body })
    .where(and(eq(drafts.orgId, input.orgId), eq(drafts.id, draft.id)));
  await logAuditCompat(input.orgId, input.actorUserId, draft.id, draft.violationId);
  return { draftId: draft.id };
}

async function logAuditCompat(
  orgId: string,
  actorUserId: string,
  draftId: string,
  violationId: string,
) {
  await db.insert(auditLog).values({
    orgId,
    actorUserId,
    action: "draft_edited",
    entity: "draft",
    entityId: draftId,
    meta: { violationId },
  });
}
