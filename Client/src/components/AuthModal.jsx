import React, { useState } from 'react';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, initialMode = 'login', onSuccess }) => {
  const [mode, setMode] = useState(initialMode); // 'login', 'signup', 'forgotPassword'
  const [geoStatus, setGeoStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1 = email, 2 = otp + new password

  // Form state based on schema
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'farmer',
    state: '',
    address: '',
    district: '',
    pincode: '',
    otp: '',
    newPassword: '',
    location: { type: 'Point', coordinates: [] } // [longitude, latitude]
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setApiSuccess('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup' && !otpSent) {
        // Step 1 of Signup: Send OTP
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, phone: formData.phone }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to send OTP.');
        setOtpSent(true);
        setApiSuccess('OTP sent to your email! Please check your inbox.');
        setIsSubmitting(false);
        return;
      }

      if (mode === 'forgotPassword') {
        if (forgotPasswordStep === 1) {
          // Send forgot password OTP
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to send OTP.');
          setForgotPasswordStep(2);
          setApiSuccess('OTP sent to your email! Please check your inbox.');
          setIsSubmitting(false);
          return;
        } else {
          // Verify forgot password OTP and reset password
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email, otp: formData.otp, newPassword: formData.newPassword }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
          setApiSuccess('Password reset successfully! You can now log in.');
          setMode('login');
          setForgotPasswordStep(1);
          setIsSubmitting(false);
          return;
        }
      }

      // Login or Complete Registration
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

      const payload = mode === 'login'
        ? { email: formData.email, password: formData.password }
        : {
            ...formData,
            // Only include location if coordinates were actually captured
            location: formData.location.coordinates.length === 2 ? formData.location : undefined,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong. Please try again.');
      }

      // Save token to localStorage
      localStorage.setItem('agriconnect_token', data.token);
      localStorage.setItem('agriconnect_user', JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
        phone: data.phone,
        state: data.state,
        district: data.district,
        address: data.address,
        pincode: data.pincode,
        location: data.location
      }));

      setApiSuccess(
        mode === 'login'
          ? `Welcome back, ${data.name}! 👋`
          : `Account created successfully! Welcome, ${data.name}! 🎉`
      );

      // Notify parent and close modal
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 1200);

    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setApiError('');
    setApiSuccess('');
    setOtpSent(false);
    setForgotPasswordStep(1);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { longitude, latitude } = position.coords;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.address || {};

          const state    = addr.state        || addr.region         || '';
          const district = addr.county       || addr.state_district || addr.city_district || addr.district || addr.city || '';
          const road     = addr.road         || addr.neighbourhood  || addr.suburb || '';
          const city     = addr.city         || addr.town           || addr.village || '';
          const address  = [road, city].filter(Boolean).join(', ');
          const pincode  = addr.postcode     || '';

          setFormData((prev) => ({
            ...prev,
            location: { type: 'Point', coordinates: [longitude, latitude] },
            state,
            district,
            address,
            pincode,
          }));
        } catch {
          setFormData((prev) => ({
            ...prev,
            location: { type: 'Point', coordinates: [longitude, latitude] },
          }));
        }

        setGeoStatus('success');
      },
      () => {
        setGeoStatus('error');
      }
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        <div className="modal-header">
          <h2>
            {mode === 'login' ? 'Welcome Back' 
              : mode === 'signup' ? 'Join AgriConnect' 
              : 'Reset Password'}
          </h2>
          <p>
            {mode === 'login' ? 'Log in to manage your farm' 
              : mode === 'signup' ? 'Create an account to get started' 
              : 'Enter your email to receive an OTP'}
          </p>
        </div>

        {apiError && <div className="auth-alert auth-alert--error">⚠ {apiError}</div>}
        {apiSuccess && <div className="auth-alert auth-alert--success">✓ {apiSuccess}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && !otpSent && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="name" required onChange={handleChange} value={formData.name} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input type="tel" name="phone" required onChange={handleChange} value={formData.phone} placeholder="+91 98765 43210" />
                </div>
              </div>
              
              <div className="form-group">
                <label>Role *</label>
                <select name="role" required onChange={handleChange} value={formData.role}>
                  <option value="farmer">Farmer</option>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" name="email" required onChange={handleChange} value={formData.email} placeholder="you@example.com" />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input type="password" name="password" required onChange={handleChange} value={formData.password} placeholder="••••••••" />
              </div>

              <div className="form-group">
                <label>Your Location <span className="label-hint">(used for nearby discovery)</span></label>
                <button
                  type="button"
                  className={`btn-geo ${geoStatus}`}
                  onClick={handleDetectLocation}
                  disabled={geoStatus === 'loading'}
                >
                  {geoStatus === 'loading' && <span className="geo-spinner"></span>}
                  {geoStatus === 'idle' && '📍 Detect My Location'}
                  {geoStatus === 'loading' && 'Fetching location...'}
                  {geoStatus === 'success' && `✅ Location Captured`}
                  {geoStatus === 'error' && '❌ Failed — Try Again'}
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>State *</label>
                  <input type="text" name="state" required onChange={handleChange} value={formData.state} placeholder="Maharashtra" />
                </div>
                <div className="form-group">
                  <label>District</label>
                  <input type="text" name="district" onChange={handleChange} value={formData.district} placeholder="Pune" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" onChange={handleChange} value={formData.address} placeholder="123 Farm Lane" />
                </div>
                <div className="form-group">
                  <label>Pincode</label>
                  <input type="text" name="pincode" onChange={handleChange} value={formData.pincode} placeholder="411001" />
                </div>
              </div>
            </>
          )}

          {mode === 'signup' && otpSent && (
            <div className="form-group">
              <label>Enter OTP sent to {formData.email} *</label>
              <input type="text" name="otp" required onChange={handleChange} value={formData.otp} placeholder="123456" />
            </div>
          )}

          {mode === 'login' && (
            <>
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" name="email" required onChange={handleChange} value={formData.email} placeholder="you@example.com" />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input type="password" name="password" required onChange={handleChange} value={formData.password} placeholder="••••••••" />
              </div>
              <div style={{ textAlign: 'right', marginTop: '-10px', marginBottom: '10px' }}>
                <span onClick={() => switchMode('forgotPassword')} className="text-gradient link" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                  Forgot Password?
                </span>
              </div>
            </>
          )}

          {mode === 'forgotPassword' && forgotPasswordStep === 1 && (
            <div className="form-group">
              <label>Email Address *</label>
              <input type="email" name="email" required onChange={handleChange} value={formData.email} placeholder="you@example.com" />
            </div>
          )}

          {mode === 'forgotPassword' && forgotPasswordStep === 2 && (
            <>
              <div className="form-group">
                <label>Enter OTP *</label>
                <input type="text" name="otp" required onChange={handleChange} value={formData.otp} placeholder="123456" />
              </div>
              <div className="form-group">
                <label>New Password *</label>
                <input type="password" name="newPassword" required onChange={handleChange} value={formData.newPassword} placeholder="••••••••" />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={isSubmitting}>
            {isSubmitting
              ? <><span className="geo-spinner"></span> Processing...</>
              : mode === 'login' ? 'Log In' 
              : mode === 'signup' && !otpSent ? 'Send OTP'
              : mode === 'signup' && otpSent ? 'Verify & Sign Up'
              : mode === 'forgotPassword' && forgotPasswordStep === 1 ? 'Send OTP'
              : 'Reset Password'
            }
          </button>
        </form>

        <div className="modal-footer">
          {mode === 'login' ? (
            <p>Don't have an account? <span onClick={() => switchMode('signup')} className="text-gradient link" style={{ cursor: 'pointer' }}>Sign Up</span></p>
          ) : (
            <p>Back to <span onClick={() => switchMode('login')} className="text-gradient link" style={{ cursor: 'pointer' }}>Log In</span></p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
