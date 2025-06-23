import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import GlobalErrorAlert from "@/components/GlobalErrorAlert";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POS App",
  description: "Point of Sale Application",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <GlobalErrorAlert />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
