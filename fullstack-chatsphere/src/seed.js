const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      displayName TEXT NOT NULL,
      avatar TEXT,
      status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'away')),
      lastSeen TEXT
    )
  `);

  db.run(`
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'public' CHECK(type IN ('public', 'private')),
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE room_members (
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('member', 'admin')),
      joinedAt TEXT NOT NULL,
      PRIMARY KEY (roomId, userId),
      FOREIGN KEY (roomId) REFERENCES rooms(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'file')),
      fileUrl TEXT,
      editedAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (roomId) REFERENCES rooms(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE direct_messages (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      receiverId TEXT NOT NULL,
      content TEXT NOT NULL,
      readAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (senderId) REFERENCES users(id),
      FOREIGN KEY (receiverId) REFERENCES users(id)
    )
  `);

  const password = bcrypt.hashSync('password123', 10);

  const users = [
    { id: uuidv4(), email: 'alice@chatsphere.io', displayName: 'Alice Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', status: 'online' },
    { id: uuidv4(), email: 'bob@chatsphere.io', displayName: 'Bob Martinez', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', status: 'online' },
    { id: uuidv4(), email: 'carol@chatsphere.io', displayName: 'Carol Kim', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol', status: 'away' },
    { id: uuidv4(), email: 'dave@chatsphere.io', displayName: 'Dave Wilson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dave', status: 'offline' },
    { id: uuidv4(), email: 'emma@chatsphere.io', displayName: 'Emma Taylor', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma', status: 'online' },
    { id: uuidv4(), email: 'frank@chatsphere.io', displayName: 'Frank Nguyen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Frank', status: 'offline' }
  ];

  const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, displayName, avatar, status, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const u of users) {
    insertUser.run([u.id, u.email, password, u.displayName, u.avatar, u.status, new Date().toISOString()]);
  }
  insertUser.free();

  const rooms = [
    { id: uuidv4(), name: 'General', description: 'Company-wide announcements and discussions', type: 'public', createdBy: users[0].id },
    { id: uuidv4(), name: 'Engineering', description: 'Technical discussions and code reviews', type: 'public', createdBy: users[0].id },
    { id: uuidv4(), name: 'Design', description: 'UI/UX design discussions', type: 'private', createdBy: users[2].id },
    { id: uuidv4(), name: 'Random', description: 'Off-topic conversations and fun stuff', type: 'public', createdBy: users[1].id }
  ];

  const insertRoom = db.prepare('INSERT INTO rooms (id, name, description, type, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
  for (const r of rooms) {
    insertRoom.run([r.id, r.name, r.description, r.type, r.createdBy, new Date(Date.now() - 86400000 * 7).toISOString()]);
  }
  insertRoom.free();

  const memberships = [
    { roomId: rooms[0].id, userId: users[0].id, role: 'admin' },
    { roomId: rooms[0].id, userId: users[1].id, role: 'member' },
    { roomId: rooms[0].id, userId: users[2].id, role: 'member' },
    { roomId: rooms[0].id, userId: users[3].id, role: 'member' },
    { roomId: rooms[0].id, userId: users[4].id, role: 'member' },
    { roomId: rooms[0].id, userId: users[5].id, role: 'member' },
    { roomId: rooms[1].id, userId: users[0].id, role: 'admin' },
    { roomId: rooms[1].id, userId: users[1].id, role: 'member' },
    { roomId: rooms[1].id, userId: users[3].id, role: 'member' },
    { roomId: rooms[1].id, userId: users[4].id, role: 'member' },
    { roomId: rooms[2].id, userId: users[2].id, role: 'admin' },
    { roomId: rooms[2].id, userId: users[0].id, role: 'member' },
    { roomId: rooms[2].id, userId: users[4].id, role: 'member' },
    { roomId: rooms[3].id, userId: users[1].id, role: 'admin' },
    { roomId: rooms[3].id, userId: users[0].id, role: 'member' },
    { roomId: rooms[3].id, userId: users[2].id, role: 'member' },
    { roomId: rooms[3].id, userId: users[3].id, role: 'member' },
    { roomId: rooms[3].id, userId: users[5].id, role: 'member' }
  ];

  const insertMember = db.prepare('INSERT INTO room_members (roomId, userId, role, joinedAt) VALUES (?, ?, ?, ?)');
  for (const m of memberships) {
    insertMember.run([m.roomId, m.userId, m.role, new Date(Date.now() - 86400000 * 6).toISOString()]);
  }
  insertMember.free();

  const sampleMessages = [
    { roomIdx: 0, userIdx: 0, content: 'Welcome to ChatSphere everyone! Excited to have this new platform.' },
    { roomIdx: 0, userIdx: 1, content: 'This looks amazing! Great work on the design.' },
    { roomIdx: 0, userIdx: 2, content: 'Love the dark theme. Very easy on the eyes.' },
    { roomIdx: 0, userIdx: 4, content: 'Are we migrating all our conversations here?' },
    { roomIdx: 0, userIdx: 0, content: 'Yes, this will be our primary communication platform going forward.' },
    { roomIdx: 0, userIdx: 3, content: 'Sounds good. Is there a mobile app coming?' },
    { roomIdx: 0, userIdx: 0, content: 'Mobile app is on the roadmap for Q2.' },
    { roomIdx: 0, userIdx: 5, content: 'Looking forward to it! The web version is already pretty responsive.' },
    { roomIdx: 1, userIdx: 0, content: 'Team, we need to discuss the API redesign for v2.' },
    { roomIdx: 1, userIdx: 1, content: 'I have been working on the OpenAPI spec. Should I share the draft?' },
    { roomIdx: 1, userIdx: 3, content: 'Please do! Also, should we consider GraphQL?' },
    { roomIdx: 1, userIdx: 0, content: 'Let us stick with REST for now. We can evaluate GraphQL for v3.' },
    { roomIdx: 1, userIdx: 4, content: 'Makes sense. What about WebSocket support for real-time features?' },
    { roomIdx: 1, userIdx: 1, content: 'Already implemented! Check out the ws module in the codebase.' },
    { roomIdx: 1, userIdx: 3, content: 'Nice! Any plans for rate limiting on the API?' },
    { roomIdx: 1, userIdx: 0, content: 'Good point. Let us add that to the sprint backlog.' },
    { roomIdx: 2, userIdx: 2, content: 'Hey design team! I pushed the new component library updates.' },
    { roomIdx: 2, userIdx: 0, content: 'The new color palette looks fantastic. Great choices.' },
    { roomIdx: 2, userIdx: 4, content: 'Should we update the typography as well? I think Inter would be a better fit.' },
    { roomIdx: 2, userIdx: 2, content: 'Agreed! I will create mockups with Inter this week.' },
    { roomIdx: 2, userIdx: 0, content: 'Also, can we look at improving the notification badge design?' },
    { roomIdx: 2, userIdx: 4, content: 'I have some ideas. Will share in our next design review.' },
    { roomIdx: 3, userIdx: 1, content: 'Anyone watched the new sci-fi movie this weekend?' },
    { roomIdx: 3, userIdx: 0, content: 'Yes! The visuals were incredible. Plot was a bit weak though.' },
    { roomIdx: 3, userIdx: 2, content: 'I thought the plot was fine. The soundtrack was amazing!' },
    { roomIdx: 3, userIdx: 3, content: 'Adding it to my watchlist. Thanks for the recommendation!' },
    { roomIdx: 3, userIdx: 5, content: 'Friday game night anyone? Thinking of setting up an Among Us session.' },
    { roomIdx: 3, userIdx: 1, content: 'Count me in! What time?' },
    { roomIdx: 3, userIdx: 0, content: 'I am down. 7 PM works for me.' },
    { roomIdx: 3, userIdx: 3, content: 'Same here. Let us make it happen!' }
  ];

  const insertMsg = db.prepare('INSERT INTO messages (id, roomId, userId, content, type, fileUrl, editedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < sampleMessages.length; i++) {
    const m = sampleMessages[i];
    const createdAt = new Date(Date.now() - (sampleMessages.length - i) * 300000).toISOString();
    insertMsg.run([uuidv4(), rooms[m.roomIdx].id, users[m.userIdx].id, m.content, 'text', null, null, createdAt]);
  }
  insertMsg.free();

  const dmPairs = [
    { senderIdx: 0, receiverIdx: 1, content: 'Hey Bob, can you review my PR when you get a chance?' },
    { senderIdx: 1, receiverIdx: 0, content: 'Sure thing! Which repo?' },
    { senderIdx: 0, receiverIdx: 1, content: 'The main chatsphere-api repo. PR #47.' },
    { senderIdx: 1, receiverIdx: 0, content: 'On it. Will have feedback by end of day.' },
    { senderIdx: 2, receiverIdx: 4, content: 'Emma, the new mockups are ready for review.' },
    { senderIdx: 4, receiverIdx: 2, content: 'Awesome! I will check them out right now.' },
    { senderIdx: 0, receiverIdx: 3, content: 'Dave, are you available for a quick sync?' },
    { senderIdx: 3, receiverIdx: 0, content: 'Give me 10 minutes, just finishing up something.' },
    { senderIdx: 1, receiverIdx: 4, content: 'Emma, do you have the latest analytics dashboard link?' },
    { senderIdx: 4, receiverIdx: 1, content: 'Here it is: https://analytics.chatsphere.io/dashboard' }
  ];

  const insertDm = db.prepare('INSERT INTO direct_messages (id, senderId, receiverId, content, readAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < dmPairs.length; i++) {
    const dm = dmPairs[i];
    const createdAt = new Date(Date.now() - (dmPairs.length - i) * 600000).toISOString();
    const readAt = i < 6 ? createdAt : null;
    insertDm.run([uuidv4(), users[dm.senderIdx].id, users[dm.receiverIdx].id, dm.content, readAt, createdAt]);
  }
  insertDm.free();

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, '..', 'chatsphere.db'), buffer);

  db.close();
  console.log('Database seeded successfully!');
  console.log(`Created: ${users.length} users, ${rooms.length} rooms, ${memberships.length} memberships, ${sampleMessages.length} messages, ${dmPairs.length} direct messages`);
  console.log('\nTest credentials (all passwords: password123):');
  users.forEach(u => console.log(`  ${u.email} - ${u.displayName}`));
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
