import React, { useEffect, useRef, useState, useMemo } from 'react';
import './DeliveryRadiusMap.css';

/**
 * Calculates straight-line distance in kilometers using the Haversine formula
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

const DELIVERY_RADIUS_KM = 50;

const DeliveryRadiusMap = ({ customerLocation, farmers = [], onFarmerSelect }) => {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleInstanceRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const farmerMarkersLayerRef = useRef(null);

  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [showRadius, setShowRadius] = useState(true);

  // Default customer coordinates (fallbacks to Kolkata if not set)
  const cLat = customerLocation?.lat ?? customerLocation?.coordinates?.[1] ?? 22.5726;
  const cLng = customerLocation?.lng ?? customerLocation?.coordinates?.[0] ?? 88.3639;
  const cAddress = customerLocation?.address || customerLocation?.district || 'Your Location';

  // 1. Ensure Leaflet is loaded (from index.html or dynamic check)
  useEffect(() => {
    if (window.L) {
      setIsLeafletReady(true);
      return;
    }

    const checkInterval = setInterval(() => {
      if (window.L) {
        setIsLeafletReady(true);
        clearInterval(checkInterval);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, []);

  // 2. Enrich farmers with distance calculation
  const enrichedFarmers = useMemo(() => {
    return farmers.map((f) => {
      const fLng = f.coordinates?.[0] ?? f.location?.coordinates?.[0] ?? f.lng;
      const fLat = f.coordinates?.[1] ?? f.location?.coordinates?.[1] ?? f.lat;

      let distanceKm = f.distanceKm;
      if (distanceKm == null && fLat != null && fLng != null) {
        distanceKm = calculateHaversineDistanceKm(cLat, cLng, fLat, fLng);
      }

      const isWithinRadius = distanceKm != null && distanceKm <= DELIVERY_RADIUS_KM;

      return {
        ...f,
        lat: fLat,
        lng: fLng,
        distanceKm,
        isWithinRadius,
      };
    });
  }, [farmers, cLat, cLng]);

  const farmersInRangeCount = useMemo(() => {
    return enrichedFarmers.filter((f) => f.isWithinRadius).length;
  }, [enrichedFarmers]);

  // Always strictly show only farmers within the 50 km delivery radius
  const displayedFarmers = useMemo(() => {
    return enrichedFarmers.filter((f) => f.isWithinRadius);
  }, [enrichedFarmers]);

  // 3. Spiderfy / declutter coordinates so nearby farmers do not stack on each other
  const declutteredFarmers = useMemo(() => {
    if (!displayedFarmers.length) return [];

    // Group farmers that are within ~300 meters of each other
    const clusters = [];
    displayedFarmers.forEach((farmer) => {
      if (farmer.lat == null || farmer.lng == null) return;

      const cluster = clusters.find((cl) => {
        const dLat = Math.abs(cl.centerLat - farmer.lat);
        const dLng = Math.abs(cl.centerLng - farmer.lng);
        return dLat < 0.003 && dLng < 0.003;
      });

      if (cluster) {
        cluster.items.push(farmer);
      } else {
        clusters.push({
          centerLat: farmer.lat,
          centerLng: farmer.lng,
          items: [farmer],
        });
      }
    });

    const results = [];
    clusters.forEach((cl) => {
      const count = cl.items.length;
      const isNearCustomer =
        Math.abs(cl.centerLat - cLat) < 0.0018 &&
        Math.abs(cl.centerLng - cLng) < 0.0018;

      cl.items.forEach((farmer, idx) => {
        let displayLat = farmer.lat;
        let displayLng = farmer.lng;

        if (count > 1) {
          // Spread in a circle (~180m radius) so all badges are visible and distinct
          const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
          const visualRadius = 0.0018;
          displayLat = cl.centerLat + visualRadius * Math.sin(angle);
          displayLng = cl.centerLng + visualRadius * Math.cos(angle);
        } else if (isNearCustomer) {
          // Push slightly north-east away from customer marker
          displayLat = farmer.lat + 0.0012;
          displayLng = farmer.lng + 0.0012;
        }

        results.push({
          ...farmer,
          displayLat,
          displayLng,
          hasOffset: count > 1 || isNearCustomer,
        });
      });
    });

    return results;
  }, [displayedFarmers, cLat, cLng]);

  // 3. Initialize Leaflet Map with Standard Light OpenStreetMap Tiles
  useEffect(() => {
    if (!isLeafletReady || !mapElementRef.current || !window.L) return;

    const L = window.L;

    // Create Map instance if not created
    if (!mapInstanceRef.current) {
      const map = L.map(mapElementRef.current, {
        center: [cLat, cLng],
        zoom: 10,
        zoomControl: true,
      });

      // Standard Light OpenStreetMap Tiles (Colorful, clear roads, rivers, cities)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Customer Pulsing Marker
      const customerIcon = L.divIcon({
        className: 'leaflet-customer-marker',
        html: `<div class="customer-pin-pulse" title="Your Location">🏠</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      customerMarkerRef.current = L.marker([cLat, cLng], { icon: customerIcon })
        .addTo(map)
        .bindPopup(`
          <div class="leaflet-popup-card">
            <h4 style="margin: 0; color: #0284c7; font-size: 1.05rem; font-weight: 700;">🏠 Your Location</h4>
            <p style="margin: 4px 0 0 0; color: #475569; font-size: 0.84rem;">${cAddress}</p>
            <div style="margin-top: 6px; font-size: 0.78rem; color: #059669; font-weight: 600;">
              Center of 50 km Fresh Delivery Zone
            </div>
          </div>
        `);

      // 50 km PostGIS Radius Boundary Circle
      circleInstanceRef.current = L.circle([cLat, cLng], {
        radius: DELIVERY_RADIUS_KM * 1000, // 50 km in meters
        color: '#059669',
        fillColor: '#10b981',
        fillOpacity: 0.16,
        weight: 2.5,
      }).addTo(map);

      // LayerGroup for farmer markers
      farmerMarkersLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    } else {
      // Update center & circle if customer coordinates change
      mapInstanceRef.current.setView([cLat, cLng], mapInstanceRef.current.getZoom());
      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng([cLat, cLng]);
      }
      if (circleInstanceRef.current) {
        circleInstanceRef.current.setLatLng([cLat, cLng]);
      }
    }
  }, [isLeafletReady, cLat, cLng, cAddress]);

  // 4. Update Farmer Markers with Spiderfy & Decluttering
  useEffect(() => {
    if (!isLeafletReady || !mapInstanceRef.current || !farmerMarkersLayerRef.current || !window.L) return;

    const L = window.L;
    farmerMarkersLayerRef.current.clearLayers();

    declutteredFarmers.forEach((farmer) => {
      if (farmer.displayLat == null || farmer.displayLng == null) return;

      const isInside = farmer.isWithinRadius;
      const statusClass = isInside ? 'in-range' : 'out-range';
      const badgeIcon = isInside ? '🌾' : '🚜';
      const distLabel = farmer.distanceKm != null ? `${farmer.distanceKm} km` : 'Near';

      // Draw dashed connector line if marker was offset for decluttering
      if (farmer.hasOffset) {
        const connector = L.polyline(
          [
            [farmer.lat, farmer.lng],
            [farmer.displayLat, farmer.displayLng],
          ],
          {
            color: '#059669',
            weight: 1.5,
            dashArray: '3, 4',
            opacity: 0.65,
          }
        );
        farmerMarkersLayerRef.current.addLayer(connector);
      }

      // Custom HTML Marker Badge
      const farmerIcon = L.divIcon({
        className: 'leaflet-farmer-marker',
        html: `
          <div class="farmer-pin-badge ${statusClass}" title="${farmer.name} (${distLabel})">
            <span>${badgeIcon}</span>
            <span>${farmer.name.split(' ')[0]}</span>
            <span style="opacity: 0.9; font-size: 0.72rem; font-weight: 600;">(${distLabel})</span>
          </div>
        `,
        iconSize: [120, 28],
        iconAnchor: [60, 14],
      });

      const productItemsHtml = (farmer.products || [])
        .slice(0, 3)
        .map((p) => `<li>• ${p.name} (₹${p.price}/${p.unit || 'kg'})</li>`)
        .join('');

      const popupHtml = `
        <div class="leaflet-popup-card">
          <div class="popup-header">
            <span class="popup-icon">🌾</span>
            <div>
              <h4>${farmer.name}</h4>
              <p>📍 ${farmer.district || 'Local Farm'}</p>
            </div>
          </div>
          <div class="popup-status ${statusClass}">
            ${
              isInside
                ? `✅ Within 50 km Delivery Zone (${farmer.distanceKm} km)`
                : `⚠️ ${farmer.distanceKm} km away (Beyond 50 km Limit)`
            }
          </div>
          <div class="popup-products">
            <strong>Available Produce (${farmer.productsAvailable || farmer.products?.length || 0}):</strong>
            <ul>${productItemsHtml || '<li>Fresh farm harvest</li>'}</ul>
          </div>
        </div>
      `;

      const marker = L.marker([farmer.displayLat, farmer.displayLng], { icon: farmerIcon })
        .bindPopup(popupHtml)
        .on('click', () => {
          if (onFarmerSelect) onFarmerSelect(farmer);
        });

      farmerMarkersLayerRef.current.addLayer(marker);
    });

    // Auto-fit bounds so all nearby farmers and customer are in clear view
    if (declutteredFarmers.length > 0 && mapInstanceRef.current) {
      const allCoords = [
        [cLat, cLng],
        ...declutteredFarmers.map((f) => [f.displayLat, f.displayLng]),
      ];
      const bounds = L.latLngBounds(allCoords);
      const span = Math.max(
        bounds.getNorth() - bounds.getSouth(),
        bounds.getEast() - bounds.getWest()
      );
      if (span < 0.02) {
        // Farmers are close (e.g. testing in same neighborhood): zoom to 14 so street labels are clear
        mapInstanceRef.current.setView([cLat, cLng], 14, { animate: true });
      } else {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [declutteredFarmers, isLeafletReady, onFarmerSelect, cLat, cLng]);

  // Recenter map on customer or fit bounds
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      if (declutteredFarmers.length > 0) {
        const allCoords = [
          [cLat, cLng],
          ...declutteredFarmers.map((f) => [f.displayLat, f.displayLng]),
        ];
        const bounds = L.latLngBounds(allCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } else {
        mapInstanceRef.current.setView([cLat, cLng], 12, { animate: true });
      }
    }
  };

  // Toggle 50 km circle visibility
  const handleToggleCircle = () => {
    setShowRadius((prev) => {
      const next = !prev;
      if (circleInstanceRef.current && mapInstanceRef.current) {
        if (next) {
          circleInstanceRef.current.addTo(mapInstanceRef.current);
        } else {
          circleInstanceRef.current.remove();
        }
      }
      return next;
    });
  };

  return (
    <div className="delivery-map-container">
      {/* ── Header ── */}
      <div className="delivery-map-header">
        <div className="delivery-map-title-wrap">
          <div className="delivery-map-icon">📍</div>
          <div>
            <h3 className="delivery-map-title">50 km PostGIS Local Delivery Map</h3>
            <p className="delivery-map-subtitle">
              Live farm origins within your 50 km direct delivery radius from <strong>{cAddress}</strong>
            </p>
          </div>
        </div>

        <div className="delivery-map-badges">
          <span className="free-tier-badge">
            <span>✨</span> Free OpenStreetMap
          </span>
          <span className="radius-badge">
            <span>⭕</span> 50 km PostGIS Boundary
          </span>
          <span className="farmers-in-range-badge">
            <span>👨‍🌾</span> {farmersInRangeCount} Eligible Farms (≤ 50 km)
          </span>
        </div>
      </div>

      {/* ── Controls Toolbar ── */}
      <div className="map-controls-bar">
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#10b981', fontWeight: 600 }}>● Active Zone:</span> Showing farms strictly within 50 km delivery radius
        </div>

        <div className="map-action-buttons">
          <button type="button" className="btn-map-control" onClick={handleToggleCircle}>
            {showRadius ? 'Hide 50km Circle' : 'Show 50km Circle'}
          </button>
          <button type="button" className="btn-map-control" onClick={handleRecenter}>
            🎯 Center on Me
          </button>
        </div>
      </div>

      {/* ── Map Frame ── */}
      <div className="map-canvas-frame">
        <div id="leaflet-map-root" ref={mapElementRef} />
      </div>

      {/* ── Legend ── */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot customer" />
          <span>Your Location</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot in-range" />
          <span>Farm Within 50 km (Direct Delivery Zone)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot radius-circle" />
          <span>50 km PostGIS Boundary</span>
        </div>
      </div>
    </div>
  );
};

export default DeliveryRadiusMap;
