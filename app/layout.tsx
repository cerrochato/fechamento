import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/lib/contexto';
import RegistrarSW from '@/components/RegistrarSW';

export const metadata: Metadata = { title: 'Fechamento', description: 'Gestão das estâncias', manifest: '/manifest.webmanifest', icons: { icon: '/icone.svg', apple: '/icone.svg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2f5d3a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegistrarSW />
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
