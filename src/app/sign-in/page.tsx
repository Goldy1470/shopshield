import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
  if (!clerkConfigured) {
    return (
      <main className="main">
        <div className="statepane statepane--err">
          <h3>Sign-in is not configured yet</h3>
          <p>
            Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local, then open the console
            again.
          </p>
          <a className="abtn abtn--quiet" href="/console">
            Back to the console
          </a>
        </div>
      </main>
    );
  }
  return (
    <main className="main">
      <SignIn forceRedirectUrl="/console" />
    </main>
  );
}
