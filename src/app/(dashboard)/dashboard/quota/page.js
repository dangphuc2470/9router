import { Suspense } from "react";
import Link from "next/link";
import { CardSkeleton } from "@/shared/components/Loading";
import ProviderLimits from "../usage/components/ProviderLimits";

export default function QuotaPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/10 via-surface to-surface border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-2xl">tablet_mac</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-main">Tablet Quota & Console Monitor</h3>
            <p className="text-xs text-text-muted">Open the Apple Turing-style live monitor & event stream for your tablet or external screen.</p>
          </div>
        </div>
        <Link
          href="/monitor"
          target="_blank"
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
        >
          <span>Open Monitor</span>
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        </Link>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <ProviderLimits />
      </Suspense>
    </div>
  );
}
