import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compresseur d'images et PDF gratuit — sans upload, 100% privé",
  description:
    "Réduisez la taille de vos images (JPG, PNG, WebP) et fichiers PDF gratuitement, directement dans votre navigateur. Aucun fichier envoyé sur un serveur. Rapide, illimité, sans inscription.",
  keywords: [
    "compresser pdf",
    "compresser image",
    "réduire taille pdf",
    "réduire taille image",
    "compresseur pdf gratuit",
    "compress pdf online",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
