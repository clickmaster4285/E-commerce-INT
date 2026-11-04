"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { customerChatApi } from "@/apis/chatApi";
import ChatThread from "@/components/chat/ChatThread";
import { useUserSocket } from "@/hooks/user/useUserSocket";

export default function OrderChatPage({ params }) {
  const { id: orderId } = use(params);
  const { socket } = useUserSocket();
  const query = useQuery({ queryKey: ["chat-order", orderId], queryFn: () => customerChatApi.openForOrder(orderId), enabled: Boolean(orderId), retry: 1 });
  const conversation = query.data?.conversation ? { ...query.data, ...query.data.conversation } : query.data;

  return <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-5xl px-4 py-6 pb-24 text-[var(--user-text)] sm:px-6 sm:py-10 sm:pb-10">
    <Link href={`/orders/${orderId}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--user-text-muted)] hover:text-[var(--user-text)]"><ArrowLeft size={16} /> Back to order</Link>
    <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><MessageCircle size={19} /></span><div><h1 className="text-xl font-semibold text-[var(--user-text)]">Order support</h1><p className="text-sm text-[var(--user-text-muted)]">Chat with our team about this order.</p></div></div>
    {query.isLoading ? <div className="flex min-h-80 items-center justify-center text-sm text-[var(--user-text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening your conversation…</div>
      : query.isError ? <div className="rounded-xl border border-[var(--user-danger)]/30 bg-[var(--user-danger)]/10 p-5 text-sm text-[var(--user-danger)]">We couldn’t open support for this order. Please check that you’re signed in and try again.</div>
      : <ChatThread conversation={conversation} api={customerChatApi} socket={socket} />}
  </main>;
}
