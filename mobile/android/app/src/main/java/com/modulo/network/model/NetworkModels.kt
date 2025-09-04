package com.modulo.network.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * Data Transfer Object for Note API communication
 * Represents note data structure for network operations
 */
data class NoteDto(
    @SerializedName("id")
    val id: Long?,
    
    @SerializedName("title")
    val title: String,
    
    @SerializedName("content")
    val content: String,
    
    @SerializedName("createdAt")
    val createdAt: Date,
    
    @SerializedName("updatedAt")
    val updatedAt: Date,
    
    @SerializedName("userId")
    val userId: Long? = null,
    
    @SerializedName("tags")
    val tags: List<String>? = null,
    
    @SerializedName("version")
    val version: Int? = null
)

/**
 * API Error response
 */
data class ApiErrorResponse(
    @SerializedName("error")
    val error: String,
    
    @SerializedName("message")
    val message: String,
    
    @SerializedName("timestamp")
    val timestamp: Date,
    
    @SerializedName("path")
    val path: String? = null,
    
    @SerializedName("status")
    val status: Int
)

/**
 * Authentication request
 */
data class AuthRequest(
    @SerializedName("username")
    val username: String,
    
    @SerializedName("password")
    val password: String
)

/**
 * Authentication response
 */
data class AuthResponse(
    @SerializedName("token")
    val token: String,
    
    @SerializedName("refreshToken")
    val refreshToken: String,
    
    @SerializedName("expiresIn")
    val expiresIn: Long,
    
    @SerializedName("user")
    val user: UserDto
)

/**
 * User data transfer object
 */
data class UserDto(
    @SerializedName("id")
    val id: Long,
    
    @SerializedName("username")
    val username: String,
    
    @SerializedName("email")
    val email: String,
    
    @SerializedName("displayName")
    val displayName: String? = null,
    
    @SerializedName("avatarUrl")
    val avatarUrl: String? = null
)
