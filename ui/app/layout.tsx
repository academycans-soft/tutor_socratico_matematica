import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open TutorAI LMS · Plataforma Agéntica de Matemática",
  description: "LMS de Próxima Generación con Interfaz Cero Clics y Tutor Socrático",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        />
      </head>
      <body className="antialiased bg-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
