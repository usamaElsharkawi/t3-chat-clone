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
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        router.push(`/chat/${data.data.id}?autoTrigger=true`);
        toast.success("Chat created successfully");
      }
    },

    onError: (error: any) => {
      toast.error(error?.message);
    },
  });
};

export const useDeleteChat = (chatId: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => deleteChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      router.push("/");
    },
    onError: () => {
      toast.error("Failed to delete chat");
    },
  });
};
