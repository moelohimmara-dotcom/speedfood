import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import "./components.css";

// next/font auto-héberge les polices au build (aucune requête vers Google Fonts au runtime) :
// répond à la note performance de DESIGN-SYSTEM.md sur le coût des données mobiles à Conakry.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  weight: ["700", "800"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Speedfood",
  description: "Découvrez et commandez chez vos restaurants préférés à Conakry.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${barlowCondensed.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
