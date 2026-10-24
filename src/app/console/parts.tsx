import Link from "next/link";
import type { CSSProperties } from "react";
import { createOrgAction, approveDraftAction, rejectDraftAction, addShopAction, exportOrgAction, deleteOrgAction } from "./actions";
import { fmtDay, fmtDaysUntil, fmtWhen } from "@/lib/format";
import type { MonthStats, QueueRow, CaseDetail } from "@/repo/cases";
import { EditableLetter } from "@/components/EditableLetter";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

const iconCheck = (
  <svg aria-hidden="true">
    <use href="#i-check" />
  </svg>
);

export function CheckIconDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <symbol
          id="i-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </symbol>
      </defs>
    </svg>
  );
}

export function SkipLink() {
  return (
    <a className="skip" href="#main">
      Skip to content
    </a>
  );
}

export function Shell({
  children,
  shopName,
}: {
  children: React.ReactNode;
  shopName: string;
}) {
  return (
    <>
      <SkipLink />
      <CheckIconDefs />
      <header className="bar">
        <div className="bar__inner">
          <Link className="wordmark" href="/console" aria-label="ShopShield console">
            ShopShield
          </Link>
          <span className="bar__scope">Console</span>
          <div className="bar__shop">
            {shopName}
            <small>Your data</small>
          </div>
          <div className="factions">
            <form action={exportOrgAction}>
              <button className="abtn abtn--quiet" type="submit">
                Export data
              </button>
            </form>
            <form action={deleteOrgAction}>
              <ConfirmSubmit
                label="Delete workspace"
                confirmText="Delete this workspace and every case, draft and event in it? This cannot be undone."
              />
            </form>
          </div>
        </div>
      </header>
      <main id="main">
        <div className="main">{children}</div>
      </main>
    </>
  );
}

