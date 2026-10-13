# Quartiers de Conakry : extraction de l'annuaire INS 2022 (à vérifier)

**Date :** 13 octobre 2026
**Source :** Annuaire statistique 2022 de l'INS, **tableau 1.3** (liste des préfectures et districts/quartiers de la région de Conakry), page 20 du PDF : https://www.stat-guinee.org/images/Documents/Publications/INS/annuelles/annuaire/Annuaire_Statistique_2022_VF_INS.pdf
**Origine des données administratives :** Direction nationale de l'administration du territoire (citée par l'INS).
**Statut :** extraction par lecture du texte du PDF. **Non vérifiée visuellement** (aucun moyen de rendu d'image dans cette session). Aucune donnée n'a été écrite en base.

## Ce que dit le tableau
Six communes urbaines apparaissent : **Dixinn, Kaloum, Kassa, Matam, Matoto, Ratoma**. La sixième, **Kassa**, n'est pas dans la migration appliquée le 13 octobre 2026 (cinq communes, d'après l'OCHA 2016).

## Quartiers par commune (lecture du tableau)

**Dixinn (22)** : Belle Vue École, Belle Vue Marché I, Belle Vue Marché II, Camayenne, Cameroun, Dixinn Centre I, Dixinn Centre II, Dixinn Gare, Dixinn Gare Rails, Dixinn Mosquée, Dixinn Port, Hafia Château d'eau, Hafia I, Hafia II, Hafia III, Hafia Minière I, Hafia Minière II, Hafia Minière Centre, Hafia Mosquée, Kénien, Landréah, Minière Cité.

**Kaloum (13)** : Almamya I, Almamya II, Boulbinet, Coronthie I, Coronthie II, Kassa, Koulewondy, Manquepas, Sandervalia, Sans Fil, Tamara, Téminetaye, Tombo.

**Kassa (2)** : Kassa, Fotoba.

**Matam (24)** : Bonfi, Bonfi Marché, Bonfi Routière, Boussoura, Carrière Centre, Carrière Cité, Coléah Centre, Coléah Cité, Coléah Domino, Coléah Imprimerie, Hermakonon Mosquée, Hermakonon Permanence, Lanseboundji, Madina Centre, Madina Cité (SIG), Madina Marché, Madina Mosquée, Madina École, Mafanco, Mafanco Centre, Matam, Matam Centre, Matam Lido, Touguiwondy.

**Matoto (38)** : Behanzin, Camp Alpha Yaya Diallo, Cité de l'Air, Dabompa, Dabompa Plateau, Dabondy École, Dabondy I, Dabondy II, Dabondy III, Dabondy Rails, **Dar Es Salam I**, Entá Marché, Gbessia Centre, Gbessia Cité École, Gbessia Cité I, Gbessia Cité II, Gbessia Cité III, Gbessia Port I, Gbessia Port II, Kissosso, Kissosso Plateau, Lansanaya, Matoto Centre, Matoto Khabitaya, Matoto Marché, Sangoya Marché, Sangoya Mosquée, Simbaya École, Simbaya I, Simbaya II, Tanéné Marché, Tanéné Mosquée, Tombolia, Tombolia Plateau, Yimbaya École, Yimbaya Permanence, Yimbaya Port, Yimbaya Tanerie.

**Ratoma (34)** : Bantounka I, Bantounka II, **Dar Es Salam I**, Dar Es Salam II, Hamdallaye I, Hamdallaye II, Hamdallaye Mosquée, Kaporo Centre, Kaporo Rails, Kipé, Kobaya, Koloma I, Koloma II, Lambanyi, Nasroullaye, Nongo, Nongo Tady, Ratoma Centre, Ratoma Dispensaire, Simbaya Gare, Soloprimo, Sonfonia Centre I, Sonfonia Centre II, Sonfonia Gare I, Sonfonia Gare II, Soumabossia, Taouyah, Wanindara I, Wanindara II, Wanindara III, Wareya, Yattaya Centre, Yattaya Fossedé, Yembeya.

## Points à vérifier
1. **Total** : 133 entrées, soit **131 noms distincts** après retrait de deux doublons. L'INS annonce **130 quartiers**.
2. **Doublons** :
   - « Kassa » apparaît comme quartier de Kaloum **et** comme commune (Kassa, avec « Fotoba »). Il est probablement le même lieu, à trancher.
   - « Dar Es Salam I » apparaît à Matoto **et** à Ratoma. Une seule des deux attributions est probablement fausse. À trancher sur la page source.
3. **Mise en page** : dans le PDF, le nom de la commune est placé au milieu de son groupe de quartiers. Le rattachement est donc déduit de la position du nom, pas lu directement. Une vérification sur la page imprimée est nécessaire.
4. **Orthographe** : les accents et apostrophes sont restaurés par l'extraction ; certains noms (« Entá Marché », « Tanéné ») sont à confirmer.
5. **Édition** : cette liste est celle de 2022. Les éditions 2016 et 2018 ont 130 quartiers et cinq communes ; la répartition peut avoir changé.

## Ce qui n'est pas fait
- Aucune insertion en base (pas de quartier ajouté, pas de commune Kassa ajoutée, pas de rattachement).
- Aucune comparaison avec les quartiers déjà présents dans `neighborhoods` (à faire avant toute écriture).
