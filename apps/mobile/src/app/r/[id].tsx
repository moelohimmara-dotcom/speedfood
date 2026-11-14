import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deposerLienEnAttente } from '../../connexion/lien-en-attente';

/** Route d'entrée des liens restaurant partagés (`/r/:id`) : dépose le lien pour le catalogue, puis revient à l'accueil. */
export default function LienRestaurant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    if (typeof id === 'string' && id !== '') deposerLienEnAttente('https://speedfood.dev/r/' + id);
    router.replace('/');
  }, [id]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Ouverture du lien Speedfood…</Text></View>;
}
