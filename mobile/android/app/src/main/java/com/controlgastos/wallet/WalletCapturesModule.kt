package com.controlgastos.wallet

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.fbreact.specs.NativeWalletCapturesSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import org.json.JSONArray

/**
 * Bridge between WalletNotificationListener's queue and JS. Contract:
 * src/core/native/specs/NativeWalletCaptures.ts and docs/google-wallet.md.
 */
class WalletCapturesModule(private val context: ReactApplicationContext) :
    NativeWalletCapturesSpec(context) {

  private val listener: ComponentName
    get() = ComponentName(context, WalletNotificationListener::class.java)

  override fun isAccessGranted(promise: Promise) {
    val enabled =
        Settings.Secure.getString(context.contentResolver, ENABLED_LISTENERS).orEmpty()
    val granted = enabled.split(':').any { ComponentName.unflattenFromString(it) == listener }
    promise.resolve(granted)
  }

  override fun openAccessSettings(promise: Promise) {
    val detail =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(
                    Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                    listener.flattenToString(),
                )
        else null
    val general = Intent(LISTENER_SETTINGS)
    for (intent in listOfNotNull(detail, general)) {
      try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        promise.resolve(null)
        return
      } catch (_: ActivityNotFoundException) {
        // Try the next screen.
      }
    }
    promise.reject("E_UNAVAILABLE", "No settings screen for notification access")
  }

  override fun readPending(promise: Promise) {
    promise.resolve(WalletCaptureStore.pendingJson(context))
  }

  override fun acknowledge(ids: ReadableArray, promise: Promise) {
    val set = (0 until ids.size()).mapNotNull { ids.getString(it) }.toSet()
    WalletCaptureStore.acknowledge(context, set)
    promise.resolve(null)
  }

  override fun getBankSenders(promise: Promise) {
    promise.resolve(JSONArray(BankSenderStore.get(context)).toString())
  }

  override fun setBankSenders(senders: ReadableArray, promise: Promise) {
    BankSenderStore.set(context, (0 until senders.size()).mapNotNull { senders.getString(it) })
    promise.resolve(null)
  }

  private companion object {
    const val ENABLED_LISTENERS = "enabled_notification_listeners"
    const val LISTENER_SETTINGS = "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"
  }
}
