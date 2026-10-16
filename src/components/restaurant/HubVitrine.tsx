import Link from "next/link";
import { IconeAdmin } from "@/components/admin/icones";
import { motHub, type CleCarteHub, type ResumeHub } from "@/lib/restaurant/hub";

/** Une carte du hub : où elle mène, son titre, sa phrase, son icône (jeu d'icônes de la console). */
const CARTES: Record<CleCarteHub, { href: string; titre: string; texte: string; icone: string }> = {
  page: { href: "/restaurant/profil/page-publique", titre: "Ma page publique et mon paiement", texte: "Photo, logo, horaires, consignes, moyens de paiement", icone: "boutique" },
  zones: { href: "/restaurant/profil/zones", titre: "Où je suis, où je livre", texte: "Votre quartier et vos zones de livraison", icone: "catalogue" },
  affiche: { href: "/restaurant/affiche", titre: "Affiche et QR", texte: "À coller en vitrine et sur les tables", icone: "contenu" },
  documents: { href: "/restaurant/documents", titre: "Reçus et factures", texte: "Votre nom sur chaque document", icone: "commandes" },
  securite: { href: "/compte/securite", titre: "Sécurité du compte", texte: "Mot de passe, double authentification", icone: "securite" },
};
const ORDRE: CleCarteHub[] = ["page", "zones", "affiche", "documents", "securite"];

/** La vitrine du hub « Mon restaurant » : auvent, carte à tampons, cartes à autocollants. Purement visuel : reçoit des données déjà calculées (`etatsHub`). */
export function HubVitrine({ nom, publie, restaurantId, resume }: { nom: string; publie: boolean; restaurantId: string; resume: ResumeHub }) {
  const cartes = new Map(resume.cartes.map((c) => [c.cle, c]));
  return (
      <div className="hub-vitrine">
        <div className="hub-auvent" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="hub-corps">
          <h2 className="hub-nom">{nom}</h2>
          <p className="hub-mot">{motHub(resume.pretes, resume.total)}</p>
          <div className="hub-tampons" role="img" aria-label={`${resume.pretes} réglage${resume.pretes > 1 ? "s" : ""} prêt${resume.pretes > 1 ? "s" : ""} sur ${resume.total}`}>
            {Array.from({ length: resume.total }, (_, i) => (
              <span key={i} className={`hub-tampon${i < resume.pretes ? " fait" : ""}`}>
                {i < resume.pretes ? <IconeAdmin nom="coche" taille={16} /> : null}
              </span>
            ))}
            <span className="hub-tampons-texte">
              <strong>
                {resume.pretes} tampon{resume.pretes > 1 ? "s" : ""} sur {resume.total}
              </strong>
              <br />
              {resume.pretes === resume.total ? "Rien à compléter" : `${resume.total - resume.pretes} à compléter`}
            </span>
          </div>

          <ul className="hub-liste">
            {ORDRE.map((cle) => {
              const carte = CARTES[cle];
              const etat = cartes.get(cle);
              return (
                <li key={cle}>
                  <Link href={carte.href} className="hub-carte">
                    <span className="hub-icone" aria-hidden="true">
                      <IconeAdmin nom={carte.icone} taille={20} />
                    </span>
                    <span className="hub-texte">
                      <span className="hub-titre">{carte.titre}</span>
                      <span className="hub-sous-titre">{carte.texte}</span>
                    </span>
                    {etat?.etiquette ? <span className={`hub-autocollant ${etat.etat === "pret" ? "pret" : "a-completer"}`}>{etat.etiquette}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="hub-pied">
            <Link href={`/restaurants/${restaurantId}`} className="lien-texte" target="_blank" rel="noopener noreferrer">
              {publie ? "Voir ma page publique" : "Aperçu de ma page"} ↗<span className="sr-only"> (nouvel onglet)</span>
            </Link>
          </p>
        </div>
      </div>
  );
}
