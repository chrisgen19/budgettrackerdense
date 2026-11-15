import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * Both families are static (no variable axes in this Google release), so every
 * weight the mockup uses is listed explicitly. `next/font` self-hosts them at
 * build time, which is why the CSP in next.config.ts needs no font exception.
 */
const plexSansCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans-condensed",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${plexSansCondensed.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets `.dark` before first paint; see src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
