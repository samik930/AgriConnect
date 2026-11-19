import React from 'react';
import './Hero.css';

const Hero = ({ onFarmerLoginClick, onCustomerLoginClick, isLoggedIn, user, onDashboardClick }) => {
  return (
    <section className="hero" id="home">
      <div className="hero-background">
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
      </div>
      
      <div className="container hero-container">
        <div className="hero-content">
          <div className="badge">
            <span className="pulse"></span>
            Revolutionizing Agriculture
          </div>
          <h1 className="hero-title">
            Empowering Farmers with <br/>
            <span className="text-gradient">Smart Technology</span>
          </h1>
          <p className="hero-subtitle">
            AgriConnect bridges the gap between traditional farming and modern innovation. Optimize your yield, connect with markets, and grow sustainably.
          </p>
          <div className="hero-actions">
            {isLoggedIn ? (
              <button className="btn-primary btn-lg" onClick={onDashboardClick}>
                Go to {user?.role === 'farmer' ? 'Farmer' : user?.role === 'customer' ? 'Customer' : 'Admin'} Dashboard →
              </button>
            ) : (
              <>
                <button className="btn-primary btn-lg" onClick={onFarmerLoginClick}>
                  🌾 Farmer Portal
                </button>
                <button className="btn-secondary btn-lg btn-customer-hero" onClick={onCustomerLoginClick}>
                  🛒 Customer Market
                </button>
              </>
            )}
          </div>
          
          <div className="stats-row">
            <div className="stat-item">
              <h3>500+</h3>
              <p>Farmers</p>
            </div>
            <div className="stat-item">
              <h3>100+</h3>
              <p>Products Listed</p>
            </div>
            <div className="stat-item">
              <h3>50+</h3>
              <p>Government Schemes</p>
            </div>
            <div className="stat-item">
              <h3>24/7</h3>
              <p>Weather Updates</p>
            </div>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="glass card card-main">
            <div className="card-header">
              <div className="dot red"></div>
              <div className="dot yellow"></div>
              <div className="dot green"></div>
            </div>
            <div className="card-body">
              <div className="chart-mockup">
                <div className="bar b1"></div>
                <div className="bar b2"></div>
                <div className="bar b3"></div>
                <div className="bar b4"></div>
                <div className="bar b5"></div>
              </div>
              <div className="insight">
                <span className="icon">↑</span>
                <div>
                  <h4>Crop Yield Forecast</h4>
                  <p>+24% expected this season</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass card card-float">
            <div className="avatar-group">
              <div className="avatar"></div>
              <div className="avatar"></div>
              <div className="avatar"></div>
            </div>
            <p>Join our growing community</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
