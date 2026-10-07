import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { LIBELLES_ROLES, sousSectionsAccessibles, type RoleSysteme } from "@/lib/system-admin/permissions";
import { listerAccesPaliers } from "@/lib/system-admin/acces-paliers";
import {
  ACTIFS,
  GARDE_PLAFONDS_EN_BASE_VALIDEE,
  PALIERS,
  libelleActif,
  libellePalier,
  paliersPreset,
  actifEstGarde,
  ACTIFS_COUVERTS_EN_APPLICATION,
  type Palier,
} from "@/lib/system-admin/paliers";
import { EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { Alert } from "@/components/ui";
import { SousNav } from "../../SousNav";
import { FormulaireAttributionPalier } from "./FormulaireAttributionPalier";
import { RetraitPalier } from "./RetraitPalier";

export const metadata = { title: "Habilitations (administration)" };

/** Résumé lisible du préréglage d'un rôle, ex. « Contenu : Éditeur · Audit : Observateur ». */
function resumePreset(role: RoleSysteme): string {
  return Object.entries(paliersPreset(role))
    .map(([actif, palier]) => `${libelleActif(actif)} : ${libellePalier(palier)}`)
    .join(" · ");
}

function libelleHabilitation(actif: string, palier: number): string {
  const nom = palier >= 0 && palier <= 5 && Number.isInteger(palier) ? libellePalier(palier as Palier) : "?";
  return `${libelleActif(actif)} · ${nom} (${palier})`;
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

/**
 * Habilitations par paliers (Studio, palier 2 ; modèle Meta Business) : QUI (une personne qui a déjà un rôle système), SUR
 * QUOI (un actif), À QUEL NIVEAU (un palier). Permission `systeme.roles`, donc `super_admin` seulement ; 404 pour les autres.
 * Les actions (`acces-paliers.ts`) revérifient tout côté serveur ; la RLS de `acces_paliers` réserve l'écriture au
 * super administrateur.
 */
export default async function PaliersSystemePage() {
  const contexte = await exigerPermissionPage("systeme.roles");
  const { personnes, lisible } = await listerAccesPaliers();
  const cibles = personnes.filter((p) => p.role !== null && p.role !== "super_admin").map((p) => p.email);

  return (
    <div>
      <PageHeader
        titre="Accès"
        description="Régler finement ce que chaque personne peut faire, espace par espace. Seul un super administrateur modifie ces réglages."
      />
      <SousNav entrees={sousSectionsAccessibles("Accès", contexte.role)} />

      {lisible ? null : (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          Les habilitations n&apos;ont pas pu être lues (la table n&apos;est peut-être pas encore installée). Par prudence, tant
          que cette lecture échoue, les éditeurs ne peuvent plus rien faire dans les Pages, Bannières et Textes du site ; les
          super administrateurs ne sont pas concernés.
        </Alert>
      )}

      <Panneau titre="Comment ça marche" id="paliers-aide">
        <div className="ad-paliers-aide">
          <p>
            Chaque rôle donne déjà un niveau d&apos;accès par défaut (son <strong>préréglage</strong>, affiché plus bas). Une
            habilitation ajuste ce niveau pour une personne, sur un espace précis.
          </p>
          <ul className="ad-paliers-niveaux">
            {PALIERS.map((p) => (
              <li key={p.valeur}>
                <strong>
                  {p.valeur} · {p.libelle}
                </strong>{" "}
                : {p.description}
              </li>
            ))}
          </ul>
          <p>
            <strong>Relèvement</strong> : donne un niveau plus haut que le préréglage. <strong>Accès partiel</strong> : limite
            la personne à ce niveau au plus, même si son rôle permet davantage (par exemple : un éditeur qui peut préparer des
            pages mais pas les mettre en ligne). Une habilitation sur « Contenu » vaut pour Pages, Bannières et Textes ; sur
            « Tout », pour tout. Avec une date d&apos;expiration, elle cesse de compter à la fin de ce jour.
          </p>
          <p className="ad-paliers-garantie">
            {GARDE_PLAFONDS_EN_BASE_VALIDEE ? (
              <>
                <strong>Ce qui est garanti</strong> : l&apos;accès partiel est appliqué par l&apos;administration et par la base de
                données sur les Pages, Bannières et Textes du site, même face à un appel technique direct.
              </>
            ) : (
              <>
                <strong>Ce qui est garanti aujourd&apos;hui</strong> : l&apos;accès partiel est appliqué par l&apos;administration
                (écrans et actions du serveur). La protection équivalente dans la base de données est prête mais pas encore
                installée ni vérifiée : d&apos;ici là, une personne plafonnée qui sait appeler la base directement pourrait le
                contourner. Ne comptez pas encore sur l&apos;accès partiel contre une personne mal intentionnée.
              </>
            )}
          </p>
          <p className="ad-secondaire">
            Limites actuelles : ces réglages ne concernent que les personnes qui ont déjà un rôle système (sans rôle, la console
            reste fermée) et un super administrateur garde toujours le contrôle total. Un relèvement n&apos;ouvre pas un écran
            que le rôle ne permet pas.
          </p>
          <p className="ad-secondaire">
            <strong>Quels espaces tiennent réellement compte d&apos;un palier ?</strong> À ce jour,{" "}
            <strong>{ACTIFS_COUVERTS_EN_APPLICATION.length} espaces sur {ACTIFS.length}</strong> :{" "}
            {ACTIFS_COUVERTS_EN_APPLICATION.map(libelleActif).join(", ")}. Sur les autres, une habilitation peut être enregistrée mais
            n&apos;a <strong>aucun effet</strong> tant qu&apos;aucun contrôle de palier ne s&apos;y applique — seule la permission
            limite l&apos;accès. Les autres espaces sont les candidats naturels pour les paliers suivants.
          </p>
        </div>
      </Panneau>

      <div style={{ marginTop: "var(--space-5)" }}>
        <Panneau titre="Attribuer une habilitation">
          <FormulaireAttributionPalier
            actifs={ACTIFS.map((a) => ({ code: a.code, libelle: a.libelle, garde: actifEstGarde(a.code) }))}
            paliers={PALIERS.filter((p) => p.attribuable).map((p) => ({ valeur: p.valeur, libelle: p.libelle }))}
            suggestions={cibles}
          />
        </Panneau>
      </div>

      <div style={{ marginTop: "var(--space-5)" }}>
        {personnes.length === 0 ? (
          <div className="ad-panneau">
            <EtatVide icone="acces" titre="Personne" texte="Aucun compte n'a de rôle système." />
          </div>
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Personnes ayant un rôle système et leurs habilitations</caption>
              <thead>
                <tr>
                  <th scope="col">Compte</th>
                  <th scope="col">Rôle et préréglage</th>
                  <th scope="col">Habilitations</th>
                </tr>
              </thead>
              <tbody>
                {personnes.map((p) => (
                  <tr key={p.utilisateurId}>
                    <td className="ad-cellule-principale" data-label="Compte" style={{ overflowWrap: "anywhere" }}>
                      <span style={{ fontWeight: 800 }}>{p.email}</span>
                    </td>
                    <td data-label="Rôle et préréglage">
                      <span className="ad-paliers-role">
                        {p.role ? (
                          <>
                            <Pastille ton="neutre">{LIBELLES_ROLES[p.role]}</Pastille>
                            <span className="ad-secondaire">{resumePreset(p.role)}</span>
                          </>
                        ) : (
                          <>
                            <Pastille ton="attention">Aucun rôle système</Pastille>
                            <span className="ad-secondaire">Ses habilitations sont sans effet : vous pouvez les retirer.</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td data-label="Habilitations">
                      {p.role === "super_admin" ? (
                        <span className="ad-secondaire">Contrôle total (aucune habilitation ne s&apos;applique).</span>
                      ) : p.habilitations.length === 0 ? (
                        <span className="ad-secondaire">Aucune : le préréglage s&apos;applique.</span>
                      ) : (
                        <ul className="ad-paliers-habilitations">
                          {p.habilitations.map((h) => (
                            <li key={h.id}>
                              <span className="ad-paliers-habilitation">
                                <Pastille ton={h.plafond ? "attention" : "succes"}>{h.plafond ? "Accès partiel" : "Relèvement"}</Pastille>
                                <span>{libelleHabilitation(h.actif, h.palier)}</span>
                                {h.expireLe ? (
                                  h.expiree ? (
                                    <Pastille ton="neutre">Expirée le {dateCourte(h.expireLe)}</Pastille>
                                  ) : (
                                    <span className="ad-secondaire">jusqu&apos;au {dateCourte(h.expireLe)}</span>
                                  )
                                ) : null}
                              </span>
                              <RetraitPalier id={h.id} description={`${h.plafond ? "l'accès partiel" : "le relèvement"} ${libelleHabilitation(h.actif, h.palier)} de ${p.email}`} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
