# Flutter Client Integration Guide

## Socket Transfer Service - Flutter Client Documentation

Complete guide for integrating the Socket Transfer Service into your Flutter application for real-time messaging with userId-based routing.

---

## 📦 Installation

### 1. Add Dependencies

Add to your `pubspec.yaml`:

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
  http: ^1.1.0
```

Run:
```bash
flutter pub get
```

---

## 🚀 Quick Start

### Basic Setup

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  static const String SERVER_URL = 'https://wirenetsocket-test.onrender.com';
  
  IO.Socket? socket;
  String? myUserId;
  
  // Initialize socket connection
  void connect(String userId) {
    myUserId = userId;
    
    socket = IO.io(SERVER_URL, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });
    
    socket?.on('connect', (_) {
      print('✅ Connected to server');
    });
    
    socket?.on('disconnect', (_) {
      print('❌ Disconnected from server');
    });
    
    socket?.on('connect_error', (error) {
      print('⚠️ Connection error: $error');
    });
  }
  
  // Disconnect
  void disconnect() {
    socket?.disconnect();
    socket?.dispose();
  }
}
```

---

## 📡 Core Concepts

### userId-Based Routing

**Key Rule:** Event name = recipient userId

```dart
// To send message to user_456:
socket.emit('user_456', messageData);

// To receive messages for user_123:
socket.on('user_123', (data) {
  // Handle message
});
```

**Important:**
- ✅ No registration needed
- ✅ No socket-user mapping
- ✅ Direct routing by userId
- ✅ Only intended recipient receives messages

---

## 📤 Sending Messages

### Message Format (Mandatory)

All messages **must** follow this structure:

```dart
{
  "event": "IceCandidate",        // Application event name
  "payload": {...},                // Your data (any JSON)
  "timestamp": 1735189092680       // Unix timestamp in milliseconds
}
```

### Send Message Function

```dart
void sendMessage({
  required String recipientUserId,
  required String eventName,
  required Map<String, dynamic> payload,
}) {
  final message = {
    'event': eventName,
    'payload': payload,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
  };
  
  // Event name = recipient userId
  socket?.emit(recipientUserId, message);
  
  print('📤 Sent to $recipientUserId: $eventName');
}
```

### Example: Send WebRTC Offer

```dart
sendMessage(
  recipientUserId: 'user_456',
  eventName: 'IceCandidate',
  payload: {
    'type': 'offer',
    'sdp': 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\n...',
    'callId': 'call_123',
  },
);
```

### Example: Send Chat Message

```dart
sendMessage(
  recipientUserId: 'user_789',
  eventName: 'ChatMessage',
  payload: {
    'text': 'Hello!',
    'senderId': 'user_123',
    'messageId': 'msg_001',
  },
);
```

---

## 📥 Receiving Messages

### Listen for Messages

```dart
void startListening(String myUserId) {
  // Listen for messages sent to your userId
  socket?.on(myUserId, (data) {
    print('📥 Received message: $data');
    
    // Parse message
    final event = data['event'] as String;
    final payload = data['payload'] as Map<String, dynamic>;
    final timestamp = data['timestamp'] as int;
    
    // Handle based on event type
    handleMessage(event, payload, timestamp);
  });
  
  print('👂 Listening for messages to: $myUserId');
}
```

### Handle Different Event Types

```dart
void handleMessage(String event, Map<String, dynamic> payload, int timestamp) {
  switch (event) {
    case 'IceCandidate':
      handleIceCandidate(payload);
      break;
      
    case 'ChatMessage':
      handleChatMessage(payload);
      break;
      
    case 'CallOffer':
      handleCallOffer(payload);
      break;
      
    case 'CallAnswer':
      handleCallAnswer(payload);
      break;
      
    default:
      print('⚠️ Unknown event: $event');
  }
}

void handleIceCandidate(Map<String, dynamic> payload) {
  final type = payload['type'];
  final sdp = payload['sdp'];
  print('🧊 ICE Candidate: $type');
  // Process WebRTC candidate
}

void handleChatMessage(Map<String, dynamic> payload) {
  final text = payload['text'];
  final senderId = payload['senderId'];
  print('💬 Chat from $senderId: $text');
  // Update UI with message
}
```

---

## 🔥 FCM Token Management

