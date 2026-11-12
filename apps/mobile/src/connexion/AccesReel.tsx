import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput } from 'react-native';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { LONGUEUR_MIN_MOT_DE_PASSE, verifierEmail, verifierInscription } from './auth-publique';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
/**
 * Inscription et mot de passe oublié (parité Kotlin, lot 1, lignes A2 et A3). Chaque écran garde son propre état d'attente et d'erreur ; les règles sont vérifiées avant le réseau, un seul essai par appui.
 * Le mot de passe est vidé de l'écran dès l'envoi et n'est conservé nulle part.
 */
const texteErreur = (e: unknown) => e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.';
function useActif() { const actif = useRef(true); useEffect(() => () => { actif.current = false; }, []); return actif; }

export function InscriptionReelle({ emailInitial, retour, sessionOuverte }: { emailInitial: string; retour(email: string): void; sessionOuverte(): void }) {
  const [nom, setNom] = useState(''); const [telephone, setTelephone] = useState(''); const [email, setEmail] = useState(emailInitial); const [motDePasse, setMotDePasse] = useState('');
  const [attente, setAttente] = useState(false); const [erreur, setErreur] = useState<string | null>(null); const [envoyee, setEnvoyee] = useState<string | null>(null);
  const actif = useActif(); const enCours = useRef(false);
  async function envoyer() {
    if (enCours.current) return;
    const probleme = verifierInscription({ nom, telephone, email, motDePasse });
    if (probleme !== null) { setErreur(probleme); return; }
    enCours.current = true; setAttente(true); setErreur(null);
    const saisie = { nom, telephone, email, motDePasse }; setMotDePasse('');
    try {
      const r = await gestion.inscrire(saisie.nom, saisie.telephone, saisie.email, saisie.motDePasse);
      if (!actif.current) return;
      if (r.sessionOuverte) sessionOuverte(); else setEnvoyee(saisie.email.trim());
    } catch (e) { if (actif.current) setErreur(texteErreur(e)); }
    finally { enCours.current = false; if (actif.current) setAttente(false); }
  }
  if (envoyee !== null) return <>
    <Text accessibilityRole="header" style={s.nom}>Vérifiez votre boîte e-mail</Text>
    <Text accessibilityLiveRegion="polite" style={s.texte}>Si cette adresse peut recevoir un compte, un e-mail de confirmation a été envoyé à {envoyee}. Ouvrez le lien reçu (regardez aussi les courriers indésirables), puis connectez-vous ici.</Text>
    <Bouton titre="Retour à la connexion" onPress={() => retour(envoyee)} />
  </>;
  return <>
    <Text accessibilityRole="header" style={s.nom}>Créer un compte</Text>
    <Text style={s.texte}>Nom</Text><TextInput accessibilityLabel="Votre nom" value={nom} onChangeText={setNom} autoCapitalize="words" autoComplete="name" editable={!attente} style={s.champ} />
    <Text style={s.texte}>Téléphone (Guinée)</Text><TextInput accessibilityLabel="Votre téléphone guinéen" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" autoComplete="tel" placeholder="622 12 34 56" editable={!attente} style={s.champ} />
    <Text style={s.texte}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail du nouveau compte" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!attente} style={s.champ} />
    <Text style={s.texte}>Mot de passe ({LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins)</Text><TextInput accessibilityLabel="Mot de passe du nouveau compte" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!attente} style={s.champ} />
    {attente && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Création du compte…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Bouton titre="Créer mon compte" disabled={attente} onPress={() => { void envoyer(); }} />
    <Bouton titre="J’ai déjà un compte" secondaire disabled={attente} onPress={() => retour(email)} />
  </>;
}

export function OubliReel({ emailInitial, retour }: { emailInitial: string; retour(email: string): void }) {
  const [email, setEmail] = useState(emailInitial);
  const [attente, setAttente] = useState(false); const [erreur, setErreur] = useState<string | null>(null); const [envoyee, setEnvoyee] = useState<string | null>(null);
  const actif = useActif(); const enCours = useRef(false);
  async function envoyer() {
    if (enCours.current) return;
    const probleme = verifierEmail(email);
    if (probleme !== null) { setErreur(probleme); return; }
    enCours.current = true; setAttente(true); setErreur(null);
    try { await gestion.demanderReinitialisation(email); if (actif.current) setEnvoyee(email.trim()); }
    catch (e) { if (actif.current) setErreur(texteErreur(e)); }
    finally { enCours.current = false; if (actif.current) setAttente(false); }
  }
  return <>
    <Text accessibilityRole="header" style={s.nom}>Mot de passe oublié</Text>
    {envoyee !== null
      ? <Text accessibilityLiveRegion="polite" style={s.texte}>Si un compte existe pour {envoyee}, un e-mail vient d’être envoyé. Ouvrez le lien reçu (regardez aussi les courriers indésirables) : il s’ouvre dans le navigateur, sur la page où vous choisissez un nouveau mot de passe.</Text>
      : <>
        <Text style={s.texte}>Indiquez l’adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</Text>
        <Text style={s.texte}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail de votre compte" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!attente} style={s.champ} />
        {attente && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Envoi en cours…</Text></>}
        {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
        <Bouton titre="Envoyer le lien" disabled={attente} onPress={() => { void envoyer(); }} />
      </>}
    <Bouton titre="Retour à la connexion" secondaire disabled={attente} onPress={() => retour(email)} />
  </>;
}
const s = StyleSheet.create({
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  champ: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 16, minHeight: 54, fontFamily: polices.texte, fontSize: 16, color: c.encre },
});
