package com.speedfood.app

import com.speedfood.app.data.LienProfond
import com.speedfood.app.data.lireLienProfond
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class LiensProfondsTest {
    @Test
    fun restaurantSpeedfoodEstReconnu() {
        assertEquals(LienProfond.Restaurant("r1"), lireLienProfond("https://speedfood-app.moelohimmara.workers.dev/r/r1"))
    }

    @Test
    fun commandeAvecRequeteEstReconnu() {
        assertEquals(LienProfond.Commande("jeton-123"), lireLienProfond("https://speedfood.dev/commande/jeton-123?source=whatsapp"))
    }

    @Test
    fun hoteInconnuEtCheminArbitraireSontRefuses() {
        assertNull(lireLienProfond("https://evil.example/r/r1"))
        assertNull(lireLienProfond("javascript:alert(1)"))
        assertNull(lireLienProfond("https://speedfood.dev/p/plat-1"))
        assertNull(lireLienProfond("https://speedfood.dev/r/"))
    }
}
