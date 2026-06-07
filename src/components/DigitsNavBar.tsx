import React from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import '../styling/digits-nav-bar.css';

const NAV_LINKS = [
  { href: '/digits',        label: 'Digits' },
  { href: '/momentum-finder', label: 'NBA Games' },
  { href: '/trail-finder',  label: 'Trail Finder' },
  { href: '/ideas',         label: 'Ideas' },
  { href: '/learning-plan', label: 'Learning Plan' },
  { href: '/posts',         label: 'Writing' },
];

const DigitsNavBar: React.FC = () => {
  const current = window.location.pathname;
  const isAuthenticated = useIsAuthenticated();

  return (
    <nav className="digits-nav">
      <a href="/digits" className="digits-nav-logo" aria-label="Digits home">
        <span className="digits-nav-logo-letter">D</span>
      </a>
      <div className="digits-nav-links">
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className={`digits-nav-pill${current === href ? ' active' : ''}`}
          >
            {label}
          </a>
        ))}
        {isAuthenticated && (
          <a
            href="/write"
            className={`digits-nav-pill${current === '/write' ? ' active' : ''}`}
          >
            Write
          </a>
        )}
      </div>
    </nav>
  );
};

export default DigitsNavBar;
