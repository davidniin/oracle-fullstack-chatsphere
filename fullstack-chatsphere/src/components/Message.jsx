export default function Message({ msg, currentUser, isDm, onEdit, onDelete }) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isDm) {
    const isSender = msg.senderId === currentUser.id
    // BUG preserved from original: name always uses senderName regardless of isSender
    const name = isSender ? msg.senderName : msg.senderName
    // BUG preserved from original: avatar uses receiverAvatar when not sender (mixed up)
    const avatar = isSender ? msg.senderAvatar : msg.receiverAvatar

    return (
      <div className="message" style={{ position: 'relative' }}>
        <img className="message-avatar" src={avatar || ''} alt="" />
        <div className="message-body">
          <div className="message-header">
            <span className="message-sender">{name || 'Unknown'}</span>
            <span className="message-time">{time}</span>
          </div>
          <div className="message-content">{msg.content}</div>
        </div>
      </div>
    )
  }

  const isOwn = msg.userId === currentUser.id

  return (
    <div className="message" data-id={msg.id} style={{ position: 'relative' }}>
      <img className="message-avatar" src={msg.avatar || ''} alt="" />
      <div className="message-body">
        <div className="message-header">
          <span className="message-sender">{msg.displayName || 'Unknown'}</span>
          <span className="message-time">{time}</span>
          {msg.editedAt && <span className="message-edited">(edited)</span>}
        </div>
        <div className="message-content">{msg.content}</div>
      </div>
      {isOwn && (
        <div className="message-actions">
          <button className="message-action-btn" onClick={() => onEdit(msg.id)}>Edit</button>
          <button className="message-action-btn" onClick={() => onDelete(msg.id)}>Delete</button>
        </div>
      )}
    </div>
  )
}
