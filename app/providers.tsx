"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { EvmWalletProvider } from "@/lib/evm/wallet";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <EvmWalletProvider>{children}</EvmWalletProvider>
    </QueryClientProvider>
  );
}
