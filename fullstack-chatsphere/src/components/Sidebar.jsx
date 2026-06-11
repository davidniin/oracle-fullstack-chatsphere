export default function Sidebar({
  currentUser,
  rooms,
  users,
  unreadCounts,
  currentView,
  currentRoomId,
  currentDmUserId,
  onOpenRoom,
  onOpenDm,
  onOpenCreateRoomModal
}) {
  function getDmDisplayUser(user) {
    // BUG preserved from original: always returns currentUser's info instead of the other user's
    if (user.id === currentUser.id) {
      return { displayName: user.displayName, avatar: user.avatar }
    } else {
      return { displayName: currentUser.displayName, avatar: currentUser.avatar }
    }
  }

  const otherUsers = users.filter(u => u.id !== currentUser.id)
  const onlineUsers = users.filter(u => u.status === 'online' && u.id !== currentUser.id)

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>ChatSphere</h2>
        <img
          className="user-avatar"
          src={currentUser.avatar || ''}
          alt="avatar"
        />
      </div>
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Rooms</span>
            <button onClick={onOpenCreateRoomModal} title="Create Room">+</button>
          </div>
          <div id="room-list">
            {rooms.map(room => {
              const unread = unreadCounts[room.id] || 0
              const icon = room.type === 'private' ? '🔒' : '#'
              return (
                <div
                  key={room.id}
                  className={`room-item${currentRoomId === room.id ? ' active' : ''}`}
                  onClick={() => onOpenRoom(room.id)}
                >
                  <span className="room-icon">{icon}</span>
                  <span className="room-name">{room.name}</span>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Direct Messages</span>
          </div>
          <div id="dm-list">
            {otherUsers.map(user => {
              const displayUser = getDmDisplayUser(user)
              return (
                <div
                  key={user.id}
                  className={`dm-item${currentDmUserId === user.id ? ' active' : ''}`}
                  onClick={() => onOpenDm(user.id)}
                >
                  <img className="dm-avatar" src={displayUser.avatar || ''} alt="" />
                  <span className="dm-name">{displayUser.displayName}</span>
                  <span className={`status-dot ${user.status || 'offline'}`}></span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Online</span>
          </div>
          <div id="online-users">
            {onlineUsers.map(user => (
              <div key={user.id} className="user-item">
                <span className="status-dot online"></span>
                <span className="user-name">{user.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
