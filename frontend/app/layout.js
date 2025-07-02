import "../src/index.css";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-gradient-to-br from-blue-50 to-blue-100 min-h-screen">
          <nav className="w-full bg-white shadow mb-8">
            <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-6">
                <Link href="/" className="text-xl font-bold text-blue-700 hover:text-blue-900 transition">RemoteSync</Link>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium transition">Dashboard</Link>
              </div>
            </div>
          </nav>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
} 