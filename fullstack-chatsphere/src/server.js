const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const initSqlJs = require('sql.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 4008;
const JWT_SECRET = process.env.JWT_SECRET || 'chatsphere-secret-key-2024';

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, '..', 'chatsphere.db');

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    console.error('Database not found. Run "npm run seed" first.');
    process.exit(1);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AUTH ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    runSql(
      'INSERT INTO users (id, email, password_hash, displayName, avatar, status, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, passwordHash, displayName, avatar, 'online', new Date().toISOString()]
    );

    const token = jwt.sign({ id, email, displayName }, JWT_SECRET);

    const generalRoom = queryOne("SELECT id FROM rooms WHERE name = 'General'");
    if (generalRoom) {
      runSql(
        'INSERT INTO room_members (roomId, userId, role, joinedAt) VALUES (?, ?, ?, ?)',
        [generalRoom.id, id, 'member', new Date().toISOString()]
      );
    }

    res.status(201).json({ token, user: { id, email, displayName, avatar } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    runSql("UPDATE users SET status = 'online', lastSeen = ? WHERE id = ?", [new Date().toISOString(), user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, displayName: user.displayName }, JWT_SECRET);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ROOM ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/rooms', authenticate, (req, res) => {
  try {
    const rooms = queryAll(`
      SELECT r.*, COUNT(rm2.userId) as memberCount
      FROM rooms r
      INNER JOIN room_members rm ON rm.roomId = r.id AND rm.userId = ?
      LEFT JOIN room_members rm2 ON rm2.roomId = r.id
      GROUP BY r.id
      ORDER BY r.name ASC
    `, [req.user.id]);

    res.json(rooms);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.post('/api/rooms', authenticate, (req, res) => {
  try {
    const { name, description, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomType = type || 'public';
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    runSql(
      'INSERT INTO rooms (id, name, description, type, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description || '', roomType, req.user.id, createdAt]
    );

    runSql(
      'INSERT INTO room_members (roomId, userId, role, joinedAt) VALUES (?, ?, ?, ?)',
      [id, req.user.id, 'admin', createdAt]
    );

    res.status(201).json({ id, name, description, type: roomType, createdBy: req.user.id, createdAt, memberCount: 1 });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.post('/api/rooms/:id/join', authenticate, (req, res) => {
  try {
    const roomId = req.params.id;

    const room = queryOne('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const existing = queryOne('SELECT * FROM room_members WHERE roomId = ? AND userId = ?', [roomId, req.user.id]);
    if (existing) {
      return res.status(409).json({ error: 'Already a member of this room' });
    }

    runSql(
      'INSERT INTO room_members (roomId, userId, role, joinedAt) VALUES (?, ?, ?, ?)',
      [roomId, req.user.id, 'member', new Date().toISOString()]
    );

    res.json({ message: 'Joined room successfully' });
  } catch (err) {
    console.error('Error joining room:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MESSAGE ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/rooms/:id/messages', authenticate, (req, res) => {
  try {
    const roomId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;

    const member = queryOne('SELECT * FROM room_members WHERE roomId = ? AND userId = ?', [roomId, req.user.id]);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    let sql = `
      SELECT m.*, u.displayName, u.avatar
      FROM messages m
      JOIN users u ON u.id = m.userId
      WHERE m.roomId = ?
    `;
    const params = [roomId];

    if (before) {
      sql += ' AND m.createdAt < ?';
      params.push(before);
    }

    sql += ' ORDER BY m.createdAt ASC LIMIT ?';
    params.push(limit);

    const messages = queryAll(sql, params);
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/rooms/:id/messages', authenticate, (req, res) => {
  try {
    const roomId = req.params.id;
    const { content, type, fileUrl } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const member = queryOne('SELECT * FROM room_members WHERE roomId = ? AND userId = ?', [roomId, req.user.id]);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const msgType = type || 'text';

    runSql(
      'INSERT INTO messages (id, roomId, userId, content, type, fileUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, roomId, req.user.id, content, msgType, fileUrl || null, createdAt]
    );

    const message = {
      id,
      roomId,
      userId: req.user.id,
      content,
      type: msgType,
      fileUrl: fileUrl || null,
      editedAt: null,
      createdAt,
      displayName: req.user.displayName,
      avatar: null
    };

    const user = queryOne('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
    if (user) message.avatar = user.avatar;

    broadcastToRoom(roomId, { type: 'new_message', message });

    res.status(201).json(message);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.put('/api/messages/:id', authenticate, (req, res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const message = queryOne('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const editedAt = new Date().toISOString();
    runSql('UPDATE messages SET content = ?, editedAt = ? WHERE id = ?', [content, editedAt, messageId]);

    broadcastToRoom(message.roomId, {
      type: 'message_edited',
      messageId,
      content,
      editedAt
    });

    res.json({ ...message, content, editedAt });
  } catch (err) {
    console.error('Error editing message:', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

app.delete('/api/messages/:id', authenticate, (req, res) => {
  try {
    const messageId = req.params.id;

    const message = queryOne('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    runSql('DELETE FROM messages WHERE id = ?', [messageId]);

    broadcastToRoom(message.roomId, {
      type: 'message_deleted',
      messageId
    });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.get('/api/messages/search', authenticate, (req, res) => {
  try {
    const { query, roomId } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let sql = `
      SELECT m.*, u.displayName, u.avatar
      FROM messages m
      JOIN users u ON u.id = m.userId
      WHERE m.content LIKE '%${query}%'
    `;

    if (roomId) {
      sql += ` AND m.roomId = '${roomId}'`;
    }

    sql += ' ORDER BY m.createdAt DESC LIMIT 50';

    const messages = queryAll(sql);
    res.json(messages);
  } catch (err) {
    console.error('Error searching messages:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ USER ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/users', authenticate, (req, res) => {
  try {
    const users = queryAll('SELECT * FROM users ORDER BY displayName ASC');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/me', authenticate, (req, res) => {
  try {
    const user = queryOne('SELECT id, email, displayName, avatar, status, lastSeen FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DIRECT MESSAGE ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/dm/:userId', authenticate, (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = queryAll(`
      SELECT dm.*,
        s.displayName as senderName, s.avatar as senderAvatar,
        r.displayName as receiverName, r.avatar as receiverAvatar
      FROM direct_messages dm
      JOIN users s ON s.id = dm.senderId
      JOIN users r ON r.id = dm.receiverId
      WHERE (dm.senderId = ? AND dm.receiverId = ?)
         OR (dm.senderId = ? AND dm.receiverId = ?)
      ORDER BY dm.createdAt ASC
    `, [req.user.id, otherUserId, otherUserId, req.user.id]);

    res.json(messages);
  } catch (err) {
    console.error('Error fetching DMs:', err);
    res.status(500).json({ error: 'Failed to fetch direct messages' });
  }
});

app.post('/api/dm/:userId', authenticate, (req, res) => {
  try {
    const receiverId = req.params.userId;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const receiver = queryOne('SELECT id, displayName, avatar FROM users WHERE id = ?', [receiverId]);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    runSql(
      'INSERT INTO direct_messages (id, senderId, receiverId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, receiverId, content, createdAt]
    );

    const dm = {
      id,
      senderId: req.user.id,
      receiverId,
      content,
      readAt: null,
      createdAt,
      senderName: req.user.displayName,
      receiverName: receiver.displayName
    };

    broadcastToUser(receiverId, { type: 'new_dm', message: dm });

    res.status(201).json(dm);
  } catch (err) {
    console.error('Error sending DM:', err);
    res.status(500).json({ error: 'Failed to send direct message' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ WEBSOCKET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const connectedClients = new Map();

function broadcastToRoom(roomId, data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastToUser(userId, data) {
  const message = JSON.stringify(data);
  const clientSet = connectedClients.get(userId);
  if (clientSet) {
    clientSet.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

wss.on('connection', (ws, req) => {
  let userId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'authenticate': {
          try {
            const decoded = jwt.verify(msg.token, JWT_SECRET);
            userId = decoded.id;
            ws.userId = userId;

            if (!connectedClients.has(userId)) {
              connectedClients.set(userId, new Set());
            }
            connectedClients.get(userId).add(ws);

            runSql("UPDATE users SET status = 'online', lastSeen = ? WHERE id = ?", [new Date().toISOString(), userId]);

            ws.send(JSON.stringify({ type: 'authenticated', userId }));

            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'user_status',
                  userId,
                  status: 'online'
                }));
              }
            });
          } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
          }
          break;
        }

        case 'join_room': {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          if (!ws.rooms) ws.rooms = new Set();
          ws.rooms.add(msg.roomId);
          break;
        }

        case 'leave_room': {
          if (ws.rooms) {
            ws.rooms.delete(msg.roomId);
          }
          break;
        }

        case 'typing': {
          if (!userId || !msg.roomId) return;
          const typingData = JSON.stringify({
            type: 'typing',
            userId,
            roomId: msg.roomId,
            displayName: msg.displayName || 'Someone'
          });
          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN && client.rooms && client.rooms.has(msg.roomId)) {
              client.send(typingData);
            }
          });
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (userId) {
      const clientSet = connectedClients.get(userId);
      if (clientSet) {
        clientSet.delete(ws);
        if (clientSet.size === 0) {
          connectedClients.delete(userId);
          runSql("UPDATE users SET status = 'offline', lastSeen = ? WHERE id = ?", [new Date().toISOString(), userId]);

          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'user_status',
                userId,
                status: 'offline'
              }));
            }
          });
        }
      }
    }
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ START SERVER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`ChatSphere server running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
