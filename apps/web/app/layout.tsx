import type { Metadata } from "next";
import "./globals.css";
import { ApolloClientProvider } from "@/lib/apollo";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Underdog Initiative Aquaponics Monitoring",
  description: "MVP aquaponics site health dashboard"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthSessionProvider session={session}>
          <ThemeProvider>
            <ApolloClientProvider>{children}</ApolloClientProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
