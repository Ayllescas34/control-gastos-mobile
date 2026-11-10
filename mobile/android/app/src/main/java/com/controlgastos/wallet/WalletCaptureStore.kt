package com.controlgastos.wallet

import android.content.Context
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Queue of payment notifications captured while the app may not be running. The listener
 * appends; the JS side reads them, stores them in SQLite and then acknowledges them, so a
 * crash between reading and saving never loses a payment (docs/google-wallet.md).
 *
 * Only notifications from WALLET_PACKAGES ever reach this store. Stored in the app's private
 * SharedPreferences (excluded from Android backups: allowBackup="false").
 */
object WalletCaptureStore {
  private const val PREFS = "wallet_captures"
  private const val KEY_QUEUE = "queue"

  /** Oldest entries are dropped beyond this, so the queue cannot grow without bound. */
  private const val MAX_ENTRIES = 500

  private val lock = Any()

  fun append(context: Context, capture: JSONObject) {
    synchronized(lock) {
      val queue = read(context)
      val id = capture.getString("id")
      for (i in 0 until queue.length()) {
        if (queue.getJSONObject(i).optString("id") == id) {
          return
        }
      }
      queue.put(capture)
      val trimmed =
          if (queue.length() <= MAX_ENTRIES) queue
          else
              JSONArray().apply {
                for (i in queue.length() - MAX_ENTRIES until queue.length()) {
                  put(queue.get(i))
                }
              }
      write(context, trimmed)
    }
  }

  fun pendingJson(context: Context): String = synchronized(lock) { read(context).toString() }

  fun acknowledge(context: Context, ids: Set<String>) {
    synchronized(lock) {
      val queue = read(context)
      val kept = JSONArray()
      for (i in 0 until queue.length()) {
        val entry = queue.getJSONObject(i)
        if (entry.optString("id") !in ids) {
          kept.put(entry)
        }
      }
      write(context, kept)
    }
  }

  private fun read(context: Context): JSONArray {
    val raw = prefs(context).getString(KEY_QUEUE, null) ?: return JSONArray()
    return try {
      JSONArray(raw)
    } catch (_: JSONException) {
      JSONArray()
    }
  }

  private fun write(context: Context, queue: JSONArray) {
    prefs(context).edit().putString(KEY_QUEUE, queue.toString()).apply()
  }

  private fun prefs(context: Context) =
      context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
