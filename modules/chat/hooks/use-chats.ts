import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createChatWithMessage,
  getAllChats,
  getChatById,
  deleteChat,
} from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export const useGetChats = () => {
  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => await getAllChats(),
  });
};

export const useGetChatById = (chatId: string) => {
  return useQuery({
    queryKey: ["chats", chatId],
    queryFn: async () => await getChatById(chatId),
  });
};

export const useCreateChat = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      content,
      model,
    }: {
      content: string;
      model: string;
    }) => await createChatWithMessage(content, model),
    onSuccess: (data: any) => {
      if (data.success && data.data) {
        // 1. Invalidate the chat list to ensure sidebar updates
        queryClient.invalidateQueries({ queryKey: ["chats"] });

        // 2. OPTIMISTIC: Set the new chat directly in cache for instant UI
        // This prevents the "disappearing message" issue when navigating away
        queryClient.setQueryData(["chats", data.data.id], {
          success: true,
          data: data.data,
        });

        router.push(`/chat/${data.data.id}?autoTrigger=true`);
        toast.success("Chat created successfully");
      }
    },

    onError: (error: any) => {
      toast.error(error?.message);
    },
  });
};

export const useDeleteChat = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ chatId }: { chatId: string }) => deleteChat(chatId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      // If the user is on the deleted chat's page, redirect home
      const currentPath = window.location.pathname;
      if (currentPath === `/chat/${variables.chatId}`) {
        router.push("/");
      }
    },
    onError: () => {
      toast.error("Failed to delete chat");
    },
  });
};
