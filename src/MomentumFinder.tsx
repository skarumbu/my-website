import React, { useState } from 'react';

function MomentumFinder() {
  const [gameDetails, setGameDetails] = useState({
    team1: '',
    team2: '',
    date: ''
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setGameDetails({ ...gameDetails, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://MomentumFinder-2099902565.us-east-1.elb.amazonaws.com/get-momentum', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameDetails)
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: 'auto', padding: '1rem' }}>
      <h2>Momentum Finder</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="text" 
            name="team1" 
            placeholder="Team 1 (e.g., Clippers)" 
            value={gameDetails.team1} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="text" 
            name="team2" 
            placeholder="Team 2 (e.g., Lakers)" 
            value={gameDetails.team2} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="date" 
            name="date" 
            value={gameDetails.date} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Find Momentum Shifts
        </button>
      </form>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {results && (
        <div>
          <h3>Results</h3>
          <pre style={{ background: '#f4f4f4', padding: '1rem' }}>{JSON.stringify(results, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default MomentumFinder;
