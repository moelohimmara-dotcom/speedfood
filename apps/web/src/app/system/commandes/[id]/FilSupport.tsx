"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { envoyerMessageSupportAction, changerStatutFilSupportAction, type EtatActionSupport } from "@/lib/system-admin/support-actions";
import { construireLienWhatsApp, MODELES_REPONSE } from "@/lib/system-admin/support-regles";
import type { FilSupport } from "@/lib/system-admin/support-service";

const INITIAL: EtatActionSupport = {};

export function FilSupportCommande({ fil, telephoneMasque }: { fil: FilSupport; telephoneMasque: string }) {
  const [etatMessage, actionMessage, envoiEnCours] = useActionState(envoyerMessageSupportAction, INITIAL);
  const [etatStatut, actionStatut, statutEnCours] = useActionState(changerStatutFilSupportAction, INITIAL);
  const whatsapp = construireLienWhatsApp(telephoneMasque, "Bonjour, je vous contacte au sujet de votre commande.");
  return (
    <div className="ad-pile">
      <div className="ad-actions-ligne">
        <strong>Statut : {fil.statut === "ouvert" ? "Ouvert" : "Résolu"}</strong>
        <a className="btn btn-secondary btn-compact" href={whatsapp} target="_blank" rel="noreferrer">Préparer WhatsApp</a>
      </div>
      <p className="u-fs-0-85rem-c-secondaire-mt-0">Le lien ouvre WhatsApp avec un texte prérempli. Aucun message n&apos;est envoyé automatiquement.</p>
      {fil.messages.length === 0 ? <p className="u-m-0-c-secondaire">Aucun message dans ce fil.</p> : <ol className="ad-chronologie">{fil.messages.map((message) => <li key={message.id}><strong>{message.auteur === "equipe" ? "Équipe" : "Client"}</strong><span>{message.contenu}</span></li>)}</ol>}
      <form action={actionMessage} onSubmit={(event) => { if (!window.confirm("Ajouter cette réponse au fil de support ?")) event.preventDefault(); }}>
        <input type="hidden" name="commande_id" value={fil.commandeId} />
        <div className="field"><label htmlFor="modele-reponse">Modèle de réponse</label><select id="modele-reponse" onChange={(event) => { const cible = document.getElementById("message-support") as HTMLTextAreaElement | null; const modele = MODELES_REPONSE.find((item) => item.id === event.target.value); if (cible && modele) cible.value = modele.contenu; }} defaultValue=""><option value="">Choisir un modèle…</option>{MODELES_REPONSE.map((modele) => <option key={modele.id} value={modele.id}>{modele.titre}</option>)}</select></div>
        <div className="field"><label htmlFor="message-support">Message</label><textarea id="message-support" name="contenu" rows={4} maxLength={1000} required /></div>
        {etatMessage.erreur ? <Alert ton="danger">{etatMessage.erreur}</Alert> : null}{etatMessage.succes ? <Alert ton="succes">{etatMessage.succes}</Alert> : null}
        <Button type="submit" disabled={envoiEnCours}>{envoiEnCours ? "Enregistrement…" : "Ajouter au fil"}</Button>
      </form>
      <form action={actionStatut} onSubmit={(event) => { if (!window.confirm(fil.statut === "ouvert" ? "Marquer ce fil comme résolu ?" : "Rouvrir ce fil ?")) event.preventDefault(); }}>
        <input type="hidden" name="commande_id" value={fil.commandeId} /><input type="hidden" name="statut" value={fil.statut === "ouvert" ? "resolu" : "ouvert"} />
        <div className="field"><label htmlFor="motif-support-fil">Motif de changement de statut</label><input id="motif-support-fil" name="motif" minLength={5} maxLength={500} required /></div>
        {etatStatut.erreur ? <Alert ton="danger">{etatStatut.erreur}</Alert> : null}{etatStatut.succes ? <Alert ton="succes">{etatStatut.succes}</Alert> : null}
        <Button type="submit" variante="secondary" disabled={statutEnCours}>{statutEnCours ? "Mise à jour…" : fil.statut === "ouvert" ? "Marquer comme résolu" : "Rouvrir le fil"}</Button>
      </form>
    </div>
  );
}
