import { PROMESSE_PAR_DEFAUT } from "@/lib/parametres/promesse-defauts";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import "./components.css";
import "./landing.css";
import "./catalogue.css";
import "./marche.css";
import "./cadre.css";
import "./admin.css";
import "./console.css";

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
  title: { default: "Speedfood", template: "%s · Speedfood" },
  description: PROMESSE_PAR_DEFAUT.partage,
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Speedfood", statusBarStyle: "default" },
};

// Sans ceci, les navigateurs mobiles utilisent un viewport de mise en page ~980px
// par défaut et affichent le site dézoomé plutôt qu'à sa taille réelle (bug repéré
// en testant le bloc 6 sur mobile, mais qui touchait déjà toutes les pages).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b82a20",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${barlowCondensed.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
