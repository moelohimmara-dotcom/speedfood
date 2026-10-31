import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { lireSupervision } from "@/lib/system-admin/supervision";
import type { EtatService } from "@/lib/system-admin/supervision-regles";
import { EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../SousNav";

export const metadata = { title: "Supervision (administration)" };
// L'état se mesure à chaque ouverture : jamais de page figée en cache.
export const dynamic = "force-dynamic";

const TON: Record<EtatService, "succes" | "attention" | "danger" | "neutre"> = { ok: "succes", degrade: "attention", panne: "danger", inconnu: "neutre" };
const LIBELLE_ETAT: Record<EtatService, string> = { ok: "En marche", degrade: "À surveiller", panne: "En panne", inconnu: "Non utilisé" };

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Conakry" });
}

/**
 * Supervision (lot L13) : l'état des services dont Speedfood dépend et les alertes qui demandent une action, mesurés à l'ouverture de la page.
 * Réservée à `parametres.editer` (propriétaire). Lecture seule : rien n'est modifié depuis cet écran.
 */
export default async function SupervisionPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const rapport = await lireSupervision();

  return (
    <div>
      <PageHeader
        titre="Supervision"
        description="L'état des services dont Speedfood dépend et ce qui demande une action maintenant. Mesuré à l'ouverture de la page."
      />

      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />

      <Panneau titre="Alertes">
        {rapport.alertes.length === 0 ? (
          <EtatVide titre="Rien à signaler" texte="Aucune commande sans réponse, aucun versement échoué, aucun litige en attente." />
        ) : (
          <ul className="u-m-0">
            {rapport.alertes.map((a) => (
              <li key={a.cle}>
                <Pastille ton={a.gravite === "critique" ? "danger" : "attention"}>{a.gravite === "critique" ? "Urgent" : "À voir"}</Pastille> {a.libelle}{" "}
                {a.lien ? (
                  <Link href={a.lien} className="lien-texte">
                    Ouvrir
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre="Services">
        <p className="u-m-0">
          État d&apos;ensemble : <Pastille ton={TON[rapport.global]}>{LIBELLE_ETAT[rapport.global]}</Pastille> · mesuré à {heure(rapport.mesureLe)} (heure de Conakry).
        </p>
        <ul className="u-m-0">
          {rapport.services.map((s) => (
            <li key={s.cle}>
              <strong>{s.libelle}</strong> : <Pastille ton={TON[s.etat]}>{LIBELLE_ETAT[s.etat]}</Pastille> {s.detail}
            </li>
          ))}
        </ul>
      </Panneau>

      <Panneau titre="Ce que cette page ne voit pas">
        <p className="u-m-0">
          Elle voit « le service répond maintenant », pas l&apos;historique : une panne passée n&apos;y apparaît pas. La sauvegarde et la disponibilité 24 h/24 se surveillent depuis le poste de la propriétaire
          (<code>docs/SURVEILLANCE.md</code>). Une surveillance continue demande un service externe, décision non prise.
        </p>
      </Panneau>
    </div>
  );
}
