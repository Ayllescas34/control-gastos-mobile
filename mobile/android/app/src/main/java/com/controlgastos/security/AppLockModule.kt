package com.controlgastos.security

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.fbreact.specs.NativeAppLockSpec
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * App PIN lock (docs/security.md). Contract: src/core/native/specs/NativeAppLock.ts. The
 * PIN never reaches logs; hashing runs off the JS thread.
 */
class AppLockModule(private val context: ReactApplicationContext) :
    NativeAppLockSpec(context), ActivityEventListener {

  private val work: ExecutorService = Executors.newSingleThreadExecutor()

  /** A reset waiting for the phone's own lock screen: the new PIN and its promise. */
  private var pendingReset: Pair<String, Promise>? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getStatus(promise: Promise) {
    promise.resolve(status().toString())
  }

  override fun enable(pin: String, promise: Promise) {
    if (!PinStore.isValid(pin)) {
      promise.reject(E_INVALID, "PIN must be ${PinStore.PIN_LENGTH} digits")
      return
    }
    if (PinStore.isEnabled(context)) {
      promise.reject(E_ALREADY, "A PIN is already set")
      return
    }
    run(promise) {
      PinStore.set(context, pin)
      hideInRecents(true)
      null
    }
  }

  override fun verify(pin: String, promise: Promise) {
    run(promise) { result(PinStore.verify(context, pin)).toString() }
  }

  override fun change(current: String, next: String, promise: Promise) {
    if (!PinStore.isValid(next)) {
      promise.reject(E_INVALID, "PIN must be ${PinStore.PIN_LENGTH} digits")
      return
    }
    run(promise) {
      val verified = PinStore.verify(context, current)
      if (verified is PinStore.Result.Ok) {
        PinStore.set(context, next)
      }
      result(verified).toString()
    }
  }

  override fun disable(current: String, promise: Promise) {
    run(promise) {
      val verified = PinStore.verify(context, current)
      if (verified is PinStore.Result.Ok) {
        PinStore.clear(context)
        hideInRecents(false)
      }
      result(verified).toString()
    }
  }

  /** Forgot the PIN: the phone's own lock screen (PIN, pattern or password) authorizes a new one. */
  override fun resetWithDeviceCredential(next: String, promise: Promise) {
    if (!PinStore.isValid(next)) {
      promise.reject(E_INVALID, "PIN must be ${PinStore.PIN_LENGTH} digits")
      return
    }
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (!keyguard.isDeviceSecure) {
      promise.reject(E_NO_DEVICE_LOCK, "The phone has no screen lock")
      return
    }
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject(E_NO_ACTIVITY, "No foreground activity")
      return
    }
    @Suppress("DEPRECATION")
    val intent =
        keyguard.createConfirmDeviceCredentialIntent(
            "Control de Gastos",
            "Confirma que eres tú para crear un PIN nuevo",
        )
    if (intent == null) {
      promise.reject(E_NO_DEVICE_LOCK, "The phone has no screen lock")
      return
    }
    synchronized(this) {
      if (pendingReset != null) {
        promise.reject(E_BUSY, "A confirmation is already open")
        return
      }
      pendingReset = Pair(next, promise)
    }
    activity.startActivityForResult(intent, REQUEST_CONFIRM)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CONFIRM) {
      return
    }
    val pending = synchronized(this) { pendingReset.also { pendingReset = null } } ?: return
    val (next, promise) = pending
    if (resultCode != Activity.RESULT_OK) {
      promise.reject(E_CANCELLED, "Confirmation cancelled")
      return
    }
    run(promise) {
      PinStore.set(context, next)
      hideInRecents(true)
      null
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun status() =
      JSONObject().apply {
        put("enabled", PinStore.isEnabled(context))
        put("lockedUntil", PinStore.lockedUntil(context))
      }

  private fun result(result: PinStore.Result) =
      JSONObject().apply {
        put("ok", result is PinStore.Result.Ok)
        put("lockedUntil", (result as? PinStore.Result.Rejected)?.lockedUntil ?: 0L)
      }

  private fun run(promise: Promise, block: () -> Any?) {
    work.execute {
      try {
        promise.resolve(block())
      } catch (error: Exception) {
        // The message never includes the PIN.
        promise.reject(E_FAILED, error.javaClass.simpleName)
      }
    }
  }

  /** Android 13+: recents shows a blank card instead of the user's finances. */
  private fun hideInRecents(hide: Boolean) {
    val activity = context.currentActivity ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      activity.runOnUiThread { activity.setRecentsScreenshotEnabled(!hide) }
    }
  }

  private companion object {
    const val REQUEST_CONFIRM = 7342
    const val E_INVALID = "E_INVALID"
    const val E_ALREADY = "E_ALREADY"
    const val E_NO_DEVICE_LOCK = "E_NO_DEVICE_LOCK"
    const val E_NO_ACTIVITY = "E_NO_ACTIVITY"
    const val E_BUSY = "E_BUSY"
    const val E_CANCELLED = "E_CANCELLED"
    const val E_FAILED = "E_FAILED"
  }
}
