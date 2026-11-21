/**
 * Client-Side Pincode Geocoder
 * Calculates coordinates, district, and state from a 6-digit Indian PIN code.
 */

export async function geocodePincode(pincode, fallbackDistrict = '', fallbackState = '') {
  const cleanPin = String(pincode || '').trim().replace(/\D/g, '');
  if (cleanPin.length !== 6) return null;

  // 1. First try backend endpoint if available
  try {
    const res = await fetch(`/api/auth/geocode-pincode?pincode=${cleanPin}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.lat != null && data.lng != null) {
        return data;
      }
    }
  } catch {
    // Fall back to direct browser fetch
  }

  // 2. Direct OpenStreetMap Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${cleanPin}&country=India&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const addr = item.address || {};
        const district = addr.county || addr.state_district || addr.city_district || addr.district || addr.city || fallbackDistrict;
        const state = addr.state || addr.region || fallbackState;
        return {
          pincode: cleanPin,
          lat,
          lng,
          coordinates: [lng, lat],
          district: district || 'Unknown',
          state: state || 'Unknown',
        };
      }
    }
  } catch {
    // Proceed to postalpincode.in
  }

  // 3. Try PostalPincode API
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const district = po.District || po.Division || fallbackDistrict;
        const state = po.State || fallbackState;

        // Try getting lat/lng for the district
        if (district) {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(district)}&state=${encodeURIComponent(state)}&country=India&format=json`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData?.[0]) {
              const lat = parseFloat(geoData[0].lat);
              const lng = parseFloat(geoData[0].lon);
              return {
                pincode: cleanPin,
                lat,
                lng,
                coordinates: [lng, lat],
                district,
                state,
              };
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

