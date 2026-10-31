/** « 24 h », « 3 jours » : formulation arrondie au jour dès 48 h. */
export function formaterDelaiValidation(heures: number): string {
  if (heures < 48) {
    return `${heures} h`;
  }
  return `${Math.ceil(heures / 24)} jours`;
}

/** Lien WhatsApp vers l'assistance, avec un message d'accueil générique (aucune donnée personnelle). */
export function lienWhatsAppAssistance(numero: string, message = "Bonjour Speedfood, j'ai une question."): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

/** Liens de carte d'un restaurant : simples liens externes, aucune carte chargée dans la page. */
export function liensCarte(latitude: number, longitude: number): { voir: string; itineraire: string } {
  return {
    voir: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
    itineraire: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  };
}
