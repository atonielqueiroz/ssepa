import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme.css";
import { ensureAdminBootstrap } from "@/lib/adminBootstrap";

export const metadata: Metadata = {
  title: "SSEPA",
  description: "Sistema de Simulação de Execuções Penais Avançado",
  icons: {
    icon: "/icon.png?v=2",
  },
};

// Forçar “modo computador” no celular via viewport fixo (renderiza como desktop e exige zoom/pinça)
export const viewport: Viewport = {
  width: 1280,
  initialScale: 0.3,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // bootstrap admin (idempotente)
  await ensureAdminBootstrap();

  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
