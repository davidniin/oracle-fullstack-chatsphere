import { useState } from 'react'

export default function LoginScreen({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  function toggleAuthMode() {
    setIsRegistering(!isRegistering)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login'
      const body = isRegistering ? { email, password, displayName } : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLogin(data.token, data.user)
    } catch (err) {
      setError('Connection failed. Please try again.')
    }
  }

  return (
    <div id="login-screen">
      <div className="login-card">
        <h1>ChatSphere</h1>
        <p>{isRegistering ? 'Create your account' : 'Sign in to your workspace'}</p>
        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@chatsphere.io"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </button>
          {error && <div className="login-error">{error}</div>}
        </form>
        <div className="login-toggle">
          <span>{isRegistering ? 'Already have an account?' : "Don't have an account?"}</span>
          {' '}
          <a onClick={toggleAuthMode}>
            {isRegistering ? 'Sign in' : 'Sign up'}
          </a>
        </div>
      </div>
    </div>
  )
}
