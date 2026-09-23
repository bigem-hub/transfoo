package com.transfo

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.transfo.network.DiscoveredPeer
import com.transfo.network.TransfoApiClient
import com.transfo.network.UdpDiscovery
import com.transfo.service.TransferService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.InputStream
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TransfoModernTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ModernTransfoApp()
                }
            }
        }
    }
}

// Visual Theme Definitions
val AmberPrimary = Color(0xFFF59E0B)
val AmberLight = Color(0xFFFBBF24)
val EmeraldAccent = Color(0xFF10B981)
val DarkBackground = Color(0xFF09090B)
val CardBackground = Color(0xFF18181B)
val SurfaceBorder = Color(0xFF27272A)
val TextMuted = Color(0xFFA1A1AA)

@Composable
fun TransfoModernTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = AmberPrimary,
            secondary = EmeraldAccent,
            background = DarkBackground,
            surface = CardBackground,
            onSurface = Color.White,
            onBackground = Color.White
        ),
        content = content
    )
}

enum class NavTab(val title: String, val icon: ImageVector) {
    DISCOVER("Discover", Icons.Default.Radar),
    PAIR("Pairing", Icons.Default.QrCode),
    TRANSFER("Transfer", Icons.Default.Send),
    LOGS("Logs & Config", Icons.Default.Terminal)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModernTransfoApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val api = remember { TransfoApiClient() }
    val discovery = remember { UdpDiscovery() }

    var selectedTab by remember { mutableStateOf(NavTab.DISCOVER) }

    // State Variables (LAN-first: discovery + transfers run over the local network)
    var targetIp by remember { mutableStateOf("192.168.1.100") }
    var targetPort by remember { mutableIntStateOf(4000) }
    var authToken by remember { mutableStateOf("") }
    var statusText by remember { mutableStateOf("Ready to connect") }
    var logs by remember { mutableStateOf(listOf("Transfo Native v1.1.0 initialized.")) }
    var isDiscovering by remember { mutableStateOf(false) }
    var discoveredPeers by remember { mutableStateOf(listOf<DiscoveredPeer>()) }

    // File transfer state
    var selectedFileUri by remember { mutableStateOf<Uri?>(null) }
    var selectedFileName by remember { mutableStateOf("") }
    var selectedFileSize by remember { mutableLongStateOf(0L) }
    var transferProgress by remember { mutableFloatStateOf(0f) }
    var transferSpeed by remember { mutableStateOf("0 KB/s") }
    var isTransferring by remember { mutableStateOf(false) }

    // LAN mode is the default: discovery + transfers stay on the local network.
    var isCloudMode by remember { mutableStateOf(false) }

    val ownDeviceId = remember { "android-${android.os.Build.MODEL}" }

    // Handshake PIN state
    var pairPinCode by remember { mutableStateOf("") }

    fun addLog(msg: String) {
        logs = (logs + "[${System.currentTimeMillis() % 100000 / 1000}s] $msg").takeLast(60)
    }

