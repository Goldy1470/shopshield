import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * ShopShield core schema (Phase 1).
 *
 * Isolation rule: every tenant-owned table carries org_id, and every repository
 * query filters by it (see src/repo/*). enableRls hardening (Postgres RLS) is
 * added in Phase 7; the query-layer rule is enforced by tests/ tests/isolation.
 */

export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Clerk user id, stable across sessions. */
  externalId: text("external_id").notNull().unique(),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** owner | member | client_viewer */
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_org_user_uq").on(t.orgId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** TikTok Shop region handled in Phase 2+ (US first). */
    region: text("region").notNull().default("US"),
    /** The seller's own TikTok Shop id, when they add it. */
    tiktokShopId: text("tiktok_shop_id"),
    /** Per-shop forwarding inbox (Phase 2): shop-xxxx@in.<domain>. */
    inboxAddress: text("inbox_address"),
    timezone: text("timezone").notNull().default("UTC"),
    /** active | archived */
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shops_org_idx").on(t.orgId)],
);

/** OAuth tokens for official-API connections (Data Path A). Encrypted at rest. */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    // "tiktok_shop"
    provider: text("provider").notNull().default("tiktok_shop"),
    label: text("label"),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    // active | expired | revoked
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("connections_org_idx").on(t.orgId), index("connections_shop_idx").on(t.shopId)],
);

export const violations = pgTable(
  "violations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /** forward_email | upload | manual | api (Data Paths B, C, A) */
    source: text("source").notNull().default("manual"),
    /** TikTok violation ticket reference, when known from the notice. */
    externalRef: text("external_ref"),
    /** Normalized category (Phase 2 parser): ip_claim, restricted_product, late_shipment, cancel_rate, ... */
    kind: text("kind").notNull().default("other"),
    /** Human label shown in the queue, taken from the notice. */
    displayName: text("display_name").notNull().default("Violation"),
    /** listing | order | account */
    target: text("target").notNull().default("account"),
    targetRef: text("target_ref"),
    policyCited: text("policy_cited"),
    /** Points / AHR impact stated by the notice, when present. */
    pointsImpact: integer("points_impact"),
    evidenceNeeded: text("evidence_needed"),
    noticeAt: timestamp("notice_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    /** True only after the seller confirms parsed fields (Path C honesty rule). */
    sourceConfirmed: boolean("source_confirmed").notNull().default(false),
    /** open | under_review | resolved | dismissed | closed */
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("violations_org_idx").on(t.orgId),
    index("violations_shop_idx").on(t.shopId),
    index("violations_status_idx").on(t.orgId, t.status),
  ],
);

export const deadlines = pgTable(
  "deadlines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    violationId: uuid("violation_id")
      .notNull()
      .references(() => violations.id, { onDelete: "cascade" }),
    /** first_appeal | second_appeal | correction | quiz */
    kind: text("kind").notNull().default("first_appeal"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    /** active | done | missed */
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deadlines_org_idx").on(t.orgId),
    index("deadlines_violation_idx").on(t.violationId),
    index("deadlines_due_idx").on(t.status, t.dueAt),
  ],
);

export const evidenceFiles = pgTable(
  "evidence_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    violationId: uuid("violation_id").references(() => violations.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    /** Object key in the S3-compatible bucket. */
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_org_idx").on(t.orgId), index("evidence_violation_idx").on(t.violationId)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    violationId: uuid("violation_id")
      .notNull()
      .references(() => violations.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    /** draft | approved | rejected | superseded */
    status: text("status").notNull().default("draft"),
    body: text("body").notNull(),
    /** Model + prompt version recorded per draft (Phase 3 pipeline). */
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("drafts_org_idx").on(t.orgId),
    index("drafts_violation_idx").on(t.violationId),
  ],
);

export const filings = pgTable(
  "filings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    violationId: uuid("violation_id")
      .notNull()
      .references(() => violations.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    filedAt: timestamp("filed_at", { withTimezone: true }).notNull().defaultNow(),
    /** Seller notes on what they submitted in Seller Center. */
    confirmation: text("confirmation"),
    filedBy: uuid("filed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("filings_org_idx").on(t.orgId), index("filings_violation_idx").on(t.violationId)],
);

export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    violationId: uuid("violation_id")
      .notNull()
      .references(() => violations.id, { onDelete: "cascade" }),
    filingId: uuid("filing_id").references(() => filings.id, { onDelete: "set null" }),
    /** reinstated | partially | denied | pending */
    result: text("result").notNull(),
    /** TikTok's stated reason. */
    reason: text("reason"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outcomes_org_idx").on(t.orgId), index("outcomes_violation_idx").on(t.violationId)],
);

/** Curated policy library (Phase 3 records live here; schema exists in Phase 1). */
export const policyDocs = pgTable("policy_docs", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  sourceUrl: text("source_url").notNull(),
  clauseSummary: text("clause_summary").notNull(),
  evidenceExpected: text("evidence_expected"),
  lastVerified: date("last_verified", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_org_idx").on(t.orgId), index("audit_actor_idx").on(t.actorUserId)],
);

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("email"),
    target: text("target"),
    /** Alert lead schedule; Phase 2 computes proportional leads per window. */
    leadDays: jsonb("lead_days").$type<number[]>().notNull().default(sql`'[14,7,3,1]'::jsonb`),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_org_idx").on(t.orgId)],
);
