package com.controlgastos.wallet

import android.content.Context
import org.json.JSONArray
import org.json.JSONException

/**
 * Bank SMS senders the user chose in the app (the sender number, such as "2424", or the
 * first word of the message, such as "BiMovil"). The listener keeps a message only when it
 * comes from one of them; every other message is discarded in memory and never stored
 * (docs/bank-messages.md). Kept natively because the listener runs while the app is closed.
 */
object BankSenderStore {
  private const val PREFS = "bank_senders"
  private const val KEY_SENDERS = "senders"

  /** Banco Industrial (Guatemala) until the user changes the list. */
  private val DEFAULT_SENDERS = listOf("2424", "BiMovil")

  private const val MAX_SENDERS = 20
  private const val MAX_LENGTH = 30

  fun get(context: Context): List<String> {
    val raw = prefs(context).getString(KEY_SENDERS, null) ?: return DEFAULT_SENDERS
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).map { array.getString(it) }
    } catch (_: JSONException) {
      DEFAULT_SENDERS
    }
  }

  fun set(context: Context, senders: List<String>) {
    val clean =
        senders
            .map { it.trim() }
            .filter { it.length in 2..MAX_LENGTH }
            .distinctBy { it.lowercase() }
            .take(MAX_SENDERS)
    prefs(context).edit().putString(KEY_SENDERS, JSONArray(clean).toString()).apply()
  }

  /**
   * Whether a message belongs to a configured bank: its sender (the notification title)
   * equals one, or its text starts with one, ignoring case.
   */
  fun matches(context: Context, sender: String?, text: String): Boolean {
    val from = sender?.trim().orEmpty()
    val body = text.trimStart()
    return get(context).any { configured ->
      from.equals(configured, ignoreCase = true) || body.startsWith(configured, ignoreCase = true)
    }
  }

  private fun prefs(context: Context) =
      context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
