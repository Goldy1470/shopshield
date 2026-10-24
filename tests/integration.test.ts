import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

if (url) {
  // The db module reads DATABASE_URL at first use; wiring before dynamic import.
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = Buffer.from(
      "test-only-encryption-key-32-bytes!!".padEnd(32, "*").slice(0, 32),
      "utf8",
    ).toString("base64");
  }
  process.env.DATABASE_URL = url;
}

const d = url ? describe : describe.skip;

d("org isolation & lifecycle (needs TEST_DATABASE_URL)", () => {
  let dbi: typeof import("@/db/index");
  let schema: typeof import("@/db/schema");
  let workspace: typeof import("@/repo/workspace");
  let cases: typeof import("@/repo/cases");
  let lifecycle: typeof import("@/repo/export-delete");
  let eq: typeof import("drizzle-orm").eq;

  beforeAll(async () => {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    dbi = await import("@/db/index");
    schema = await import("@/db/schema");
    workspace = await import("@/repo/workspace");
    cases = await import("@/repo/cases");
    lifecycle = await import("@/repo/export-delete");
    eq = (await import("drizzle-orm")).eq;
    await migrate(dbi.db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await dbi.db.delete(schema.orgs);
  });

  async function seedsWithTwoOrgs() {
    const [ua] = await dbi.db
      .insert(schema.users)
      .values({ externalId: "test_external_A", email: "a@test.local", name: "A" })
      .returning();
    const [ub] = await dbi.db
      .insert(schema.users)
      .values({ externalId: "test_external_B", email: "b@test.local", name: "B" })
      .returning();
    const orgA = await workspace.createOrg({ userId: ua.id, name: "A Ceramics" });
    const orgB = await workspace.createOrg({ userId: ub.id, name: "B Leather" });
    const shopA = await workspace.createShop({
      orgId: orgA,
      actorUserId: ua.id,
      name: "A Ceramics main",
      region: "US",
    });
    const shopB = await workspace.createShop({
      orgId: orgB,
      actorUserId: ub.id,
      name: "B Leather main",
      region: "US",
    });
    return { ua, ub, orgA, orgB, shopA, shopB };
  }

  async function addViolation(orgId: string, shopId: string, displayName: string) {
    const [v] = await dbi.db
      .insert(schema.violations)
      .values({
        orgId,
        shopId,
        source: "manual",
        displayName,
        kind: "other",
        target: "listing",
        targetRef: "0041",
        policyCited: "IP policy (synthetic)",
        status: "open",
      })
      .returning();
    return v;
  }

  it("shops list is scoped to the org", async () => {
    const { ua, orgA, orgB, shopA, shopB } = await seedsWithTwoOrgs();
    const shopsA = await workspace.listShops(orgA);
    const shopsB = await workspace.listShops(orgB);
    expect(shopsA.map((s) => s.name)).toEqual([shopA.name]);
    expect(shopsB.map((s) => s.name)).toEqual([shopB.name]);
    // user A has no membership in org B
    expect(await workspace.getShop(orgB, shopA.id)).toBeNull();
    expect(await workspace.getShop(orgA, shopB.id)).toBeNull();
    void ua;
    void orgB;
  });

  it("draft approval cannot cross org boundaries", async () => {
    const { ua, ub, orgA, orgB, shopA } = await seedsWithTwoOrgs();
    const v = await addViolation(orgA, shopA.id, "IP claim (synthetic)");
    const [draft] = await dbi.db
      .insert(schema.drafts)
      .values({ orgId: orgA, violationId: v.id, body: "Synthetic draft body.", createdBy: ua.id })
      .returning();

    await expect(
      cases.approveDraft({ orgId: orgB, actorUserId: ub.id, draftId: draft.id }),
    ).rejects.toThrow("Draft not found");

    // Same org approve works and writes the audit row.
    const res = await cases.approveDraft({ orgId: orgA, actorUserId: ua.id, draftId: draft.id });
    expect(res.violationId).toBe(v.id);
    const [status] = await dbi.db
      .select()
      .from(schema.violations)
      .where(eq(schema.violations.id, v.id))
      .limit(1);
    expect(status.status).toBe("under_review");
    const audits = await dbi.db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, orgA));
    expect(audits.some((a) => a.action === "draft_approved")).toBe(true);
  });

  it("export contains only the org's rows", async () => {
    const { orgA, orgB, shopA, shopB } = await seedsWithTwoOrgs();
    await addViolation(orgA, shopA.id, "Late shipment (synthetic)");
    await addViolation(orgB, shopB.id, "Cancel-rate warning (synthetic)");
    const jsonA = await lifecycle.exportOrgData(orgA);
    expect(jsonA).toContain("A Ceramics");
    expect(jsonA).toContain("Late shipment (synthetic)");
    expect(jsonA).not.toContain("B Leather");
    expect(jsonA).not.toContain("Cancel-rate warning (synthetic)");
  });

  it("delete wipes the org and cascades; other orgs survive", async () => {
    const { orgA, orgB, shopA, shopB } = await seedsWithTwoOrgs();
    const vA = await addViolation(orgA, shopA.id, "IP claim (synthetic)");
    await addViolation(orgB, shopB.id, "IP claim (synthetic)");
    const removed = await lifecycle.deleteOrgData(orgA);
    expect(removed).toBeGreaterThan(0);
    const jsonA = await lifecycle.exportOrgData(orgA);
    expect(jsonA).toContain('"exportedAt"');
    expect(jsonA).not.toContain("A Ceramics");
    const [gone] = await dbi.db
      .select()
      .from(schema.violations)
      .where(eq(schema.violations.id, vA.id))
      .limit(1);
    expect(gone).toBeUndefined();
    const shopsB = await workspace.listShops(orgB);
    expect(shopsB.length).toBe(1);
  });
});
