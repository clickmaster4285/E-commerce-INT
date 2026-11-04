"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquareText, Search } from "lucide-react";
import { adminChatApi } from "@/apis/chatApi";
import { getAdminSocket } from "@/hooks/admin/useAdminSocket";
import ChatThread from "@/components/chat/ChatThread";
import { useTranslation } from "@/i18n/LanguageProvider";

const FILTER_KEYS = ["all", "unread", "open", "closed"];

function initials(name = "Customer") {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
}

function relativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  if (!Number.isFinite(delta)) return "";
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 604_800_000) return `${Math.floor(delta / 86_400_000)}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AdminChatsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const { t } = useTranslation();
  const FILTERS = FILTER_KEYS.map((key) => ({ key, label: t(`chat.admin.${key}`) }));
  const queryClient = useQueryClient();
  const socket = getAdminSocket();

  const conversationsQuery = useQuery({
    queryKey: ["chat-conversations", filter, search],
    queryFn: () => adminChatApi.list({ status: filter, search: search.trim(), limit: 50 }),
  });
  const conversations = useMemo(() => conversationsQuery.data?.data || [], [conversationsQuery.data]);
  const countsQuery = useQuery({
    queryKey: ["chat-counts"],
    queryFn: async () => {
      const params = { limit: 1 };
      const results = await Promise.all(FILTERS.map(({ key }) => adminChatApi.list({ ...params, status: key })));
      return Object.fromEntries(FILTERS.map(({ key }, index) => [key, results[index].pagination?.total || 0]));
    },
  });
  const selected = useMemo(() => conversations.find((item) => String(item._id) === String(selectedId)) || null, [conversations, selectedId]);
  const activeConversation = selected || conversations[0] || null;
  const activeId = activeConversation?._id;

  useEffect(() => {
    if (!socket) return undefined;
    const joinInbox = () => socket.emit("chat:inbox:join");
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-counts"] });
    };
    socket.on("connect", joinInbox);
    socket.on("chat:conversation-created", refresh);
    socket.on("chat:conversation-updated", refresh);
    socket.on("chat:unread-count", refresh);
    if (socket.connected) joinInbox();
    return () => {
      socket.off("connect", joinInbox);
      socket.off("chat:conversation-created", refresh);
      socket.off("chat:conversation-updated", refresh);
      socket.off("chat:unread-count", refresh);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (activeId && activeConversation?.unread_admin_count) {
      adminChatApi.markRead(activeId)
        .then(() => queryClient.invalidateQueries({ queryKey: ["chat-conversations"] }))
        .catch(() => {});
    }
  }, [activeId, activeConversation?.unread_admin_count, queryClient]);

  return (
    <main className="admin-chat-page flex h-full min-h-0 w-full flex-col">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(9rem,0.35fr)_minmax(0,1fr)] gap-2.5 overflow-hidden lg:grid-cols-[350px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-none border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-[#101b2e]">
          <div className="shrink-0 border-b border-slate-100 px-3.5 pb-3.5 pt-3 dark:border-slate-700">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><MessageSquareText size={18} strokeWidth={2.2} /></span>
              <div className="min-w-0"><h1 className="text-base font-bold leading-tight text-slate-900 dark:text-slate-100">{t("chat.admin.title")}</h1><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t("chat.admin.inbox")}</p></div>
            </div>
            <label className="flex h-10 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-[#16233b] dark:focus-within:ring-blue-900">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("chat.admin.search")} className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </label>
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {FILTERS.map((item) => {
                const active = filter === item.key;
                const count = countsQuery.data?.[item.key];
                return <button key={item.key} onClick={() => setFilter(item.key)} className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold transition sm:text-xs ${active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#1c2941] dark:text-slate-300 dark:hover:bg-slate-700"}`}>
                  <span>{item.label}</span>{typeof count === "number" && <span className={active ? "text-blue-100" : "text-slate-400 dark:text-slate-500"}>({count})</span>}
                </button>;
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
              : conversationsQuery.isError ? <p className="px-4 py-10 text-center text-sm text-red-600 dark:text-rose-300">{t("chat.admin.loadError")}</p>
                : conversations.length === 0 ? <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("chat.admin.none")}</p>
                  : conversations.map((item) => {
                    const name = item.guest_name || item.customer?.name || item.guest_email || item.customer?.email || "Customer";
                    const active = String(activeId) === String(item._id);
                    return <button key={item._id} onClick={() => setSelectedId(item._id)} className={`relative block w-full border-b border-slate-100 px-3.5 py-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${active ? "bg-blue-50/70 dark:bg-blue-950/50" : "bg-white dark:bg-[#101b2e]"}`}>
                      {active && <span className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-blue-600" />}
                      <div className="flex items-start gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{initials(name)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{name}</span>
                            <time className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{relativeTime(item.last_message_at)}</time>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-300">{item.order?.order_number ? `Order #${item.order.order_number}` : item.inquiry_context?.label || ({ product: "Product question", cart: "Cart question", general: "General support chat" }[item.inquiry_type] || "General support chat")}</span>
                          <span className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{item.last_message || "Conversation started"}</span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "open" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{item.status === "open" ? "Open" : "Closed"}</span>
                              {item.unread_admin_count > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">{item.unread_admin_count}</span>}
                            </span>
                          </span>
                        </span>
                      </div>
                    </button>;
                  })}
          </div>
        </aside>

        <div className="h-full min-h-0 min-w-0 overflow-hidden">
          {activeConversation
            ? <ChatThread key={activeConversation._id} conversation={activeConversation} api={adminChatApi} socket={socket || getAdminSocket()} isAdmin />
            : <div className="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#101b2e] dark:text-slate-400">{t("chat.customer.selectConversation")}</div>}
        </div>
      </div>
    </main>
  );
}
