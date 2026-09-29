import Dashboard from './Dashboard';
import { useState } from 'react';
import { login, signup } from './api';

function App() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = isSignup
        ? await signup(email, password)
        : await login(email, password);

      const receivedToken = res.data.token;
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
  };

 if (token) {
  return <Dashboard token={token} onLogout={handleLogout} />;
}

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto' }}>
      <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
            required
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
          {isSignup ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button onClick={() => setIsSignup(!isSignup)} style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}>
          {isSignup ? 'Log In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
}

export default App;