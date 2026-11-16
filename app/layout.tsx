import type { ReactNode } from "react";

export const metadata = {
  title: "Preços x Mercado | Óticas Foto Paulo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f6f7f9",
          color: "#1b1f23",
        }}
      >
        {children}
      </body>
    </html>
  );
}
