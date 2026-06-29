"use client";

import { useEffect, useState } from "react";

type OpenAICostSummary = {
  totalCandidateReports: number;
  estimatedSpendAllTime: number;
  estimatedSpendCurrentMonth: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function OpenAICostSummaryCard() {
  const [summary, setSummary] = useState<OpenAICostSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function requestSummary(signal?: AbortSignal) {
    const response = await fetch("/api/admin/openai-cost-summary", {
      cache: "no-store",
      signal,
    });
    const payload = (await response.json()) as OpenAICostSummary | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in payload && payload.error
          ? payload.error
          : "Unable to load OpenAI cost summary.",
      );
    }

    return payload as OpenAICostSummary;
  }

  async function refreshSummary(signal?: AbortSignal) {
    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const nextSummary = await requestSummary(signal);
      setSummary(nextSummary);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load OpenAI cost summary.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function hydrateSummary() {
      try {
        const nextSummary = await requestSummary(controller.signal);
        setSummary(nextSummary);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load OpenAI cost summary.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void hydrateSummary();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        OpenAI Cost
      </p>

      {isLoading ? (
        <div className="mt-6 space-y-3 text-sm text-slate-600">
          <p>Loading cost summary...</p>
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <p>{error}</p>
          <button
            className="mt-4 rounded-full bg-rose-600 px-4 py-2 font-semibold text-white transition hover:bg-rose-500"
            type="button"
            onClick={() => {
              void refreshSummary();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && summary ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Candidate Reports
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {summary.totalCandidateReports}
            </p>
          </article>
          <article className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Estimated Spend
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCurrency(summary.estimatedSpendAllTime)}
            </p>
          </article>
          <article className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Current Month
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCurrency(summary.estimatedSpendCurrentMonth)}
            </p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
