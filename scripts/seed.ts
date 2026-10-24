/**
 * Seed script — SYNTHETIC data only, clearly labeled. Never point it at
 * production; it inserts one demo org, shop, violations, a draft, a filing
 * and an outcome, all marked synthetic.
 *
 *   npm run seed        (uses DATABASE_URL)
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, connection } from "../src/db/index";
import {
  auditLog,
  deadlines,
  drafts,
  evidenceFiles,
  filings,
  orgs,
  outcomes,
  shops,
  users,
  violations,
  memberships,
} from "../src/db/schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Set DATABASE_URL (e.g. .env.local) before seeding.");
    process.exit(1);
  }
  await migrate(db, { migrationsFolder: "./drizzle" });

  // A synthetic user + org + shop
  const [user] = await db
    .insert(users)
    .values({ externalId: "seed_synthetic_user", email: "seed@synthetic.local", name: "Synthetic Seller" })
    .onConflictDoUpdate({ target: users.externalId, set: { name: "Synthetic Seller" } })
    .returning();
  const [org] = await db.insert(orgs).values({ name: "Demo Ceramics (SYNTHETIC)" }).returning();
  await db.insert(memberships).values({ orgId: org.id, userId: user.id, role: "owner" });
  const [shop] = await db
    .insert(shops)
    .values({
      orgId: org.id,
      name: "Demo Ceramics Shop (SYNTHETIC)",
      region: "US",
      timezone: "America/New_York",
    })
    .returning();

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const v1 = (
    await db
      .insert(violations)
      .values({
        orgId: org.id,
        shopId: shop.id,
        source: "upload",
        externalRef: "SYN-0041",
        kind: "ip_claim",
        displayName: "IP claim (SYNTHETIC)",
        target: "listing",
        targetRef: "0041",
        policyCited: "IP policy, appeals (SYNTHETIC)",
        pointsImpact: 10,
        evidenceNeeded: "Invoice, licence PDF",
        noticeAt: new Date(now - 5 * day),
        deadlineAt: new Date(now + 25 * day),
        sourceConfirmed: true,
        status: "open",
      })
      .returning()
  )[0];

  const v2 = (
    await db
      .insert(violations)
      .values({
        orgId: org.id,
        shopId: shop.id,
        source: "forward_email",
        externalRef: "SYN-0127",
        kind: "restricted_product",
        displayName: "Restricted ingredient (SYNTHETIC)",
        target: "listing",
        targetRef: "0127",
        pointsImpact: 6,
        noticeAt: new Date(now - 9 * day),
        status: "under_review",
      })
      .returning()
  )[0];

  const v3 = (
    await db
      .insert(violations)
      .values({
        orgId: org.id,
        shopId: shop.id,
        source: "forward_email",
        kind: "late_shipment",
        displayName: "Late shipment (SYNTHETIC)",
        target: "order",
        targetRef: "Thursday batch",
        noticeAt: new Date(now - 12 * day),
        status: "resolved",
      })
      .returning()
  )[0];

  await db.insert(deadlines).values({
    orgId: org.id,
    violationId: v1.id,
    kind: "first_appeal",
    dueAt: new Date(now + 25 * day),
    status: "active",
  });

  await db.insert(evidenceFiles).values([
    {
      orgId: org.id,
      violationId: v1.id,
      filename: "invoice-4472-SYNTHETIC.pdf",
      contentType: "application/pdf",
      sizeBytes: 8192,
      storageKey: "synthetic/invoice-4472.pdf",
    },
    {
      orgId: org.id,
      violationId: v1.id,
      filename: "licence-SYNTHETIC.pdf",
      contentType: "application/pdf",
      sizeBytes: 4096,
      storageKey: "synthetic/licence.pdf",
    },
  ]);

  const [draft] = await db
    .insert(drafts)
    .values({
      orgId: org.id,
      violationId: v1.id,
      body:
        "To Seller Support (SYNTHETIC draft): listing 0041 carries an IP claim. The design follows the licensed Ceramic Studio template; invoice 4472 and the licence PDF are attached.\n\nThe shop asks for reinstatement under the IP policy, appeals section.",
      model: null,
      promptVersion: "manual",
      createdBy: user.id,
    })
    .returning();

  const [v2Draft] = await db
    .insert(drafts)
    .values({
      orgId: org.id,
      violationId: v2.id,
      status: "approved",
      body: "SYNTHETIC approved draft.",
      createdBy: user.id,
    })
    .returning();

  const [filing] = await db
    .insert(filings)
    .values({
      orgId: org.id,
      violationId: v2.id,
      draftId: v2Draft.id,
      filedAt: new Date(now - 6 * day),
      confirmation: "Submitted in Seller Center (SYNTHETIC)",
      filedBy: user.id,
    })
    .returning();

  await db.insert(outcomes).values({
    orgId: org.id,
    violationId: v2.id,
    filingId: filing.id,
    result: "reinstated",
    reason: "Evidence sufficient (SYNTHETIC)",
    receivedAt: new Date(now - 4 * day),
  });

  await db.insert(auditLog).values({
    orgId: org.id,
    actorUserId: user.id,
    action: "seed_inserted",
    entity: "org",
    entityId: org.id,
    meta: { synthetic: true },
  });

  console.log(
    `Seeded synthetic org ${org.name} (${org.id}) with 3 violations, 3 deadlines rows, 2 evidence files, 2 drafts, 1 filing, 1 outcome.`,
  );
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