export function LoadingShell() {
  return (
    <>
      <SkipLink />
      <main id="main">
        <div className="main">
          <h1 className="visually-hidden">ShopShield console</h1>
          <div className="screen" data-state="loading">
            <section className="strip" aria-label="Loading the month">
              <div className="strip__head">
                <h2>The last 30 nights</h2>
              </div>
            </section>
            <div className="cols">
              <section className="queue">
                <div className="s-loading statepane" aria-live="polite" aria-label="Loading the queue">
                  <h3>Dressing the queue</h3>
                  <div className="sk">
                    <i style={{ width: "82%" }} />
                    <i style={{ width: "64%" }} />
                    <i style={{ width: "90%" }} />
                    <i style={{ width: "70%" }} />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export function MonthStrip({ stats }: { stats: MonthStats }) {
  const counts = stats.perDay.map((d) => d.count);
  const max = Math.max(1, ...counts);
  const tallest = Math.max(...counts);
  return (
    <section className="strip" aria-label="Violations per day, last 30 days">
      <div className="strip__head">
        <h2>The last 30 nights</h2>
        <span>
          {fmtDay(stats.windowStart)} – today
        </span>
      </div>
      <div
        className="strip__bars"
        role="img"
        aria-label={`New violations per day over the last 30 days. Busiest day: ${tallest}.`}
      >
        {stats.perDay.map((d) => (
          <i
            key={d.date}
            style={{ "--h": `${Math.max(d.count > 0 ? 6 : 2, (d.count / max) * 100)}%` } as CSSProperties}
          />
        ))}
      </div>
      <div className="tally">
        <div>
          <b>{stats.newViolations}</b>
          <span>New violations</span>
        </div>
        <div>
          <b>{stats.filed}</b>
          <span>Filed</span>
        </div>
        <div>
          <b className={stats.open > 0 ? "is-open" : undefined}>{stats.open}</b>
          <span>With you now</span>
        </div>
      </div>
    </section>
  );
}

function stateLabel(r: QueueRow): string {
  if (r.violation.status === "under_review") return "Approved — file in Seller Center";
  if (r.violation.status === "resolved") return "Resolved";
  return "Open";
}

export function QueuePane({ rows, selectedId }: { rows: QueueRow[]; selectedId: string | null }) {
  return (
    <section className="queue" aria-label="The queue">
      <div className="s-full">
        <div className="pane__head">
          <h2>The queue</h2>
          <span>
            {rows.length} {rows.length === 1 ? "case" : "cases"}
          </span>
        </div>
        <table className="qu">
          <thead>
            <tr>
              <th scope="col">Night</th>
              <th scope="col">Type</th>
              <th scope="col">Listing</th>
              <th scope="col">Deadline</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const iso = (r.violation.noticeAt ?? r.violation.createdAt).toISOString();
              return (
                <tr key={r.violation.id} className={r.violation.id === selectedId ? "is-open" : undefined}>
                  <td>
                    <Link href={`/console?case=${r.violation.id}`}>
                      <time dateTime={iso}>{fmtWhen(r.violation.noticeAt ?? r.violation.createdAt)}</time>
                    </Link>
                  </td>
                  <td>{r.violation.displayName}</td>
                  <td>{r.violation.targetRef ?? r.violation.target}</td>
                  <td>{r.nextDeadline ? fmtDaysUntil(r.nextDeadline.dueAt) : "—"}</td>
                  <td>
                    <span className="st">
                      {r.violation.status === "under_review" && iconCheck}
                      {stateLabel(r)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EmptyPane({ shopsCount }: { shopsCount: number }) {
  if (shopsCount === 0) {
    return (
      <div className="s-empty statepane" aria-live="polite">
        <h3>Add your first shop</h3>
        <p>The watch guards a real shop, not a demo. Name it and pick a region.</p>
        <form action={addShopAction} className="fstack">
          <input className="finput" name="name" required maxLength={120} placeholder="Shop name" aria-label="Shop name" />
          <select className="finput" name="region" defaultValue="US" aria-label="Shop region">
            <option value="US">US</option>
            <option value="UK">UK</option>
            <option value="SEA">Southeast Asia</option>
          </select>
          <div className="factions">
            <button className="abtn" type="submit">
              Add shop
            </button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <div className="s-empty statepane" aria-live="polite">
      <h3>Nothing to defend tonight</h3>
      <p>
        Your shops are connected. Violations arrive by forwarding and upload — that wiring ships in Phase 2.
      </p>
    </div>
  );
}

export function CasePanel({ detail }: { detail: CaseDetail | null }) {
  if (!detail) {
    return (
      <aside className="case" aria-label="The case file">
        <div className="case__head">
          <h2>Case file</h2>
        </div>
        <p className="cites">Pick a case from the queue.</p>
      </aside>
    );
  }
  const v = detail.violation;
  const draft = detail.draft;
  return (
    <aside className="case" aria-label="The case file">
      <div className="case__head">
        <h2>
          Case file — {v.displayName}
          {v.targetRef ? `, ${v.targetRef}` : ""}
        </h2>
        <time dateTime={(v.noticeAt ?? v.createdAt).toISOString()}>
          noticed {fmtWhen(v.noticeAt ?? v.createdAt)}
        </time>
      </div>
      <EditableLetter
        draftId={draft?.id ?? null}
        initialBody={draft?.body ?? ""}
        editable={Boolean(draft && draft.status === "draft")}
      />
      <p className="cites">
        {v.policyCited ? `Policy cited: ${v.policyCited}` : "Policy cited: not parsed yet"}
        {v.evidenceNeeded ? ` · evidence expected: ${v.evidenceNeeded}` : ""}
        {detail.evidence.length > 0 ? ` · ${detail.evidence.length} evidence file(s)` : ""}
      </p>
      {draft && draft.status === "draft" && (
        <div className="case__actions">
          <form action={approveDraftAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <button className="abtn" type="submit">
              Approve draft
            </button>
          </form>
          <form action={rejectDraftAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <button className="abtn abtn--quiet" type="submit">
              Reject
            </button>
          </form>
        </div>
      )}
      <p className="case__note">
        {draft?.status === "approved"
          ? "Approved on your word. File it in Seller Center, then mark it filed (Phase 4)."
          : draft?.status === "rejected"
            ? "Rejected. Redraft from your records arrives with Phase 3."
            : "Filing happens in Seller Center, at your word. Nothing sends from here."}
      </p>
    </aside>
  );
}

export function ErrorPane({ message, heading }: { message?: string; heading?: string }) {
  return (
    <div className="statepane statepane--err" aria-live="polite">
      <h3>{heading ?? "The watch stalled"}</h3>
      <p>
        {message ?? "The watch retries on its own schedule. Nothing in your data is lost."}
      </p>
    </div>
  );
}

export function ErrorScreen({ message }: { message?: string }) {
  return (
    <Shell shopName="ShopShield">
      <h1 className="visually-hidden">ShopShield console</h1>
      <div className="screen" data-state="error">
        <div className="cols">
          <section className="queue">
            <div className="s-error statepane statepane--err" aria-live="polite">
              <h3>The watch stalled</h3>
              <p>{message ?? "Something went wrong fetching your data. Nothing in your shop is touched."}</p>
              <a className="abtn abtn--quiet" href="/console">
                Retry from the top
              </a>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

export function StubScreen({ kind }: { kind: "auth_not_configured" | "unauthenticated" }) {
  return (
    <>
      <SkipLink />
      <CheckIconDefs />
      <main id="main">
        <div className="main">
          <div className="screen" data-state="empty">
            <div className="cols">
              <section className="queue">
                {kind === "auth_not_configured" ? (
                  <div className="s-empty statepane" aria-live="polite">
                    <h3>Sign-in is not configured yet</h3>
                    <p>
                      Add the Clerk keys to .env.local to turn on auth. Until then the console can&apos;t
                      show anyone data — by design.
                    </p>
                    <a className="abtn abtn--quiet" href="/demo/app.html">
                      See the demo
                    </a>
                  </div>
                ) : (
                  <div className="s-empty statepane" aria-live="polite">
                    <h3>The console wakes for its owner</h3>
                    <p>Sign in to open your queue, deadlines and case files.</p>
                    <a className="abtn" href="/sign-in">
                      Sign in
                    </a>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export function CreateOrgScreen({ email, name }: { email: string | null; name: string | null }) {
  return (
    <>
      <SkipLink />
      <CheckIconDefs />
      <main id="main">
        <div className="main">
          <div className="screen" data-state="empty">
            <div className="cols">
              <section className="queue">
                <div className="s-empty statepane" aria-live="polite">
                  <h3>Name your workspace</h3>
                  <p>
                    Signed in as {email ?? name ?? "you"}. A workspace holds your shops and cases;
                    agencies can flip this into a multi-client org later.
                  </p>
                  <form action={createOrgAction} className="fstack">
                    <input
                      className="finput"
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Workspace name — e.g. Ceramics Direct"
                      aria-label="Workspace name"
                    />
                    <div className="factions">
                      <button className="abtn" type="submit">
                        Create workspace
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