    // Auto LAN Discovery: listen continuously + announce ourselves every 3 s
    // while scanning, so the PC finds us even if it started listening later.
    LaunchedEffect(isDiscovering) {
        if (isDiscovering) {
            addLog("LAN Radar scanning active on UDP port 4001...")
            val listenJob = launch {
                discovery.listen(
                    onPeerFound = { peer ->
                        if (peer.id == ownDeviceId) return@listen // ignore our own echo
                        if (!discoveredPeers.any { it.id == peer.id }) {
                            discoveredPeers = discoveredPeers + peer
                            addLog("Found device: ${peer.name} @ ${peer.ip}:${peer.port}")
                        } else {
                            discoveredPeers = discoveredPeers.map {
                                if (it.id == peer.id) peer else it
                            }
                        }
                    },
                    onLog = { addLog(it) }
                )
            }
            val announceJob = launch {
                discovery.announceLoop(
                    deviceId = ownDeviceId,
                    deviceName = android.os.Build.MODEL,
                    servicePort = 4000,
                    intervalMs = 3000,
                    onLog = { addLog(it) }
                )
            }
            try {
                listenJob.join()
            } finally {
                announceJob.cancel()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Brush.linearGradient(listOf(AmberPrimary, AmberLight))),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.SwapHoriz,
                                contentDescription = null,
                                tint = Color.Black,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Column {
                            Text(
                                "Transfo",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = Color.White
                            )
                            Text(
                                "Native Core v1.1.0",
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }
                    }
                },
                actions = {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (authToken.isNotEmpty()) EmeraldAccent.copy(alpha = 0.2f) else Color(0xFF27272A),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (authToken.isNotEmpty()) EmeraldAccent else SurfaceBorder
                        ),
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (authToken.isNotEmpty()) EmeraldAccent else Color.Red)
                            )
                            Text(
                                text = if (authToken.isNotEmpty()) "Paired" else "Not Paired",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = if (authToken.isNotEmpty()) EmeraldAccent else TextMuted
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground)
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = CardBackground,
                contentColor = Color.White,
                tonalElevation = 8.dp
            ) {
                NavTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = { Icon(tab.icon, contentDescription = tab.title) },
                        label = { Text(tab.title, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.Black,
                            selectedTextColor = AmberPrimary,
                            indicatorColor = AmberPrimary,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted
                        )
                    )
                }
            }
        },
        containerColor = DarkBackground
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedTab) {
                NavTab.DISCOVER -> DiscoverScreen(
                    isDiscovering = isDiscovering,
                    discoveredPeers = discoveredPeers,
                    onToggleScan = {
                        isDiscovering = !isDiscovering
                    },
                    onSelectPeer = { peer ->
                        targetIp = peer.ip
                        targetPort = peer.port
                        isCloudMode = false
                        selectedTab = NavTab.PAIR
                        addLog("Targeting peer ${peer.name} (${peer.ip})")
                    },
                    onBroadcast = {
                        scope.launch {
                            val localIp = UdpDiscovery.getLocalIpAddress()
                            discovery.broadcastAnnouncement("android-${android.os.Build.MODEL}", android.os.Build.MODEL)
                            addLog("Broadcasted device announcement ($localIp)")
                        }
                    }
                )

                NavTab.PAIR -> PairScreen(
                    targetIp = targetIp,
                    onIpChange = { targetIp = it },
                    targetPort = targetPort,
                    onPortChange = { targetPort = it },
                    pinCode = pairPinCode,
                    onPinChange = { pairPinCode = it },
                    statusText = statusText,
                    hasToken = authToken.isNotEmpty(),
                    onStartHandshake = {
                        scope.launch {
                            try {
                                statusText = "Logging in to $targetIp..."
                                addLog("Authenticating with $targetIp:$targetPort...")
                                val loginToken = api.login(targetIp, targetPort).getOrThrow()

                                statusText = "Requesting pairing code..."
                                val code = api.initiatePairing(targetIp, targetPort, "Android-${android.os.Build.MODEL}").getOrThrow()
                                pairPinCode = code
                                addLog("Generated Pairing Code: $code")

                                statusText = "Authorizing pairing with code $code..."
                                val pairResult = api.authorizePairing(targetIp, targetPort, code, loginToken).getOrThrow()
                                authToken = pairResult.token
                                statusText = "Successfully paired with ${pairResult.deviceName}!"
                                addLog("Pairing complete! Device: ${pairResult.deviceName}")
                            } catch (e: Exception) {
                                statusText = "Pairing Error: ${e.message}"
                                addLog("Pairing failed: ${e.message}")
                            }
                        }
                    },
                    isCloudMode = isCloudMode,
                    onModeChange = { cloud ->
                        isCloudMode = cloud
                        if (cloud) {
                            targetIp = "https://transfoo.vercel.app"
                            targetPort = 443
                        } else {
                            targetIp = "192.168.1.100"
                            targetPort = 4000
                        }
                    }
                )

                NavTab.TRANSFER -> TransferScreen(
                    context = context,
                    targetIp = targetIp,
                    hasToken = authToken.isNotEmpty(),
                    fileName = selectedFileName,
                    fileSize = selectedFileSize,
                    fileUri = selectedFileUri,
                    transferProgress = transferProgress,
                    transferSpeed = transferSpeed,
                    isTransferring = isTransferring,
                    statusText = statusText,
                    onFileSelected = { uri, name, size ->
                        selectedFileUri = uri
                        selectedFileName = name
                        selectedFileSize = size
                        addLog("Selected file: $name (${size / 1024} KB)")
                    },
                    onStartTransfer = {
                        if (authToken.isEmpty()) {
                            statusText = "Pair with a PC first!"
                            return@TransferScreen
                        }
                        val uri = selectedFileUri ?: return@TransferScreen

                        scope.launch {
                            try {
                                isTransferring = true
                                transferProgress = 0f
                                statusText = "Preparing transfer..."
                                TransferService.startService(context, selectedFileName)

                                val inputStream = context.contentResolver.openInputStream(uri)
                                    ?: throw Exception("Could not open file stream")

                                addLog("Creating transfer session for $selectedFileName ($selectedFileSize bytes)...")
                                val sessionId = api.createTransferSession(
                                    targetIp, targetPort, authToken, selectedFileName, selectedFileSize, 65536
                                ).getOrThrow()

                                val buffer = ByteArray(65536)
                                var bytesRead: Int
                                var totalUploaded = 0L
                                val startTime = System.currentTimeMillis()

                                withContext(Dispatchers.IO) {
                                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                        val chunkBytes = if (bytesRead == buffer.size) buffer else buffer.copyOf(bytesRead)
                                        val base64 = Base64.encodeToString(chunkBytes, Base64.NO_WRAP)

                                        api.uploadChunk(targetIp, targetPort, authToken, sessionId, base64).getOrThrow()

                                        totalUploaded += bytesRead
                                        transferProgress = (totalUploaded.toFloat() / selectedFileSize.toFloat()).coerceIn(0f, 1f)

                                        val elapsedSec = (System.currentTimeMillis() - startTime) / 1000.0
                                        if (elapsedSec > 0) {
                                            val speedKb = (totalUploaded / 1024.0 / elapsedSec).roundToInt()
                                            transferSpeed = "$speedKb KB/s"
                                        }
                                    }
                                    inputStream.close()
                                }

                                statusText = "Verifying transfer..."
                                val status = api.getSessionStatus(targetIp, targetPort, authToken, sessionId).getOrThrow()

                                transferProgress = 1.0f
                                statusText = "Transfer completed successfully!"
                                addLog("Transfer done! Received ${status.received} bytes on PC.")
                            } catch (e: Exception) {
                                statusText = "Transfer error: ${e.message}"
                                addLog("Transfer Error: ${e.message}")
                            } finally {
                                isTransferring = false
                                TransferService.stopService(context)
                            }
                        }
                    }
                )

                NavTab.LOGS -> LogsScreen(
                    logs = logs,
                    localIp = UdpDiscovery.getLocalIpAddress(),
                    onClearLogs = { logs = emptyList() }
                )
            }
        }
    }
}

