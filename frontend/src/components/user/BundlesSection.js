import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import BundleCard from "./BundleCard";
import { bundleApi } from "@/apis/user/bundleApi";
/**
 * ✅ HOMEPAGE BUNDLE SECTION — active combo deals ka grid.
 * Koi bundle nahi to section hide (homepage clutter nahi hota).
 */
export default function BundlesSection({ limit = 8 }) {
  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["bundles-active"],
    queryFn: () => bundleApi.getAllActive({ limit }),
    staleTime: 5 * 60 * 1000,
  });

  if (!isLoading && bundles.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-3 lg:px-6 py-5 lg:py-8">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Layers size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-[var(--user-text)] flex items-center gap-1.5">
              Bundle Deals
              <Sparkles size={14} className="text-purple-500" />
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[var(--user-text-subtle)] font-semibold">
              Combo packs — sabse kam price me zyada products
            </p>
          </div>
        </div>

        <Link
          href="/bundles"
          className="text-[11px] sm:text-xs font-bold text-[var(--user-accent)] hover:underline flex items-center gap-1 shrink-0"
        >
          View All <ArrowRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3 animate-pulse"
            >
              <div className="aspect-square rounded-xl bg-[var(--user-bg-hover)] mb-3" />
              <div className="h-3 w-3/4 rounded bg-[var(--user-bg-hover)] mb-2" />
              <div className="h-4 w-1/2 rounded bg-[var(--user-bg-hover)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {bundles.map((bundle) => (
            <BundleCard key={bundle._id || bundle.id} bundle={bundle} />
          ))}
        </div>
      )}
    </section>
  );
}
