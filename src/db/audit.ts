import { db } from "./index";
import { auditLog } from "./schema";

export type AuditEntry = {
  orgId: string;
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: unknown;
};

/**
 * Every approve / edit / file / delete / export action writes an audit row.
 * Fire-and-forget from the caller's perspective is NOT acceptable for
 * compliance actions: callers `await logAudit(...)`.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    orgId: entry.orgId,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    meta: (entry.meta ?? null) as never,
  });
}
