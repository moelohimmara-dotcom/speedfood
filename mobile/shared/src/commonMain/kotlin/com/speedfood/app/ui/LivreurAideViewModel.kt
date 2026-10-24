package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AideApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Assistance conducteur : le numéro de l'assistance — celui affiché par la console, jamais un numéro écrit en dur dans l'application.
 */
class LivreurAideViewModel(private val aide: AideApi) : ViewModel() {
    private val _whatsapp = MutableStateFlow<String?>(null)
    val whatsapp: StateFlow<String?> = _whatsapp.asStateFlow()

    init {
        viewModelScope.launch {
            _whatsapp.value = aide.whatsapp()
        }
    }
}
