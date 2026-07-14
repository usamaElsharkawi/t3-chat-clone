"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import UserButton from "@/modules/authentication/components/user-button";
import { PlusIcon, SearchIcon, EllipsisIcon, Trash } from "lucide-react";
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

function ChatSidebar({user}:any) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <aside className="flex h-full w-67 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center border-b border-sidebar-border px-4 py-3">
        <Image src="/logo.svg" alt="Logo" width={100} height={100} />
      </div>

      <div className="p-4">
        <Button className="w-full">
          <Link
            className="flex flex-row justify-center items-center gap-x-2"
            href="/"
          >
            <PlusIcon />
            New Chat
          </Link>
        </Button>
      </div>
      <div className="px-4 pb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your threads..."
            className="pl-9 pr-8 bg-sidebar-accent border-sidebar-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2"></div>
      {/* footer */}
      <div className="  p-4 flex items-center gap-3 border-t border-sidebar-border">
        <UserButton user={user} />
        <span className="flex-1 text-sm text-sidebar-foreground truncate">
          {user.email}
        </span>
      </div>


    </aside>
  );
}

export default ChatSidebar;
