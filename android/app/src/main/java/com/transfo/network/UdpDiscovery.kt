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

    suspend fun listen(
        onPeerFound: (DiscoveredPeer) -> Unit,
        onLog: (String) -> Unit = {}
    ) = withContext(Dispatchers.IO) {
        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket(null).apply {
                broadcast = true
                reuseAddress = true
                bind(java.net.InetSocketAddress(discoveryPort))
                soTimeout = 2000
            }
            onLog("Listening on UDP port $discoveryPort")
            val buffer = ByteArray(2048)
            val packet = DatagramPacket(buffer, buffer.size)

            while (coroutineContext.isActive) {
                try {
                    socket.receive(packet)
                    val text = String(packet.data, 0, packet.length)
                    val senderIp = packet.address?.hostAddress ?: continue

                    try {
                        val json = JSONObject(text)
                        val deviceId = json.optString("deviceId").ifEmpty { json.optString("id") }
                        val deviceName = json.optString("deviceName").ifEmpty { json.optString("name", "Transfo Peer") }
                        val port = json.optInt("port", 4000)

                        if (deviceId.isNotEmpty()) {
                            val peer = DiscoveredPeer(
                                id = deviceId,
                                name = deviceName,
                                ip = senderIp,
                                port = port,
                                lastSeen = System.currentTimeMillis()
                            )
                            onPeerFound(peer)
                        } else {
                            onLog("Ignored packet without deviceId from $senderIp")
                        }
                    } catch (e: Exception) {
                        onLog("Ignored malformed packet from $senderIp (${text.length} bytes)")
                    }
                } catch (e: java.net.SocketTimeoutException) {
                    // Normal timeout to check coroutine isActive
                } catch (e: Exception) {
                    onLog("Receive error: ${e.message}")
                }
            }
        } catch (e: Exception) {
            onLog("Could not bind UDP port $discoveryPort: ${e.message}")
        } finally {
            socket?.close()
        }
    }

    /** Targets for announces: every interface subnet broadcast + global fallback. */
    fun broadcastTargets(): List<InetAddress> {
        val out = LinkedHashSet<InetAddress>()
        try {
            val ifaces = NetworkInterface.getNetworkInterfaces() ?: return listOf(InetAddress.getByName("255.255.255.255"))
            for (nif in ifaces) {
                if (nif.isLoopback || !nif.isUp) continue
                for (ia in nif.interfaceAddresses) {
                    val bcast = ia.broadcast
                    if (bcast != null) out.add(bcast)
                }
            }
        } catch (e: Exception) { /* fall through to global */ }
        out.add(InetAddress.getByName("255.255.255.255"))
        return out.toList()
    }

    suspend fun broadcastAnnouncement(
        deviceId: String,
        deviceName: String,
        servicePort: Int = 4000,
        onLog: (String) -> Unit = {}
    ): Int = withContext(Dispatchers.IO) {
        var socket: DatagramSocket? = null
        var sent = 0
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
            for (target in broadcastTargets()) {
                try {
                    socket.send(DatagramPacket(bytes, bytes.size, target, discoveryPort))
                    sent++
                } catch (e: Exception) {
                    onLog("Announce failed via ${target.hostAddress}: ${e.message}")
                }
            }
            if (sent > 0) onLog("Announced $deviceName to $sent network(s)")
        } catch (e: Exception) {
            onLog("Announce error: ${e.message}")
        } finally {
            socket?.close()
        }
        sent
    }

    /** Repeating announcer. Cancels with the caller's coroutine scope. */
    suspend fun announceLoop(
        deviceId: String,
        deviceName: String,
        servicePort: Int = 4000,
        intervalMs: Long = 3000,
        onLog: (String) -> Unit = {}
    ) = withContext(Dispatchers.IO) {
        onLog("Announcer started (every ${intervalMs}ms)")
        while (coroutineContext.isActive) {
            broadcastAnnouncement(deviceId, deviceName, servicePort, onLog)
            try {
                kotlinx.coroutines.delay(intervalMs)
            } catch (e: Exception) {
                break
            }
        }
        onLog("Announcer stopped")
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
