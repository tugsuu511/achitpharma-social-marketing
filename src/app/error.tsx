"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-screen"><h1>Түр алдаа гарлаа</h1><p>Холболтоо шалгаад дахин оролдоно уу.</p><button className="button primary" onClick={reset}>Дахин оролдох</button></main>; }
