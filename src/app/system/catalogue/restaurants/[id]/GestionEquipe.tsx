"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  inviterEquipierAction,
  revoquerEquipierAction,
  type EtatActionCompte,
  type MembreRestaurant,
} from "@/lib/system-admin/comptes";
import { Button, Alert, Badge } from "@/components/ui";

const etatInitial: EtatActionCompte = {};

const LIBELLES_ROLE_MEMBRE: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Équipier",
};

/**
 * Équipe du restaurant : la liste des membres, le retrait d'un équipier (fenêtre du design system, pas une demande
 * native du navigateur) et l'ajout d'un équipier à partir d'un compte existant.
 */
export function GestionEquipe({
  restaurantId,
  membres,
}: {
  restaurantId: string;
  membres: MembreRestaurant[];
}) {
  const [etat, action, enCours] = useActionState(inviterEquipierAction, etatInitial);
  const [enTransition, demarrerTransition] = useTransition();
  const [aRetirer, setARetirer] = useState<MembreRestaurant | null>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [erreurRetrait, setErreurRetrait] = useState<string | null>(null);

  return (
    <div>
      {membres.length === 0 ? (
        <p className="ad-aide-champ">Aucun membre : personne ne peut recevoir les commandes de ce restaurant.</p>
      ) : (
        <ul className="ad-equipe">
          {membres.map((m) => (
            <li key={m.utilisateur_id} className="ad-equipe-membre">
              <span className="ad-equipe-identite">
                <span className="ad-equipe-email">{m.email}</span>{" "}
                <Badge ton="neutre">{LIBELLES_ROLE_MEMBRE[m.role] ?? m.role}</Badge>
              </span>
              {m.role === "manager" ? (
                <Button
                  type="button"
                  variante="danger"
                  className="ad-action-discrete"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setARetirer(m);
                    setErreurRetrait(null);
                    dialogue.current?.showModal();
                  }}
                >
                  Retirer
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <dialog ref={dialogue} className="ad-dialogue" aria-labelledby="titre-retrait-equipier">
        <div className="ad-dialogue-corps">
          <h2 id="titre-retrait-equipier">Retirer cet équipier ?</h2>
          {aRetirer ? (
            <Alert ton="info">
              <strong>{aRetirer.email}</strong> perdra accès à la console de ce restaurant. Ses commandes déjà passées
              restent inchangées. Le propriétaire n&apos;est jamais retiré depuis cette fiche.
            </Alert>
          ) : null}
          {erreurRetrait ? <Alert ton="danger">{erreurRetrait}</Alert> : null}
          <div className="ad-dialogue-actions">
            <Button
              type="button"
              variante="secondary"
              onClick={() => {
                dialogue.current?.close();
                setARetirer(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variante="danger"
              disabled={enTransition || !aRetirer}
              onClick={() => {
                if (!aRetirer) return;
                demarrerTransition(async () => {
                  const resultat = await revoquerEquipierAction(restaurantId, aRetirer.utilisateur_id);
                  if (resultat?.erreur) {
                    setErreurRetrait(resultat.erreur);
                    return;
                  }
                  dialogue.current?.close();
                  setARetirer(null);
                });
              }}
            >
              {enTransition ? "Retrait…" : "Retirer de l'équipe"}
            </Button>
          </div>
        </div>
      </dialog>

      <form action={action} className="ad-equipe-ajout">
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <div className="field">
          <label htmlFor="email-equipier">Ajouter un équipier (adresse d&apos;un compte existant)</label>
          <input
            id="email-equipier"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">Équipier ajouté.</Alert> : null}
        <Button type="submit" disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </form>
    </div>
  );
}