"use client";

import { useActionState } from "react";
import { modifierProfilAction, type EtatFormulaireProfil } from "@/lib/restaurant/actions";
import { Button, Alert, Card } from "@/components/ui";
import { SelecteurCouleur } from "./SelecteurCouleur";

const etatInitial: EtatFormulaireProfil = {};

/**
 * Deux blocs (identité visuelle, puis horaires et consignes) dans un seul formulaire, avec une barre
 * d'enregistrement collée en bas de l'écran : on modifie ce qu'on veut, le bouton reste toujours à portée.
 */
export function FormulaireProfil({
  horaires,
  consignes,
  photoUrl,
  logoUrl,
  couleurAccent,
}: {
  horaires: string;
  consignes: string;
  photoUrl: string | null;
  logoUrl: string | null;
  couleurAccent: string | null;
}) {
  const [etat, action, enCours] = useActionState(modifierProfilAction, etatInitial);

  return (
    <form action={action} className="profil-formulaire">
      <Card>
        <h2 className="profil-bloc-titre">Identité visuelle</h2>
        <div className="champs-ligne profil-medias">
          <div className="field depot-photo">
            <label htmlFor="photo">Photo de couverture</label>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
              <img src={photoUrl} alt="Photo de couverture actuelle" className="profil-media-couverture" />
            ) : null}
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
            <p className="aide-champ">
              Affichée en haut de votre fiche publique. Format conseillé 3/2 (ex. 1200 × 800). JPEG, PNG ou WebP, 5 Mo
              maximum. Laissez vide pour garder la photo actuelle.
            </p>
          </div>
          <div className="field depot-photo">
            <label htmlFor="logo">Logo (votre emblème)</label>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
              <img src={logoUrl} alt="Logo actuel" className="profil-media-logo" />
            ) : null}
            <input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
            <p className="aide-champ">
              Pastille sur le bord de votre bannière et sur votre carte du catalogue. Carré conseillé (ex. 512 × 512).
              Sans logo, votre initiale est affichée.
            </p>
          </div>
        </div>
        <div className="field">
          <span id="etiquette-couleur" className="etiquette-champ">
            Couleur d&apos;accent
          </span>
          <SelecteurCouleur valeurInitiale={couleurAccent} />
          <p className="aide-champ">
            Un liseré décoratif propre à votre restaurant, visible dans le catalogue et sur votre fiche. Facultatif.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="profil-bloc-titre">Horaires et consignes</h2>
        <div className="field">
          <label htmlFor="horaires">Horaires</label>
          <textarea
            id="horaires"
            name="horaires"
            rows={2}
            maxLength={500}
            defaultValue={horaires}
            placeholder="Ex. Lun-Sam 9h-21h"
          />
        </div>
        <div className="field">
          <label htmlFor="consignes">Consignes pour vos clients</label>
          <textarea
            id="consignes"
            name="consignes"
            rows={3}
            maxLength={1000}
            defaultValue={consignes}
            placeholder="Ex. Livraison uniquement dans un rayon de 5 km"
          />
        </div>
      </Card>

      <div className="barre-enregistrement">
        <div className="barre-enregistrement-message" role="status">
          {etat.erreur ? (
            <Alert ton="danger">{etat.erreur}</Alert>
          ) : etat.succes ? (
            <Alert ton="succes">Modifications enregistrées.</Alert>
          ) : null}
        </div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
