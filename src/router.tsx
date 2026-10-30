import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getAppScrollRestorationKey } from "@/lib/order-scroll";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    getScrollRestorationKey: getAppScrollRestorationKey,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
