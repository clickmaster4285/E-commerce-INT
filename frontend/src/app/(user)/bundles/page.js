"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers, PackageOpen } from "lucide-react";
import Link from "next/link";
import BundleCard from "@/components/user/BundleCard";
import { bundleApi } from "@/apis/user/bundleApi";

export default function BundlesPage() {
  const { data: bundles = [], isLoading, isError } = useQuery({
    queryKey: ["bundles-active"],
    queryFn: () => bundleApi.getAllActive({ limit: 60 }),
    staleTime: 60 * 1000,
  });

  return (
    <main className="min-h-screen bg-[var(--user-bg-base)] text-[var(--user-text)]">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-5 sm:py-7">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
            <Layers size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider">
              Bundle Deals
            </h1>
            <p className="text-[11px] sm:text-xs text-[var(--user-text-subtle)] font-semibold">
              Combo packs — ek sath lein aur bachayein
            </p>
          </div>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
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
        ) : bundles.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] p-10 sm:p-14 flex flex-col items-center text-center">
            <span className="w-14 h-14 rounded-2xl bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
              <PackageOpen size={26} className="text-[var(--user-accent)]" />
            </span>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider mb-1">
              {isError ? "Could not load bundles" : "No bundle deals yet"}
            </h2>
            <p className="text-xs sm:text-[13px] text-[var(--user-text-subtle)] max-w-sm">
              {isError
                ? "Something went wrong. Please try again later."
                : "Jaise hi koi naya combo deal aayega, wo yahan dikhega."}
            </p>
            <Link
              href="/"
              className="mt-5 px-5 h-10 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-black uppercase tracking-wider flex items-center justify-center hover:brightness-110 transition"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {bundles.map((bundle) => (
              <BundleCard key={bundle._id || bundle.id} bundle={bundle} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