### Register FCM Token

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> registerFCMToken({
  required String userId,
  required String deviceId,
  required String fcmToken,
}) async {
  final url = Uri.parse('$SERVER_URL/setToken');
  
  final response = await http.post(
    url,
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'userId': userId,
      'deviceId': deviceId,
      'fcmToken': fcmToken,
    }),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    print('✅ FCM token registered: ${data['success']}');
  } else {
    print('❌ Failed to register token: ${response.statusCode}');
  }
}
```

### Get FCM Token

```dart
Future<String?> getFCMToken(String userId) async {
  final url = Uri.parse('$SERVER_URL/getToken');
  
  final response = await http.post(
    url,
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'userId': userId}),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['fcmToken'];
  }
  
  return null;
}
```

---

## 🎯 Complete Example: WebRTC Signaling

### Full Implementation

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:http/http.dart' as http;
import 'dart:convert';

class WebRTCSignalingService {
  static const String SERVER_URL = 'https://wirenetsocket-test.onrender.com';
  
  IO.Socket? socket;
  String? myUserId;
  Function(String event, Map<String, dynamic> payload)? onMessageReceived;
  
  // 1. Connect to server
  void connect(String userId) {
    myUserId = userId;
    
    socket = IO.io(SERVER_URL, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });
    
    socket?.on('connect', (_) {
      print('✅ Connected to signaling server');
      startListening();
    });
    
    socket?.on('disconnect', (_) {
      print('❌ Disconnected from signaling server');
    });
    
    socket?.on('connect_error', (error) {
      print('⚠️ Connection error: $error');
    });
  }
  
  // 2. Listen for incoming messages
  void startListening() {
    if (myUserId == null) return;
    
    socket?.on(myUserId!, (data) {
      print('📥 Received: ${data['event']}');
      
      final event = data['event'] as String;
      final payload = data['payload'] as Map<String, dynamic>;
      
      // Notify listeners
      onMessageReceived?.call(event, payload);
    });
  }
  
  // 3. Send ICE candidate
  void sendIceCandidate({
    required String recipientUserId,
    required String type,
    required String sdp,
    String? callId,
  }) {
    final message = {
      'event': 'IceCandidate',
      'payload': {
        'type': type,
        'sdp': sdp,
        'callId': callId,
        'senderId': myUserId,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    
    socket?.emit(recipientUserId, message);
    print('📤 Sent ICE candidate to $recipientUserId');
  }
  
  // 4. Send call offer
  void sendCallOffer({
    required String recipientUserId,
    required String sdp,
    required String callId,
  }) {
    final message = {
      'event': 'CallOffer',
      'payload': {
        'sdp': sdp,
        'callId': callId,
        'callerId': myUserId,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    
    socket?.emit(recipientUserId, message);
    print('📞 Sent call offer to $recipientUserId');
  }
  
  // 5. Send call answer
  void sendCallAnswer({
    required String recipientUserId,
    required String sdp,
    required String callId,
  }) {
    final message = {
      'event': 'CallAnswer',
      'payload': {
        'sdp': sdp,
        'callId': callId,
        'answerId': myUserId,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    
    socket?.emit(recipientUserId, message);
    print('✅ Sent call answer to $recipientUserId');
  }
  
  // 6. Register FCM token
  Future<void> registerFCMToken(String deviceId, String fcmToken) async {
    if (myUserId == null) return;
    
    final url = Uri.parse('$SERVER_URL/setToken');
    
    await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'userId': myUserId,
        'deviceId': deviceId,
        'fcmToken': fcmToken,
      }),
    );
  }
  
  // 7. Disconnect
  void disconnect() {
    socket?.disconnect();
    socket?.dispose();
  }
}
```

### Usage in Your App

```dart
class CallScreen extends StatefulWidget {
  final String recipientUserId;
  
  @override
  _CallScreenState createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final signaling = WebRTCSignalingService();
  
  @override
  void initState() {
    super.initState();
    
    // Connect to signaling server
    signaling.connect('user_123');
    
    // Listen for messages
    signaling.onMessageReceived = (event, payload) {
      switch (event) {
        case 'IceCandidate':
          handleIceCandidate(payload);
          break;
        case 'CallAnswer':
          handleCallAnswer(payload);
          break;
      }
    };
  }
  
  void makeCall() {
    // Send call offer
    signaling.sendCallOffer(
      recipientUserId: widget.recipientUserId,
      sdp: 'your_sdp_here',
      callId: 'call_123',
    );
  }
  
  void handleIceCandidate(Map<String, dynamic> payload) {
    print('Received ICE candidate: ${payload['type']}');
    // Add to WebRTC peer connection
  }
  
  void handleCallAnswer(Map<String, dynamic> payload) {
    print('Call answered!');
    // Set remote description
  }
  
  @override
  void dispose() {
    signaling.disconnect();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Call')),
      body: Center(
        child: ElevatedButton(
          onPressed: makeCall,
          child: Text('Start Call'),
        ),
      ),
    );
  }
}
```

---

## 🔄 Connection Management

### Auto-Reconnect

```dart
void setupAutoReconnect() {
  socket?.on('disconnect', (_) {
    print('⚠️ Disconnected, attempting reconnect...');
    
    Future.delayed(Duration(seconds: 2), () {
      socket?.connect();
    });
  });
}
```

### Connection Status

```dart
bool isConnected() {
  return socket?.connected ?? false;
}

void checkConnection() {
  if (socket?.connected == true) {
    print('✅ Socket is connected');
  } else {
    print('❌ Socket is disconnected');
  }
}
```

---

## 🎨 Provider Pattern Integration

