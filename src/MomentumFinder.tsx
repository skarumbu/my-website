import React, { useEffect, useRef, useState } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/momentum-finder.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const POLL_INTERVAL_MS = 30_000;

interface Game {
  gameId: string;
  team1: string;
  team2: string;
  date: string;
  status?: string;
  score?: Record<string, number>;
  momentumTeam?: string | null;
  winProbability?: Record<string, number> | null;
  location?: string;
}

function MomentumFinder() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashingScores, setFlashingScores] = useState<Set<string>>(new Set());
  const prevScoresRef = useRef<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const fetchGames = async () => {
      if (!API_BASE_URL) {
        setError('Missing REACT_APP_API_BASE_URL environment variable');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/get-current-games`);
        if (!response.ok) throw new Error(`Error: ${response.status} ${response.statusText}`);
        const data = await response.json();

        const newFlashing = new Set<string>();
        for (const game of data.games as Game[]) {
          const prev = prevScoresRef.current[game.gameId];
          if (prev && game.score) {
            for (const team of [game.team1, game.team2]) {
              if (game.score[team] !== undefined && game.score[team] !== prev[team]) {
                newFlashing.add(`${game.gameId}-${team}`);
              }
            }
          }
          if (game.score) prevScoresRef.current[game.gameId] = { ...game.score };
        }

        if (newFlashing.size > 0) {
          setFlashingScores(newFlashing);
          setTimeout(() => setFlashingScores(new Set()), 1000);
        }

        setGames(data.games);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
    const interval = setInterval(fetchGames, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
            {games.map((game) => (
              <div
                key={game.gameId}
                className={`momentum-card${game.momentumTeam ? ' momentum-card--hot' : ''}`}
              >
                <h3 className="momentum-card__title">
                  {game.team1} <span className="vs-sep">vs</span> {game.team2}
                </h3>

                <div className="momentum-card__meta">
                  <span>{game.date}</span>
                  <span>·</span>
                  <span>{game.status || 'TBD'}</span>
                </div>

                <div className="momentum-card__score">
                  <span className={`momentum-card__score-value${flashingScores.has(`${game.gameId}-${game.team1}`) ? ' score-flash' : ''}`}>
                    {game.score?.[game.team1] ?? '-'}
                  </span>
                  <span className="momentum-card__score-sep">–</span>
                  <span className={`momentum-card__score-value${flashingScores.has(`${game.gameId}-${game.team2}`) ? ' score-flash' : ''}`}>
                    {game.score?.[game.team2] ?? '-'}
                  </span>
                </div>

                {game.momentumTeam && (
                  <p className="momentum-badge">🔥 {game.momentumTeam} on a run</p>
                )}
                {game.winProbability && (
                  <div className="win-prob-row">
                    <span>{game.team1}: {Math.round(game.winProbability[game.team1] * 100)}%</span>
                    <span className="win-prob-sep">·</span>
                    <span>{game.team2}: {Math.round(game.winProbability[game.team2] * 100)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MomentumFinder;
