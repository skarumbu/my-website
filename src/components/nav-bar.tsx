import React from "react";
import "../styling/nav-bar.css";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/digits", label: "Digits" },
  { href: "/momentum-finder", label: "NBA Games" },
  { href: "/trail-finder", label: "Trail Finder" },
  { href: "/ideas", label: "Ideas" },
  { href: "/learning-plan", label: "Learning Plan" },
  { href: "/write", label: "Write" },
];

const NavBar: React.FC = () => {
  const current = window.location.pathname;

  return (
    <nav className="site-nav">
      <div className="site-nav-links">
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className={current === href ? "active" : ""}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
};

export default NavBar;
