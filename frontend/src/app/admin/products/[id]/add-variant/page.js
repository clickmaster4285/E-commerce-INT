"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import VariantForm from "@/components/admin/VariantForm";

function AddVariantPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  return <VariantForm productId={params?.id} editVariantId={searchParams.get("edit")} returnTab={searchParams.get("tab")} />;
}

export default function AddVariantPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
        <div className="rounded-xl py-10 px-14 flex flex-col items-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Loading...</span>
        </div>
      </div>
    }>
      <AddVariantPageInner />
    </Suspense>
  );
}
