"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ajouterLivreurRestaurantAction, archiverLivreurRestaurantAction, type EtatRegistreLivreurs } from "@/lib/livraison/registre-restaurant";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatRegistreLivreurs = {};

export interface LivreurRegistre {
  id: string;
  nom: string;
  telephone: string | null;
  vehicule: string;
}

const LIBELLES_VEHICULE: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture", pied: "À pied" };

/** « Mes livreurs » : les personnes qui livrent pour VOTRE restaurant uniquement. Elles ne reçoivent jamais de course d'un autre restaurant. */
export function RegistreLivreurs({ livreurs }: { livreurs: LivreurRegistre[] }) {
  const router = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);
  const [etat, action, enCours] = useActionState(
    async (precedent: EtatRegistreLivreurs, donnees: FormData) => {
      const r = await ajouterLivreurRestaurantAction(precedent, donnees);
      if (r.succes) formulaire.current?.reset();
      return r;
    },
    etatInitial
  );
  const [message, setMessage] = useState<string | null>(null);
  const [archivage, demarrer] = useTransition();

  function archiver(id: string, nom: string) {
    setMessage(null);
    demarrer(async () => {
      const r = await archiverLivreurRestaurantAction(id);
      if (!r.ok) setMessage(r.message);
      else {
        setMessage(`${nom} est archivé.`);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Card>
        <h2 className="profil-bloc-titre">Ajouter un livreur</h2>
        <form ref={formulaire} action={action} className="registre-livreurs-formulaire">
          <div className="field">
            <label htmlFor="liv-nom">Nom</label>
            <input id="liv-nom" name="nom" required minLength={2} maxLength={80} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="liv-tel">Téléphone</label>
            <input id="liv-tel" name="telephone" inputMode="tel" required autoComplete="off" placeholder="622 00 00 00" />
          </div>
          <div className="field">
            <label htmlFor="liv-vehicule">Véhicule</label>
            <select id="liv-vehicule" name="vehicule" defaultValue="moto">
              <option value="moto">Moto</option>
              <option value="velo">Vélo</option>
              <option value="voiture">Voiture</option>
              <option value="pied">À pied</option>
            </select>
          </div>
          <Button type="submit" disabled={enCours}>
            {enCours ? "Ajout…" : "Ajouter"}
          </Button>
        </form>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
        <p className="aide-champ">
          Ce sont des personnes que vous connaissez et qui livrent seulement pour vous. Speedfood ne les a pas vérifiées : elles ne reçoivent jamais de course d&apos;un autre restaurant,
          et vous choisissez vous-même celle qui livre chaque commande.
        </p>
      </Card>

      <Card>
        <h2 className="profil-bloc-titre">Mes livreurs ({livreurs.length})</h2>
        {livreurs.length === 0 ? (
          <p className="aide-champ">Aucun livreur pour le moment. Ajoutez-en un ci-dessus : vous pourrez ensuite l&apos;affecter à une commande en livraison.</p>
        ) : (
          <ul className="registre-livreurs-liste">
            {livreurs.map((l) => (
              <li key={l.id} className="registre-livreurs-ligne">
                <span>
                  <strong>{l.nom}</strong>
                  <small>
                    {" "}
                    · {LIBELLES_VEHICULE[l.vehicule] ?? l.vehicule}
                    {l.telephone ? ` · ${l.telephone}` : ""}
                  </small>
                </span>
                <Button type="button" variante="secondary" disabled={archivage} onClick={() => archiver(l.id, l.nom)}>
                  Archiver
                </Button>
              </li>
            ))}
          </ul>
        )}
        {message ? <Alert ton="info">{message}</Alert> : null}
      </Card>
    </>
  );
}
