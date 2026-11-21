import React, { useState } from 'react';
import { geocodePincode } from '../utils/pincodeGeocode';

/**
 * A self-contained button that:
 *  1. Asks browser for GPS coordinates OR accepts a 6-digit Pincode
 *  2. Calculates coordinates from pincode or reverse-geocodes
 *  3. PUTs /api/auth/profile with the new location and pincode
 *  4. Updates localStorage so the rest of the app sees fresh coords
 */
const UpdateLocationButton = ({ onUpdated }) => {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const handleUpdate = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMsg('Geolocation not supported by your browser. Please enter Pincode below.');
      setShowPinInput(true);
      return;
    }

    setStatus('loading');
    setMsg('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { longitude, latitude } = position.coords;

        try {
          // Reverse geocode
          let state = '', district = '', address = '', pincode = '';
          try {
            const geo = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { 'Accept-Language': 'en' } }
            );
            const geoData = await geo.json();
            const addr = geoData.address || {};
            state    = addr.state        || addr.region         || '';
            district = addr.county       || addr.state_district || addr.city_district || addr.district || addr.city || '';
            const road = addr.road       || addr.neighbourhood  || addr.suburb || '';
            const city = addr.city       || addr.town           || addr.village || '';
            address  = [road, city].filter(Boolean).join(', ');
            pincode  = addr.postcode     || '';
          } catch { /* use raw coords even if reverse-geo fails */ }

          // Send to backend
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: { type: 'Point', coordinates: [longitude, latitude] },
              state, district, address, pincode,
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to update location.');
          }

          const updated = await res.json();

          // Persist to localStorage
          const stored = JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
          localStorage.setItem('agriconnect_user', JSON.stringify({
            ...stored,
            location: updated.location,
            state:    updated.state,
            district: updated.district,
            address:  updated.address,
            pincode:  updated.pincode,
          }));

          setStatus('success');
          setMsg(`📌 ${address || 'Location'}${district ? ', ' + district : ''}${state ? ', ' + state : ''}`);
          if (onUpdated) onUpdated(updated);

        } catch (err) {
          setStatus('error');
          setMsg(err.message);
        }
      },
      () => {
        setStatus('error');
        setMsg('Browser GPS permission was not granted. You can enter your 6-digit Pincode below.');
        setShowPinInput(true);
      }
    );
  };

  const handlePincodeSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pinInput.trim().replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setStatus('error');
      setMsg('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    setStatus('loading');
    setMsg(`Calculating coordinates for pincode ${cleanPin}...`);

    try {
      const geo = await geocodePincode(cleanPin);
      if (!geo || geo.lat == null || geo.lng == null) {
        throw new Error(`Could not calculate coordinates for pincode ${cleanPin}.`);
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { type: 'Point', coordinates: [geo.lng, geo.lat] },
          state: geo.state,
          district: geo.district,
          pincode: cleanPin,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update location.');
      }

      const updated = await res.json();
      const stored = JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
      localStorage.setItem('agriconnect_user', JSON.stringify({
        ...stored,
        location: updated.location,
        state:    updated.state,
        district: updated.district,
        pincode:  updated.pincode,
      }));

      setStatus('success');
      setMsg(`📌 Pincode ${cleanPin} geocoded: ${geo.district}, ${geo.state} [${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}]`);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setStatus('error');
      setMsg(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '380px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={status === 'loading'}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            background: status === 'success' ? '#16a34a' : status === 'error' ? '#dc2626' : '#15803d',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: status === 'loading' ? 0.7 : 1,
          }}
        >
          {status === 'loading' && <span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />}
          {status === 'idle'    && '📍 Detect GPS Location'}
          {status === 'loading' && 'Calculating...'}
          {status === 'success' && '✅ Location Updated'}
          {status === 'error'   && '❌ Retry GPS'}
        </button>

        <button
          type="button"
          onClick={() => setShowPinInput(!showPinInput)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text)',
            fontSize: '0.84rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          📮 {showPinInput ? 'Hide Pincode' : 'Set by Pincode'}
        </button>
      </div>

      {showPinInput && (
        <form onSubmit={handlePincodeSubmit} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <input
            type="text"
            placeholder="Enter 6-digit Pincode"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: '0.85rem',
              width: '180px',
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading' || pinInput.length !== 6}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: pinInput.length === 6 ? 'var(--color-primary)' : '#475569',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: pinInput.length === 6 ? 'pointer' : 'not-allowed',
            }}
          >
            Calculate
          </button>
        </form>
      )}

      {msg && (
        <p style={{ fontSize: '0.78rem', margin: 0, color: status === 'success' ? '#86efac' : '#fca5a5' }}>
          {msg}
        </p>
      )}
    </div>
  );
};

export default UpdateLocationButton;
