# Phase 0 — TikTok Shop data-path findings

Researched: 2026-10-24 (from public documentation only; no live API calls — we have no Partner Center app yet).

GATE VERDICT UP FRONT: **there is no public TikTok Shop API for the violation list, violation detail, or the AHR score, and no general appeal-submission API.** Seller Center remains the authority. Etsy-style "read the violations feed" is not buildable. Everything ShopShield does must be built on notification ingestion (email forwarding / upload) plus whatever small official API surface actually exists for orders and products.

---

## 1. How the platform really works (verified)

- Apps are created in **TikTok Shop Partner Center** (App & Service > Manage). Each app gets an `app_key` / `app_secret`.
- Sellers authorize an app; the app exchanges an `authorized_code` for an `access_token` (`/api/token/getAccessToken`, refresh via `/api/token/refreshToken`). Authenticated requests carry the token in the `x-tts-access-token` header and are **signed** (`app_key`, `timestamp`, `sign` query parameters).
- Permissions are **per-app API permission scopes managed in Partner Center "Manage API"** — e.g. "Product Basic", "Return & Refund Basic", "Shop Authorized Information", "Customer Engagement - Read". Scopes are friendly names, **not** OAuth scope strings — there is no `shop.readonly`. This is confirmed by the API Testing Tool docs (`105005 Access denied` = missing scope/token mismatch).
- Shop-scoped operations additionally require a `shop_cipher` parameter.
- Server: `https://open-api.tiktokglobalshop.com`. API families are **versioned** (e.g. `202309`, `202601`).
- Two developer tracks: **seller in-house developer** (own shop / development shop, usable without app review) and **ISV / app-store partner** (requires app categories, review, and TikTok Shop App Scoring & Tiering).

Sources: partner.tiktokshop.com/docv2/page/tts-api-concepts-overview, /methods-and-endpoints, /api-testing-tool, /authorization-overview (id `678e3a3292b0f40314a92d75`), /app-review-process.

## 2. THE FOUR KEY AREAS — verdicts

