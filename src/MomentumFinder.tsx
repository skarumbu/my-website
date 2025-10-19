import React, { useEffect, useState } from 'react';
import NavBar from './components/nav-bar.tsx';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

interface Game {
  team1: string;
  team2: string;
  date: string;
  status?: string;
  team1_score?: number;
  team2_score?: number;
  location?: string;
}

function MomentumFinder() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<String | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      if (!API_BASE_URL) {
        setError('Missing REACT_APP_API_BASE_URL environment variable');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/get-current-games`);
        if (!response.ok) {
          throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        console.log('API raw response:', text);
      
        const data = JSON.parse(text);
        setGames(data.games);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  return (
    <div className="main">
      <header className="Main-text">
        <NavBar />
      </header>
      <div style={{ maxWidth: '800px', margin: 'auto', padding: '1rem' }}>
        <h2>Current NBA Games</h2>
        {loading && <p>Loading games...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {!loading && !error && games.length === 0 && (
          <p>No games are currently in progress or scheduled.</p>
        )}
        {!loading && !error && games.length > 0 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {games.map((game, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '10px',
                  padding: '1rem',
                  background: '#f9f9f9'
                }}
              >
                <h3>
                  {game.team1} vs {game.team2}
                </h3>
                <p>
                  🕒 {game.date} — {game.status || 'TBD'}
                </p>
                <p>
                  Score: {game.team1_score} - {game.team2_score}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MomentumFinder;
