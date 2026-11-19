import React, { useState } from 'react';

/**
 * A self-contained button that:
 *  1. Asks browser for GPS coordinates
 *  2. Reverse-geocodes via Nominatim
 *  3. PATCHes /api/auth/profile with the new location
 *  4. Updates localStorage so the rest of the app sees fresh coords
 */
const UpdateLocationButton = ({ onUpdated }) => {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = useState('');

  const handleUpdate = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMsg('Geolocation not supported by your browser.');
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
        setMsg('Location access denied. Please allow location in your browser settings.');
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        {status === 'idle'    && '📍 Update My Location'}
        {status === 'loading' && 'Detecting...'}
        {status === 'success' && '✅ Location Updated'}
        {status === 'error'   && '❌ Retry Location'}
      </button>
      {msg && (
        <p style={{ fontSize: '0.78rem', margin: 0, color: status === 'success' ? '#86efac' : '#fca5a5' }}>
          {msg}
        </p>
      )}
    </div>
  );
};

export default UpdateLocationButton;

