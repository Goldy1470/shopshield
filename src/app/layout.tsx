import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopShield console",
  description: "Violations, deadlines, drafts and the docket — your own data, not demo data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
  const tree = clerkConfigured ? <ClerkProvider>{children}</ClerkProvider> : <>{children}</>;
  return (
    <html lang="en">
      <body>
        {/* React 19 hoists these <link> elements into <head> */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Wix+Madefor+Display:wght@400;500;600&family=Wix+Madefor+Text:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {tree}
      </body>
    </html>
  );
}
