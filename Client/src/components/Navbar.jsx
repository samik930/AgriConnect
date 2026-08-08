import React, { useState, useEffect } from 'react';
import './Navbar.css';

const Navbar = ({ onLoginClick, onSignupClick, isLoggedIn, onDashboardClick, onLogoClick }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container nav-container">
        <div className="logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
          <span className="text-gradient">AgriConnect</span>
        </div>
        <nav className="nav-links">
          <a href="#home" className="nav-link">Home</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#about" className="nav-link">About</a>
          <a href="#contact" className="nav-link">Contact</a>
        </nav>
        <div className="nav-actions">
          {isLoggedIn ? (
            <button className="btn-primary" onClick={onDashboardClick}>Dashboard</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={onLoginClick}>Log In</button>
              <button className="btn-primary" onClick={onSignupClick}>Sign Up</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
