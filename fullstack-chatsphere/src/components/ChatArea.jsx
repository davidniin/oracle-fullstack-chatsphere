import { useRef, useEffect } from 'react'
import Message from './Message.jsx'

export default function ChatArea({
  currentView,
  currentRoomId,
  currentDmUserId,
  rooms,
  users,
  messages,
  typingText,
  currentUser,
  token,
  wsRef,
  onMessagesUpdate,
  onSearchMessages
}) {
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimerRef = useRef(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }, [messages])

  function getHeaderInfo() {
    if (currentView === 'room' && currentRoomId) {
      const room = rooms.find(r => r.id === currentRoomId)
      if (!room) return null
      return {
        icon: room.type === 'private' ? '🔒' : '#',
        name: room.name,
        meta: `${room.memberCount || 0} members`,
        placeholder: `Message #${room.name}`
      }
    }
    if (currentView === 'dm' && currentDmUserId) {
      const user = users.find(u => u.id === currentDmUserId)
      if (!user) return null
      return {
        icon: '💬',
        name: user.displayName,
        meta: user.status || 'offline',
        placeholder: `Message ${user.displayName}`
      }
    }
    return null
  }

  async function sendMessage() {
    if (!inputRef.current) return
    const content = inputRef.current.value.trim()
    if (!content) return

    try {
      if (currentView === 'room' && currentRoomId) {
        await fetch(`/api/rooms/${currentRoomId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content })
        })
      } else if (currentView === 'dm' && currentDmUserId) {
        const res = await fetch(`/api/dm/${currentDmUserId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content })
        })
        const msg = await res.json()
        onMessagesUpdate(prev => [...prev, msg])
      }
      inputRef.current.value = ''
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
      return
    }

    const ws = wsRef.current
    if (currentView === 'room' && currentRoomId && ws && ws.readyState === WebSocket.OPEN) {
      if (!typingTimerRef.current) {
        ws.send(JSON.stringify({
          type: 'typing',
          roomId: currentRoomId,
          displayName: currentUser.displayName
        }))
      }
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null
      }, 2000)
    }
  }

  async function handleEditMessage(messageId) {
    const msg = messages.find(m => m.id === messageId)
    if (!msg) return
    const currentContent = msg.content
    const newContent = prompt('Edit message:', currentContent)
    if (newContent === null || newContent === currentContent) return

    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newContent })
      })
    } catch (err) {
      console.error('Failed to edit message:', err)
    }
  }

  async function handleDeleteMessage(messageId) {
    if (!confirm('Delete this message?')) return

    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch (err) {
      console.error('Failed to delete message:', err)
    }
  }

  function handleSearch() {
    if (!currentRoomId) return
    const query = prompt('Search messages:')
    if (!query) return
    onSearchMessages(query)
  }

  function handleShowMembers() {
    if (!currentRoomId) return
    const room = rooms.find(r => r.id === currentRoomId)
    alert(`${room ? room.name : 'Room'} has ${room ? room.memberCount : 0} members`)
  }

  const headerInfo = getHeaderInfo()
  const showHeader = currentView !== null
  const showInput = currentView !== null

  return (
    <div className="chat-area">
      {showHeader && headerInfo && (
        <div className="chat-header">
          <div className="chat-header-info">
            <span className="chat-header-icon">{headerInfo.icon}</span>
            <div>
              <div className="chat-header-name">{headerInfo.name}</div>
              <div className="chat-header-meta">{headerInfo.meta}</div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button onClick={handleSearch}>Search</button>
            <button onClick={handleShowMembers}>Members</button>
          </div>
        </div>
      )}

      <div className="messages-container" ref={messagesEndRef}>
        {!currentView ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#x1f4ac;</div>
            <h3>Welcome to ChatSphere</h3>
            <p>Select a room or conversation to start chatting</p>
          </div>
        ) : (
          messages.map(msg => (
            <Message
              key={msg.id}
              msg={msg}
              currentUser={currentUser}
              isDm={currentView === 'dm'}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
            />
          ))
        )}
      </div>

      <div className="typing-indicator">{typingText}</div>

      {showInput && (
        <div className="message-input-area">
          <div className="message-input-wrapper">
            <input
              type="text"
              className="message-input"
              ref={inputRef}
              placeholder={headerInfo ? headerInfo.placeholder : 'Type a message...'}
              onKeyDown={handleKeyDown}
            />
            <button className="send-btn" onClick={sendMessage}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
