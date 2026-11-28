import Link from "next/link";
import { continuerAvecGoogleAction } from "@/lib/client/actions";

/**
 * « Continuer avec Google » : crée le compte client au premier passage, connecte ensuite. La destination `suite` (par exemple /commande) est gardée
 * jusqu'au retour de Google. N'apparaît que si l'équipe a activé la connexion Google (réglage `connexion_google_active`), vérifié aussi par l'action.
 */
export function ContinuerAvecGoogle({ suite, mention = true }: { suite: string; mention?: boolean }) {
  return (
    <form action={continuerAvecGoogleAction} className="entrer-formulaire">
      <input type="hidden" name="suite" value={suite} />
      <button type="submit" className="btn btn-google btn-block">
        Continuer avec Google
      </button>
      {mention ? (
        <p className="aide-champ inscription-mention">
          En continuant, vous acceptez que Speedfood garde votre pseudo, votre avatar et l&apos;identifiant de votre compte Google. Speedfood reçoit votre
          nom et votre adresse e-mail, jamais vos contacts ni vos messages. Détails sur la page{" "}
          <Link href="/confidentialite" className="lien-texte">
            Confidentialité
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
