/**
 * Indian Pincode Geocoding Service
 * Automatically calculates geographical coordinates (lat, lng), district, and state
 * based on the 6-digit Indian PIN code.
 */

const PIN_PREFIX_OFFLINE = {
  '11': { state: 'Delhi', district: 'New Delhi', lat: 28.6139, lng: 77.2090 },
  '12': { state: 'Haryana', district: 'Gurgaon', lat: 28.4595, lng: 77.0266 },
  '13': { state: 'Haryana', district: 'Ambala', lat: 30.3782, lng: 76.7767 },
  '14': { state: 'Punjab', district: 'Amritsar', lat: 31.6340, lng: 74.8723 },
  '15': { state: 'Punjab', district: 'Bathinda', lat: 30.2110, lng: 74.9455 },
  '16': { state: 'Chandigarh', district: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  '17': { state: 'Himachal Pradesh', district: 'Shimla', lat: 31.1048, lng: 77.1734 },
  '18': { state: 'Jammu and Kashmir', district: 'Jammu', lat: 32.7266, lng: 74.8570 },
  '19': { state: 'Jammu and Kashmir', district: 'Srinagar', lat: 34.0837, lng: 74.7973 },
  '20': { state: 'Uttar Pradesh', district: 'Noida', lat: 28.5355, lng: 77.3910 },
  '21': { state: 'Uttar Pradesh', district: 'Prayagraj', lat: 25.4358, lng: 81.8463 },
  '22': { state: 'Uttar Pradesh', district: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  '24': { state: 'Uttarakhand', district: 'Dehradun', lat: 30.3165, lng: 78.0322 },
  '26': { state: 'Uttar Pradesh', district: 'Bareilly', lat: 28.3670, lng: 79.4304 },
  '28': { state: 'Uttar Pradesh', district: 'Agra', lat: 27.1767, lng: 78.0081 },
  '30': { state: 'Rajasthan', district: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  '31': { state: 'Rajasthan', district: 'Udaipur', lat: 24.5854, lng: 73.7125 },
  '32': { state: 'Rajasthan', district: 'Kota', lat: 25.2138, lng: 75.8648 },
  '34': { state: 'Rajasthan', district: 'Jodhpur', lat: 26.2389, lng: 73.0243 },
  '36': { state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
  '38': { state: 'Gujarat', district: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  '39': { state: 'Gujarat', district: 'Surat', lat: 21.1702, lng: 72.8311 },
  '40': { state: 'Maharashtra', district: 'Mumbai', lat: 18.9936, lng: 72.8545 },
  '41': { state: 'Maharashtra', district: 'Pune', lat: 18.5204, lng: 73.8567 },
  '42': { state: 'Maharashtra', district: 'Nashik', lat: 19.9975, lng: 73.7898 },
  '43': { state: 'Maharashtra', district: 'Aurangabad', lat: 19.8762, lng: 75.3433 },
  '44': { state: 'Maharashtra', district: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  '45': { state: 'Madhya Pradesh', district: 'Indore', lat: 22.7196, lng: 75.8577 },
  '46': { state: 'Madhya Pradesh', district: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  '49': { state: 'Chhattisgarh', district: 'Raipur', lat: 21.2514, lng: 81.6296 },
  '50': { state: 'Telangana', district: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  '51': { state: 'Andhra Pradesh', district: 'Tirupati', lat: 13.6288, lng: 79.4192 },
  '52': { state: 'Andhra Pradesh', district: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  '53': { state: 'Andhra Pradesh', district: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  '56': { state: 'Karnataka', district: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  '57': { state: 'Karnataka', district: 'Mangaluru', lat: 12.9141, lng: 74.8560 },
  '58': { state: 'Karnataka', district: 'Hubballi', lat: 15.3647, lng: 75.1240 },
  '59': { state: 'Karnataka', district: 'Belagavi', lat: 15.8497, lng: 74.4977 },
  '60': { state: 'Tamil Nadu', district: 'Chennai', lat: 13.0827, lng: 80.2707 },
  '62': { state: 'Tamil Nadu', district: 'Madurai', lat: 9.9252, lng: 78.1198 },
  '64': { state: 'Tamil Nadu', district: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  '67': { state: 'Kerala', district: 'Kozhikode', lat: 11.2588, lng: 75.7804 },
  '68': { state: 'Kerala', district: 'Kochi', lat: 9.9312, lng: 76.2673 },
  '69': { state: 'Kerala', district: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  '70': { state: 'West Bengal', district: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  '71': { state: 'West Bengal', district: 'Howrah', lat: 22.5958, lng: 88.2636 },
  '72': { state: 'West Bengal', district: 'Midnapore', lat: 22.4257, lng: 87.3199 },
  '73': { state: 'West Bengal', district: 'Siliguri', lat: 26.7271, lng: 88.3953 },
  '74': { state: 'West Bengal', district: 'North 24 Parganas', lat: 22.7214, lng: 88.4817 },
  '75': { state: 'Odisha', district: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
  '76': { state: 'Odisha', district: 'Cuttack', lat: 20.4625, lng: 85.8830 },
  '78': { state: 'Assam', district: 'Guwahati', lat: 26.1445, lng: 91.7362 },
  '79': { state: 'Tripura', district: 'Agartala', lat: 23.8315, lng: 91.2868 },
  '80': { state: 'Bihar', district: 'Patna', lat: 25.5941, lng: 85.1376 },
  '81': { state: 'Bihar', district: 'Bhagalpur', lat: 25.2425, lng: 86.9842 },
  '82': { state: 'Bihar', district: 'Gaya', lat: 24.7914, lng: 85.0002 },
  '83': { state: 'Jharkhand', district: 'Ranchi', lat: 23.3441, lng: 85.3096 },
  '84': { state: 'Bihar', district: 'Muzaffarpur', lat: 26.1209, lng: 85.3647 },
  '85': { state: 'Bihar', district: 'Purnia', lat: 25.7771, lng: 87.4753 },
};

/**
 * Geocodes an Indian Pincode to [lng, lat] coordinates, district, and state.
 * Uses OpenStreetMap Nominatim, PostalPincode API, and offline table fallback.
 */
export async function geocodePincode(pincode, fallbackDistrict = '', fallbackState = '') {
  const cleanPin = String(pincode || '').trim().replace(/\D/g, '');
  if (cleanPin.length !== 6) {
    return null;
  }

  let lat = null;
  let lng = null;
  let district = fallbackDistrict;
  let state = fallbackState;
  let source = 'unknown';

  // 1. Try OpenStreetMap Nominatim with postalcode query
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/search?postalcode=${cleanPin}&country=India&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AgriConnect-PincodeGeocoder/1.0',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        lat = parseFloat(item.lat);
        lng = parseFloat(item.lon);
        source = 'nominatim_postal';

        const addr = item.address || {};
        district = addr.county || addr.state_district || addr.city_district || addr.district || addr.city || district;
        state = addr.state || addr.region || state;
      }
    }
  } catch (err) {
    // Proceed to next fallback
  }

  // 2. If coordinates not found yet, query PostalPincode API for official district & state
  if (lat == null || lng == null || !district || !state) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          district = district || po.District || po.Division || '';
          state = state || po.State || '';

          // If we still need coordinates, query Nominatim by District + State
          if (lat == null && district) {
            try {
              const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(district)}&state=${encodeURIComponent(state)}&country=India&format=json`,
                { headers: { 'User-Agent': 'AgriConnect-PincodeGeocoder/1.0' } }
              );
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData?.[0]) {
                  lat = parseFloat(geoData[0].lat);
                  lng = parseFloat(geoData[0].lon);
                  source = 'postalpincode_city';
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      // Proceed to next fallback
    }
  }

  // 3. Try Zippopotam fallback if still missing
  if (lat == null || lng == null) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`https://api.zippopotam.us/in/${cleanPin}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.places?.[0]) {
          const pl = data.places[0];
          lat = parseFloat(pl.latitude);
          lng = parseFloat(pl.longitude);
          state = state || pl.state;
          district = district || pl['place name'];
          source = 'zippopotam';
        }
      }
    } catch {
      // Proceed to offline prefix table
    }
  }

  // 4. Offline prefix lookup table fallback (Guarantees coordinates even offline)
  if (lat == null || lng == null) {
    const prefix = cleanPin.substring(0, 2);
    const region = PIN_PREFIX_OFFLINE[prefix];
    if (region) {
      lat = region.lat;
      lng = region.lng;
      district = district || region.district;
      state = state || region.state;
      source = 'offline_prefix';
    }
  }

  // If still unknown, fallback to India center coordinates
  if (lat == null || lng == null) {
    lat = 20.5937;
    lng = 78.9629;
    source = 'country_fallback';
  }

  return {
    pincode: cleanPin,
    lat,
    lng,
    coordinates: [lng, lat], // GeoJSON [longitude, latitude]
    district: district || 'Unknown',
    state: state || 'Unknown',
    source,
  };
}

