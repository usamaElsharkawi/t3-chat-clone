"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import UserButton from "@/modules/authentication/components/user-button";
import { PlusIcon, SearchIcon, EllipsisIcon, Trash, MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";
import { isToday, isYesterday, isWithinInterval, subDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "next/navigation";
import { useGetChats, useDeleteChat } from "@/modules/chat/hooks/use-chats";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

function groupChatsByDate(chats: any) {
  const groups: { today: any[]; yesterday: any[]; lastWeek: any[]; older: any[] } = { today: [], yesterday: [], lastWeek: [], older: [] };
  const now = new Date();

  if (!chats || !Array.isArray(chats)) return groups;

  chats.forEach((chat) => {
    try {
      const chatDate = chat.createdAt;
      const date = typeof chatDate === "string" ? new Date(chatDate) : chatDate;

      if (isToday(date)) {
        groups.today.push(chat);
      } else if (isYesterday(date)) {
        groups.yesterday.push(chat);
      } else if (isWithinInterval(date, { start: subDays(now, 7), end: now })) {
        groups.lastWeek.push(chat);
      } else {
        groups.older.push(chat);
      }
    } catch (error) {
      console.error("Error processing chat date:", error, chat);
      groups.older.push(chat);
    }
  });

  return groups;
}

const DATE_GROUPS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "lastWeek", label: "Last 7 Days" },
  { key: "older", label: "Older" },
];

function ChatItem({ chat, isActive, onDelete }: any) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={`/chat/${chat.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
        "hover:bg-sidebar-accent hover:shadow-sm",
        isActive && "bg-sidebar-accent shadow-sm border border-sidebar-border/50"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
        isActive 
          ? "bg-primary/10 text-primary" 
          : "bg-sidebar-accent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
      )}>
        <MessageSquare className="h-4 w-4" />
      </div>

      {/* Title */}
      <span className={cn(
        "truncate flex-1 transition-colors duration-200",
        isActive 
          ? "text-sidebar-foreground font-medium" 
          : "text-muted-foreground group-hover:text-sidebar-foreground"
      )}>
        {chat.title}
      </span>

      {/* Actions */}
      <div className={cn(
        "opacity-0 transition-opacity duration-200",
        (isHovered || isActive) && "opacity-100"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 hover:bg-sidebar-accent-foreground/10 transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                <EllipsisIcon className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
              onClick={(e) => onDelete(e, chat.id)}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}

function ChatGroup({ label, chats, activeChatId, onDelete }: any) {
  if (chats.length === 0) return null;

  return (
    <div className="mb-6 animate-in fade-in duration-300">
      <div className="mb-2.5 px-3 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
        {label}
      </div>
      <div className="space-y-1">
        {chats.map((chat: any) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === activeChatId}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function ChatSidebar({ user }: any) {
  const pathname = usePathname();
  const activeChatId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: result, isPending } = useGetChats();
  const { mutateAsync: deleteChat } = useDeleteChat();
  const chats = result?.success ? result.data : [];

  const filteredChats = () => {
    if (!chats || !Array.isArray(chats)) return [];
    if (!searchQuery) {
      return chats;
    }
    const query = searchQuery.toLowerCase();
    return chats.filter(
      (chat: any) =>
        chat.title.toLowerCase().includes(query) ||
        chat.messages?.some((message: any) =>
          message.content.toLowerCase().includes(query),
        ),
    );
  };

  const groupedChats = useMemo(() => {
    const filtered = filteredChats();
    return groupChatsByDate(filtered);
  }, [searchQuery, chats]);


  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteChat({ chatId });
      toast.success("Chat deleted");
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  return (
    <aside className="flex h-full w-67 flex-col border-r border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-sidebar-border/80 px-4 py-3">
        <Image src="/logo.svg" alt="Logo" width={100} height={100} priority />
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Link href="/" className="block">
          <Button className="w-full h-10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <PlusIcon className="h-4 w-4" />
            New Chat
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative group">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 pr-9 h-10 bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent focus:bg-sidebar-accent transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
        {isPending ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : !chats?.length ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-sidebar-accent flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No chats found" : "No conversations yet"}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground/60">
                Start a new chat to begin
              </p>
            )}
          </div>
        ) : (
          DATE_GROUPS.map((group) => (
            <ChatGroup
              key={group.key}
              label={group.label}
              chats={groupedChats[group.key as keyof typeof groupedChats]}
              activeChatId={activeChatId}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border/80 bg-sidebar/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
          <UserButton user={user} />
          <span className="flex-1 text-sm text-sidebar-foreground/80 truncate">
            {user.email}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default ChatSidebar;
