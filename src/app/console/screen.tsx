import { monthStats, listQueue, getCaseDetail, type CaseDetail } from "@/repo/cases";
import { listShops } from "@/repo/workspace";
import { ErrorScreen, EmptyPane, MonthStrip, QueuePane, CasePanel, Shell } from "./parts";

export async function ConsoleScreen({
  orgId,
  orgName,
  caseId,
}: {
  orgId: string;
  orgName: string;
  caseId?: string;
}) {
  let stats;
  let queue;
  let shopsCount = 0;
  try {
    const [s, q] = await Promise.all([monthStats(orgId), listQueue(orgId)]);
    stats = s;
    queue = q;
    shopsCount = (await listShops(orgId)).length;
  } catch (err) {
    return <ErrorScreen message={err instanceof Error ? err.message : undefined} />;
  }

  const selected =
    caseId && queue.some((row) => row.violation.id === caseId)
      ? caseId
      : (queue[0]?.violation.id ?? null);

  let detail: CaseDetail | null = null;
  if (selected) {
    try {
      detail = await getCaseDetail(orgId, selected);
    } catch {
      detail = null;
    }
  }

  const state = queue.length > 0 ? "full" : "empty";

  return (
    <Shell shopName={orgName}>
      <h1 className="visually-hidden">ShopShield console</h1>
      <div className="screen" data-state={state}>
        <MonthStrip stats={stats} />
        <div className="cols">
          <QueuePane rows={queue} selectedId={selected} />
          <EmptyPane shopsCount={queue.length > 0 ? -1 : shopsCount} />
          {state === "full" && <CasePanel detail={detail} />}
        </div>
      </div>
    </Shell>
  );
}
