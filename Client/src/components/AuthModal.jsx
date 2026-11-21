import React, { useState, useEffect, useCallback } from 'react';
import './AuthModal.css';
import { geocodePincode } from '../utils/pincodeGeocode';

// Safe fetch: throws a friendly error if server is unreachable or returns non-JSON
const safeFetch = async (url, options) => {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Cannot connect to server. Make sure the backend is running on port 5000.');
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Server is not responding correctly. Make sure the backend is running on port 5000.');
  }
  return { res, data };
};

const AuthModal = ({ isOpen, onClose, initialMode = 'login', initialRole = 'farmer', onSuccess }) => {
  const [mode, setMode] = useState(initialMode); // 'login', 'signup', 'forgotPassword', 'adminLogin'
  const [role, setRole] = useState(initialRole || 'farmer'); // 'farmer' | 'customer'
  const [geoStatus, setGeoStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [pincodeStatus, setPincodeStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  const [adminRedirectPrompt, setAdminRedirectPrompt] = useState(false);
  
  const [otpSent, setOtpSent] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1 = email, 2 = otp + new password

  // Form state based on schema
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: initialRole || 'farmer',
    state: '',
    address: '',
    district: '',
    pincode: '',
    otp: '',
    newPassword: '',
    location: { type: 'Point', coordinates: [] } // [longitude, latitude]
  });

  // Defined with useCallback so it can be safely called from useEffect
  const handleDetectLocation = useCallback(() => {
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
      () => setGeoStatus('error')
    );
  }, []);

  // Auto-trigger location detection when signup form opens
  useEffect(() => {
    if (isOpen && mode === 'signup' && geoStatus === 'idle') {
      handleDetectLocation();
    }
  }, [isOpen, mode, geoStatus, handleDetectLocation]);

  if (!isOpen) return null;

  const handlePincodeInput = async (pinValue) => {
    const cleanPin = pinValue.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: cleanPin }));

    if (cleanPin.length === 6) {
      setPincodeStatus('🔍 Calculating coordinates from pincode...');
      try {
        const geo = await geocodePincode(cleanPin, formData.district, formData.state);
        if (geo && geo.lat != null && geo.lng != null) {
          setFormData((prev) => ({
            ...prev,
            pincode: cleanPin,
            state: prev.state || geo.state,
            district: prev.district || geo.district,
            location: { type: 'Point', coordinates: [geo.lng, geo.lat] },
          }));
          setPincodeStatus(`📍 Coordinates: [${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}] (${geo.district}, ${geo.state})`);
          setGeoStatus('success');
        } else {
          setPincodeStatus('⚠️ Coordinates will be resolved automatically on submit.');
        }
      } catch {
        setPincodeStatus('');
      }
    } else {
      setPincodeStatus('');
    }
  };

  const handleChange = (e) => {
    if (e.target.name === 'pincode') {
      handlePincodeInput(e.target.value);
      return;
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setApiError('');
    setAdminRedirectPrompt(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setApiSuccess('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup' && !otpSent) {
        // Step 1 of Signup: Send OTP
        const { res, data } = await safeFetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, phone: formData.phone }),
        });
        if (!res.ok) throw new Error(data.message || 'Failed to send OTP.');
        setOtpSent(true);
        setApiSuccess('OTP sent to your email! Please check your inbox.');
        setIsSubmitting(false);
        return;
      }

      if (mode === 'forgotPassword') {
        if (forgotPasswordStep === 1) {
          // Send forgot password OTP
          const { res, data } = await safeFetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          });
          if (!res.ok) throw new Error(data.message || 'Failed to send OTP.');
          setForgotPasswordStep(2);
          setApiSuccess('OTP sent to your email! Please check your inbox.');
          setIsSubmitting(false);
          return;
        } else {
          // Verify forgot password OTP and reset password
          const { res, data } = await safeFetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email, otp: formData.otp, newPassword: formData.newPassword }),
          });
          if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
          setApiSuccess('Password reset successfully! You can now log in.');
          setMode('login');
          setForgotPasswordStep(1);
          setIsSubmitting(false);
          return;
        }
      }

      // Login or Complete Registration
      const isLogin = mode === 'login' || mode === 'adminLogin';
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : {
            ...formData,
            // Only include location if coordinates were actually captured
            location: formData.location.coordinates.length === 2 ? formData.location : undefined,
          };

      const { res, data } = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong. Please try again.');
      }

      if (mode === 'adminLogin' && data.role !== 'admin') {
        throw new Error(`Access denied: This portal is strictly for administrators. Your account is registered as a "${data.role}". Please use ${data.role === 'farmer' ? 'Farmer' : 'Customer'} Login.`);
      }

      if (mode === 'login') {
        if (data.role === 'admin') {
          setAdminRedirectPrompt(true);
          throw new Error('Your account has Administrator privileges. Please switch to the Admin Dashboard login.');
        }
        if (role === 'farmer' && data.role !== 'farmer') {
          throw new Error('This portal is for Farmers. Your account is registered as a "Customer". Please switch to Customer Login.');
        }
        if (role === 'customer' && data.role !== 'customer') {
          throw new Error('This portal is for Customers. Your account is registered as a "Farmer". Please switch to Farmer Login.');
        }
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

      const userName = data.name || 'there';
      setApiSuccess(
        mode === 'login'
          ? `Welcome back, ${userName}! 👋`
          : `Account created successfully! Welcome, ${userName}! 🎉`
      );

      // Notify parent and close modal
      if (onSuccess) onSuccess();
      else onClose();

    } catch (err) {
      // Handle HTML response from proxy (server not running)
      if (err.message && err.message.includes('<!DOCTYPE')) {
        setApiError('Cannot connect to server. Please make sure the backend is running.');
      } else {
        setApiError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode, newRole) => {
    setMode(newMode);
    if (newRole) {
      setRole(newRole);
      setFormData((prev) => ({ ...prev, role: newRole }));
    }
    setApiError('');
    setApiSuccess('');
    setAdminRedirectPrompt(false);
    setOtpSent(false);
    setForgotPasswordStep(1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        <div className="modal-header">
          <h2>
            {mode === 'adminLogin'
              ? '🔐 Admin Login'
              : mode === 'login'
              ? role === 'farmer'
                ? '🌾 Farmer Login'
                : '🛒 Customer Login'
              : mode === 'signup'
              ? formData.role === 'farmer'
                ? '🌾 Join as a Farmer'
                : '🛒 Join as a Customer'
              : 'Reset Password'}
          </h2>
          <p>
            {mode === 'adminLogin'
              ? 'Sign in to access the administrator portal'
              : mode === 'login'
              ? role === 'farmer'
                ? 'Log in to manage your crops, inventory & advisories'
                : 'Log in to browse fresh farm produce & track orders'
              : mode === 'signup'
              ? formData.role === 'farmer'
                ? 'Create a farmer account to list crops and access subsidies'
                : 'Create a customer account to buy directly from local farmers'
              : 'Enter your email to receive an OTP'}
          </p>
        </div>

        {/* Dedicated Role Tabs for Farmer and Customer */}
        {mode === 'login' && (
          <div className="auth-role-tabs">
            <button
              type="button"
              className={`auth-role-tab ${role === 'farmer' ? 'active-farmer' : ''}`}
              onClick={() => {
                setRole('farmer');
                setApiError('');
              }}
            >
              🌾 Farmer Login
            </button>
            <button
              type="button"
              className={`auth-role-tab ${role === 'customer' ? 'active-customer' : ''}`}
              onClick={() => {
                setRole('customer');
                setApiError('');
              }}
            >
              🛒 Customer Login
            </button>
          </div>
        )}

        {mode === 'signup' && !otpSent && (
          <div className="auth-role-tabs">
            <button
              type="button"
              className={`auth-role-tab ${formData.role === 'farmer' ? 'active-farmer' : ''}`}
              onClick={() => {
                setFormData((prev) => ({ ...prev, role: 'farmer' }));
                setRole('farmer');
                setApiError('');
              }}
            >
              🌾 Register as Farmer
            </button>
            <button
              type="button"
              className={`auth-role-tab ${formData.role === 'customer' ? 'active-customer' : ''}`}
              onClick={() => {
                setFormData((prev) => ({ ...prev, role: 'customer' }));
                setRole('customer');
                setApiError('');
              }}
            >
              🛒 Register as Customer
            </button>
          </div>
        )}

        {apiError && (
          <div className="auth-alert auth-alert--error" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>⚠ {apiError}</div>
            {adminRedirectPrompt && (
              <button
                type="button"
                className="btn-admin-header"
                style={{ alignSelf: 'flex-start', marginTop: '2px', fontSize: '0.82rem', padding: '6px 12px' }}
                onClick={() => {
                  switchMode('adminLogin', 'admin');
                  setAdminRedirectPrompt(false);
                }}
              >
                🛡️ Switch to Admin Login →
              </button>
            )}
          </div>
        )}
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
                  {geoStatus === 'idle'    && '📍 Detecting your location...'}
                  {geoStatus === 'loading' && 'Fetching location...'}
                  {geoStatus === 'success' && `✅ Location Captured`}
                  {geoStatus === 'error'   && '❌ Failed — Click to Try Again'}
                </button>
                {geoStatus === 'error' && (
                  <p style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '4px' }}>
                    Location access denied or unavailable. Click above to retry, or fill in State manually.
                  </p>
                )}
                {geoStatus === 'success' && formData.address && (
                  <p style={{ fontSize: '0.8rem', color: '#86efac', marginTop: '4px' }}>
                    📌 {formData.address}{formData.district ? `, ${formData.district}` : ''}{formData.state ? `, ${formData.state}` : ''}
                  </p>
                )}
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
                  <label>Pincode *</label>
                  <input
                    type="text"
                    name="pincode"
                    required
                    onChange={handleChange}
                    value={formData.pincode}
                    placeholder="e.g. 700001 or 400001"
                    maxLength={6}
                  />
                  {pincodeStatus && (
                    <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#10b981', fontWeight: 600 }}>
                      {pincodeStatus}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" onChange={handleChange} value={formData.address} placeholder="123 Farm Lane" />
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

          {(mode === 'login' || mode === 'adminLogin') && (
            <>
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" name="email" required onChange={handleChange} value={formData.email} placeholder={mode === 'adminLogin' ? 'admin@agriconnect.com' : 'you@example.com'} />
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
              : mode === 'adminLogin' ? 'Log In as Admin'
              : mode === 'login' ? (role === 'farmer' ? 'Log In as Farmer' : 'Log In as Customer')
              : mode === 'signup' && !otpSent ? 'Send OTP'
              : mode === 'signup' && otpSent ? 'Verify & Sign Up'
              : mode === 'forgotPassword' && forgotPasswordStep === 1 ? 'Send OTP'
              : 'Reset Password'
            }
          </button>
        </form>

        <div className="modal-footer">
          {mode === 'adminLogin' ? (
            <p>Not an administrator? <span onClick={() => switchMode('login', 'farmer')} className="text-gradient link" style={{ cursor: 'pointer' }}>Standard User Login</span></p>
          ) : mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <span onClick={() => switchMode('signup', role)} className="text-gradient link" style={{ cursor: 'pointer' }}>
                Sign Up as {role === 'farmer' ? 'Farmer' : 'Customer'}
              </span>
            </p>
          ) : (
            <p>
              Already registered? Back to{' '}
              <span onClick={() => switchMode('login', formData.role || 'farmer')} className="text-gradient link" style={{ cursor: 'pointer' }}>
                {formData.role === 'customer' ? 'Customer' : 'Farmer'} Log In
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
