import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Fraunces, Manrope } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leadership Continuity System MVP",
  description:
    "Organization succession planning MVP with role composites, strengths analysis, fit scoring, and mentor-ready development reports.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const brandLink = (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-950 font-display text-lg text-teal-50">
        LC
      </div>
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
          Leadership Continuity
        </p>
        <p className="text-sm text-slate-600">
          Organization succession planning MVP
        </p>
      </div>
    </Link>
  );
  let navigation: React.ReactNode;

  if (pathname.startsWith("/auth")) {
    navigation = (
      <header className="relative z-10 px-5 pt-4 sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-[1380px]">
          <div className="theme-panel-strong flex items-center justify-between gap-4 rounded-[2rem] px-4 py-4 sm:px-6">
            {brandLink}
            <Link
              href="/auth"
              className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              Open Auth
            </Link>
          </div>
        </div>
      </header>
    );
  } else {
    try {
      navigation = await AppNav({ pathname });
    } catch {
      console.warn("Navigation auth fallback activated.");
      navigation = (
        <header className="relative z-10 px-5 pt-4 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1380px]">
            <div className="theme-panel-strong flex items-center justify-between gap-4 rounded-[2rem] px-4 py-4 sm:px-6">
              {brandLink}
              <Link
                href="/auth"
                className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Auth
              </Link>
            </div>
          </div>
        </header>
      );
    }
  }

  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {navigation}
        {children}
      </body>
    </html>
  );
}
