// Pur, sans dépendance serveur : testable seul (npm run test:unit). Notifications de suivi de commande pour le client.

export const TYPES_NOTIFICATION_CLIENT = ["acceptee", "prete", "refusee", "annulee", "terminee"] as const;
export type TypeNotificationClient = (typeof TYPES_NOTIFICATION_CLIENT)[number];

/** Le statut de commande qui mérite une notification au client ; `null` pour les autres (la commande vient d'être créée, etc.). */
export function typeDepuisStatutCommande(statut: string): TypeNotificationClient | null {
  return (TYPES_NOTIFICATION_CLIENT as readonly string[]).includes(statut) ? (statut as TypeNotificationClient) : null;
}

export interface ContenuNotification {
  titre: string;
  corps: string;
  /** Page ouverte au clic : jamais une adresse extérieure. */
  url: string;
  /** Une notification par commande remplace la précédente (pas d'empilement). */
  tag: string;
}

/**
 * Texte de la notification. Il est servi par NOTRE serveur au Service Worker du client (jamais par les services de push) : le nom du restaurant
 * peut donc y figurer. Pas de montant, pas d'adresse, pas de numéro.
 */
export function contenuNotificationClient(type: TypeNotificationClient, restaurantNom: string, mode: string): ContenuNotification {
  const resto = restaurantNom.trim().slice(0, 60) || "Le restaurant";
  const url = "/compte/commandes";
  const tag = "speedfood-suivi";
  switch (type) {
    case "acceptee":
      return { titre: "Commande acceptée", corps: `${resto} prépare votre commande.`, url, tag };
    case "prete":
      return { titre: "Commande prête", corps: mode === "livraison" ? `${resto} : votre commande est prête, la livraison se prépare.` : `${resto} : votre commande est prête.`, url, tag };
    case "refusee":
      return { titre: "Commande refusée", corps: `${resto} ne peut pas honorer votre commande. Aucun montant n'a été encaissé par Speedfood.`, url, tag };
    case "annulee":
      return { titre: "Commande annulée", corps: `Votre commande chez ${resto} a été annulée.`, url, tag };
    case "terminee":
      return { titre: mode === "livraison" ? "Commande livrée" : "Commande terminée", corps: `Merci d'avoir commandé chez ${resto}. Vous pouvez laisser un avis.`, url, tag };
  }
}

/** Texte de repli si le serveur ne peut pas donner le détail (réseau coupé au moment de la notification). */
export const CONTENU_NOTIFICATION_PAR_DEFAUT: ContenuNotification = {
  titre: "Votre commande a avancé",
  corps: "Ouvrez Speedfood pour voir où elle en est.",
  url: "/compte/commandes",
  tag: "speedfood-suivi",
};
