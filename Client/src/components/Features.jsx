import React from 'react';
import './Features.css';

const featuresData = [
  {
    title: 'Direct Farmer Marketplace',
    description: 'Connect farmers directly with customers and eliminate unnecessary middlemen.',
    icon: '🌾'
  },
  {
    title: 'Government Schemes',
    description: 'Discover state-specific agricultural schemes and subsidy opportunities.',
    icon: '🏛'
  },
  {
    title: 'Loan Assistance',
    description: 'Access information about agricultural loans and financial support programs.',
    icon: '💰'
  },
  {
    title: 'Weather Forecasting',
    description: 'View local weather forecasts to plan farming activities effectively.',
    icon: '🌦'
  },
  {
    title: 'Location-Based Discovery',
    description: 'Find products and farmers within your district or nearby regions.',
    icon: '📍'
  },
  {
    title: 'Farming Technologies',
    description: 'Explore modern agricultural techniques, tools, and best practices.',
    icon: '🚜'
  }
];

const Features = () => {
  return (
    <section className="features" id="features">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">Why Choose <span className="text-gradient">AgriConnect?</span></h2>
          <p className="section-subtitle">
            We provide comprehensive tools to help you manage your farm efficiently and increase profitability.
          </p>
        </div>
        
        <div className="features-grid">
          {featuresData.map((feature, index) => (
            <div className="feature-card glass" key={index} style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <a href="#learn-more" className="feature-link">
                Learn more <span>→</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
