package com.modulo.network.interceptor

import com.modulo.auth.TokenManager
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

/**
 * OkHttp Interceptor for handling authentication
 * Automatically adds Authorization header with Bearer token
 */
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    
    @Throws(IOException::class)
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        // Get current access token
        val accessToken = tokenManager.getAccessToken()
        
        // If no token available, proceed without auth header
        if (accessToken.isNullOrBlank()) {
            return chain.proceed(originalRequest)
        }
        
        // Add Authorization header
        val authenticatedRequest = originalRequest.newBuilder()
            .header("Authorization", "Bearer $accessToken")
            .build()
        
        val response = chain.proceed(authenticatedRequest)
        
        // Handle token refresh on 401 Unauthorized
        if (response.code == 401) {
            response.close()
            
            // Attempt to refresh token
            val refreshedToken = tokenManager.refreshToken()
            
            if (refreshedToken != null) {
                // Retry with new token
                val retryRequest = originalRequest.newBuilder()
                    .header("Authorization", "Bearer $refreshedToken")
                    .build()
                
                return chain.proceed(retryRequest)
            } else {
                // Refresh failed, clear tokens and proceed
                tokenManager.clearTokens()
            }
        }
        
        return response
    }
}

/**
 * Error handling interceptor
 */
class ErrorInterceptor : Interceptor {
    
    @Throws(IOException::class)
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        
        when (response.code) {
            in 200..299 -> {
                // Success - no action needed
            }
            400 -> {
                throw IOException("Bad Request: ${response.message}")
            }
            401 -> {
                throw IOException("Unauthorized: Authentication required")
            }
            403 -> {
                throw IOException("Forbidden: Access denied")
            }
            404 -> {
                throw IOException("Not Found: Resource not found")
            }
            409 -> {
                throw IOException("Conflict: Resource conflict")
            }
            422 -> {
                throw IOException("Unprocessable Entity: Validation error")
            }
            in 500..599 -> {
                throw IOException("Server Error: ${response.message}")
            }
            else -> {
                throw IOException("HTTP Error ${response.code}: ${response.message}")
            }
        }
        
        return response
    }
}
