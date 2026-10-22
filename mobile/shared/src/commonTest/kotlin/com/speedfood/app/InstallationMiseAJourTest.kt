package com.speedfood.app

import com.speedfood.app.data.EtatInstallation
import com.speedfood.app.data.InstallateurApk
import com.speedfood.app.data.InstallationMiseAJour
import com.speedfood.app.data.VersionPubliee
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class InstallationMiseAJourTest {
    private val empreinte = "a".repeat(64)
    private val version = VersionPubliee(20, "2.18.0", "Notes", false, empreinte, 14_000_000)

    private class FauxInstallateur(var autorise: Boolean = true, var erreur: String? = null, override val actif: Boolean = true) : InstallateurApk {
        var autorisationOuverte = 0
        var installations = 0
        var urlVue: String? = null
        override fun autorise() = autorise
        override fun ouvrirAutorisation() {
            autorisationOuverte++
        }
        override suspend fun telecharger(url: String, sha256: String, progres: (Int) -> Unit): String? {
            urlVue = url
            progres(40)
            return erreur
        }
        override fun installer() {
            installations++
        }
    }

    private fun installation(faux: FauxInstallateur) = InstallationMiseAJour(faux, CoroutineScope(UnconfinedTestDispatcher()), "https://exemple.test/")

    @Test
    fun sansEmpreinteOuSansPlateformeLInstallationEnUnGesteNEstPasProposee() {
        assertFalse(installation(FauxInstallateur()).possible(version.copy(apkSha256 = "")))
        assertFalse(installation(FauxInstallateur(actif = false)).possible(version))
        assertTrue(installation(FauxInstallateur()).possible(version))
    }

    @Test
    fun sansAutorisationOnOuvreLeReglageEtOnNeTelechargeRien() {
        val faux = FauxInstallateur(autorise = false)
        val i = installation(faux)
        i.lancer(version)
        assertEquals(EtatInstallation.AutorisationRequise, i.etat.value)
        assertEquals(1, faux.autorisationOuverte)
        assertEquals(null, faux.urlVue)
        faux.autorise = true
        i.lancer(version)
        assertEquals(EtatInstallation.Installation, i.etat.value)
        assertEquals("https://exemple.test/speedfood.apk", faux.urlVue)
        assertEquals(1, faux.installations)
    }

    @Test
    fun uneEmpreinteRefuseeNInstallePasEtPermetDeReessayer() {
        val faux = FauxInstallateur(erreur = "Le fichier reçu ne correspond pas à la version annoncée.")
        val i = installation(faux)
        i.lancer(version)
        assertEquals(EtatInstallation.Echec("Le fichier reçu ne correspond pas à la version annoncée."), i.etat.value)
        assertEquals(0, faux.installations)
        faux.erreur = null
        i.reinitialiser()
        assertEquals(EtatInstallation.Repos, i.etat.value)
        i.lancer(version)
        assertEquals(1, faux.installations)
    }
}
