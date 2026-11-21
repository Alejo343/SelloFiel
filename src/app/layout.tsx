import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';

import './globals.css';

/**
 * Las mismas dos familias que sellofiel.app: Fraunces para los títulos, que da
 * el carácter de "sello", e Inter para el texto, que se lee bien en pantallas
 * chicas.
 *
 * `next/font` las descarga al compilar y las sirve desde nuestro propio
 * servidor: ninguna visita del cliente toca los servidores de Google, que es
 * mejor para su privacidad y para la velocidad del tap.
 */
const fuenteDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--fuente-display',
  display: 'swap',
});

const fuenteSans = Inter({
  subsets: ['latin'],
  variable: '--fuente-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sello Fiel',
  description: 'Tu tarjeta de sellos digital',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f3eee5',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${fuenteDisplay.variable} ${fuenteSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
