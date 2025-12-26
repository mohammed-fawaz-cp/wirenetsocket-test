# Simple Socket + FCM Transfer Service

A minimal **Node.js + Express + Socket.IO** backend that forwards data between clients using **recipient userId-based routing**, with **Firebase Cloud Messaging (DATA-only)** as a fallback and a **failure-based design** approach.

---

## 🎯 Goals

* Forward data from **Client A → Client B**
* Use **Socket.IO** for real-time delivery
* Use **FCM (DATA-only)** for background/offline delivery
* Route messages strictly by **recipient userId**
* Ensure predictable behavior under failure
* Keep the codebase **simple, readable, and complete**

---

## 📦 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase (Required for FCM)

1. Download your Firebase service account JSON from [Firebase Console](https://console.firebase.google.com/)
2. Place it in the project root as `firebase-service-account.json`
3. Ensure this file is in `.gitignore` (already configured)

### 3. Environment Variables (Optional)

Copy `.env.example` to `.env` and customize if needed:

```bash
cp .env.example .env
```

Default values:
- `PORT=3000`
- `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`

---

## 🚀 Running the Server

```bash
npm start
```

Server will start on `http://localhost:3000`

---

## 🧪 Testing

### Quick Test with Browser Client

1. Start the server: `npm start`
2. Open `test-client.html` in **two browser tabs**
3. **Tab 1**: Enter userId `user_123` and click "Start Listening"
4. **Tab 2**: Enter recipient `user_123`, event `TestEvent`, payload `{"hello": "world"}`, click "Send Message"
5. **Tab 1** should receive the message

### API Testing with curl

**Set FCM Token:**
```bash
curl -X POST http://localhost:3000/setToken \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","deviceId":"device_abc","fcmToken":"fcm_token_xyz"}'
```

**Get FCM Token:**
```bash
curl -X POST http://localhost:3000/getToken \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123"}'
```

**Health Check:**
```bash
curl http://localhost:3000/health
```

---

## 📡 Core Concepts

### Routing Model

* **Socket event name = recipient userId**
* No socket registration required
* No socket-user mapping needed

**Example:**
```javascript
// Client A sends to user_456
socket.emit('user_456', message);

// Client B listens as user_456
socket.on('user_456', (message) => {
  console.log('Received:', message);
});
```

### Message Format (Mandatory)

All messages must follow this structure:

```json
{
  "event": "IceCandidate",
  "payload": {"type": "offer", "sdp": "..."},
  "timestamp": 1735050000000
}
```

* `event` – Application-level event name
* `payload` – Arbitrary JSON data
* `timestamp` – Message creation time (Unix timestamp)

---

## 🔄 Message Flow

### 1. Client A → Server

```javascript
const message = {
  event: "IceCandidate",
  payload: { type: "offer", sdp: "..." },
  timestamp: Date.now()
};

socket.emit('user_456', message); // Event name = recipient userId
```

### 2. Server Processing

1. **Validate** message format
2. **Enqueue** message for recipient
3. **Attempt socket delivery** (emit to event `user_456`)
4. **Send FCM fallback** (data-only message)
5. **Keep in queue** until explicit acknowledgment

### 3. Client B Receives

```javascript
socket.on('user_456', (message) => {
  console.log('Event:', message.event);
  console.log('Payload:', message.payload);
});
```

---

## 📊 In-Memory Queue

### Purpose
- Ensures FIFO delivery order
- Acts as glue between Socket and FCM
- Prevents message loss during temporary disconnects

### Queue Operations

**Enqueue:**
```javascript
enqueueMessage(userId, message);
```

**Get Queued Messages:**
```javascript
const messages = getQueuedMessages(userId);
```

**Clear Queue:**
```javascript
clearQueue(userId);
```

### Queue Behavior

| Scenario | Behavior |
|----------|----------|
| Recipient online | Message queued → Socket delivery → FCM sent |
| Recipient offline | Message queued → FCM sent → Remains in queue |
| Recipient reconnects | Can request queued messages via `requestQueue` event |
| Server restart | Queue lost (in-memory only) |

---

## 🔥 Firebase Cloud Messaging (FCM)

### Data-Only Messages

FCM is used **only for data delivery**, not UI notifications.

**FCM Payload Example:**
```json
{
  "token": "fcm_device_token",
  "data": {
    "recipient": "user_456",
    "event": "IceCandidate",
    "payload": "{\"type\":\"offer\"}",
    "timestamp": "1735050000000"
  }
}
```

### When FCM is Used

- Recipient socket is offline
- App is in background
- App is killed/terminated
- Network temporarily unavailable

---

## 🛠️ API Endpoints

### POST `/setToken`

Store or update FCM token for a user.

**Request:**
```json
{
  "userId": "user_123",
  "deviceId": "device_abc",
  "fcmToken": "fcm_token_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user_123",
  "deviceId": "device_abc",
  "fcmToken": "fcm_token_xyz"
}
```

**Rules:**
- One user → one device → one token
- Latest request overwrites previous data

---

### POST `/getToken`

Retrieve stored FCM token for a user.

**Request:**
```json
{
  "userId": "user_123"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user_123",
  "deviceId": "device_abc",
  "fcmToken": "fcm_token_xyz"
}
```

---

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "firebase": true,
  "timestamp": 1735050000000
}
```

---

## 💾 SQLite Storage

### Table Structure

```sql
CREATE TABLE user_tokens (
  user_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Characteristics

- **Single table** for token storage
- **userId is UNIQUE** (primary key)
- **Latest device/token only** (no history)
- **Automatic overwrites** on conflict

---

## ⚠️ Failure Scenarios

### Failure-Based Design Philosophy

This system **starts from what can go wrong** and ensures safe, predictable behavior.

| Failure | Behavior |
|---------|----------|
| Recipient socket offline | FCM sent, message queued |
| App in background | FCM sent, message queued |
| App killed | FCM sent, message queued |
| Temporary disconnect | Message queued for delivery |
| Server restart | Queue lost (acceptable) |
| Invalid message format | Rejected, logged |
| Missing FCM token | Socket delivery only |
| Firebase not initialized | Socket delivery only, warning logged |

---

## 🏗️ Architecture Principles

### Design Rules (Strict)

✅ **DO:**
- Use pure functions
- Keep code flat and readable
- Validate all inputs
- Log all important events
- Handle errors gracefully

❌ **DON'T:**
- Use classes
- Create layered architecture
- Add unused code
- Add magic behavior
- Over-engineer

**Philosophy:** If it doesn't improve correctness or reliability, it's not included.

---

## 📁 Project Structure

```
wirenet-socket-test/
├── server.js              # Main server (Express + Socket.IO + Queue + FCM)
├── routes.js              # API endpoints (/setToken, /getToken)
├── package.json           # Dependencies
├── test-client.html       # Browser test client
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── README.md              # This file
└── firebase-service-account.json  # Firebase credentials (not in git)
```

---

## 🔍 Debugging

### Server Logs

The server logs all important events:

```
[SOCKET] Client connected: abc123
[SOCKET] Received event: user_456
[QUEUE] Enqueued message for user_456. Queue size: 1
[SOCKET] Emitted to user_456
[FCM] Sent to user_456
```

### Common Issues

**Firebase not initialized:**
```
⚠ Firebase Admin SDK not initialized: Cannot find module './firebase-service-account.json'
```
**Solution:** Place `firebase-service-account.json` in project root.

**Invalid message format:**
```
[SOCKET] Invalid message format - missing required fields
```
**Solution:** Ensure message has `event`, `payload`, and `timestamp` fields.

---

## 🚧 Future Enhancements (Optional)

- [ ] Add lightweight authentication
- [ ] Add ACK-based queue cleanup
- [ ] Add rate limiting / abuse protection
- [ ] Add message TTL (time-to-live)
- [ ] Add Redis for persistent queue
- [ ] Add clustering for horizontal scaling

---

## 📄 License

MIT

---

## 🤝 Contributing

This project intentionally avoids complexity. Contributions should:
- Maintain simplicity
- Follow failure-based design
- Not add unnecessary abstractions
- Include clear documentation

---

**Built with simplicity and reliability in mind.**
