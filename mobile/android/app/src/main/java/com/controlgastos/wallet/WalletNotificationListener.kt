package com.controlgastos.wallet

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import org.json.JSONObject

/** Google Wallet: every notification is inspected for a payment. */
const val GOOGLE_WALLET_PACKAGE = "com.google.android.apps.walletnfcrel"

/**
 * SMS apps: only messages from the bank senders in BankSenderStore are kept. Google
 * Messages, Samsung Messages and the AOSP app.
 */
val MESSAGING_PACKAGES =
    setOf(
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
    )

/**
 * Receives notifications once the user grants "Acceso a notificaciones" to the app. Keeps
 * Google Wallet notifications and bank SMS from the configured senders, and queues their
 * text for the JS side, which decides whether they are movements
 * (src/features/wallet/domain). Every other notification is ignored without being stored.
 * Nothing is logged and nothing leaves the device.
 */
class WalletNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) {
      return
    }
    when (sbn.packageName) {
      GOOGLE_WALLET_PACKAGE -> captureWallet(sbn)
      in MESSAGING_PACKAGES -> captureBankMessages(sbn)
    }
  }

  private fun captureWallet(sbn: StatusBarNotification) {
    val notification = sbn.notification ?: return
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) {
      return
    }
    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
    if (title.isNullOrBlank() && text.isNullOrBlank() && bigText.isNullOrBlank()) {
      return
    }
    // `when` is the event time chosen by Wallet and survives notification updates, so an
    // updated notification for the same payment yields the same id.
    val postedAt = if (notification.`when` > 0) notification.`when` else sbn.postTime
    queue(sbn.packageName, postedAt, title, text, bigText)
  }

  /**
   * A conversation notification may carry several unread messages (MessagingStyle); each is
   * checked on its own. Re-posts of the same messages produce the same ids.
   */
  private fun captureBankMessages(sbn: StatusBarNotification) {
    val notification = sbn.notification ?: return
    val extras = notification.extras ?: return
    val sender =
        (extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)
                ?: extras.getCharSequence(Notification.EXTRA_TITLE))
            ?.toString()
    for ((time, text) in messagesOf(extras, notification, sbn)) {
      if (BankSenderStore.matches(applicationContext, sender, text)) {
        queue(sbn.packageName, time, sender, text, null)
      }
    }
  }

  private fun messagesOf(
      extras: Bundle,
      notification: Notification,
      sbn: StatusBarNotification,
  ): List<Pair<Long, String>> {
    @Suppress("DEPRECATION")
    val bundles = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
    val messages =
        bundles.orEmpty().mapNotNull { item ->
          val bundle = item as? Bundle ?: return@mapNotNull null
          val text = bundle.getCharSequence("text")?.toString()
          if (text.isNullOrBlank()) null
          else Pair(bundle.getLong("time").takeIf { it > 0 } ?: sbn.postTime, text)
        }
    if (messages.isNotEmpty()) {
      return messages
    }
    val text =
        (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString()
    val time = if (notification.`when` > 0) notification.`when` else sbn.postTime
    return if (text.isNullOrBlank()) emptyList() else listOf(Pair(time, text))
  }

  private fun queue(
      packageName: String,
      postedAt: Long,
      title: String?,
      text: String?,
      bigText: String?,
  ) {
    val capture =
        JSONObject().apply {
          put("id", stableId(packageName, postedAt, title, text))
          put("packageName", packageName)
          put("title", title ?: JSONObject.NULL)
          put("text", text ?: JSONObject.NULL)
          put("bigText", bigText ?: JSONObject.NULL)
          put("postedAt", postedAt)
        }
    WalletCaptureStore.append(applicationContext, capture)
  }

  private fun stableId(packageName: String, postedAt: Long, title: String?, text: String?): String {
    val digest =
        MessageDigest.getInstance("SHA-256")
            .digest("$packageName|$postedAt|${title.orEmpty()}|${text.orEmpty()}".toByteArray())
    return digest.joinToString("") { "%02x".format(it) }.take(32)
  }
}
