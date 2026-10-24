import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { memberships, orgs, users } from "@/db/schema";

export type WorkspaceView =
  | { kind: "auth_not_configured" }
  | { kind: "unauthenticated" }
  | { kind: "db_error"; message: string }
  | { kind: "needs_org"; user: { id: string; email: string | null; name: string | null } }
  | {
      kind: "ready";
      orgId: string;
      orgName: string;
      role: string;
      userId: string;
      userEmail: string | null;
    };

function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

async function pullViewer(): Promise<
  { kind: "auth_not_configured" } | { kind: "unauthenticated" } | { externalUser: { externalId: string; email: string | null; name: string | null } }
> {
  if (!clerkConfigured()) return { kind: "auth_not_configured" };
  const { currentUser } = await import("@clerk/nextjs/server");
  const cu = await currentUser();
  if (!cu) return { kind: "unauthenticated" };
  return {
    externalUser: {
      externalId: cu.id,
      email: cu.primaryEmailAddress?.emailAddress ?? null,
      name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
    },
  };
}

async function upsertUser(ext: { externalId: string; email: string | null; name: string | null }) {
  const [row] = await db
    .insert(users)
    .values({ externalId: ext.externalId, email: ext.email, name: ext.name })
    .onConflictDoUpdate({
      target: users.externalId,
      set: { email: ext.email, name: ext.name },
    })
    .returning();
  return row;
}

/** Resolves the signed-in viewer to their org membership. Pure reads only. */
export async function loadWorkspace(): Promise<WorkspaceView> {
  try {
    const pulled = await pullViewer();
    if ("kind" in pulled) return pulled;
    const user = await upsertUser(pulled.externalUser);
    const [membership] = await db
      .select({ role: memberships.role, orgId: memberships.orgId })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);
    if (!membership) {
      return {
        kind: "needs_org",
        user: { id: user.id, email: user.email, name: user.name },
      };
    }
    const [org] = await db.select().from(orgs).where(eq(orgs.id, membership.orgId)).limit(1);
    if (!org) return { kind: "needs_org", user: { id: user.id, email: user.email, name: user.name } };
    return {
      kind: "ready",
      orgId: org.id,
      orgName: org.name,
      role: membership.role,
      userId: user.id,
      userEmail: user.email,
    };
  } catch (err) {
    return { kind: "db_error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function membersOnlyOrgCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  return rows.length;
}

export async function membershipExists(userId: string, orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
  return Boolean(row);
}
