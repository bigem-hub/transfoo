package com.transfo.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import kotlin.coroutines.coroutineContext

data class DiscoveredPeer(
    val id: String,
    val name: String,
    val ip: String,
    val port: Int,
    val lastSeen: Long = System.currentTimeMillis()
)

class UdpDiscovery(private val discoveryPort: Int = 4001) {

    suspend fun listen(onPeerFound: (DiscoveredPeer) -> Unit) = withContext(Dispatchers.IO) {
        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket(discoveryPort).apply {
                broadcast = true
                reuseAddress = true
                soTimeout = 2000
            }
            val buffer = ByteArray(2048)
            val packet = DatagramPacket(buffer, buffer.size)

            while (coroutineContext.isActive) {
                try {
                    socket.receive(packet)
                    val text = String(packet.data, 0, packet.length)
                    val senderIp = packet.address?.hostAddress ?: continue

                    val json = JSONObject(text)
                    val deviceId = json.optString("deviceId").ifEmpty { json.optString("id") }
                    val deviceName = json.optString("deviceName").ifEmpty { json.optString("name", "Transfo Peer") }
                    val port = json.optInt("port", 8765)

                    if (deviceId.isNotEmpty()) {
                        val peer = DiscoveredPeer(
                            id = deviceId,
                            name = deviceName,
                            ip = senderIp,
                            port = port,
                            lastSeen = System.currentTimeMillis()
                        )
                        onPeerFound(peer)
                    }
                } catch (e: java.net.SocketTimeoutException) {
                    // Normal timeout to check coroutine isActive
                } catch (e: Exception) {
                    // Ignore malformed packets
                }
            }
        } catch (e: Exception) {
            // Socket bind error
        } finally {
            socket?.close()
        }
    }

    suspend fun broadcastAnnouncement(deviceId: String, deviceName: String, servicePort: Int = 4000) = withContext(Dispatchers.IO) {
        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket().apply {
                broadcast = true
            }
            val json = JSONObject().apply {
                put("deviceId", deviceId)
                put("deviceName", deviceName)
                put("port", servicePort)
                put("ts", System.currentTimeMillis())
            }
            val bytes = json.toString().toByteArray(Charsets.UTF_8)
            val broadcastAddr = InetAddress.getByName("255.255.255.255")
            val packet = DatagramPacket(bytes, bytes.size, broadcastAddr, discoveryPort)
            socket.send(packet)
        } catch (e: Exception) {
            // Broadcast error
        } finally {
            socket?.close()
        }
    }

    companion object {
        fun getLocalIpAddress(): String {
            try {
                val interfaces = NetworkInterface.getNetworkInterfaces() ?: return "127.0.0.1"
                for (nif in interfaces) {
                    if (nif.isLoopback || !nif.isUp) continue
                    val addresses = nif.inetAddresses
                    for (addr in addresses) {
                        if (addr is Inet4Address && !addr.isLoopbackAddress) {
                            val ip = addr.hostAddress ?: ""
                            if (ip.isNotEmpty() && !ip.startsWith("127.")) {
                                return ip
                            }
                        }
                    }
                }
            } catch (e: Exception) { }
            return "127.0.0.1"
        }
    }
}
