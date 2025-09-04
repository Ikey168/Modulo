package com.modulo.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.*

/**
 * Manages authentication tokens with secure storage
 * Uses EncryptedSharedPreferences for secure token storage
 */
class TokenManager(private val context: Context) {
    
    companion object {
        private const val PREFS_NAME = "modulo_auth_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token" 
        private const val KEY_TOKEN_EXPIRY = "token_expiry"
        private const val KEY_USER_ID = "user_id"
        private const val REFRESH_BUFFER_MINUTES = 5L // Refresh token 5 minutes before expiry
    }
    
    private val mutex = Mutex()
    
    private val encryptedPrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }
    
    /**
     * Store authentication tokens
     */
    suspend fun storeTokens(
        accessToken: String,
        refreshToken: String,
        expiresInSeconds: Long,
        userId: Long
    ) = mutex.withLock {
        val expiryTime = System.currentTimeMillis() + (expiresInSeconds * 1000)
        
        encryptedPrefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_TOKEN_EXPIRY, expiryTime)
            .putLong(KEY_USER_ID, userId)
            .apply()
    }
    
    /**
     * Get current access token if valid
     */
    fun getAccessToken(): String? {
        val token = encryptedPrefs.getString(KEY_ACCESS_TOKEN, null)
        val expiryTime = encryptedPrefs.getLong(KEY_TOKEN_EXPIRY, 0)
        
        // Check if token is expired (with buffer for refresh)
        val bufferTime = REFRESH_BUFFER_MINUTES * 60 * 1000
        if (System.currentTimeMillis() + bufferTime >= expiryTime) {
            return null
        }
        
        return token
    }
    
    /**
     * Get refresh token
     */
    fun getRefreshToken(): String? {
        return encryptedPrefs.getString(KEY_REFRESH_TOKEN, null)
    }
    
    /**
     * Get stored user ID
     */
    fun getUserId(): Long? {
        val userId = encryptedPrefs.getLong(KEY_USER_ID, -1)
        return if (userId == -1L) null else userId
    }
    
    /**
     * Check if user is authenticated
     */
    fun isAuthenticated(): Boolean {
        return getAccessToken() != null || getRefreshToken() != null
    }
    
    /**
     * Check if access token is expired
     */
    fun isAccessTokenExpired(): Boolean {
        val expiryTime = encryptedPrefs.getLong(KEY_TOKEN_EXPIRY, 0)
        return System.currentTimeMillis() >= expiryTime
    }
    
    /**
     * Refresh access token using refresh token
     * Returns new access token or null if refresh failed
     */
    suspend fun refreshToken(): String? = mutex.withLock {
        val refreshToken = getRefreshToken() ?: return@withLock null
        
        try {
            // TODO: Implement actual refresh token API call
            // For now, return null to indicate refresh is not implemented
            // This should make an API call to refresh the token
            
            /*
            val authService = // Get auth service instance
            val response = authService.refreshToken(RefreshTokenRequest(refreshToken))
            
            storeTokens(
                response.token,
                response.refreshToken,
                response.expiresIn,
                response.user.id
            )
            
            return@withLock response.token
            */
            
            return@withLock null
        } catch (e: Exception) {
            // Refresh failed, clear all tokens
            clearTokens()
            return@withLock null
        }
    }
    
    /**
     * Clear all stored tokens
     */
    fun clearTokens() {
        encryptedPrefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_TOKEN_EXPIRY)
            .remove(KEY_USER_ID)
            .apply()
    }
    
    /**
     * Get token expiry time
     */
    fun getTokenExpiryTime(): Date? {
        val expiryTime = encryptedPrefs.getLong(KEY_TOKEN_EXPIRY, 0)
        return if (expiryTime > 0) Date(expiryTime) else null
    }
    
    /**
     * Get time until token expires (in minutes)
     */
    fun getMinutesUntilExpiry(): Long {
        val expiryTime = encryptedPrefs.getLong(KEY_TOKEN_EXPIRY, 0)
        if (expiryTime == 0L) return 0L
        
        val timeUntilExpiry = expiryTime - System.currentTimeMillis()
        return if (timeUntilExpiry > 0) timeUntilExpiry / (60 * 1000) else 0L
    }
}

/**
 * Token refresh request
 */
data class RefreshTokenRequest(
    val refreshToken: String
)

/**
 * Authentication state
 */
sealed class AuthState {
    object Authenticated : AuthState()
    object Unauthenticated : AuthState()
    object TokenExpired : AuthState()
    data class Error(val message: String) : AuthState()
}