Checked against the full generated OpenAPI spec of the Partner API (318 operations, 305 paths, 44 webhooks; spec generated 2026-10-22 from TikTok's own docs — github.com/isaackogan/TikTok-Shop-Api-SDKs, `.openapi/tiktok-shop.openapi.json`):

| Area | Verdict | Detail |
| --- | --- | --- |
| Violation list | **DOES NOT EXIST** | Zero operations matching "violation" in path, summary, or tag anywhere in the spec. Seller sees violations only in Seller Center > Account Health > Violation Records. |
| Violation detail | **DOES NOT EXIST** | Same. The violation ticket (enforcement status, reason, details, next steps, deadline timer) exists only in the Seller Center UI. |
| AHR score | **DOES NOT EXIST (as a public API)** | Zero operations matching "health". AHR is visible only in Seller Center. Note: TSP (service-partner) agencies get a **Health module UI in Partner Center Console** for their signed sellers (AHR/SPS/CHR + violation counts + "appealable violations"), but that is a console UI module gated on seller-authorized Seller Center Access roles — not a documented app API we can code against. |
| Appeal submission | **DOES NOT EXIST for general violations** | The only appeal operation in the spec is `POST /product/202604/appeals/submit` — "Submit Size Chart Appeal" (scope: Product Basic) — which belongs to the product-audit (size chart) flow, i.e. a narrow product-listing appeal, not the account-health violation appeal. Also relevant: webhooks `appeal_completed` and `product_audit_status_change` exist. |

Third-party scraping APIs exist (e.g. TikHub / sandbase "creator account health" endpoints driven by the seller's session **cookie**). **Do not use these** — automating the seller's login / scraping Seller Center violates TikTok's terms (house rule #2).

## 3. What the official API DOES cover (Data Path A material)

Verdicts for the brief's endpoint areas:

| Area | Verdict | Notes |
| --- | --- | --- |
| Shop info | **EXISTS** | Seller / shop endpoints incl. `GET /seller/202601/shop_groups`; scope "Shop Authorized Information". |
| Orders & fulfilment | **EXISTS** | Full Orders + Logistics + Fulfillment families; `ORDER_STATUS_CHANGE`, `PACKAGE_UPDATE` webhooks. |
| Late shipment | **DERIVABLE (unclear as a metric)** | No published "late shipment" or shipping-SLA-breach endpoint. Reconstructable from order `ship_before` deadlines + package status events. |
| Cancel rate | **DERIVABLE** | No rate metric endpoint. Compute from order statuses + `Search Cancellations` (`POST /return_refund/202602/cancellations/search`, scope "Return & Refund Basic"). SPS components (OTDR, cancellation rate) are visible in Seller Center, not via API. |
| Products & listing audit | **EXISTS** | Products family incl. `POST /product/202601/compliance/auditing/research` ("Search Products for Compliance Auditing", Product Basic) + `product_audit_status_change` webhook. Compliance sub-records (manufacturers, responsible persons) exist for EU GPSR data. |
| Violations / AHR / appeals | see §2 | |

## 4. Notification mechanics — the foundation for Data Path B (verified)

From TikTok's "What To Do When You Receive A Violation" and "Seller Enforcement Policy" (seller-us.tiktok.com university articles; updated through 2026-10-09):

- **Every violation is notified at minimum via email and a Seller Center Inbox message.** More severe violations use more channels. → The forwarding-inbox premise is TikTok's own stated behavior, not our invention.
- **AHR warnings also arrive by the same channels when the AHR is 10 points away from the next milestone.** → We can catch pre-enforcement warnings by email, reliably.
- Milestones: first enforcement at 150, escalated 100 / 50, deactivation at 0 (US/UK model; 0–1,000 scale, sellers start at 200, rolling 180-day window in US/UK — SEA runs a 90-day window with slightly different bands; US-first launch uses 180 days as briefed).
- **Appeal windows (US policy):**
  - Post-enforcement appeal: **within 30 days of notification**; if rejected, a **second appeal within 15 days of the rejection**; **2 appeals max** per violation, then final.
  - Pre-enforcement (immediate-enforcement violations): **12–72 hours** to appeal or correct; success cancels pending enforcement. Correction windows likewise 12–72 hours, vary by violation.
- Ticket statuses: `Pending` (can still correct/appeal) → `Enforcement action taken` (appeal only) → `Under Review` → `Enforcement action cancelled` (won).
- Appeals are filed **only inside Seller Center** ("View & Appeal" from the ticket). Submitting an appeal does not guarantee approval.
- The ticket's own countdown timer is the binding deadline ("the live violation ticket is the authority").

Implication for Phase 2 alerts: a fixed 14/7/3/1-day schedule is wrong for 12–72-hour windows. Deadline alerts must be **proportional to each notice's window** (e.g. at 50% and 75% elapsed), with 14/7/3/1 as long-window defaults; parse the ticket's own deadline whenever present.

## 5. Data Paths (decided; build order A → B → C)

**Path A — official API, for what exists.** Connect via a Partner Center app for orders, products/listing audit status, shop identity. Token storage encrypted at rest. Read-only families first. This is a*supplementary intelligence*: it enriches cases (order facts, listing status) — it does NOT deliver violations.
- Phase 0.5 (testing): user registers a **seller in-house developer** app on their own shop/development shop — no app review needed. ISV app + review comes later, before multi-seller OAuth (needs user decision; flagged at GATE).

**Path B — forwarding inbox (primary violation ingestion).** Each shop gets `shop-xxxx@in.shopshield.app` (or other owned domain). TikTok emails the notice by default (verified above); the seller (or their agency) forwards the notice email. We parse: notice type, target (listing/product/order/account), policy cited, points/AHR impact, deadline timer, required evidence. Deadline countdown refreshes on re-forward of the ticket.
- Premise verified: TikTok states it emails every violation. **Residual, to verify with a real shop:** default-notification behavior per region, whether forwarded mail passes spam filtering (SPF/DKIM on forwarded mail vs Postmark inbound), attachment/formats of notice emails, and whether agencies' shops have forwarding policies that strip the original headers.

**Path C — manual entry + upload with AI extraction.** Screenshot/PDF of the ticket; AI extracts fields; **every extracted field requires seller confirmation** (house rule: no fabricated facts). This is also the corrective path when forwarding fails.

Build order: **B first** (this is where the product lives — deadlines, queue, docket), then C (fallback + fastest onboarding), then A (order/product enrichment once a Partner Center app exists).

## 6. Consequences for the landing page & claims

- No "connects to Seller Center", no scope strings, no "reads your account health" — landing copy now says notices are forwarded/uploaded (done today in `index.html`).
- If/when Path A ships, it can honestly say "connects to TikTok Shop for orders and listing status" — nothing more.
- "Never files alone / you always file in Seller Center" matches TikTok's own enforcement-message wording.

## 7. Open items (explicitly unresolved)

1. Real-shop verification of Path B email behavior (default email on for all notices, formats, attachments) — needs the user's shop.
2. Partner Center registration (user action pending) — then live API probing of the A-verified endpoints (scopes, field shapes, `shop_cipher` handling) and API Testing Tool runs.
3. Whether `appeal_completed` webhook carries data beyond size-chart appeals (docs page is JS-only; test in-app later).
4. TSP Health-module reachability for our future agency accounts (UI-level, not API — monitor, don't promise).
5. Whether TikTok ever opens a violations/AHR endpoint (watch the changelog; recheck quarterly).

## References

- Partner Center docs root — https://partner.tiktokshop.com/docv2 (concepts, authorization, API Testing Tool, app review)
- Generated Partner API OpenAPI spec (2026-10-22; 318 ops / 44 webhooks) — https://github.com/isaackogan/TikTok-Shop-Api-SDKs (`.openapi/tiktok-shop.openapi.json`), browsable at https://ttspa.docs.isaackogan.com (unofficial mirror of TikTok's docs; used to enumerate endpoints and their per-operation doc URLs, which point back at partner.tiktokshop.com pages)
- What To Do When You Receive A Violation (US) — https://seller-us.tiktok.com/university/essay?knowledge_id=6291506660427575
- Seller Enforcement Policy (US, updated 2026-10-09) — https://seller-us.tiktok.com/university/essay?knowledge_id=2380042836166443
- AHR Requirements (US, updated 2026-10-09) — https://seller-us.tiktok.com/university/essay?knowledge_id=6750828276418350
- AHR overview (UK; 150/100/50/0 milestones) — https://seller-uk.tiktok.com/university/essay?knowledge_id=3374697174435586
- How to Correct Seller Violations — https://seller-us.tiktok.com/university/essay?knowledge_id=3638385374070542
- TSP Health module (partner console UI, agency angle) — https://partner.tiktokshop.com/docv2/page/jwkahmef
- Key endpoint pages (titles verified; bodies are JS-rendered): submit-appeal-task-202604, submit-size-chart-appeal-202604, search-products-for-compliance-auditing-202601, search-cancellations-202602
