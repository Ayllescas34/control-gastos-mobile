package com.controlgastos.backup

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import com.facebook.fbreact.specs.NativeBackupFilesSpec
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Saves and opens backup files through the Storage Access Framework: the system picker
 * grants access to the one document the user chooses, so no storage permission is needed
 * and no file path is assumed. Contract (codes, threading): src/core/native/specs/
 * NativeBackupFiles.ts and docs/backup.md. File contents are never logged.
 */
class BackupFilesModule(private val context: ReactApplicationContext) :
    NativeBackupFilesSpec(context), ActivityEventListener {

  private sealed class Request(val promise: Promise) {
    class Save(promise: Promise, val content: String) : Request(promise)

    class Open(promise: Promise, val maxBytes: Long) : Request(promise)
  }

  /** The picker currently open, if any. Touched from the JS and UI threads. */
  private var pending: Request? = null
  private val lock = Any()

  /** Reading and writing happen off the UI thread, one at a time. */
  private val io: ExecutorService = Executors.newSingleThreadExecutor()

  init {
    context.addActivityEventListener(this)
  }

  override fun createDocument(suggestedName: String, content: String, promise: Promise) {
    val intent =
        Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = JSON_MIME_TYPE
          putExtra(Intent.EXTRA_TITLE, suggestedName)
        }
    launch(intent, REQUEST_SAVE, Request.Save(promise, content))
  }

  override fun openDocument(maxBytes: Double, promise: Promise) {
    val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          // Some providers label .json files as text or generic binary data.
          type = "*/*"
          putExtra(Intent.EXTRA_MIME_TYPES, OPENABLE_MIME_TYPES)
        }
    launch(intent, REQUEST_OPEN, Request.Open(promise, maxBytes.toLong()))
  }

  private fun launch(intent: Intent, requestCode: Int, request: Request) {
    val activity = context.currentActivity
    if (activity == null) {
      request.promise.reject(E_NO_ACTIVITY, "The app is not in the foreground")
      return
    }
    synchronized(lock) {
      if (pending != null) {
        request.promise.reject(E_BUSY, "A file picker is already open")
        return
      }
      pending = request
    }
    try {
      activity.startActivityForResult(intent, requestCode)
    } catch (error: ActivityNotFoundException) {
      synchronized(lock) { pending = null }
      request.promise.reject(E_UNAVAILABLE, "No app can show the file picker", error)
    }
  }

  override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?
  ) {
    if (requestCode != REQUEST_SAVE && requestCode != REQUEST_OPEN) {
      return
    }
    val request = synchronized(lock) { pending.also { pending = null } } ?: return
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      request.promise.reject(E_CANCELLED, "The user closed the file picker")
      return
    }
    io.execute {
      when (request) {
        is Request.Save -> write(uri, request)
        is Request.Open -> read(uri, request)
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun write(uri: Uri, request: Request.Save) {
    try {
      openOutput(uri).use { output ->
        output.write(request.content.toByteArray(Charsets.UTF_8))
        output.flush()
      }
      request.promise.resolve(null)
    } catch (error: Exception) {
      // Do not leave an empty or partial document behind.
      runCatching { DocumentsContract.deleteDocument(context.contentResolver, uri) }
      request.promise.reject(E_WRITE_FAILED, "Could not write the backup file", error)
    }
  }

  /** "wt" truncates; a few providers only accept "w" (the document was just created). */
  private fun openOutput(uri: Uri): OutputStream {
    val resolver = context.contentResolver
    val stream =
        try {
          resolver.openOutputStream(uri, "wt")
        } catch (error: IllegalArgumentException) {
          resolver.openOutputStream(uri, "w")
        }
    return stream ?: throw IOException("The provider returned no output stream")
  }

  private fun read(uri: Uri, request: Request.Open) {
    try {
      val stream =
          context.contentResolver.openInputStream(uri)
              ?: throw IOException("The provider returned no input stream")
      val bytes = stream.use { readAtMost(it, request.maxBytes) }
      if (bytes == null) {
        request.promise.reject(E_TOO_LARGE, "The file is larger than the allowed size")
        return
      }
      request.promise.resolve(decodeUtf8(bytes))
    } catch (error: CharacterCodingException) {
      request.promise.reject(E_NOT_TEXT, "The file is not UTF-8 text", error)
    } catch (error: Exception) {
      request.promise.reject(E_READ_FAILED, "Could not read the file", error)
    }
  }

  /** The whole stream, or null as soon as it exceeds `maxBytes`. */
  private fun readAtMost(input: InputStream, maxBytes: Long): ByteArray? {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(BUFFER_SIZE)
    var total = 0L
    while (true) {
      val read = input.read(buffer)
      if (read < 0) {
        return output.toByteArray()
      }
      total += read
      if (total > maxBytes) {
        return null
      }
      output.write(buffer, 0, read)
    }
  }

  /** Strict UTF-8: malformed bytes fail instead of becoming replacement characters. */
  private fun decodeUtf8(bytes: ByteArray): String =
      Charsets.UTF_8.newDecoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .decode(ByteBuffer.wrap(bytes))
          .toString()

  override fun invalidate() {
    context.removeActivityEventListener(this)
    synchronized(lock) { pending.also { pending = null } }
        ?.promise
        ?.reject(E_CANCELLED, "The app was reloaded")
    io.shutdown()
    super.invalidate()
  }

  companion object {
    private const val REQUEST_SAVE = 41_001
    private const val REQUEST_OPEN = 41_002
    private const val BUFFER_SIZE = 64 * 1024
    private const val JSON_MIME_TYPE = "application/json"
    private val OPENABLE_MIME_TYPES =
        arrayOf(JSON_MIME_TYPE, "text/plain", "application/octet-stream")

    private const val E_CANCELLED = "E_CANCELLED"
    private const val E_BUSY = "E_BUSY"
    private const val E_NO_ACTIVITY = "E_NO_ACTIVITY"
    private const val E_UNAVAILABLE = "E_UNAVAILABLE"
    private const val E_WRITE_FAILED = "E_WRITE_FAILED"
    private const val E_READ_FAILED = "E_READ_FAILED"
    private const val E_TOO_LARGE = "E_TOO_LARGE"
    private const val E_NOT_TEXT = "E_NOT_TEXT"
  }
}
