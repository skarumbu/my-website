import "./styling/main.css";
import "./styling/home.css";
import React from "react";

const ArrowIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

const App: React.FC = () => {
  return (
    <div className="main home">

      {/* NAV */}
      <nav className="home-nav">
        <div className="home-nav-links">
          <a href="/" className="active">Home</a>
          <a href="/digits">Digits</a>
          <a href="/momentum-finder">NBA Games</a>
          <a href="/trail-finder">Trail Finder</a>
          <a href="/ideas">Ideas</a>
          <a href="/learning-plan">Learning Plan</a>
          <a href="/posts">Writing</a>
        </div>
      </nav>

      {/* PLAYGROUND */}
      <div className="section-eyebrow">
        <h2>The playground</h2>
      </div>

      <div className="projects">

        {/* Digits — featured */}
        <a href="/digits" className="card card-digits">
          <span className="tag">★ Featured</span>
          <span className="card-decor">÷</span>
          <div className="digits-preview" aria-hidden="true">
            <div className="pebble p1">7</div>
            <div className="pebble p2">25</div>
            <div className="pebble p3">+</div>
            <div className="pebble p4">15</div>
            <div className="pebble p5">×</div>
            <div className="pebble p6">3</div>
          </div>
          <div>
            <div className="card-label">Daily puzzle</div>
            <div className="card-title">Digits</div>
            <div className="card-desc">Combine six numbers with math to hit the target.</div>
          </div>
          <div className="arrow"><ArrowIcon /></div>
        </a>

        {/* NBA Games */}
        <a href="/momentum-finder" className="card card-nba">
          <span className="tag">Live tonight</span>
          <span className="card-decor">🏀</span>
          <div>
            <div className="card-label">Scoreboard</div>
            <div className="card-title">NBA Games</div>
            <div className="card-desc">Spoiler-free recaps and a watchability score for tonight's slate.</div>
          </div>
          <div className="arrow"><ArrowIcon /></div>
        </a>

        {/* Trail Finder */}
        <a href="/trail-finder" className="card card-trail">
          <span className="tag">Weekend</span>
          <span className="card-decor">⛰</span>
          <div>
            <div className="card-label">Get outside</div>
            <div className="card-title">Trail Finder</div>
            <div className="card-desc">Hidden hikes near you, ranked by quietness and snack-stops.</div>
          </div>
          <div className="arrow"><ArrowIcon /></div>
        </a>

        {/* Ideas */}
        <a href="/ideas" className="card card-ideas">
          <span className="tag">47 sparks</span>
          <span className="card-decor">✦</span>
          <div>
            <div className="card-label">Notebook</div>
            <div className="card-title">Ideas</div>
            <div className="card-desc">A messy drawer.</div>
          </div>
          <div className="arrow"><ArrowIcon /></div>
        </a>

        {/* Learning Plan */}
        <a href="/learning-plan" className="card card-learn">
          <span className="tag">In progress</span>
          <span className="card-decor">∑</span>
          <div>
            <div className="card-label">Brain food</div>
            <div className="card-title">Learning Plan</div>
            <div className="card-desc">What I'm chewing on this quarter — shaders, Spanish, and how to actually finish a book.</div>
          </div>
          <div className="arrow"><ArrowIcon /></div>
        </a>

        {/* Writing */}
        <a href="/posts" className="card card-writing">
          <span className="card-decor" style={{ right: 12, bottom: -8, fontSize: 110 }}>✍</span>
          <div>
            <div className="card-label">Journal</div>
            <div className="card-title">Writing</div>
            <div className="card-desc">Thoughts, notes, and project write-ups.</div>
          </div>
          <div className="arrow"><ArrowIcon /></div>
        </a>

      </div>


{/* FOOTER */}
      <footer className="home-footer">
        <div className="footer-left">
          <span style={{ color: "var(--ink-3)" }}>© 2026</span>
        </div>
        <div className="socials">
          <a href="https://github.com/skarumbu" title="GitHub" target="_blank" rel="noreferrer">gh</a>
        </div>
      </footer>

    </div>
  );
};

export default App;
