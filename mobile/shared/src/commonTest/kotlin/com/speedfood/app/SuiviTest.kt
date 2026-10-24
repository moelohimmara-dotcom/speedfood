package com.speedfood.app

import com.speedfood.app.data.cleEtapeSuivi
import com.speedfood.app.data.cleLigneSuivi
import com.speedfood.app.data.progressionSuivi
import kotlin.test.Test
import kotlin.test.assertEquals

class SuiviTest {
    @Test
    fun friseSuitLeStatutReel() {
        assertEquals(0, progressionSuivi("en_attente"))
        assertEquals(2, progressionSuivi("prete"))
        assertEquals("suivi-etape-terminee", cleEtapeSuivi("terminee"))
        assertEquals("suivi-ligne-CMD-1", cleLigneSuivi("CMD", 1))
    }
}
