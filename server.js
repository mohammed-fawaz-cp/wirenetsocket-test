const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const Database = require('better-sqlite3');
const cors = require('cors');
const { setTokenRoute, getTokenRoute } = require('./routes');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3000;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

// ============================================================================
// INITIALIZE EXPRESS & SOCKET.IO
// ============================================================================

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// ============================================================================
// INITIALIZE SQLITE DATABASE
// ============================================================================

const db = new Database('tokens.db');

// Create user_tokens table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_tokens (
    user_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    fcm_token TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

console.log('✓ SQLite database initialized');

// ============================================================================
// INITIALIZE FIREBASE ADMIN SDK
// ============================================================================

let firebaseInitialized = false;

try {
  const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  firebaseInitialized = true;
  console.log('✓ Firebase Admin SDK initialized');
} catch (error) {
  console.warn('⚠ Firebase Admin SDK not initialized:', error.message);
  console.warn('⚠ FCM fallback will not work. Place firebase-service-account.json in project root.');
}

// ============================================================================
// IN-MEMORY QUEUE
// ============================================================================

// Map<userId, Array<message>>
const messageQueues = new Map();

/**
 * Add message to queue for a specific user
 */
function enqueueMessage(userId, message) {
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, []);
  }
  messageQueues.get(userId).push(message);
  console.log(`[QUEUE] Enqueued message for ${userId}. Queue size: ${messageQueues.get(userId).length}`);
}

/**
 * Get all messages for a user (FIFO order)
 */
function getQueuedMessages(userId) {
  return messageQueues.get(userId) || [];
}

/**
 * Clear queue for a user after successful delivery
 */
function clearQueue(userId) {
  const count = messageQueues.get(userId)?.length || 0;
  messageQueues.delete(userId);
  console.log(`[QUEUE] Cleared ${count} messages for ${userId}`);
}

// ============================================================================
// FCM DELIVERY
// ============================================================================

/**
 * Send FCM data message to user
 */
async function sendFCMMessage(userId, message) {
  if (!firebaseInitialized) {
    console.log(`[FCM] Skipped for ${userId} - Firebase not initialized`);
    return;
  }

  try {
    // Get FCM token from database
    const stmt = db.prepare('SELECT fcm_token FROM user_tokens WHERE user_id = ?');
    const row = stmt.get(userId);

    if (!row) {
      console.log(`[FCM] No token found for ${userId}`);
      return;
    }

    const fcmToken = row.fcm_token;

    // Send data-only message
    const fcmMessage = {
      token: fcmToken,
      data: {
        recipient: userId,
        event: message.event,
        payload: JSON.stringify(message.payload),
        timestamp: String(message.timestamp)
      }
    };

    await admin.messaging().send(fcmMessage);
    console.log(`[FCM] Sent to ${userId}`);
  } catch (error) {
    console.error(`[FCM] Failed for ${userId}:`, error.message);
  }
}

// ============================================================================
// SOCKET.IO MESSAGE HANDLING
// ============================================================================

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Listen for any event (userId-based routing)
  socket.onAny((eventName, message) => {
    console.log(`[SOCKET] Received event: ${eventName}`);

    // Validate message format
    if (!message || typeof message !== 'object') {
      console.error('[SOCKET] Invalid message format - not an object');
      return;
    }

    if (!message.event || !message.payload || !message.timestamp) {
      console.error('[SOCKET] Invalid message format - missing required fields');
      return;
    }

    // eventName = recipient userId
    const recipientUserId = eventName;

    // Enqueue message
    enqueueMessage(recipientUserId, message);

    // Attempt socket delivery
    const deliverySuccess = io.emit(recipientUserId, message);
    console.log(`[SOCKET] Emitted to ${recipientUserId}`);

    // Send FCM fallback (always send, regardless of socket delivery)
    sendFCMMessage(recipientUserId, message);

    // Note: We only clear queue when recipient explicitly acknowledges receipt
    // For now, queue persists until server restart or manual cleanup
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });

  // Optional: Allow clients to request queued messages
  socket.on('requestQueue', (userId) => {
    const queued = getQueuedMessages(userId);
    if (queued.length > 0) {
      console.log(`[SOCKET] Delivering ${queued.length} queued messages to ${userId}`);
      queued.forEach(msg => {
        socket.emit(userId, msg);
      });
      // Clear queue after delivery
      clearQueue(userId);
    }
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

app.post('/setToken', (req, res) => setTokenRoute(req, res, db));
app.post('/getToken', (req, res) => getTokenRoute(req, res, db));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    firebase: firebaseInitialized,
    timestamp: Date.now()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Socket Transfer Service running on port ${PORT}`);
  console.log(`   Binding to: ${HOST}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Socket.IO: ws://localhost:${PORT}`);
  console.log('');
});
