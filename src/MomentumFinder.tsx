import React, { useEffect, useState } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/momentum-finder.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

interface Game {
  team1: string;
  team2: string;
  date: string;
  status?: string;
  score?: number;
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
    <div className="main momentum-main">
      <header className="Main-text">
        <NavBar />
      </header>
      <div className="momentum-container">
        <h2 className="momentum-title">
          Current NBA Games
        </h2>

        {loading && <p className="momentum-status">Loading games...</p>}
        {error && <p className="momentum-status momentum-status--error">Error: {error}</p>}
        {!loading && !error && games.length === 0 && (
          <p className="momentum-status">
            No games are currently in progress or scheduled.
          </p>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="momentum-grid">
            {games.map((game, index) => (
              <div
                key={index}
                className="momentum-card"
              >
                <h3 className="momentum-card__title">
                  {game.team1} <span className="vs-sep">vs</span> {game.team2}
                </h3>

                <div className="momentum-card__meta">
                  <span className="momentum-card__icon" role="img" aria-label="clock">
                    🕒
                  </span>
                  <span>
                    {game.date} — <strong>{game.status || 'TBD'}</strong>
                  </span>
                </div>

                <div className="momentum-card__score">
                  <span className="momentum-card__score-value">
                    {game.score?.[game.team1] ?? '-'}
                  </span>
                  <span className="momentum-card__score-sep">–</span>
                  <span className="momentum-card__score-value">
                    {game.score?.[game.team2] ?? '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MomentumFinder;
