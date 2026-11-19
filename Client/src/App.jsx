import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import AuthModal from './components/AuthModal';
import ChatBot from './components/ChatBot';
import FarmerDashboard from './pages/FarmerDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authRole, setAuthRole] = useState('farmer'); // 'farmer' | 'customer' | 'admin'
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [currentView, setCurrentView] = useState('home');

  // Check for existing session on mount
  useEffect(() => {
    const user = localStorage.getItem('agriconnect_user');
    if (user) {
      setLoggedInUser(JSON.parse(user));
    }
  }, []);

  const openAuthModal = (mode, role = 'farmer') => {
    setAuthMode(mode);
    setAuthRole(role);
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

  return (
    <div className="app-container">
      {currentView === 'dashboard' && loggedInUser ? (
        <>
          {loggedInUser.role === 'farmer' && (
            <FarmerDashboard onLogout={handleLogout} onLogoClick={handleLogoClick} />
          )}
          {loggedInUser.role === 'customer' && (
            <CustomerDashboard onLogout={handleLogout} onLogoClick={handleLogoClick} />
          )}
          {loggedInUser.role === 'admin' && (
            <AdminDashboard onLogout={handleLogout} onLogoClick={handleLogoClick} />
          )}
        </>
      ) : (
        <>
          <Navbar 
            onFarmerLoginClick={() => openAuthModal('login', 'farmer')}
            onCustomerLoginClick={() => openAuthModal('login', 'customer')}
            onLoginClick={(role) => openAuthModal('login', role || 'farmer')} 
            onSignupClick={(role) => openAuthModal('signup', role || 'farmer')} 
            onAdminLoginClick={() => openAuthModal('adminLogin', 'admin')}
            isLoggedIn={!!loggedInUser}
            onDashboardClick={() => setCurrentView('dashboard')}
            onLogoClick={handleLogoClick}
          />
          <Hero 
            onFarmerLoginClick={() => openAuthModal('login', 'farmer')}
            onCustomerLoginClick={() => openAuthModal('login', 'customer')}
            isLoggedIn={!!loggedInUser}
            user={loggedInUser}
            onDashboardClick={() => setCurrentView('dashboard')}
          />
          <Features />
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            initialMode={authMode}
            initialRole={authRole}
            onSuccess={handleAuthSuccess}
            key={`${isAuthModalOpen}-${authMode}-${authRole}`}
          />
        </>
      )}

      {/* Global Multi-Agent AI Chatbot */}
      <ChatBot user={loggedInUser} />
    </div>
  );
}

export default App;
