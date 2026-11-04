import CustomerChatsPage from "../page";

export default async function CustomerChatConversationPage({ params }) {
  const { conversationId } = await params;
  return <CustomerChatsPage key={conversationId} initialConversationId={conversationId} />;
}
