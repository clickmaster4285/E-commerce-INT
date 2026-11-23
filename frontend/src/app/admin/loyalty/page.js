"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Settings2, Users } from "lucide-react";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { useTranslation } from "@/i18n/LanguageProvider";
import MembersTab from "./_components/MembersTab";
import HistoryTab from "./_components/HistoryTab";
import SettingsTab from "./_components/SettingsTab";
import MemberDrawer from "./_components/MemberDrawer";

const TABS = [
  { id: "settings", icon: Settings2 },
  { id: "members", icon: Users },
  { id: "history", icon: History },
];
const isTab = (v) => TABS.some((x) => x.id === v);

export default function LoyaltyPage() {
  const { t, dir } = useTranslation();
  const [tab, setTab] = useState("settings");
  const [memberId, setMemberId] = useState(null);

  // ?tab= URL ke saath sync — refresh / back button par wahi tab
  useEffect(() => {
    const read = () => {
      const v = new URLSearchParams(window.location.search).get("tab");
      setTab(isTab(v) ? v : "settings");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const go = useCallback((next) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState({}, "", url);
  }, []);

  const closeMember = useCallback(() => setMemberId(null), []);

  return (
    <div dir={dir} className="min-h-full space-y-4 text-[var(--text-primary)]">
      <AdminPageHeader title={t("admin.loyalty.title")} subtitle={t("admin.loyalty.subtitle")} />

      <div role="tablist" aria-label={t("admin.loyalty.title")} className="flex gap-1 overflow-x-auto border-b border-[var(--border-color)] [scrollbar-width:none]">
        {TABS.map(({ id, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} type="button" role="tab" aria-selected={active} onClick={() => go(id)}
              className={`relative inline-flex h-10 shrink-0 items-center gap-2 px-3 text-[13px] font-semibold transition ${active ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
              <Icon size={15} aria-hidden="true" />
              {t(`admin.loyalty.tab.${id}`)}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />}
            </button>
          );
        })}
      </div>

      {tab === "members" && <MembersTab onOpenMember={setMemberId} />}
      {tab === "history" && <HistoryTab onOpenMember={setMemberId} />}
      {tab === "settings" && <SettingsTab />}

      <MemberDrawer key={memberId || "none"} userId={memberId} onClose={closeMember} />
    </div>
  );
}
