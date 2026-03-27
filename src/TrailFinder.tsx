import React, { useState, useEffect, useRef } from 'react';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/trail-finder.css';

const API_BASE_URL = process.env.REACT_APP_TRAIL_FINDER_API_BASE_URL;

interface Trail {
  name: string;
  address: string;
  rating: number;
  google_maps_url: string;
  condition_summary: string;
  gear_list: string[];
}

function TrailFinder() {
  const [location, setLocation] = useState('');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (!API_BASE_URL) return;
      try {
        const resp = await fetch(`${API_BASE_URL}/autocomplete?input=${encodeURIComponent(location)}`);
        if (!resp.ok) return;
        const data = await resp.json();
        setSuggestions(data.suggestions ?? []);
        setShowSuggestions(true);
      } catch {
        // ignore autocomplete errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!location.trim()) return;
    if (!API_BASE_URL) {
      setError('Missing REACT_APP_TRAIL_FINDER_API_BASE_URL environment variable');
      return;
    }

    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setSearched(true);
    setTrails([]);

    try {
      const response = await fetch(
        `${API_BASE_URL}/get-trail-recommendations?location=${encodeURIComponent(location)}`
      );
      if (!response.ok) throw new Error(`Error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setTrails(data.trails);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLocation(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="main trail-main">
      <header className="Main-text">
        <NavBar />
      </header>
      <div className="trail-container">
        <h2 className="trail-title">Trail Finder</h2>
        <p className="trail-subtitle">Find great hikes near you this weekend</p>

        <div className="trail-search">
          <div className="trail-input-wrapper" ref={wrapperRef}>
            <input
              className="trail-input"
              type="text"
              placeholder="Enter a city or location..."
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="trail-autocomplete">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="trail-autocomplete__item"
                    onMouseDown={() => handleSuggestionClick(s)}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="trail-button" onClick={handleSearch} disabled={loading}>
            Find Hikes
          </button>
        </div>

        {loading && (
          <div className="trail-loading">
            <Spinner />
            <p className="trail-status">Checking trail conditions and weather...</p>
          </div>
        )}
        {error && <p className="trail-status trail-status--error">Error: {error}</p>}
        {!loading && searched && !error && trails.length === 0 && (
          <p className="trail-status">No trails found for that location.</p>
        )}

        {!loading && trails.length > 0 && (
          <div className="trail-grid">
            {trails.map((trail, i) => (
              <div key={i} className="trail-card">
                <div className="trail-card__header">
                  <h3 className="trail-card__name">
                    <a href={trail.google_maps_url} target="_blank" rel="noopener noreferrer">
                      {trail.name}
                    </a>
                  </h3>
                  {trail.rating > 0 && (
                    <span className="trail-card__rating">★ {trail.rating.toFixed(1)}</span>
                  )}
                </div>
                <p className="trail-card__address">{trail.address}</p>
                <p className="trail-card__conditions">{trail.condition_summary}</p>
                <div className="trail-card__gear">
                  <span className="trail-card__gear-label">Gear:</span>
                  <div className="trail-card__gear-chips">
                    {trail.gear_list.map((item, j) => (
                      <span key={j} className="trail-gear-chip">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrailFinder;
