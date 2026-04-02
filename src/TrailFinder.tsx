import React, { useState, useEffect, useRef } from 'react';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/trail-finder.css';

const API_BASE_URL = process.env.REACT_APP_TRAIL_FINDER_API_BASE_URL;

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: { input: string; types: string[] },
              callback: (predictions: Array<{ description: string }> | null, status: string) => void
            ) => void;
          };
          PlacesServiceStatus: { OK: string };
        };
      };
    };
  }
}

interface Trail {
  name: string;
  address: string;
  rating: number;
  google_maps_url: string;
  condition_summary: string;
  gear_list: string[];
  condition_tags: string[];
  suitability_score: number;
  difficulty: 'easy' | 'moderate' | 'hard';
  distance_km: number | null;
}

function SuitabilityDot({ score }: { score: number }) {
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#f59e0b' : '#ef4444';
  return <span className="tf-suitability-dot" style={{ backgroundColor: color }} title={`Suitability: ${score}/10`} />;
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <span className={`tf-difficulty-badge tf-difficulty-badge--${difficulty}`}>{difficulty}</span>;
}

function TrailFinder() {
  const [location, setLocation] = useState('');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<'suitability' | 'rating'>('suitability');
  const [minRating, setMinRating] = useState(0);
  const [activeConditionFilters, setActiveConditionFilters] = useState<Set<string>>(new Set());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      if (!window.google?.maps?.places) return;
      const service = new window.google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input: location, types: ['(cities)'] },
        (predictions, status) => {
          if (status === window.google!.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions.map(p => p.description));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
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
    setActiveConditionFilters(new Set());

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

  const toggleConditionFilter = (tag: string) => {
    setActiveConditionFilters(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const allTags = Array.from(new Set(trails.flatMap(t => t.condition_tags ?? [])));

  const filtered = trails
    .filter(t => t.rating >= minRating)
    .filter(t => activeConditionFilters.size === 0 ||
      [...activeConditionFilters].every(tag => (t.condition_tags ?? []).includes(tag)));

  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'suitability' ? b.suitability_score - a.suitability_score : b.rating - a.rating
  );

  const ratingOptions = [0, 3, 4, 4.5];
  const ratingLabels: Record<number, string> = { 0: 'Any', 3: '3.0+', 4: '4.0+', 4.5: '4.5+' };

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
          <>
            <div className="tf-filter-bar">
              <select
                className="tf-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'suitability' | 'rating')}
              >
                <option value="suitability">Best match</option>
                <option value="rating">Highest rated</option>
              </select>
              <div className="tf-filter-group">
                {ratingOptions.map(r => (
                  <button
                    key={r}
                    className={`tf-rating-pill${minRating === r ? ' active' : ''}`}
                    onClick={() => setMinRating(r)}
                  >
                    {ratingLabels[r]}
                  </button>
                ))}
              </div>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tf-condition-chip${activeConditionFilters.has(tag) ? ' active' : ''}`}
                  onClick={() => toggleConditionFilter(tag)}
                >
                  {tag}{activeConditionFilters.has(tag) ? ' ×' : ''}
                </button>
              ))}
            </div>

            {sorted.length === 0 ? (
              <p className="trail-status">No trails match the current filters.</p>
            ) : (
              <div className="trail-grid">
                {sorted.map((trail, i) => (
                  <div key={i} className="trail-card">
                    <div className="trail-card__header">
                      <h3 className="trail-card__name">
                        <SuitabilityDot score={trail.suitability_score} />
                        <a href={trail.google_maps_url} target="_blank" rel="noopener noreferrer">
                          {trail.name}
                        </a>
                      </h3>
                      <div className="trail-card__meta">
                        {trail.rating > 0 && (
                          <span className="trail-card__rating">★ {trail.rating.toFixed(1)}</span>
                        )}
                        <DifficultyBadge difficulty={trail.difficulty} />
                      </div>
                    </div>
                    <p className="trail-card__address">
                      {trail.distance_km != null ? `${trail.distance_km} km · ` : ''}{trail.address}
                    </p>
                    <p className="trail-card__conditions">{trail.condition_summary}</p>
                    {(trail.condition_tags ?? []).length > 0 && (
                      <div className="trail-card__condition-tags">
                        {trail.condition_tags.map((tag, j) => (
                          <span key={j} className="tf-condition-chip">{tag}</span>
                        ))}
                      </div>
                    )}
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
          </>
        )}
      </div>
    </div>
  );
}

export default TrailFinder;
