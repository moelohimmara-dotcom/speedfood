"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ajouterLivreurRestaurantAction, archiverLivreurRestaurantAction, genererLienLivreurRestaurantAction, type EtatRegistreLivreurs, type ResultatLienLivreur } from "@/lib/livraison/registre-restaurant";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatRegistreLivreurs = {};

export interface LivreurRegistre {
  id: string;
  nom: string;
  telephone: string | null;
  vehicule: string;
  /** Le livreur a déjà activé son compte (il voit ses livraisons dans sa console). */
  compteActive: boolean;
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
  const [lien, setLien] = useState<(ResultatLienLivreur & { ok: true }) | null>(null);
  const [copie, setCopie] = useState(false);

  function envoyerLien(id: string) {
    setMessage(null);
    setLien(null);
    setCopie(false);
    demarrer(async () => {
      const r = await genererLienLivreurRestaurantAction(id);
      if (!r.ok) setMessage(r.message);
      else setLien(r);
    });
  }

  async function copierLien(texte: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
    } catch {
      setMessage("Copie impossible : sélectionnez le lien et copiez-le.");
    }
  }

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
                    {l.compteActive ? " · console activée" : " · pas de console"}
                  </small>
                </span>
                <span className="registre-livreurs-actions">
                  {l.compteActive ? null : (
                    <Button type="button" variante="secondary" disabled={archivage} onClick={() => envoyerLien(l.id)}>
                      Lien d&apos;activation
                    </Button>
                  )}
                  <Button type="button" variante="secondary" disabled={archivage} onClick={() => archiver(l.id, l.nom)}>
                    Archiver
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {message ? <Alert ton="info">{message}</Alert> : null}
        {lien ? (
          <div className="registre-livreurs-lien">
            <p>
              <strong>Lien d&apos;activation pour {lien.nom}</strong> (usage unique, valable jusqu&apos;au {new Date(lien.expireLe).toLocaleDateString("fr-FR", { dateStyle: "long" })}). Il ne s&apos;affichera plus : envoyez-le maintenant.
            </p>
            <p className="registre-livreurs-adresse">{lien.lien}</p>
            <div className="registre-livreurs-actions">
              <a className="btn btn-primary" href={lien.lienWhatsApp} target="_blank" rel="noopener noreferrer">
                Envoyer sur WhatsApp
              </a>
              <Button type="button" variante="secondary" onClick={() => copierLien(lien.lien)}>
                {copie ? "Lien copié" : "Copier le lien"}
              </Button>
            </div>
            <p className="aide-champ">Un nouveau lien annule les précédents. Une fois activée, la console du livreur ne montre que les livraisons de votre restaurant.</p>
          </div>
        ) : null}
      </Card>
    </>
  );
}
