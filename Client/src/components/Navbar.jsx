import React, { useState, useEffect } from 'react';
import './Navbar.css';

const Navbar = ({
  onFarmerLoginClick,
  onCustomerLoginClick,
  onLoginClick,
  onSignupClick,
  onAdminLoginClick,
  isLoggedIn,
  onDashboardClick,
  onLogoClick
}) => {
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
              <button
                className="btn-role-login btn-farmer-login"
                onClick={onFarmerLoginClick || (() => onLoginClick && onLoginClick('farmer'))}
                title="Sign in as a Farmer"
              >
                🌾 Farmer Login
              </button>
              <button
                className="btn-role-login btn-customer-login"
                onClick={onCustomerLoginClick || (() => onLoginClick && onLoginClick('customer'))}
                title="Sign in as a Customer"
              >
                🛒 Customer Login
              </button>
              <button className="btn-primary btn-signup-nav" onClick={() => onSignupClick && onSignupClick()}>
                Sign Up
              </button>
              <button className="btn-admin-header" onClick={onAdminLoginClick} title="Administrator Login">
                🛡️ Admin
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
