import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deposerLienEnAttente } from '../../connexion/lien-en-attente';

/** Route d'entrée des liens de suivi de commande (`/commande/:jeton`) : dépose le lien pour le catalogue, puis revient à l'accueil. */
export default function LienCommande() {
  const { jeton } = useLocalSearchParams<{ jeton: string }>();
  useEffect(() => {
    if (typeof jeton === 'string' && jeton !== '') deposerLienEnAttente('https://speedfood.dev/commande/' + jeton);
    router.replace('/');
  }, [jeton]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Ouverture du lien Speedfood…</Text></View>;
}
