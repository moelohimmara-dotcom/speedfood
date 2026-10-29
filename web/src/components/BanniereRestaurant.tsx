import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie, illustrationCouverture, illustrationLogo } from "@/lib/illustrations/automatique";
import type { Illustration as ModeleIllustration } from "@/lib/illustrations/modele";
import type { TonEtat } from "@/lib/disponibilite/etat";

const COULEUR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Découpe un nom pour mettre ses derniers mots en couleur : « Boulangerie Soleil de Matam » → « Boulangerie Soleil » + « de Matam ».
 * Deux mots : le second est coloré ; un seul mot : aucun accent (un titre entièrement coloré perd son effet).
 */
export function decouperTitre(nom: string): { debut: string; fin: string } {
  const mots = nom.trim().split(/\s+/);
  if (mots.length <= 1) return { debut: nom.trim(), fin: "" };
  const nbFin = mots.length >= 4 ? 2 : 1;
  return { debut: mots.slice(0, mots.length - nbFin).join(" "), fin: mots.slice(mots.length - nbFin).join(" ") };
}

function Icone({ nom }: { nom: "lieu" | "horloge" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {nom === "lieu" ? (
        <>
          <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  );
}

/**
 * En-tête d'un restaurant (fiche publique) : à gauche un grand cadre photo avec le logo, à droite le statut, le nom en grand
 * (ses derniers mots dans la couleur du restaurant), une phrase de contexte, le quartier, les horaires et les actions.
 *
 * Seules des informations réelles y figurent : pas de note, pas de classement. La pastille « menu confirmé » reprend la
 * promesse de fraîcheur de Speedfood (heure de la dernière confirmation d'un plat).
 *
 * Quatre combinaisons d'image sont traitées : photo, sinon illustration de couverture modifiable ; logo, sinon illustration de logo.
 */
export function BanniereRestaurant({
  nom,
  categorie,
  quartier,
  horaires,
  consignes,
  statut,
  photoUrl,
  logoUrl,
  couleurAccent,
  couvertureIllustration,
  logoIllustration,
  menuConfirme,
  children,
}: {
  nom: string;
  categorie: string;
  quartier: string;
  horaires: string;
  consignes?: string | null;
  statut: { texte: string; ton: TonEtat };
  photoUrl: string | null;
  logoUrl: string | null;
  /** Couleur #RRGGBB choisie par le restaurateur pour les derniers mots du nom ; sinon le rouge de la marque. */
  couleurAccent?: string | null;
  couvertureIllustration?: ModeleIllustration | null;
  logoIllustration?: ModeleIllustration | null;
  /** « Menu confirmé il y a 12 min », ou null quand aucun plat n'a été confirmé récemment. */
  menuConfirme?: string | null;
  /** Actions sous le texte (partage). */
  children?: ReactNode;
}) {
  const famille = familleDepuisCategorie(categorie);
  const couverture = couvertureIllustration ?? illustrationCouverture(famille);
  const logoIllustre = logoIllustration ?? illustrationLogo(nom, famille);
  const { debut, fin } = decouperTitre(nom);
  const accent = couleurAccent && COULEUR.test(couleurAccent) ? couleurAccent : undefined;

  return (
    <section className="fh" aria-label={`Présentation de ${nom}`}>
      <div className="fh-cadre">
        <div className="fh-media">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={photoUrl} alt="" />
          ) : (
            <Illustration valeur={couverture} nom="" decoratif />
          )}
        </div>
        <span className="fh-logo" aria-hidden="true">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={logoUrl} alt="" />
          ) : (
            <Illustration valeur={logoIllustre} nom="" decoratif />
          )}
        </span>
        {menuConfirme ? (
          <span className="fh-fraicheur">
            <span className="fh-fraicheur-point" aria-hidden="true" />
            {menuConfirme}
          </span>
        ) : null}
      </div>

      <div className="fh-texte">
        <div className="fh-pastilles">
          <Badge ton={statut.ton}>{statut.texte}</Badge>
          {quartier ? <span className="fh-lieu-tag">À {quartier}</span> : null}
        </div>
        <h1 className="fh-titre">
          {debut}
          {fin ? (
            <>
              {" "}
              <span className="fh-titre-accent" style={accent ? { color: accent } : undefined}>
                {fin}
              </span>
            </>
          ) : null}
        </h1>
        <p className="fh-accroche">{categorie ? `${categorie}${quartier ? ` à ${quartier}` : ""}` : consignes}</p>
        {categorie && consignes ? <p className="fh-consignes">{consignes}</p> : null}
        <ul className="fh-meta">
          {quartier ? (
            <li>
              <Icone nom="lieu" />
              {quartier}, Conakry
            </li>
          ) : null}
          {horaires.trim() ? (
            <li>
              <Icone nom="horloge" />
              {horaires}
            </li>
          ) : null}
        </ul>
        {children ? <div className="fh-actions">{children}</div> : null}
      </div>
    </section>
  );
}
