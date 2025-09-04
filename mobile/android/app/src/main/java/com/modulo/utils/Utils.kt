package com.modulo.utils

import com.google.gson.*
import java.lang.reflect.Type
import java.text.SimpleDateFormat
import java.util.*

/**
 * Gson Type Adapter for Date serialization/deserialization
 */
class DateTypeAdapter : JsonSerializer<Date>, JsonDeserializer<Date> {
    
    companion object {
        private const val DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
    }
    
    private val dateFormat = SimpleDateFormat(DATE_FORMAT, Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    override fun serialize(src: Date?, typeOfSrc: Type?, context: JsonSerializationContext?): JsonElement {
        return if (src != null) {
            JsonPrimitive(dateFormat.format(src))
        } else {
            JsonNull.INSTANCE
        }
    }
    
    override fun deserialize(json: JsonElement?, typeOfT: Type?, context: JsonDeserializationContext?): Date? {
        if (json == null || json.isJsonNull) return null
        
        return try {
            val dateString = json.asString
            dateFormat.parse(dateString)
        } catch (e: Exception) {
            // Try parsing as timestamp if date format fails
            try {
                Date(json.asLong)
            } catch (e2: Exception) {
                null
            }
        }
    }
}

/**
 * Utility functions for date operations
 */
object DateUtils {
    
    /**
     * Format date for display
     */
    fun formatForDisplay(date: Date): String {
        val displayFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())
        return displayFormat.format(date)
    }
    
    /**
     * Format date as relative time (e.g., "2 hours ago")
     */
    fun formatRelativeTime(date: Date): String {
        val now = Date()
        val diffInMillis = now.time - date.time
        
        return when {
            diffInMillis < 60_000 -> "Just now"
            diffInMillis < 3600_000 -> "${diffInMillis / 60_000} minutes ago"
            diffInMillis < 86400_000 -> "${diffInMillis / 3600_000} hours ago"
            diffInMillis < 604800_000 -> "${diffInMillis / 86400_000} days ago"
            else -> formatForDisplay(date)
        }
    }
    
    /**
     * Check if date is today
     */
    fun isToday(date: Date): Boolean {
        val cal1 = Calendar.getInstance().apply { time = Date() }
        val cal2 = Calendar.getInstance().apply { time = date }
        
        return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
                cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
    }
}

/**
 * Network connectivity utilities
 */
object NetworkUtils {
    
    /**
     * Check if device is connected to network
     */
    fun isConnected(context: android.content.Context): Boolean {
        val connectivityManager = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) 
            as android.net.ConnectivityManager
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            
            return capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            return networkInfo?.isConnectedOrConnecting == true
        }
    }
    
    /**
     * Check if device is connected to WiFi
     */
    fun isConnectedToWifi(context: android.content.Context): Boolean {
        val connectivityManager = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) 
            as android.net.ConnectivityManager
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            
            return capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            return networkInfo?.type == android.net.ConnectivityManager.TYPE_WIFI
        }
    }
}

/**
 * String validation utilities
 */
object ValidationUtils {
    
    /**
     * Validate email format
     */
    fun isValidEmail(email: String): Boolean {
        return android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
    }
    
    /**
     * Validate password strength
     */
    fun isValidPassword(password: String): Boolean {
        return password.length >= 8 && 
                password.any { it.isUpperCase() } &&
                password.any { it.isLowerCase() } &&
                password.any { it.isDigit() }
    }
    
    /**
     * Validate note title
     */
    fun isValidNoteTitle(title: String): Boolean {
        return title.trim().isNotEmpty() && title.length <= 200
    }
    
    /**
     * Validate note content
     */
    fun isValidNoteContent(content: String): Boolean {
        return content.length <= 10_000 // 10KB limit
    }
}

/**
 * UUID utilities
 */
object UuidUtils {
    
    /**
     * Generate a new UUID string
     */
    fun generate(): String = UUID.randomUUID().toString()
    
    /**
     * Validate UUID format
     */
    fun isValid(uuid: String): Boolean {
        return try {
            UUID.fromString(uuid)
            true
        } catch (e: IllegalArgumentException) {
            false
        }
    }
}
