/* Instant skeleton — /filtering-product navigate karte hi dikhta hai
   (route-level loading, layout shift nahi). Theme: home orange accent. */
export default function Loading() {
  return (
    <main
      style={{
        "--user-accent": "#f97316",
        "--user-accent-hover": "#ea580c",
        "--user-accent-text": "#ffffff",
        "--user-accent-soft": "rgba(249, 115, 22, 0.14)",
      }}
      className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
    >
      <div className="sticky top-14 z-40 h-11 border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] lg:top-16 lg:h-12" />
      <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
        <div className="mb-3 h-6 w-52 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
        <div className="flex w-full items-start gap-4 lg:gap-6 xl:gap-8">
          <div className="hidden w-[16.375rem] shrink-0 lg:block xl:w-[18rem] 2xl:w-[20rem]">
            <div className="space-y-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4">
              {[...Array(8).keys()].map((i) => (
                <div key={i} className="h-7 animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
              ))}
            </div>
          </div>
          <div className="grid w-full min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {[...Array(10).keys()].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
