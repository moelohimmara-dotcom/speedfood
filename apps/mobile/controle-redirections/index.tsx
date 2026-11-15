import { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { creerAuth } from '../src/connexion/client';
import { ErreurLivreur } from '../src/connexion/livreur';
import { fetchHttp } from '../src/connexion/http-natif';
import { verifierDelais } from './delais';

const LOCAL = 'http://127.0.0.1:8798';
const PORTEUR = 'controle-redirections-factice';
const ID = '11111111-1111-4111-8111-111111111111';
const CHEMINS = ['/api/v1/livreur/en-ligne', '/api/v1/livreur/offre', '/api/v1/livreur/course'];
// Expo 57 remplace déjà global.fetch par défaut : viser explicitement le
// polyfill XHR pour que le contre-essai ne teste pas Expo à son insu.
const fetchXHR = require('whatwg-fetch').fetch as typeof fetch;
function apiLocale(transport: typeof fetch, statut: number, cible: 'meme' | 'autre') {
  return creerAuth(((input: string, init?: RequestInit) => {
    const chemin = new URL(String(input)).pathname;
    if (!CHEMINS.includes(chemin) || new Headers(init?.headers).get('Authorization') !== 'Bearer ' + PORTEUR) throw new Error('APPEL_NON_FACTICE_REFUSE');
    return transport(LOCAL + chemin + '?statut=' + statut + '&cible=' + cible, init);
  }) as typeof fetch);
}
async function compteurs() { const r = await fetchHttp(LOCAL + '/__etat'); if (!r.ok) throw new Error('COMPTEURS_INDISPONIBLES'); return await r.json() as { entrees: unknown[]; destinations: unknown[] }; }
async function reset() { const r = await fetchHttp(LOCAL + '/__reset', { method: 'POST', redirect: 'error', credentials: 'omit' }); if (!r.ok) throw new Error('RESET_REFUSE'); }

function Controle() {
  const [occupe, setOccupe] = useState(false); const [lignes, setLignes] = useState<string[]>(['Prêt. Aucun compte réel, aucune base.']);
  async function delais() {
    if (occupe) return;
    setOccupe(true);
    try { await verifierDelais(setLignes); }
    catch { setLignes(l => [...l, 'Contrôle interrompu ou échoué : consulter le serveur de délais.']); }
    finally { setOccupe(false); }
  }
  async function lancer(temoin: boolean) {
    if (occupe) return;
    setOccupe(true); setLignes(['Essai en cours…']);
    try {
      await reset();
      if (temoin) {
        await apiLocale(fetchXHR, 307, 'meme').avancerCourseLivreur(PORTEUR, { livraisonId: ID, vers: 'recuperee' });
        const c = await compteurs();
        setLignes(['TÉMOIN XHR 307', 'Entrées : ' + c.entrees.length, 'Destinations : ' + c.destinations.length, c.destinations.length === 1 ? 'Défaut reproduit : redirection suivie.' : 'Témoin inattendu : vérifier le banc.']);
      } else {
        let succes = 0; let bloques = 0; const resultats: string[] = [];
        for (const cible of ['meme', 'autre'] as const) {
          for (const statut of [200, 301, 302, 303, 307, 308]) {
            if (statut === 200 && cible === 'autre') continue;
            const api = apiLocale(fetchHttp, statut, cible);
            const actions = [() => api.basculerEnLigneLivreur(PORTEUR, true), () => api.repondreOffreLivreur(PORTEUR, ID, 'acceptee'), () => api.avancerCourseLivreur(PORTEUR, { livraisonId: ID, vers: 'recuperee' })];
            let ok = 0;
            for (const action of actions) {
              try { await action(); if (statut === 200) { succes++; ok++; } }
              catch (e) { if (statut !== 200 && e instanceof ErreurLivreur && e.genre === 'incertain') { bloques++; ok++; } }
            }
            resultats.push(statut + ' / ' + cible + ' : ' + ok + '/3');
            setLignes([...resultats]);
          }
        }
        const c = await compteurs();
        const valide = succes === 3 && bloques === 30 && c.entrees.length === 33 && c.destinations.length === 0;
        setLignes([valide ? 'PROTECTION VALIDÉE SUR ANDROID' : 'ÉCHEC DU CONTRÔLE', 'Succès sans redirection : ' + succes + '/3', 'Redirections bloquées : ' + bloques + '/30', 'Entrées : ' + c.entrees.length + ' / destinations : ' + c.destinations.length, ...resultats]);
      }
    } catch { setLignes(['Essai interrompu : vérifier le serveur local et les relais ADB.']); }
    finally { setOccupe(false); }
  }
  return <ScrollView contentContainerStyle={s.contenu}>
    <Text style={s.titre}>CONTRÔLE LOCAL — REDIRECTIONS</Text>
    <Text>Données fictives uniquement. Transport du produit, serveur local.</Text>
    <Pressable accessibilityRole="button" disabled={occupe} style={s.bouton} onPress={() => { void lancer(true); }}><Text style={s.libelle}>Témoin XHR (factice)</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={occupe} style={s.bouton} onPress={() => { void lancer(false); }}><Text style={s.libelle}>Vérifier la protection native</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={occupe} style={s.bouton} onPress={() => { void delais(); }}><Text style={s.libelle}>Vérifier les délais (environ 1 min)</Text></Pressable>
    {lignes.map((l, i) => <Text key={i} selectable style={s.ligne}>{l}</Text>)}
  </ScrollView>;
}
const s = StyleSheet.create({ contenu: { padding: 20, paddingTop: 56, paddingBottom: 40, gap: 14 }, titre: { fontSize: 19, fontWeight: '700' }, bouton: { backgroundColor: '#9E211A', padding: 16, borderRadius: 12 }, libelle: { color: 'white', fontWeight: '700' }, ligne: { fontSize: 16 } });
registerRootComponent(Controle);
