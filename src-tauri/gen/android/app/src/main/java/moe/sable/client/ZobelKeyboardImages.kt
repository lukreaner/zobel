package moe.sable.client

import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.WebView
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import androidx.core.view.inputmethod.InputContentInfoCompat
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Zobel: lets keyboards such as Gboard insert GIFs, stickers and images into text fields.
 *
 * The WebView tells keyboards it only takes text, so Gboard greys its GIFs out ("This app
 * doesn't support images here"). This declares the image types as well, reads what the keyboard
 * hands over and passes it to the page as the `zobel-keyboard-image` event, which
 * `src/lib/zobel/keyboard-images.ts` pastes into the focused field.
 */
object ZobelKeyboardImages {
    val MIME_TYPES = arrayOf("image/gif", "image/png", "image/jpeg", "image/webp")

    /** Images larger than this are refused, as the page gets them as one base64 string. */
    private const val MAX_BYTES = 32 * 1024 * 1024

    private val reader = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    fun wrap(webView: WebView, connection: InputConnection?, outAttrs: EditorInfo): InputConnection? {
        if (connection == null) return null
        EditorInfoCompat.setContentMimeTypes(outAttrs, MIME_TYPES)
        @Suppress("DEPRECATION")
        return InputConnectionCompat.createWrapper(connection, outAttrs) { content, flags, _ ->
            accept(webView, content, flags)
        }
    }

    private fun accept(webView: WebView, content: InputContentInfoCompat, flags: Int): Boolean {
        val description = content.description
        val mime = (0 until description.mimeTypeCount)
            .map { description.getMimeType(it) }
            .firstOrNull { type -> MIME_TYPES.any { it.equals(type, ignoreCase = true) } }
            ?: return false
        if (flags and InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION != 0) {
            try {
                content.requestPermission()
            } catch (_: Exception) {
                return false
            }
        }
        val resolver = webView.context.contentResolver
        reader.execute {
            try {
                val bytes = resolver.openInputStream(content.contentUri)?.use { input ->
                    input.readBytes()
                }
                if (bytes != null && bytes.isNotEmpty() && bytes.size <= MAX_BYTES) {
                    val name = content.contentUri.lastPathSegment
                        ?.substringAfterLast('/')
                        ?.takeIf { it.contains('.') }
                        ?: "image.${mime.substringAfter('/')}"
                    val detail = JSONObject()
                        .put("mime", mime)
                        .put("name", name)
                        .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
                    val script =
                        "window.dispatchEvent(new CustomEvent('zobel-keyboard-image',{detail:$detail}))"
                    main.post { webView.evaluateJavascript(script, null) }
                }
            } catch (error: Exception) {
                Log.w("ZobelKeyboardImages", "Could not read the image from the keyboard", error)
            } finally {
                content.releasePermission()
            }
        }
        return true
    }
}