// ----------------------------------------------------------------------------
// DISCOVER TAB
// ----------------------------------------------------------------------------
@Composable
fun DiscoverScreen(
    isDiscovering: Boolean,
    discoveredPeers: List<DiscoveredPeer>,
    onToggleScan: () -> Unit,
    onSelectPeer: (DiscoveredPeer) -> Unit,
    onBroadcast: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "radar")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.3f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Radar Animation Card
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (isDiscovering) {
                        Box(
                            modifier = Modifier
                                .size(100.dp)
                                .scale(pulseScale)
                                .clip(CircleShape)
                                .background(AmberPrimary.copy(alpha = 0.2f))
                        )
                    }
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(if (isDiscovering) AmberPrimary else SurfaceBorder),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Radar,
                            contentDescription = null,
                            tint = if (isDiscovering) Color.Black else TextMuted,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                Text(
                    text = if (isDiscovering) "Scanning local network..." else "Discovery is idle",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color.White
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = onToggleScan,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isDiscovering) Color(0xFFEF4444) else AmberPrimary
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = if (isDiscovering) Icons.Default.Stop else Icons.Default.PlayArrow,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isDiscovering) "Stop Radar" else "Start Scan")
                    }

                    OutlinedButton(
                        onClick = onBroadcast,
                        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.WifiTethering,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Announce", color = Color.White)
                    }
                }
            }
        }

        // Peer List
        Text(
            text = "Discovered PC Nodes (${discoveredPeers.size})",
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = TextMuted
        )

        if (discoveredPeers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(12.dp))
                    .background(CardBackground),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Computer,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(40.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No Transfo PC peers found", color = TextMuted, fontSize = 13.sp)
                    Text("Make sure Transfo Desktop is open on your PC", color = TextMuted.copy(alpha = 0.6f), fontSize = 11.sp)
                }
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(discoveredPeers) { peer ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = CardBackground),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectPeer(peer) }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(EmeraldAccent.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.DesktopWindows,
                                        contentDescription = null,
                                        tint = EmeraldAccent
                                    )
                                }
                                Column {
                                    Text(peer.name, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
                                    Text("${peer.ip}:${peer.port}", color = TextMuted, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                                }
                            }

                            Button(
                                onClick = { onSelectPeer(peer) },
                                colors = ButtonDefaults.buttonColors(containerColor = AmberPrimary),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Text("Connect", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ----------------------------------------------------------------------------
// PAIR TAB
// ----------------------------------------------------------------------------
@Composable
fun PairScreen(
    targetIp: String,
    onIpChange: (String) -> Unit,
    targetPort: Int,
    onPortChange: (Int) -> Unit,
    pinCode: String,
    onPinChange: (String) -> Unit,
    statusText: String,
    hasToken: Boolean,
    onStartHandshake: () -> Unit,
    isCloudMode: Boolean = false,
    onModeChange: ((Boolean) -> Unit)? = null
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Pairing Handshake",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = Color.White
                )

                // Mode selector: Cloud vs LAN
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = !isCloudMode,
                        onClick = { onModeChange?.invoke(false) },
                        label = { Text("LAN PC", fontSize = 12.sp) },
                        leadingIcon = { Icon(Icons.Default.Lan, contentDescription = null, tint = if (!isCloudMode) Color.Black else TextMuted) },
                        modifier = Modifier.weight(1f)
                    )

                    FilterChip(
                        selected = isCloudMode,
                        onClick = { onModeChange?.invoke(true) },
                        label = { Text("Cloud Server", fontSize = 12.sp) },
                        leadingIcon = { Icon(Icons.Default.Cloud, contentDescription = null, tint = if (isCloudMode) Color.Black else TextMuted) },
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = targetIp,
                    onValueChange = onIpChange,
                    label = { Text("Server URL or PC IP") },
                    placeholder = { Text(if (isCloudMode) "https://transfoo.vercel.app" else "e.g. 192.168.1.x") },
                    singleLine = true,
                    leadingIcon = {
                        Icon(
                            if (isCloudMode) Icons.Default.Cloud else Icons.Default.Lan,
                            contentDescription = null,
                            tint = AmberPrimary
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AmberPrimary,
                        unfocusedBorderColor = SurfaceBorder
                    )
                )

                if (!isCloudMode) {
                    OutlinedTextField(
                        value = targetPort.toString(),
                        onValueChange = { onPortChange(it.toIntOrNull() ?: 4000) },
                        label = { Text("Port (Default: 4000)") },
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Numbers, contentDescription = null, tint = AmberPrimary) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AmberPrimary,
                            unfocusedBorderColor = SurfaceBorder
                        )
                    )
                }

                if (pinCode.isNotEmpty()) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF27272A)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .padding(16.dp)
                                .fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("Pairing Code", fontSize = 12.sp, color = TextMuted)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = pinCode,
                                fontSize = 32.sp,
                                fontWeight = FontWeight.Bold,
                                color = AmberPrimary,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 4.sp
                            )
                        }
                    }
                }

                Button(
                    onClick = onStartHandshake,
                    colors = ButtonDefaults.buttonColors(containerColor = AmberPrimary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.VpnKey, contentDescription = null, tint = Color.Black)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Authenticate & Pair with PC", fontWeight = FontWeight.Bold, color = Color.Black)
                }
            }
        }

        // Pairing Status Banner
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = if (hasToken) Icons.Default.CheckCircle else Icons.Default.Info,
                    contentDescription = null,
                    tint = if (hasToken) EmeraldAccent else AmberPrimary
                )
                Column {
                    Text("Status", fontSize = 12.sp, color = TextMuted)
                    Text(statusText, fontWeight = FontWeight.Medium, color = Color.White, fontSize = 13.sp)
                }
            }
        }
    }
}

