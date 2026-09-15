'use client';
export default function CoachingError({ reset }: {
    reset: () => void;
}) { return <main className="app-page mx-auto max-w-3xl p-10"><h1 className="text-2xl font-semibold">Coaching is temporarily unavailable</h1><p className="my-4">We could not load the coaching workspace. Please try again or contact your administrator.</p><button className="underline" onClick={reset}>Try again</button></main>; }
