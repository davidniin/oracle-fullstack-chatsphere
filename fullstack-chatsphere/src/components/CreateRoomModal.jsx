import { useState } from 'react'

export default function CreateRoomModal({ isOpen, token, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('public')

  function handleClose() {
    onClose()
    setName('')
    setDescription('')
    setType('public')
  }

  async function handleCreate() {
    if (!name.trim()) return

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), type })
      })

      if (res.ok) {
        handleClose()
        onCreated()
      }
    } catch (err) {
      console.error('Failed to create room:', err)
    }
  }

  return (
    <div className={`modal-overlay${isOpen ? ' open' : ''}`}>
      <div className="modal">
        <h3>Create a Room</h3>
        <div className="form-group">
          <label>Room Name</label>
          <input
            type="text"
            placeholder="e.g., project-alpha"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            placeholder="What's this room about?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '14px'
            }}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleCreate}>
            Create Room
          </button>
        </div>
      </div>
    </div>
  )
}
