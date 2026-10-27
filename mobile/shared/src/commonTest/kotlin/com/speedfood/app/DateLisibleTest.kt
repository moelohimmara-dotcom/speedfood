package com.speedfood.app

import com.speedfood.app.data.dateLisible
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Instant

class DateLisibleTest {
    private val maintenant = Instant.parse("2026-10-27T10:00:00Z")

    @Test
    fun aujourdhuiEtHier() {
        assertEquals("aujourd'hui 02:34", dateLisible("2026-10-27T02:34:00Z", maintenant))
        assertEquals("hier 18:20", dateLisible("2026-10-26T18:20:00.000Z", maintenant))
    }

    @Test
    fun uneDatePlusAncienneAvecOuSansAnnee() {
        assertEquals("22 oct. 09:00", dateLisible("2026-10-22T09:00:00Z", maintenant))
        assertEquals("1 janv. 00:05", dateLisible("2026-01-01T00:05:00Z", maintenant))
        assertEquals("31 déc. 2025 23:59", dateLisible("2025-12-31T23:59:00Z", maintenant))
        assertEquals("29 févr. 2024 12:00", dateLisible("2024-02-29T12:00:00Z", maintenant), "année bissextile")
    }

    @Test
    fun unHorodatageIllisibleOuAbsentNeCassePas() {
        assertEquals("", dateLisible(null, maintenant))
        assertEquals("", dateLisible("  ", maintenant))
        assertEquals("pas une date", dateLisible("pas une date", maintenant))
    }
}
