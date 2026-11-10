package com.controlgastos.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * The app's 6-digit PIN (docs/security.md). The PIN itself is never stored: only
 * HMAC-SHA256(Keystore key, PBKDF2-SHA256(PIN, random salt)). The HMAC key lives in the
 * Android Keystore and cannot be exported, so a copy of the app's files is not enough to
 * brute-force the 10^6 possible PINs offline. Failed attempts are counted here, natively, so
 * the JS side cannot skip the waiting time.
 */
object PinStore {
  const val PIN_LENGTH = 6

  private const val PREFS = "app_lock"
  private const val KEY_SALT = "salt"
  private const val KEY_HASH = "hash"
  private const val KEY_FAILURES = "failures"
  private const val KEY_LOCKED_UNTIL = "locked_until"
  private const val KEYSTORE = "AndroidKeyStore"
  private const val HMAC_ALIAS = "control_gastos_pin_hmac"
  private const val ITERATIONS = 120_000
  private const val HASH_BITS = 256

  /** Free attempts before waiting; then 30 s, doubling per failure, up to 15 min. */
  private const val FREE_ATTEMPTS = 5
  private const val FIRST_WAIT_MS = 30_000L
  private const val MAX_WAIT_MS = 15 * 60_000L

  sealed class Result {
    object Ok : Result()

    /** Wrong PIN, or still waiting: `lockedUntil` (epoch ms) is 0 when there is no wait. */
    data class Rejected(val lockedUntil: Long) : Result()
  }

  private val lock = Any()

  fun isValid(pin: String): Boolean = pin.length == PIN_LENGTH && pin.all { it in '0'..'9' }

  fun isEnabled(context: Context): Boolean = prefs(context).contains(KEY_HASH)

  fun lockedUntil(context: Context): Long {
    val until = prefs(context).getLong(KEY_LOCKED_UNTIL, 0L)
    return if (until > System.currentTimeMillis()) until else 0L
  }

  fun set(context: Context, pin: String) {
    require(isValid(pin)) { "PIN must be $PIN_LENGTH digits" }
    synchronized(lock) {
      val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
      prefs(context)
          .edit()
          .putString(KEY_SALT, encode(salt))
          .putString(KEY_HASH, encode(derive(pin, salt)))
          .putInt(KEY_FAILURES, 0)
          .putLong(KEY_LOCKED_UNTIL, 0L)
          .apply()
    }
  }

  fun clear(context: Context) {
    synchronized(lock) { prefs(context).edit().clear().apply() }
  }

  fun verify(context: Context, pin: String): Result =
      synchronized(lock) {
        val prefs = prefs(context)
        val waiting = lockedUntil(context)
        if (waiting > 0) {
          return Result.Rejected(waiting)
        }
        val salt = prefs.getString(KEY_SALT, null)?.let(::decode)
        val stored = prefs.getString(KEY_HASH, null)?.let(::decode)
        val matches =
            salt != null &&
                stored != null &&
                isValid(pin) &&
                MessageDigest.isEqual(derive(pin, salt), stored)
        if (matches) {
          prefs.edit().putInt(KEY_FAILURES, 0).putLong(KEY_LOCKED_UNTIL, 0L).apply()
          return Result.Ok
        }
        val failures = prefs.getInt(KEY_FAILURES, 0) + 1
        val until =
            if (failures < FREE_ATTEMPTS) 0L
            else {
              val doublings = (failures - FREE_ATTEMPTS).coerceAtMost(10)
              System.currentTimeMillis() + (FIRST_WAIT_MS shl doublings).coerceAtMost(MAX_WAIT_MS)
            }
        prefs.edit().putInt(KEY_FAILURES, failures).putLong(KEY_LOCKED_UNTIL, until).apply()
        Result.Rejected(until)
      }

  private fun derive(pin: String, salt: ByteArray): ByteArray {
    val spec = PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, HASH_BITS)
    val stretched =
        try {
          SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
          spec.clearPassword()
        }
    return Mac.getInstance("HmacSHA256").run {
      init(hmacKey())
      doFinal(stretched)
    }
  }

  private fun hmacKey(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(HMAC_ALIAS, null) as? SecretKey)?.let {
      return it
    }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, KEYSTORE)
        .apply { init(KeyGenParameterSpec.Builder(HMAC_ALIAS, KeyProperties.PURPOSE_SIGN).build()) }
        .generateKey()
  }

  private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)

  private fun decode(text: String) = Base64.decode(text, Base64.NO_WRAP)

  private fun prefs(context: Context) =
      context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
