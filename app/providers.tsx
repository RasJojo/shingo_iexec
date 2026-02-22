"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { EvmWalletProvider } from "@/lib/evm/wallet";
import { ThemeProvider } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <EvmWalletProvider>{children}</EvmWalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
