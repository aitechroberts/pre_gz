// src/app/layout.tsx
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Navigation } from '@/components/layout/navigation';
import './globals.css';
import { WebSocketProvider } from '@/components/providers/websocket-provider';


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <QueryProvider>
            <WebSocketProvider>
              <Navigation />
              <main>{children}</main>
            </WebSocketProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}