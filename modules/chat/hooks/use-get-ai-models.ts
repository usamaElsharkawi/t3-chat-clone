import { useQuery } from "@tanstack/react-query";

export const useGetAiModels = () => {
  return useQuery({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const response = await fetch("/api/ai/get-models");
      return response.json();
    },
  });
};