// ----------------------------------------------------------------------------
// TRANSFER TAB
// ----------------------------------------------------------------------------
@Composable
fun TransferScreen(
    context: Context,
    targetIp: String,
    hasToken: Boolean,
    fileName: String,
    fileSize: Long,
    fileUri: Uri?,
    transferProgress: Float,
    transferSpeed: String,
    isTransferring: Boolean,
    statusText: String,
    onFileSelected: (Uri, String, Long) -> Unit,
    onStartTransfer: () -> Unit
) {
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            var name = "selected_file"
            var size = 0L
            context.contentResolver.query(it, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (cursor.moveToFirst()) {
                    if (nameIndex != -1) name = cursor.getString(nameIndex)
                    if (sizeIndex != -1) size = cursor.getLong(sizeIndex)
                }
            }
            onFileSelected(it, name, size)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text("Select File to Transfer", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.White)

                OutlinedButton(
                    onClick = { filePickerLauncher.launch("*/*") },
                    modifier = Modifier.fillMaxWidth(),
                    border = androidx.compose.foundation.BorderStroke(1.dp, AmberPrimary)
                ) {
                    Icon(Icons.Default.FileOpen, contentDescription = null, tint = AmberPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (fileName.isEmpty()) "Browse Device Files" else "Change Selected File", color = Color.White)
                }

                if (fileName.isNotEmpty()) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF27272A)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(Icons.Default.InsertDriveFile, contentDescription = null, tint = AmberPrimary)
                            Column(modifier = Modifier.weight(1f)) {
                                Text(fileName, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${(fileSize / 1024.0 / 1024.0 * 100).roundToInt() / 100.0} MB", color = TextMuted, fontSize = 12.sp)
                            }
                        }
                    }
                }

                if (isTransferring) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Progress: ${(transferProgress * 100).toInt()}%", fontSize = 12.sp, color = TextMuted)
                            Text(transferSpeed, fontSize = 12.sp, color = EmeraldAccent, fontWeight = FontWeight.Bold)
                        }
                        LinearProgressIndicator(
                            progress = { transferProgress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = EmeraldAccent,
                            trackColor = Color(0xFF27272A)
                        )
                    }
                }

                Button(
                    onClick = onStartTransfer,
                    enabled = hasToken && fileUri != null && !isTransferring,
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldAccent),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Send, contentDescription = null, tint = Color.Black)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isTransferring) "Transferring..." else "Send to PC ($targetIp)",
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                }
            }
        }

        // Status Card
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Transfer Status", fontSize = 12.sp, color = TextMuted)
                Text(statusText, fontWeight = FontWeight.Medium, color = Color.White, fontSize = 13.sp)
            }
        }
    }
}

// ----------------------------------------------------------------------------
// LOGS & CONFIG TAB
// ----------------------------------------------------------------------------
@Composable
fun LogsScreen(
    logs: List<String>,
    localIp: String,
    onClearLogs: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Device Wi-Fi IP", fontSize = 12.sp, color = TextMuted)
                    Text(localIp, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = AmberPrimary, fontFamily = FontFamily.Monospace)
                }
                IconButton(onClick = onClearLogs) {
                    Icon(Icons.Default.Delete, contentDescription = "Clear Logs", tint = TextMuted)
                }
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Realtime Event Stream", fontWeight = FontWeight.Bold, color = TextMuted, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(10.dp))
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.Black)
                        .padding(12.dp)
                ) {
                    LazyColumn {
                        items(logs) { log ->
                            Text(
                                text = log,
                                color = EmeraldAccent,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                modifier = Modifier.padding(vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
