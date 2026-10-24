import { Suspense } from "react";
import { loadWorkspace } from "@/lib/auth";
import { ConsoleScreen } from "./screen";
import { LoadingShell, StubScreen, CreateOrgScreen, ErrorScreen } from "./parts";

export const dynamic = "force-dynamic";

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const sp = await searchParams;
  const ws = await loadWorkspace();

  if (ws.kind === "ready") {
    return (
      <Suspense fallback={<LoadingShell />}>
        <ConsoleScreen orgId={ws.orgId} orgName={ws.orgName} caseId={sp.case} />
      </Suspense>
    );
  }
  if (ws.kind === "needs_org") {
    return <CreateOrgScreen email={ws.user.email} name={ws.user.name} />;
  }
  if (ws.kind === "unauthenticated") return <StubScreen kind="unauthenticated" />;
  if (ws.kind === "auth_not_configured") return <StubScreen kind="auth_not_configured" />;
  return <ErrorScreen message={ws.message} />;
}
