import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import AuthModal from './components/AuthModal';
import FarmerDashboard from './pages/FarmerDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [currentView, setCurrentView] = useState('home');

  // Check for existing session on mount
  useEffect(() => {
    const user = localStorage.getItem('agriconnect_user');
    if (user) {
      setLoggedInUser(JSON.parse(user));
    }
  }, []);

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    const user = JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
    setLoggedInUser(user);
    setIsAuthModalOpen(false);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('agriconnect_token');
    localStorage.removeItem('agriconnect_user');
    setLoggedInUser(null);
    setCurrentView('home');
  };

  const handleLogoClick = () => {
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentView === 'dashboard' && loggedInUser) {
    if (loggedInUser.role === 'farmer') {
      return <FarmerDashboard onLogout={handleLogout} onLogoClick={handleLogoClick} />;
    }
    if (loggedInUser.role === 'customer') {
      return <CustomerDashboard onLogout={handleLogout} onLogoClick={handleLogoClick} />;
    }
    if (loggedInUser.role === 'admin') {
      return <AdminDashboard onLogout={handleLogout} onLogoClick={handleLogoClick} />;
    }
  }

  return (
    <div className="app-container">
      <Navbar 
        onLoginClick={() => openAuthModal('login')} 
        onSignupClick={() => openAuthModal('signup')} 
        isLoggedIn={!!loggedInUser}
        onDashboardClick={() => setCurrentView('dashboard')}
        onLogoClick={handleLogoClick}
      />
      <Hero />
      <Features />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        onSuccess={handleAuthSuccess}
        key={isAuthModalOpen ? 'open' : 'closed'}
      />
    </div>
  );
}

export default App;