### Socket Provider

```dart
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketProvider extends ChangeNotifier {
  IO.Socket? _socket;
  bool _isConnected = false;
  String? _myUserId;
  
  bool get isConnected => _isConnected;
  String? get myUserId => _myUserId;
  
  void connect(String userId) {
    _myUserId = userId;
    
    _socket = IO.io('https://wirenetsocket-test.onrender.com', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });
    
    _socket?.on('connect', (_) {
      _isConnected = true;
      notifyListeners();
    });
    
    _socket?.on('disconnect', (_) {
      _isConnected = false;
      notifyListeners();
    });
    
    // Listen for messages
    _socket?.on(userId, (data) {
      handleMessage(data);
    });
  }
  
  void sendMessage(String recipientUserId, String event, Map<String, dynamic> payload) {
    final message = {
      'event': event,
      'payload': payload,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    
    _socket?.emit(recipientUserId, message);
  }
  
  void handleMessage(dynamic data) {
    // Process message and notify listeners
    notifyListeners();
  }
  
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _isConnected = false;
    notifyListeners();
  }
}
```

### Usage with Provider

```dart
// In main.dart
void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => SocketProvider(),
      child: MyApp(),
    ),
  );
}

// In your widget
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final socketProvider = Provider.of<SocketProvider>(context);
    
    return Column(
      children: [
        Text(socketProvider.isConnected ? 'Connected' : 'Disconnected'),
        ElevatedButton(
          onPressed: () {
            socketProvider.sendMessage(
              'user_456',
              'TestEvent',
              {'hello': 'world'},
            );
          },
          child: Text('Send Message'),
        ),
      ],
    );
  }
}
```

---

## ⚠️ Important Notes

### Message Format Validation

**Always include all required fields:**

```dart
// ✅ CORRECT
final message = {
  'event': 'IceCandidate',      // Required
  'payload': {'type': 'offer'}, // Required
  'timestamp': DateTime.now().millisecondsSinceEpoch, // Required
};

// ❌ WRONG - Missing fields
final message = {
  'event': 'IceCandidate',
  // Missing payload and timestamp - will be rejected!
};
```

### Server Response Time

- **First request:** May take 30-60 seconds (cold start on free tier)
- **Subsequent requests:** Instant
- **Solution:** Implement loading states and timeouts

### Error Handling

```dart
void sendMessageSafe(String recipientUserId, String event, Map<String, dynamic> payload) {
  try {
    if (socket?.connected != true) {
      print('❌ Socket not connected');
      return;
    }
    
    final message = {
      'event': event,
      'payload': payload,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    
    socket?.emit(recipientUserId, message);
    print('✅ Message sent successfully');
    
  } catch (e) {
    print('❌ Error sending message: $e');
  }
}
```

---

## 🧪 Testing

### Test Connection

```dart
void testConnection() {
  final socket = IO.io('https://wirenetsocket-test.onrender.com', <String, dynamic>{
    'transports': ['websocket'],
  });
  
  socket.on('connect', (_) {
    print('✅ Test: Connected successfully');
    socket.disconnect();
  });
  
  socket.on('connect_error', (error) {
    print('❌ Test: Connection failed - $error');
  });
}
```

### Test Message Sending

```dart
void testSendMessage() {
  final socket = IO.io('https://wirenetsocket-test.onrender.com', <String, dynamic>{
    'transports': ['websocket'],
  });
  
  socket.on('connect', (_) {
    print('✅ Connected, sending test message...');
    
    socket.emit('test_user', {
      'event': 'TestEvent',
      'payload': {'test': 'data'},
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
    
    print('✅ Test message sent');
  });
}
```

---

## 📚 API Reference

### Server Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Check server status |
| `/setToken` | POST | Register FCM token |
| `/getToken` | POST | Retrieve FCM token |

### Socket Events

| Action | Event Name | Description |
|--------|------------|-------------|
| **Emit** | `recipientUserId` | Send message to specific user |
| **Listen** | `myUserId` | Receive messages for your user |
| **System** | `connect` | Socket connected |
| **System** | `disconnect` | Socket disconnected |
| **System** | `connect_error` | Connection error |

---

## 🚀 Production Checklist

- [ ] Replace `SERVER_URL` with your production URL
- [ ] Implement auto-reconnect logic
- [ ] Add error handling for all socket operations
- [ ] Validate message format before sending
- [ ] Register FCM token on app launch
- [ ] Handle background/foreground state changes
- [ ] Implement message queuing for offline scenarios
- [ ] Add logging for debugging
- [ ] Test with multiple devices
- [ ] Monitor connection status in UI

---

## 📞 Support

**Server URL:** https://wirenetsocket-test.onrender.com

**Health Check:** https://wirenetsocket-test.onrender.com/health

**GitHub:** https://github.com/mohammed-fawaz-cp/wirenetsocket-test

---

**Built with simplicity and reliability in mind. Happy coding! 🚀**
