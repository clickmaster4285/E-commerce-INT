"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/redux/store";
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}