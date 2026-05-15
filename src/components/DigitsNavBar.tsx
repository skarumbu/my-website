import React from 'react';
import '../styling/digits-nav-bar.css';

const NAV_LINKS = [
  { href: '/digits',        label: 'Digits' },
  { href: '/momentum-finder', label: 'NBA Games' },
  { href: '/trail-finder',  label: 'Trail Finder' },
  { href: '/ideas',         label: 'Ideas' },
  { href: '/learning-plan', label: 'Learning Plan' },
];

const DigitsNavBar: React.FC = () => {
  const current = window.location.pathname;

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
      </div>
    </nav>
  );
};

export default DigitsNavBar;
