package com.transfo.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class PairResult(
    val deviceName: String,
    val token: String,
    val pairedAt: String
)

data class SessionInfo(
    val id: String,
    val name: String,
    val size: Long,
    val received: Long,
    val status: String
)

class TransfoApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun buildUrl(hostOrIp: String, port: Int, path: String): String {
        val raw = hostOrIp.trim()
        val isExplicitHttps = raw.startsWith("https://", ignoreCase = true)
        val isExplicitHttp = raw.startsWith("http://", ignoreCase = true)
        val cleaned = raw
            .removePrefix("http://")
            .removePrefix("https://")
            .removePrefix("HTTP://")
            .removePrefix("HTTPS://")
            .trimEnd('/')

        val normalizedPath = if (path.startsWith("/")) path else "/$path"

        // Explicit host:port -> keep it, preserving an explicit https scheme.
        if (cleaned.contains(":")) {
            val scheme = if (isExplicitHttps) "https" else "http"
            return "$scheme://$cleaned$normalizedPath"
        }
        // Explicit https without port -> default 443, no port suffix.
        if (isExplicitHttps) return "https://$cleaned$normalizedPath"
        // Explicit http without port -> append caller's port unless standard.
        if (isExplicitHttp) {
            return if (port != 80 && port != 443) "http://$cleaned:$port$normalizedPath"
            else "http://$cleaned$normalizedPath"
        }
        // Bare domain (e.g. transfoo.vercel.app) -> HTTPS cloud.
        if (cleaned.contains(".") && !cleaned.matches(Regex("""^\d+\.\d+\.\d+\.\d+$"""))) {
            return "https://$cleaned$normalizedPath"
        }
        // Bare LAN IP -> http + port.
        return "http://$cleaned:$port$normalizedPath"
    }

    suspend fun login(ip: String, port: Int = 4000, email: String = "pc", password: String = "transfo"): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val url = buildUrl(ip, port, "/api/auth/login")
            val bodyObj = JSONObject().apply {
                put("email", email)
                put("password", password)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    throw Exception("Login failed HTTP ${response.code}: $respStr")
                }
                val json = JSONObject(respStr)
                json.optString("token").takeIf { it.isNotEmpty() }
                    ?: throw Exception("No token in response: $respStr")
            }
        }
    }

    suspend fun initiatePairing(ip: String, port: Int = 4000, deviceName: String = "Android-Native"): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val url = buildUrl(ip, port, "/api/pairing")
            val bodyObj = JSONObject().apply {
                put("deviceName", deviceName)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    throw Exception("Pairing init failed HTTP ${response.code}: $respStr")
                }
                val json = JSONObject(respStr)
                json.optString("code").takeIf { it.isNotEmpty() }
                    ?: throw Exception("No code in pairing init response: $respStr")
            }
        }
    }

    suspend fun authorizePairing(ip: String, port: Int = 4000, code: String, token: String): Result<PairResult> = withContext(Dispatchers.IO) {
        runCatching {
            val url = buildUrl(ip, port, "/api/pairing/authorize")
            val bodyObj = JSONObject().apply {
                put("code", code)
            }
            val request = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    throw Exception("Pairing auth failed HTTP ${response.code}: $respStr")
                }
                val json = JSONObject(respStr)
                val pairedToken = json.optString("token")
                val devName = json.optString("deviceName", "Unknown PC")
                val pairedAt = json.optString("pairedAt", "")
                if (pairedToken.isEmpty()) {
                    throw Exception("No paired token returned: $respStr")
                }
                PairResult(devName, pairedToken, pairedAt)
            }
        }
    }

    suspend fun createTransferSession(
        ip: String,
        port: Int = 4000,
        token: String,
        fileName: String,
        fileSize: Long,
        chunkSize: Int = 65536
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val url = buildUrl(ip, port, "/api/transfer/sessions")
            val bodyObj = JSONObject().apply {
                put("name", fileName)
                put("size", fileSize)
                put("chunkSize", chunkSize)
            }
            val request = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    throw Exception("Session creation failed HTTP ${response.code}: $respStr")
                }
                val json = JSONObject(respStr)
                json.optString("id").takeIf { it.isNotEmpty() }
                    ?: throw Exception("No session ID returned: $respStr")
            }
        }
    }

    suspend fun uploadChunk(
        ip: String,
        port: Int = 4000,
        token: String,
        sessionId: String,
        base64Data: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val url = buildUrl(ip, port, "/api/transfer/sessions/$sessionId/chunk")
            val bodyObj = JSONObject().apply {
                put("data", base64Data)
            }
            val request = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw Exception("Chunk upload failed HTTP ${response.code}")
                }
                true
            }
        }
    }

    suspend fun getSessionStatus(
        ip: String,
        port: Int = 4000,
        token: String,
        sessionId: String
    ): Result<SessionInfo> = withContext(Dispatchers.IO) {
        runCatching {
            val url = buildUrl(ip, port, "/api/transfer/sessions/$sessionId")
            val request = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    throw Exception("Status fetch failed HTTP ${response.code}: $respStr")
                }
                val json = JSONObject(respStr)
                SessionInfo(
                    id = json.optString("id", sessionId),
                    name = json.optString("name", "file"),
                    size = json.optLong("size", 0L),
                    received = json.optLong("received", 0L),
                    status = json.optString("status", "unknown")
                )
            }
        }
    }
}
