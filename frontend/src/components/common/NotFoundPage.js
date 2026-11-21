// ==========================================================
// 404 PAGE — Wrong URL par page open.
//   Root, admin aur storefront ke har not-found se isse
//   render karte hain (kyunke not-found me hai —
//   return karne ke liye link likhna mehnga hai).
// ==========================================================
export default function NotFoundPage({
  title = "Page not found",
  message = "The page you're looking for doesn't exist or has been moved.",
  href = "/",
  label = "Back to home",
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-16 text-center">
      <div className="w-full max-w-md">
        <p className="text-[64px] font-extrabold leading-none text-[#f57224]">404</p>
        <h1 className="mt-4 text-[22px] font-extrabold text-white">{title}</h1>
        <p className="mt-3 text-[14px] text-[#94a3b8]">{message}</p>
        <a
          href={href}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110"
        >
          {label}
        </a>
      </div>
    </main>
  );
}
