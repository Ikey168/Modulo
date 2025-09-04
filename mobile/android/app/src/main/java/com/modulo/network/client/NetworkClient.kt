package com.modulo.network.client

import com.modulo.network.api.NotesApiService
import com.modulo.network.interceptor.AuthInterceptor
import com.modulo.network.interceptor.ErrorInterceptor
import com.modulo.utils.DateTypeAdapter
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.Date
import java.util.concurrent.TimeUnit

/**
 * Network client configuration for API communication
 * Configures Retrofit, OkHttp, and Gson for backend integration
 */
object NetworkClient {
    
    private const val DEFAULT_TIMEOUT_SECONDS = 30L
    private const val BASE_URL = "https://api.modulo.app/" // TODO: Configure based on environment
    
    /**
     * Gson instance with custom date handling
     */
    val gson: Gson by lazy {
        GsonBuilder()
            .registerTypeAdapter(Date::class.java, DateTypeAdapter())
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .create()
    }
    
    /**
     * OkHttp client with interceptors
     */
    private fun createOkHttpClient(
        authInterceptor: AuthInterceptor,
        enableLogging: Boolean = false
    ): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(DEFAULT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(DEFAULT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(DEFAULT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(ErrorInterceptor())
        
        if (enableLogging) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }
        
        return builder.build()
    }
    
    /**
     * Create Retrofit instance
     */
    private fun createRetrofit(
        baseUrl: String,
        okHttpClient: OkHttpClient
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }
    
    /**
     * Create Notes API service
     */
    fun createNotesApiService(
        authInterceptor: AuthInterceptor,
        baseUrl: String = BASE_URL,
        enableLogging: Boolean = false
    ): NotesApiService {
        val okHttpClient = createOkHttpClient(authInterceptor, enableLogging)
        val retrofit = createRetrofit(baseUrl, okHttpClient)
        return retrofit.create(NotesApiService::class.java)
    }
}

/**
 * Network configuration
 */
data class NetworkConfig(
    val baseUrl: String = "https://api.modulo.app/",
    val connectTimeoutSeconds: Long = 30L,
    val readTimeoutSeconds: Long = 30L,
    val writeTimeoutSeconds: Long = 30L,
    val enableLogging: Boolean = false
)

/**
 * Network status
 */
enum class NetworkStatus {
    CONNECTED,
    DISCONNECTED,
    CONNECTING,
    ERROR
}

/**
 * API response wrapper
 */
sealed class ApiResult<T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error<T>(val exception: Throwable, val errorBody: String? = null) : ApiResult<T>()
    data class Loading<T>(val message: String = "Loading...") : ApiResult<T>()
}

/**
 * Extension function to handle API responses
 */
suspend fun <T> safeApiCall(apiCall: suspend () -> T): ApiResult<T> {
    return try {
        ApiResult.Success(apiCall())
    } catch (e: Exception) {
        ApiResult.Error(e)
    }
}
