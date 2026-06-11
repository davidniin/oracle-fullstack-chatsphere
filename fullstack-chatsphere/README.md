# ChatSphere Bug Hunt Challenge

## Overview

ChatSphere is a real-time team chat application built with Express, WebSocket, sql.js, and vanilla JavaScript. It features room-based messaging, direct messages, user presence, and a dark-themed UI inspired by Slack and Discord.

The application has a number of **security vulnerabilities, logic errors, and UI bugs** hidden throughout the codebase. Your task is to find and document as many as you can.

## Getting Started

```bash
npm install
npm run seed
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Test Credentials

All seeded users share the password `password123`:

| Email | Name |
|---|---|
| alice@chatsphere.io | Alice Chen |
| bob@chatsphere.io | Bob Martinez |
| carol@chatsphere.io | Carol Kim |
| dave@chatsphere.io | Dave Wilson |
| emma@chatsphere.io | Emma Taylor |
| frank@chatsphere.io | Frank Nguyen |

## Architecture

- **Backend:** `src/server.js` — Express REST API + WebSocket server using sql.js for SQLite
- **Frontend:** `public/index.html` — Single-page application with inline CSS and JavaScript
- **Database:** `chatsphere.db` — SQLite database (created by seed script)
- **Seed:** `src/seed.js` — Database schema creation and sample data

### Data Model

- **Users** — id, email, password_hash, displayName, avatar, status, lastSeen
- **Rooms** — id, name, description, type (public/private), createdBy, createdAt
- **RoomMembers** — roomId, userId, role (member/admin), joinedAt
- **Messages** — id, roomId, userId, content, type (text/image/file), fileUrl, editedAt, createdAt
- **DirectMessages** — id, senderId, receiverId, content, readAt, createdAt

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/register | Register a new user |
| POST | /api/auth/login | Log in |
| GET | /api/rooms | List user's rooms |
| POST | /api/rooms | Create a room |
| POST | /api/rooms/:id/join | Join a room |
| GET | /api/rooms/:id/messages | Get room messages (paginated) |
| POST | /api/rooms/:id/messages | Send a message to a room |
| PUT | /api/messages/:id | Edit a message |
| DELETE | /api/messages/:id | Delete a message |
| GET | /api/messages/search | Search messages |
| GET | /api/users | List all users |
| GET | /api/users/me | Get current user profile |
| GET | /api/dm/:userId | Get DMs with a user |
| POST | /api/dm/:userId | Send a DM |

### WebSocket Events

- `authenticate` — Authenticate connection with JWT token
- `join_room` / `leave_room` — Subscribe to room updates
- `typing` — Broadcast typing indicator
- `new_message` — Real-time message delivery
- `message_edited` / `message_deleted` — Real-time edit/delete
- `user_status` — Online/offline status changes

## Challenge Instructions

1. **Read through the code carefully.** Both `src/server.js` and `public/index.html` contain bugs.
2. **Bugs span multiple categories:** security vulnerabilities, authorization flaws, logic errors, data integrity issues, and UI/UX bugs.
3. **For each bug you find, document:**
   - Where it is (file and approximate line/function)
   - What the bug is
   - What the impact is
   - How you would fix it
4. **You may use any tools** — browser dev tools, curl, Postman, code review, etc.
5. **Time limit:** 90 minutes

Good luck!
