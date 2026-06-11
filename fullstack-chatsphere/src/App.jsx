import { useState, useRef, useEffect } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatArea from './components/ChatArea.jsx'
import CreateRoomModal from './components/CreateRoomModal.jsx'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [currentView, setCurrentView] = useState(null)
  const [currentRoomId, setCurrentRoomId] = useState(null)
  const [currentDmUserId, setCurrentDmUserId] = useState(null)
  const [rooms, setRooms] = useState([])
  const [users, setUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [typingText, setTypingText] = useState('')
  const [createRoomOpen, setCreateRoomOpen] = useState(false)

  const wsRef = useRef(null)
  const typingTimeoutsRef = useRef({})
  const currentViewRef = useRef(currentView)
  const currentRoomIdRef = useRef(currentRoomId)
  const currentDmUserIdRef = useRef(currentDmUserId)

  useEffect(() => { currentViewRef.current = currentView }, [currentView])
  useEffect(() => { currentRoomIdRef.current = currentRoomId }, [currentRoomId])
  useEffect(() => { currentDmUserIdRef.current = currentDmUserId }, [currentDmUserId])

  // BUG: no cleanup in useEffect (intentional)
  useEffect(() => {
    if (token && currentUser) {
      connectWebSocket()
      loadRooms()
      loadUsers()
    }
  }, [token])

  function connectWebSocket() {
    // Connect directly to ws://localhost:4008, not through Vite proxy
    const ws = new WebSocket('ws://localhost:4008')
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'authenticate', token }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleWsMessage(data)
    }

    ws.onclose = () => {
      setTimeout(() => {
        connectWebSocket()
      }, 3000)
    }

    ws.onerror = () => {}
  }

  function handleWsMessage(data) {
    switch (data.type) {
      case 'authenticated':
        if (currentRoomIdRef.current) {
          wsRef.current.send(JSON.stringify({ type: 'join_room', roomId: currentRoomIdRef.current }))
        }
        break

      case 'new_message':
        if (data.message.roomId === currentRoomIdRef.current && currentViewRef.current === 'room') {
          setMessages(prev => [...prev, data.message])
        } else if (data.message.roomId) {
          setUnreadCounts(prev => ({
            ...prev,
            [data.message.roomId]: (prev[data.message.roomId] || 0) + 1
          }))
        }
        break

      case 'message_edited':
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.messageId
              ? { ...msg, content: data.content, editedAt: data.editedAt }
              : msg
          )
        )
        break

      case 'message_deleted':
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId))
        break

      case 'new_dm':
        if (data.message.senderId === currentDmUserIdRef.current && currentViewRef.current === 'dm') {
          setMessages(prev => [...prev, data.message])
        }
        break

      case 'typing':
        showTypingIndicator(data.displayName, data.roomId)
        break

      case 'user_status':
        setUsers(prev =>
          prev.map(u => u.id === data.userId ? { ...u, status: data.status } : u)
        )
        break
    }
  }

  function showTypingIndicator(displayName, roomId) {
    if (roomId !== currentRoomIdRef.current) return

    // BUG preserved from original: timeout resets to same message instead of clearing it
    setTypingText(`${displayName} is typing...`)

    let timeout = typingTimeoutsRef.current[displayName]
    clearTimeout(timeout)

    typingTimeoutsRef.current[displayName] = setTimeout(() => {
      setTypingText(`${displayName} is typing...`)
    }, 3000)
  }

  async function loadRooms() {
    try {
      const res = await fetch('/api/rooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setRooms(data)
    } catch (err) {
      console.error('Failed to load rooms:', err)
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  async function openRoom(roomId) {
    setCurrentView('room')
    setCurrentRoomId(roomId)
    setCurrentDmUserId(null)

    // BUG preserved from original: unreadCounts[roomId] + 0 doesn't actually clear it
    setUnreadCounts(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 0 }))

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'join_room', roomId }))
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const msgs = await res.json()
      msgs.sort((a, b) => a.id > b.id ? 1 : -1)
      setMessages(msgs)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  async function openDm(userId) {
    setCurrentView('dm')
    setCurrentDmUserId(userId)
    setCurrentRoomId(null)

    try {
      const res = await fetch(`/api/dm/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const msgs = await res.json()
      setMessages(msgs)
    } catch (err) {
      console.error('Failed to load DMs:', err)
    }
  }

  async function handleSearchMessages(query) {
    fetch(`/api/messages/search?query=${encodeURIComponent(query)}&roomId=${currentRoomId || ''}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(msgs => {
        setMessages(msgs)
      })
      .catch(err => console.error('Search failed:', err))
  }

  function handleLogin(newToken, user) {
    setToken(newToken)
    setCurrentUser(user)
  }

  if (!token || !currentUser) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <>
      <div id="app">
        <Sidebar
          currentUser={currentUser}
          rooms={rooms}
          users={users}
          unreadCounts={unreadCounts}
          currentView={currentView}
          currentRoomId={currentRoomId}
          currentDmUserId={currentDmUserId}
          onOpenRoom={openRoom}
          onOpenDm={openDm}
          onOpenCreateRoomModal={() => setCreateRoomOpen(true)}
        />
        <ChatArea
          currentView={currentView}
          currentRoomId={currentRoomId}
          currentDmUserId={currentDmUserId}
          rooms={rooms}
          users={users}
          messages={messages}
          typingText={typingText}
          currentUser={currentUser}
          token={token}
          wsRef={wsRef}
          onMessagesUpdate={setMessages}
          onSearchMessages={handleSearchMessages}
        />
      </div>
      <CreateRoomModal
        isOpen={createRoomOpen}
        token={token}
        onClose={() => setCreateRoomOpen(false)}
        onCreated={loadRooms}
      />
    </>
  )
}
