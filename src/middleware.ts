import {
  NextFetchEvent,
  NextResponse,
  type NextRequest,
  type NextMiddleware,
} from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk keys absent → pass-through middleware; /console shows the honest
 * "auth not configured" state instead of crashing. Keys set → real Clerk.
 */
const keysPresent = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const clerkHandler: NextMiddleware | null = keysPresent ? clerkMiddleware() : null;

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse> {
  if (clerkHandler) return (await clerkHandler(req, event)) as NextResponse;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};
