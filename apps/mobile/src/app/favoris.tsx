import { useApplication } from '../etat/Application';
import { restaurants } from '../donnees/demo';
import { Ecran, Titre, Texte, EtatVide } from '../design/Composants';
import { CarteRestaurant } from '../design/CarteRestaurant';
export default function Favoris() {
  const { favoris } = useApplication();
  return <Ecran><Titre>Vos bonnes adresses</Titre><Texte>Les favoris de votre session de démonstration.</Texte>
    {favoris.length ? restaurants.filter(r => favoris.includes(r.id)).map(r => <CarteRestaurant key={r.id} restaurant={r} />) : <EtatVide titre="Gardez vos envies" message="Touchez le cœur d’un restaurant pour le retrouver ici. Aucun compte nécessaire dans cette démo." />}
  </Ecran>;
}
