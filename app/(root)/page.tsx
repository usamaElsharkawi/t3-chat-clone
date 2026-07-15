import { getCurrentUser } from "@/modules/authentication/actions";
import UserButton from "@/modules/authentication/components/user-button"
import ChatMessageView from "@/modules/chat/components/chat-view/chat-message-view";

export default async function Home() {
  const user = await getCurrentUser()
  return (
    <>
    <ChatMessageView user={user}/>
    </>
  );
}