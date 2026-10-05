import { PROMESSE_PAR_DEFAUT } from "@/lib/parametres/promesse-defauts";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import "./components.css";
import "./landing.css";
import "./catalogue.css";
import "./marche.css";
import "./cadre.css";
import "./public.css";
import "./public-pages.css";
import "./public-info.css";
import "./public-mouvement.css";
import "./fiche-refonte.css";
import "./controles.css";
import "./paiement.css";
import "./affiche.css";
import "./documents.css";
import "./public-segments.css";
import "./admin.css";
import "./console-resto.css";
import "./console.css";
import "./console-b.css";
import "./fantaisie.css";
import "./boucles.css";
import "./vecteurs.css";
import "./decouverte-b.css";
import { FichiersAnimes } from "@/components/FichiersAnimes";

// next/font auto-héberge les polices au build (aucune requête vers Google Fonts au runtime) :
// répond à la note performance de DESIGN-SYSTEM.md sur le coût des données mobiles à Conakry.
// Pas de préchargement : les titres de la direction B utilisent Bricolage ; Barlow ne sert plus que sur quelques écrans (revue du 5 octobre).
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Titres du site public (direction B, décision du 4 octobre 2026). Pas de préchargement : le fichier n'est téléchargé que
// par les pages dont le CSS l'utilise (site public), jamais par la console.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
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
    <html lang="fr" className={`${barlowCondensed.variable} ${manrope.variable} ${bricolage.variable}`}>
      <body>
        {children}
        <FichiersAnimes />
      </body>
    </html>
  );
}
