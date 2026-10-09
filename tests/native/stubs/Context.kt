package android.content
open class Context {
    companion object { const val MODE_PRIVATE = 0 }
    val preferences = Preferences()
    fun getSharedPreferences(name: String, mode: Int) = preferences
}
class Preferences {
    var enabled = true
    var fallback = 0f
    fun getBoolean(key: String, default: Boolean) = enabled
    fun getFloat(key: String, default: Float) = if (key == "fallback") fallback else 0f
}
