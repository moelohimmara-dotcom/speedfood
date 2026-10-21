package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ClientCommande
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.DestinationEnvoyee
import com.speedfood.app.data.EstimationLivraison
import com.speedfood.app.data.KtorLivraisonApi
import com.speedfood.app.data.KtorRestaurantApi
import com.speedfood.app.data.CreationCommande
import com.speedfood.app.data.ErreurAuth
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorCommandeApi
import com.speedfood.app.data.LigneEnvoyee
import com.speedfood.app.data.Menu
import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.Plat
import com.speedfood.app.data.ResultatAjout
import com.speedfood.app.data.ResultatCommande
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.normaliserTelephone
import com.speedfood.app.data.nouvelleCleIdempotence
import com.speedfood.app.ui.CommandeAffichee
import com.speedfood.app.ui.lignesRecommandees
import com.speedfood.app.ui.fusionnerCommandes
import com.speedfood.app.ui.libelleStatut
import com.speedfood.app.ui.verifierConnexion
import com.speedfood.app.ui.verifierInscription
import com.speedfood.app.ui.verifierSaisieCommande
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CommandeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private val reponseJeton = """{"access_token":"acces-1","refresh_token":"renouv-1","expires_in":3600,"user":{"id":"u1","email":"a@b.test"}}"""

    // ---------- téléphone ----------

    @Test
    fun telephoneGuineen() {
        assertEquals("+224622123456", normaliserTelephone("622 12 34 56"))
        assertEquals("+224622123456", normaliserTelephone("0622123456"))
        assertEquals("+224622123456", normaliserTelephone("+224 622-12-34-56"))
        assertEquals("+224722123456", normaliserTelephone("00224722123456"))
        assertNull(normaliserTelephone("522123456"))
        assertNull(normaliserTelephone("62212345"))
        assertNull(normaliserTelephone("abc"))
        assertNull(normaliserTelephone(""))
    }

    // ---------- validations d'écran ----------

    @Test
    fun validationDeLaConnexionEtDeLInscription() {
        assertNotNull(verifierConnexion("pas-un-mail", "x"))
        assertNotNull(verifierConnexion("a@b.test", ""))
        assertNull(verifierConnexion("aminata@exemple.test", "n-importe-quoi"))
        assertNotNull(verifierInscription("A", "622123456", "aminata@exemple.test", "un-mot-de-passe-long"))
        assertNotNull(verifierInscription("Aminata", "123", "aminata@exemple.test", "un-mot-de-passe-long"))
        assertNotNull(verifierInscription("Aminata", "622123456", "aminata@exemple.test", "court"), "12 caractères au moins")
        assertNull(verifierInscription("Aminata", "622123456", "aminata@exemple.test", "un-mot-de-passe-long"))
    }

    @Test
    fun validationDeLaSaisieDeCommande() {
        assertNotNull(verifierSaisieCommande("", "622123456", true))
        assertNotNull(verifierSaisieCommande("Aminata", "12", true))
        assertNotNull(verifierSaisieCommande("Aminata", "622123456", false), "le consentement est obligatoire")
        assertNull(verifierSaisieCommande("Aminata", "622123456", true))
    }

    // ---------- authentification ----------

    @Test
    fun connexionEnvoieLaClePubliqueEtLireLaSession() = runTest {
        var requete: io.ktor.client.request.HttpRequestData? = null
        var corps = ""
        val auth = KtorAuthApi(client(MockEngine { r -> requete = r; corps = r.body.toByteArray().decodeToString(); respond(reponseJeton, HttpStatusCode.OK, json) }), config) { 1_000L }
        val session = auth.connecter("  a@b.test ", "secret-secret")
        assertEquals("acces-1", session.accessToken)
        assertEquals("u1", session.userId)
        assertEquals(1_000L + 3600, session.expireLe)
        assertEquals("cle-publique-de-test", requete?.headers?.get("apikey"))
        assertEquals("password", requete?.url?.parameters?.get("grant_type"))
        assertEquals("a@b.test", Json.parseToJsonElement(corps).jsonObject["email"]?.jsonPrimitive?.content, "l'e-mail est rogné")
    }

    @Test
    fun erreursDAuthentificationLisibles() = runTest {
        fun auth(statut: HttpStatusCode, corps: String) = KtorAuthApi(client(MockEngine { respond(corps, statut, json) }), config) { 0L }
        val mauvais = assertFailsWith<ErreurAuth> { auth(HttpStatusCode.BadRequest, """{"msg":"Invalid login credentials"}""").connecter("a@b.test", "x") }
        assertEquals("E-mail ou mot de passe incorrect.", mauvais.message)
        assertEquals(false, mauvais.temporaire)
        val nonConfirme = assertFailsWith<ErreurAuth> { auth(HttpStatusCode.BadRequest, """{"msg":"Email not confirmed"}""").connecter("a@b.test", "x") }
        assertTrue(nonConfirme.message!!.contains("Confirmez"))
        val limite = assertFailsWith<ErreurAuth> { auth(HttpStatusCode.TooManyRequests, "{}").connecter("a@b.test", "x") }
        assertEquals(true, limite.temporaire)
        val panne = assertFailsWith<ErreurAuth> { auth(HttpStatusCode.BadGateway, "oops").connecter("a@b.test", "x") }
        assertEquals(true, panne.temporaire)
        assertTrue(panne.message!!.contains("indisponible"))
    }

    @Test
    fun inscriptionPlaceLesCoordonneesDansLesMetadonnees() = runTest {
        var corps = ""
        var redirection: String? = null
        val auth = KtorAuthApi(client(MockEngine { r -> corps = r.body.toByteArray().decodeToString(); redirection = r.url.parameters["redirect_to"]; respond("{}", HttpStatusCode.OK, json) }), config) { 0L }
        auth.inscrire("Aminata Diallo", "+224622123456", "aminata@exemple.test", "un-mot-de-passe-long")
        val racine = Json.parseToJsonElement(corps).jsonObject
        assertEquals("Aminata Diallo", racine["data"]!!.jsonObject["nom_commande"]!!.jsonPrimitive.content)
        assertEquals("+224622123456", racine["data"]!!.jsonObject["telephone"]!!.jsonPrimitive.content)
        assertTrue(redirection!!.startsWith("https://exemple.test/auth/confirmation"))
    }

    // ---------- session ----------

    @Test
    fun sessionConserveeEtRenouveleeAvantExpiration() = runTest {
        var maintenant = 1_000L
        var renouvellements = 0
        val moteur = MockEngine { respond(
            """{"access_token":"acces-2","refresh_token":"renouv-2","expires_in":3600,"user":{"id":"u1","email":"a@b.test"}}""".also { renouvellements++ },
            HttpStatusCode.OK, json,
        ) }
        val stockage = StockageMemoire()
        val service = SessionService(KtorAuthApi(client(moteur), config) { maintenant }, stockage) { maintenant }
        assertNull(service.jetonValide(), "personne n'est connectée")

        // Une session existante valable une heure
        stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces-1", "renouv-1", 4_600L, "u1", "a@b.test")))
        val relue = SessionService(KtorAuthApi(client(moteur), config) { maintenant }, stockage) { maintenant }
        assertEquals("acces-1", relue.jetonValide())
        assertEquals(0, renouvellements, "pas de renouvellement tant que la session est valable")

        maintenant = 4_600L - 30 // dans la marge de 60 s : on renouvelle avant d'envoyer
        assertEquals("acces-2", relue.jetonValide())
        assertEquals(1, renouvellements)
        assertTrue(stockage.lire(SessionService.CLE)!!.contains("acces-2"), "la nouvelle session est conservée")
    }

    @Test
    fun renouvellementRefuseFermeLaSessionMaisUneCoupureLaGarde() = runTest {
        val stockage = StockageMemoire()
        val ancienne = Session("acces-1", "renouv-1", 100L, "u1", "a@b.test")
        stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), ancienne))

        val enPanne = SessionService(KtorAuthApi(client(MockEngine { respond("oops", HttpStatusCode.ServiceUnavailable, json) }), config) { 500L }, stockage) { 500L }
        assertNull(enPanne.jetonValide(), "pas de jeton utilisable pour l'instant")
        assertNotNull(enPanne.session.value, "mais la session est gardée pour un prochain essai")

        val revoquee = SessionService(KtorAuthApi(client(MockEngine { respond("""{"msg":"Invalid Refresh Token"}""", HttpStatusCode.BadRequest, json) }), config) { 500L }, stockage) { 500L }
        assertNull(revoquee.jetonValide())
        assertNull(revoquee.session.value, "un refus définitif ferme la session")
        assertNull(stockage.lire(SessionService.CLE))
    }

    @Test
    fun sessionIllisibleEstEffacee() {
        val stockage = StockageMemoire()
        stockage.ecrire(SessionService.CLE, "{pas du json")
        val service = SessionService(KtorAuthApi(client(MockEngine { respond("{}", HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
        assertNull(service.session.value)
        assertNull(stockage.lire(SessionService.CLE))
    }

    // ---------- panier ----------

    private val piment = OptionPlat("o1", "Piment", 1_000)
    private val oeuf = OptionPlat("o2", "Œuf", 2_000)
    private val epuise = OptionPlat("o3", "Fromage", 3_000, disponible = false)
    private val riz = Plat(id = "p1", nom = "Riz gras", prix = 35_000, prixPromo = 30_000, options = listOf(piment, oeuf, epuise))
    private val jus = Plat(id = "p2", nom = "Jus de bissap", prix = 5_000)

    @Test
    fun lePanierCalculeLesMontantsEtLesLignes() {
        val panier = PanierService()
        assertEquals(ResultatAjout.Ajoute, panier.ajouter("r1", "Chez Fatou", riz, listOf(piment, epuise), 2))
        assertEquals(ResultatAjout.Ajoute, panier.ajouter("r1", "Chez Fatou", jus, emptyList()))
        val p = panier.panier.value
        assertEquals("Chez Fatou", p.restaurantNom)
        // riz promo 30 000 + piment 1 000 = 31 000 × 2 ; le supplément épuisé est écarté ; + jus 5 000
        assertEquals(2 * 31_000 + 5_000, p.sousTotal)
        assertEquals(3, p.nombreArticles)
        assertEquals(2, p.lignes.size)
    }

    @Test
    fun memePlatMemesSupplementsFusionnentSinonDeuxLignes() {
        val panier = PanierService()
        panier.ajouter("r1", "R", riz, listOf(piment))
        panier.ajouter("r1", "R", riz, listOf(piment))
        panier.ajouter("r1", "R", riz, listOf(oeuf))
        panier.ajouter("r1", "R", riz, emptyList())
        val lignes = panier.panier.value.lignes
        assertEquals(3, lignes.size)
        assertEquals(2, lignes.first { it.options.map { o -> o.id } == listOf("o1") }.quantite)
    }

    @Test
    fun unSeulRestaurantAlaFoisAvecConfirmation() {
        val panier = PanierService()
        panier.ajouter("r1", "Chez Fatou", riz, emptyList())
        assertEquals(ResultatAjout.AutreRestaurant, panier.ajouter("r2", "Chez Mamadou", jus, emptyList()))
        assertEquals("r1", panier.panier.value.restaurantId, "rien n'est remplacé sans confirmation")
        assertEquals(1, panier.panier.value.lignes.size)
        assertEquals(ResultatAjout.Ajoute, panier.remplacerEtAjouter("r2", "Chez Mamadou", jus, emptyList()))
        assertEquals("r2", panier.panier.value.restaurantId)
        assertEquals(listOf("p2"), panier.panier.value.lignes.map { it.plat.id })
    }

    @Test
    fun quantitesBorneesEtPanierVideOublieSonRestaurant() {
        val panier = PanierService()
        panier.ajouter("r1", "R", jus, emptyList(), 30)
        assertEquals(ResultatAjout.QuantiteMax, panier.ajouter("r1", "R", jus, emptyList(), 1))
        assertEquals(30, panier.panier.value.nombreArticles)
        val cle = panier.panier.value.lignes.single().cle
        panier.definirQuantite(cle, 99)
        assertEquals(30, panier.panier.value.nombreArticles, "plafonné à 30")
        panier.definirQuantite(cle, 0)
        assertTrue(panier.panier.value.estVide)
        assertNull(panier.panier.value.restaurantId)
    }

    @Test
    fun actualiserReprendLesPrixDuMenuEtRetireLesPlatsDisparus() {
        val panier = PanierService()
        panier.ajouter("r1", "R", riz, listOf(piment))
        panier.ajouter("r1", "R", jus, emptyList())
        val rizAugmente = riz.copy(prixPromo = null, prix = 40_000)
        val retirees = panier.actualiser(Menu(emptyList(), listOf(rizAugmente.copy(options = listOf(piment.copy(prix = 1_500))))))
        assertEquals(1, retirees, "le jus n'existe plus")
        val ligne = panier.panier.value.lignes.single()
        assertEquals(41_500, ligne.prixUnitaire)
    }

    // ---------- commande ----------

    @Test
    fun laCommandeEnvoieIdentifiantsEtQuantitesSansPrixParLigne() = runTest {
        var corps = ""
        var autorisation: String? = null
        val api = KtorCommandeApi(
            client(MockEngine { r ->
                corps = r.body.toByteArray().decodeToString()
                autorisation = r.headers[HttpHeaders.Authorization]
                respond("""{"ok":true,"reference":"SF-0042","jeton":"jeton-suivi","idempotent":false}""", HttpStatusCode.OK, json)
            }),
            config,
        )
        val commande = CreationCommande(
            cleIdempotence = nouvelleCleIdempotence(),
            restaurantId = "r1",
            client = ClientCommande("Aminata", "+224622123456"),
            mode = "retrait",
            lignes = listOf(LigneEnvoyee("p1", 2, listOf("o1"))),
            sousTotalAffiche = 62_000,
            consentementReglement = true,
        )
        val resultat = api.creer(commande, "acces-1")
        assertEquals(ResultatCommande.Creee("SF-0042", "jeton-suivi", false), resultat)
        assertEquals("Bearer acces-1", autorisation)
        val racine = Json.parseToJsonElement(corps).jsonObject
        assertEquals("retrait", racine["mode"]!!.jsonPrimitive.content)
        assertEquals("62000", racine["sousTotalAffiche"]!!.jsonPrimitive.content)
        assertTrue(!racine["client"]!!.jsonObject.containsKey("adresse"), "pas d'adresse en retrait : le champ est absent, jamais null")
        assertTrue(!racine.containsKey("destination") && !racine.containsKey("fraisAffiches"), "ni destination ni frais en retrait")
        assertTrue(!corps.contains("\"prix\""), "aucun prix de ligne n'est envoyé")
    }

    @Test
    fun laCommandeEnLivraisonPorteQuartierAdresseEtFraisVus() = runTest {
        var corps = ""
        val api = KtorCommandeApi(
            client(MockEngine { r -> corps = r.body.toByteArray().decodeToString(); respond("""{"ok":true,"reference":"SF-7","jeton":"j7","idempotent":false}""", HttpStatusCode.Created, json) }),
            config,
        )
        api.creer(
            CreationCommande("c", "r1", ClientCommande("Aminata", "+224622123456", "Rue KA-012, près de la mosquée"), "livraison", listOf(LigneEnvoyee("p1", 1)), 30_000, true,
                destination = DestinationEnvoyee("q2"), fraisAffiches = 9_500),
            "t",
        )
        val racine = Json.parseToJsonElement(corps).jsonObject
        assertEquals("livraison", racine["mode"]!!.jsonPrimitive.content)
        assertEquals("q2", racine["destination"]!!.jsonObject["quartierId"]!!.jsonPrimitive.content)
        assertEquals("9500", racine["fraisAffiches"]!!.jsonPrimitive.content)
        assertEquals("Rue KA-012, près de la mosquée", racine["client"]!!.jsonObject["adresse"]!!.jsonPrimitive.content)
    }

    @Test
    fun saisieDeLivraisonControleQuartierAdresseEtCalcul() {
        val ok = EstimationLivraison.Ok(9_500, 2.4, false, 25, "2,4 km")
        fun v(adresse: String = "Rue KA-012, Kaloum", quartier: String? = "q1", estimation: EstimationLivraison? = ok, enCours: Boolean = false) =
            verifierSaisieCommande("Aminata", "622123456", true, true, adresse, quartier, estimation, enCours)
        assertNull(v())
        assertNotNull(v(quartier = null), "quartier obligatoire")
        assertNotNull(v(adresse = "rue"), "adresse trop courte")
        assertNotNull(v(adresse = "x".repeat(301)), "adresse trop longue")
        assertNotNull(v(enCours = true), "calcul en cours")
        assertNotNull(v(estimation = null), "pas de calcul")
        assertEquals("Trop loin.", v(estimation = EstimationLivraison.Erreur("Trop loin.")))
        assertNull(v(estimation = EstimationLivraison.NonCalculee), "frais à convenir : on peut commander")
        // En retrait, rien de tout cela ne compte.
        assertNull(verifierSaisieCommande("Aminata", "622123456", true))
    }

    @Test
    fun estimationDeLivraisonLitLeServeur() = runTest {
        var corps = ""
        fun api(reponse: String, statut: HttpStatusCode = HttpStatusCode.OK) =
            KtorLivraisonApi(client(MockEngine { r -> corps = r.body.toByteArray().decodeToString(); respond(reponse, statut, json) }), config)

        val ok = api("""{"ok":true,"estimation":{"statut":"ok","fraisGnf":9500,"distanceKm":2.4,"gratuite":false,"dureeMinutes":25,"libelle":"2,4 km"}}""")
            .estimer("r1", "q2", 30_000, "jeton")
        assertEquals(EstimationLivraison.Ok(9_500, 2.4, false, 25, "2,4 km"), ok)
        val racine = Json.parseToJsonElement(corps).jsonObject
        assertEquals("q2", racine["destination"]!!.jsonObject["quartierId"]!!.jsonPrimitive.content)
        assertEquals("30000", racine["sousTotal"]!!.jsonPrimitive.content)

        assertEquals(EstimationLivraison.NonCalculee, api("""{"ok":true,"estimation":{"statut":"non_calcule"}}""").estimer("r1", "q2", 1, "j"))
        assertEquals(
            EstimationLivraison.Erreur("Ce restaurant ne livre pas : choisissez le retrait."),
            api("""{"ok":true,"estimation":{"statut":"erreur","message":"Ce restaurant ne livre pas : choisissez le retrait."}}""").estimer("r1", "q2", 1, "j"),
        )
        assertEquals(
            EstimationLivraison.Erreur("Connectez-vous pour calculer la livraison."),
            api("""{"ok":false,"erreur":{"code":"NON_AUTHENTIFIE","message":"Connectez-vous pour calculer la livraison."}}""", HttpStatusCode.Unauthorized).estimer("r1", "q2", 1, "j"),
        )
    }

    @Test
    fun historiqueDuCompteEtFusionAvecLAppareil() = runTest {
        var autorisation: String? = null
        val api = KtorCommandeApi(
            client(MockEngine { r ->
                autorisation = r.headers[HttpHeaders.Authorization]
                respond(
                    """{"ok":true,"commandes":[
                        {"id":"x","reference":"SF-2","creeLe":"2026-10-21T10:00:00Z","restaurantId":"r1","restaurantNom":"Chez Awa","mode":"livraison","statut":"acceptee","totalGnf":39500,"jeton":"j2","estTest":false},
                        {"id":"y","reference":"SF-1","creeLe":"2026-10-20T10:00:00Z","restaurantId":"r1","restaurantNom":"Chez Awa","mode":"retrait","statut":"terminee","totalGnf":30000,"jeton":"j1","estTest":false}]}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val serveur = api.lister("acces")
        assertEquals("Bearer acces", autorisation)
        assertEquals(2, serveur.size)

        val locales = listOf(
            CommandeLocale("SF-1", "j1", "Chez Awa", 1L, 30_000, restaurantId = "r1", lignes = listOf(LigneEnvoyee("p1", 1))),
            CommandeLocale("SF-3", "j3", "Chez Awa", 4_000_000_000_000L, 5_000), // pas encore vue par le serveur
        )
        val fusion = fusionnerCommandes(serveur, locales)
        assertEquals(listOf("SF-3", "SF-2", "SF-1"), fusion.map { it.reference }, "la plus récente d'abord")
        val sf2 = fusion.first { it.reference == "SF-2" }
        assertTrue(sf2.livraison)
        assertEquals("acceptee", sf2.statut)
        assertTrue(!sf2.peutRecommander, "l'appareil n'a pas gardé les lignes de SF-2")
        val sf1 = fusion.first { it.reference == "SF-1" }
        assertEquals("terminee", sf1.statut, "le serveur fait foi pour le statut")
        assertTrue(sf1.peutRecommander, "les lignes viennent de l'appareil")
    }

    @Test
    fun commanderANouveauUtiliseLeMenuDAujourdhui() {
        val menu = Menu(
            emptyList(),
            listOf(
                Plat("p1", "Riz gras", prix = 40_000, options = listOf(OptionPlat("o1", "Piment", 1_500), OptionPlat("o2", "Oeuf", 2_000, disponible = false))),
                Plat("p2", "Jus", prix = 5_000, disponible = false),
            ),
        )
        val lignes = listOf(LigneEnvoyee("p1", 2, listOf("o1", "o2")), LigneEnvoyee("p2", 1), LigneEnvoyee("disparu", 1))
        val refaites = lignesRecommandees(menu, lignes)
        assertEquals(1, refaites.size, "le plat épuisé et le plat disparu sont ignorés")
        val (plat, options, quantite) = refaites.single()
        assertEquals(40_000, plat.prix, "prix daujourdhui")
        assertEquals(listOf("o1"), options.map { it.id }, "le supplément devenu indisponible est écarté")
        assertEquals(2, quantite)
        assertTrue(CommandeAffichee("SF-1", "j", "r1", "R", 1L, 1, null, false, lignes).peutRecommander)
        assertTrue(!CommandeAffichee("SF-1", "j", "", "R", 1L, 1, null, false, lignes).peutRecommander)
        assertTrue(!CommandeAffichee("SF-1", "j", "r1", "R", 1L, 1, null, false, emptyList()).peutRecommander)
    }

    @Test
    fun uneCommandeRefuseeRendLeMessageDuServeur() = runTest {
        val api = KtorCommandeApi(
            client(MockEngine { respond("""{"ok":false,"erreur":{"code":"CONFLIT_ETAT","message":"Les prix ont changé."}}""", HttpStatusCode.Conflict, json) }),
            config,
        )
        val resultat = api.creer(CreationCommande("c", "r1", ClientCommande("A", "+224622123456"), "retrait", emptyList(), 0, true), "t")
        assertEquals(ResultatCommande.Refusee("Les prix ont changé.", "CONFLIT_ETAT"), resultat)
    }

    @Test
    fun suiviLitLaProposition() = runTest {
        val api = KtorCommandeApi(
            client(MockEngine {
                respond(
                    """{"ok":true,"suivi":{"reference":"SF-1","statut":"en_attente","etatDerive":"attente_confirmation_client","restaurant":{"id":"r1","nom":"Chez Fatou"},
                    "lignes":[{"nom":"Riz gras","prix":30000,"quantite":2,"options":[]}],"sousTotal":60000,
                    "propositionActive":{"id":"prop1","nouveauSousTotal":55000,"nouveauxFraisLivraison":0}}}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val suivi = api.suivi("jeton")!!
        assertEquals("prop1", suivi.propositionActive?.id)
        assertEquals(60_000, suivi.total)
        assertEquals("Le restaurant propose un changement", libelleStatut(suivi.statut, suivi.etatDerive))
    }

    @Test
    fun suiviIntrouvableRendNull() = runTest {
        val api = KtorCommandeApi(client(MockEngine { respond("""{"ok":false,"erreur":{"code":"INTROUVABLE","message":"Commande introuvable."}}""", HttpStatusCode.NotFound, json) }), config)
        assertNull(api.suivi("jeton-inconnu"))
    }

    @Test
    fun cleDIdempotenceUniqueEtCommandesLocales() {
        assertNotEquals(nouvelleCleIdempotence(), nouvelleCleIdempotence())
        assertEquals(36, nouvelleCleIdempotence().length)

        val locales = CommandesLocales(StockageMemoire())
        assertTrue(locales.lister().isEmpty())
        locales.ajouter(CommandeLocale("SF-1", "j1", "Chez Fatou", 1L, 10_000))
        locales.ajouter(CommandeLocale("SF-2", "j2", "Chez Fatou", 2L, 20_000))
        locales.ajouter(CommandeLocale("SF-1", "j1", "Chez Fatou", 3L, 10_000))
        assertEquals(listOf("SF-1", "SF-2"), locales.lister().map { it.reference }, "la plus récente d'abord, sans doublon")
        repeat(60) { locales.ajouter(CommandeLocale("X-$it", "j$it", "R", it.toLong(), 1)) }
        assertEquals(CommandesLocales.MAX, locales.lister().size)
        locales.oublier()
        assertTrue(locales.lister().isEmpty())
    }
}
