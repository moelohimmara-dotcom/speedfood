package com.speedfood.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.speedfood.app.data.PhotoChoisie
import com.speedfood.app.data.ResultatPhoto
import com.speedfood.app.data.SelecteurPhoto
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlin.coroutines.resume

/**
 * Choix d'une photo par le sélecteur du système, puis réduction : décodage échantillonné (la photo entière n'est jamais chargée en pleine taille), remise à l'endroit
 * d'après l'orientation EXIF, côté de [COTE_MAX] px au plus, JPEG qualité [QUALITE]. Une photo de plusieurs Mo devient un fichier de 200 à 500 Ko.
 */
class PhotoAndroid(private val contexte: Context) : SelecteurPhoto {
    private var lanceur: (() -> Unit)? = null
    private var attente: CancellableContinuation<Uri?>? = null

    /** L'activité fournit le déclenchement du sélecteur (il doit être enregistré avant que l'activité démarre). */
    fun lier(declencher: () -> Unit) {
        lanceur = declencher
    }

    fun delier() {
        lanceur = null
        attente?.resume(null)
        attente = null
    }

    /** Réponse du sélecteur : null si la personne l'a refermé sans choisir. */
    fun recu(uri: Uri?) {
        attente?.resume(uri)
        attente = null
    }

    override val disponible: Boolean get() = true

    override suspend fun choisir(): ResultatPhoto {
        val declencher = lanceur ?: return ResultatPhoto.Erreur("Réessayez dans un instant : l'écran n'est pas prêt.")
        val uri = suspendCancellableCoroutine<Uri?> { suite ->
            attente = suite
            suite.invokeOnCancellation { attente = null }
            try {
                declencher()
            } catch (_: Exception) {
                attente = null
                suite.resume(null)
            }
        } ?: return ResultatPhoto.Annule
        return withContext(Dispatchers.IO) {
            try {
                val octets = reduire(uri) ?: return@withContext ResultatPhoto.Erreur("Cette photo n'a pas pu être lue. Choisissez-en une autre.")
                ResultatPhoto.Choisie(PhotoChoisie(octets))
            } catch (_: OutOfMemoryError) {
                ResultatPhoto.Erreur("Cette photo est trop grande pour ce téléphone. Choisissez-en une autre.")
            } catch (_: Exception) {
                ResultatPhoto.Erreur("Cette photo n'a pas pu être lue. Choisissez-en une autre.")
            }
        }
    }

    private fun reduire(uri: Uri): ByteArray? {
        val resolveur = contexte.contentResolver
        val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolveur.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, limites) } ?: return null
        if (limites.outWidth <= 0 || limites.outHeight <= 0) return null

        var echantillon = 1
        while (maxOf(limites.outWidth, limites.outHeight) / (echantillon * 2) >= COTE_MAX) echantillon *= 2
        val decode = BitmapFactory.Options().apply { inSampleSize = echantillon }
        val brut = resolveur.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, decode) } ?: return null

        val rotation = resolveur.openInputStream(uri)?.use { flux ->
            when (ExifInterface(flux).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f

        val echelle = minOf(1f, COTE_MAX.toFloat() / maxOf(brut.width, brut.height))
        val matrice = Matrix().apply {
            if (echelle < 1f) postScale(echelle, echelle)
            if (rotation != 0f) postRotate(rotation)
        }
        val final = if (matrice.isIdentity) brut else Bitmap.createBitmap(brut, 0, 0, brut.width, brut.height, matrice, true)
        val sortie = ByteArrayOutputStream()
        // Le JPEG n'a pas de transparence : une image à fond transparent (PNG) serait noire sans ce fond blanc.
        val surFondBlanc = Bitmap.createBitmap(final.width, final.height, Bitmap.Config.ARGB_8888).also {
            android.graphics.Canvas(it).apply {
                drawColor(android.graphics.Color.WHITE)
                drawBitmap(final, 0f, 0f, null)
            }
        }
        surFondBlanc.compress(Bitmap.CompressFormat.JPEG, QUALITE, sortie)
        return sortie.toByteArray().takeIf { it.isNotEmpty() }
    }

    private companion object {
        const val COTE_MAX = 1280
        const val QUALITE = 82
    }
}
