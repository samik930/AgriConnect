import React, { useState, useEffect, useCallback } from 'react';
import './FarmerDashboard.css';
import AIAssistant from '../components/AIAssistant';
import UpdateLocationButton from '../components/UpdateLocationButton';
import { geocodePincode } from '../utils/pincodeGeocode';

/* ─── Helper: authenticated fetch ─────────────────────────── */
const authFetch = (url, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });
};

/* ─── Weather icons mapping ────────────────────────────────── */
const weatherIcon = (code) => {
  if (code <= 232) return '⛈';
  if (code <= 321) return '🌦';
  if (code <= 531) return '🌧';
  if (code <= 622) return '❄️';
  if (code === 800) return '☀️';
  if (code <= 804) return '⛅';
  return '🌫';
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ─── Empty product form ───────────────────────────────────── */
const EMPTY_PRODUCT = { name: '', category: '', description: '', price: '', stock: '', unit: 'kg', imageUrl: '' };

/* ═══════════════════════════════════════════════════════════ */
const FarmerDashboard = ({ onLogout, onLogoClick }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    return JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
  });
  const user = currentUser;
  const [activeTab, setActiveTab] = useState('overview');

  /* products */
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  /* notification (schemes + technologies) */
  const [notification, setNotification] = useState({ schemes: [], technologies: [] });
  const [notifLoading, setNotifLoading] = useState(false);
  /* unread counts for notifications */
  const [unreadSchemesCount, setUnreadSchemesCount] = useState(0);
  const [unreadTechnologiesCount, setUnreadTechnologiesCount] = useState(0);

  /* weather */
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  /* product modal */
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  /* profile */
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    state: user.state || '',
    district: user.district || '',
    address: user.address || '',
    pincode: user.pincode || '',
  });
  const [pincodeStatus, setPincodeStatus] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  /* orders */
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  /* official admin-managed trainings & market prices */
  const [trainings, setTrainings] = useState([]);
  const [trainingsLoading, setTrainingsLoading] = useState(false);
  const [marketPrices, setMarketPrices] = useState([]);
  const [marketPricesLoading, setMarketPricesLoading] = useState(false);
  const [cropFilter, setCropFilter] = useState('');

  /* ── Fetch: Trainings (Official Admin Authored) ─── */
  const fetchTrainings = useCallback(async () => {
    setTrainingsLoading(true);
    try {
      const res = await fetch('/api/trainings');
      if (res.ok) {
        const data = await res.json();
        setTrainings(Array.isArray(data.trainings) ? data.trainings : []);
      }
    } catch { /* silent */ }
    finally { setTrainingsLoading(false); }
  }, []);

  /* ── Fetch: APMC Market Prices (Official Benchmark Authored by Admin) ─── */
  const fetchMarketPrices = useCallback(async () => {
    setMarketPricesLoading(true);
    try {
      const res = await fetch('/api/market-prices');
      if (res.ok) {
        const data = await res.json();
        setMarketPrices(Array.isArray(data.marketPrices) ? data.marketPrices : []);
      }
    } catch { /* silent */ }
    finally { setMarketPricesLoading(false); }
  }, []);

  /* ── Fetch: My Products ─── */
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError('');
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const myId = user._id;
      const myProducts = Array.isArray(data)
        ? data.filter(p => p.farmer?._id === myId || p.farmer === myId)
        : [];
      setProducts(myProducts);
    } catch {
      setProductsError('Failed to load products.');
    } finally {
      setProductsLoading(false);
    }
  }, [user._id]);

/* ── Fetch: Schemes + Technologies ─── */
   const fetchNotification = useCallback(async (currentActiveTab) => {
     setNotifLoading(true);
     try {
       const res = await authFetch('/api/notification');
       if (res.ok) {
         const data = await res.json();
         setNotification({ schemes: data.schemes || [], technologies: data.technologies || [] });
         // Set unread counts based on current tab
         if (currentActiveTab === 'schemes') {
           setUnreadSchemesCount(0);
           setUnreadTechnologiesCount(data.technologies?.length || 0);
         } else if (currentActiveTab === 'technologies') {
           setUnreadSchemesCount(data.schemes?.length || 0);
           setUnreadTechnologiesCount(0);
         } else {
           // For overview or other tabs, show total counts
           setUnreadSchemesCount(data.schemes?.length || 0);
           setUnreadTechnologiesCount(data.technologies?.length || 0);
         }
       }
     } catch { /* silent */ }
     finally { setNotifLoading(false); }
   }, []);

  /* ── Fetch: Weather (Open-Meteo, no API key) ─── */
  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherError('');
    try {
      // Get user coordinates from localStorage if available
      const storedUser = JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
      let lat = 20.5937, lon = 78.9629; // Default: India center

      if (navigator.geolocation) {
        await new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            (pos) => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve(); },
            resolve, { timeout: 5000 }
          )
        );
      }

      // Current weather via Open-Meteo (free, no key)
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=7`
      );
      const wData = await wRes.json();
      const cur = wData.current;
      const daily = wData.daily;

      // Reverse geocode location name
      let locationName = 'Your Location';
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'Accept-Language': 'en' } });
        const geoData = await geoRes.json();
        const addr = geoData.address || {};
        locationName = [addr.city || addr.town || addr.village, addr.state].filter(Boolean).join(', ');
      } catch { /* silent */ }

      setWeather({
        temp: Math.round(cur.temperature_2m),
        humidity: cur.relative_humidity_2m,
        rain: cur.precipitation_probability,
        wind: Math.round(cur.wind_speed_10m),
        code: cur.weather_code,
        location: locationName,
      });

      setForecast(
        daily.time.map((date, i) => ({
          day: DAYS[new Date(date).getDay()],
          code: daily.weather_code[i],
          max: Math.round(daily.temperature_2m_max[i]),
          min: Math.round(daily.temperature_2m_min[i]),
          rain: daily.precipitation_probability_max[i],
        }))
      );
    } catch {
      setWeatherError('Could not load weather data.');
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  /* ── Initial data loads ─── */
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await authFetch('/api/orders/farmer/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent fail
    } finally {
      setOrdersLoading(false);
    }
  }, []);

useEffect(() => {
     fetchProducts();
     fetchOrders();
   }, [fetchProducts, fetchOrders]);

   // Fetch notifications when viewing overview, schemes, or technologies tabs
   useEffect(() => {
     if (['overview', 'schemes', 'technologies'].includes(activeTab)) {
       fetchNotification(activeTab);
     }
   }, [activeTab, fetchNotification]);

  useEffect(() => {
    if (activeTab === 'weather') fetchWeather();
    if (activeTab === 'trainings') fetchTrainings();
    if (activeTab === 'market-prices') fetchMarketPrices();
  }, [activeTab, fetchWeather, fetchTrainings, fetchMarketPrices]);

  /* ── Product CRUD handlers ─── */
  const openAddModal = () => {
    setEditingProduct(null);
    setSelectedImageFile(null);
    setImagePreview('');
    setProductForm(EMPTY_PRODUCT);
    setShowProductModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setSelectedImageFile(null);
    const existingImg = product.image || product.imageUrl || '';
    setImagePreview(existingImg);
    setProductForm({
      name: product.name,
      category: product.category,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      unit: product.unit || 'kg',
      imageUrl: existingImg,
    });
    setShowProductModal(true);
  };

  const handleProductFormChange = (e) => {
    setProductForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('Image file size must be less than 8MB.');
      return;
    }
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreview('');
    setProductForm(prev => ({ ...prev, imageUrl: '' }));
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setProductSubmitting(true);
    try {
      const prodId = editingProduct?._id || editingProduct?.id;
      const url = editingProduct ? `/api/products/${prodId}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      let body;
      if (selectedImageFile) {
        const formData = new FormData();
        formData.append('name', productForm.name);
        formData.append('category', productForm.category);
        formData.append('description', productForm.description || '');
        formData.append('price', productForm.price);
        formData.append('stock', productForm.stock);
        formData.append('unit', productForm.unit || 'kg');
        formData.append('image', selectedImageFile);
        body = formData;
      } else {
        body = JSON.stringify(productForm);
      }

      const res = await authFetch(url, { method, body });
      if (res.ok) {
        setShowProductModal(false);
        setSelectedImageFile(null);
        setImagePreview('');
        fetchProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save product: ' + (err.message || 'Server error'));
      }
    } catch (err) {
      alert('Error saving product: ' + err.message);
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch { /* silent */ }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const err = await res.json();
        alert('Failed to update status: ' + err.message);
      }
    } catch {
      alert('Failed to update status');
    }
  };

  /* ─── Sidebar nav items ─── */
  const navItems = [
    { id: 'overview',      label: 'Overview',        icon: '📊' },
    { id: 'products',      label: 'My Products',      icon: '🛒' },
    { id: 'orders',        label: 'Orders Received',  icon: '📦' },
    { id: 'schemes',       label: 'Govt. Schemes',    icon: '🏛' },
    { id: 'technologies',  label: 'Technologies',     icon: '🚜' },
    { id: 'trainings',     label: 'Trainings & KVK',  icon: '🎓' },
    { id: 'market-prices', label: 'Mandi Rates',      icon: '📈' },
    { id: 'weather',       label: 'Weather',          icon: '🌦' },
    { id: 'ai-assistant',  label: 'AI Assistant',     icon: '🤖' },
    { id: 'profile',       label: 'Profile',          icon: '👤' },
  ];

  /* ─── Render helpers ─── */
  const renderOverview = () => (
    <>
      <div className="dashboard-header">
        <h1>Good morning, {user.name?.split(' ')[0] || 'Farmer'} 👨‍🌾</h1>
        <p>Here's what's happening on your farm today.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">📦</div>
          <div className="stat-card-value">{products.length}</div>
          <div className="stat-card-label">Total Products Listed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-value">{products.filter(p => p.stock > 0).length}</div>
          <div className="stat-card-label">Active Products</div>
        </div>
<div className="stat-card">
           <div className="stat-card-icon">🏛</div>
           <div className="stat-card-value">{unreadSchemesCount}</div>
           <div className="stat-card-label">Govt. Schemes Available</div>
         </div>
         <div className="stat-card">
           <div className="stat-card-icon">🚜</div>
           <div className="stat-card-value">{unreadTechnologiesCount}</div>
           <div className="stat-card-label">Technologies Available</div>
         </div>
      </div>

      {/* Quick glance products */}
      <h2 className="db-section-title">🛒 Recent Products</h2>
      {renderProducts(true)}
    </>
  );

  const renderProducts = (compact = false) => {
    const displayProducts = compact ? products.slice(0, 3) : products;
    return (
      <>
        {!compact && (
          <div className="products-header">
            <h2 className="db-section-title" style={{ margin: 0 }}>🛒 My Products</h2>
            <button className="btn-primary btn-sm" style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openAddModal}>
              + Add Product
            </button>
          </div>
        )}

        {productsError && <div className="db-error">{productsError}</div>}

        {productsLoading ? (
          <div className="loading-state"><span className="geo-spinner"></span> Loading products...</div>
        ) : displayProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p>No products listed yet.</p>
            {!compact && <button className="btn-primary" style={{ padding: '12px 28px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff' }} onClick={openAddModal}>Add Your First Product</button>}
          </div>
        ) : (
          <div className="products-grid">
            {displayProducts.map(p => (
              <div className="product-card" key={p._id || p.id}>
                {(p.image || p.imageUrl) && (
                  <div className="product-card-image-wrap">
                    <img src={p.image || p.imageUrl} alt={p.name} className="product-card-image" />
                  </div>
                )}
                <span className="product-badge">{p.category}</span>
                <div className="product-name">{p.name}</div>
                <div className="product-price">₹{p.price}/{p.unit || 'kg'}</div>
                <div className="product-meta">
                  <span>📦 Stock: {p.stock} {p.unit || 'kg'}</span>
                  {p.description && <span>📝 {p.description}</span>}
                </div>
                {!compact && (
                  <div className="product-actions">
                    <button className="btn-sm btn-edit" onClick={() => openEditModal(p)}>✏ Edit</button>
                    <button className="btn-sm btn-delete" onClick={() => handleDeleteProduct(p._id || p.id)}>🗑 Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {compact && products.length > 3 && (
          <p style={{ marginTop: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer' }} onClick={() => setActiveTab('products')}>
            View all {products.length} products →
          </p>
        )}
      </>
    );
  };

  const renderSchemes = () => (
    <>
      <h2 className="db-section-title">🏛 Government Schemes</h2>
      {notifLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Loading schemes...</div>
      ) : notification.schemes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏛</div>
          <p>No schemes available for your state yet.</p>
        </div>
      ) : (
        <div className="schemes-list">
          {notification.schemes.map(s => (
            <div className="scheme-card" key={s._id}>
              <div className="scheme-info">
                <h4>{s.title}</h4>
                {s.eligibility && <div className="scheme-tag">👥 {s.eligibility}</div>}
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{s.description}</p>
                {s.state && <div className="scheme-deadline" style={{ marginTop: 8 }}>📍 {s.state}{s.district ? ` — ${s.district}` : ''}</div>}
              </div>
              {s.applicationLink && (
                <a href={s.applicationLink} target="_blank" rel="noreferrer"
                  style={{ padding: '10px 20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none' }}>
                  View Details →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderTechnologies = () => (
    <>
      <h2 className="db-section-title">🚜 Agricultural Technologies</h2>
      {notifLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Loading...</div>
      ) : notification.technologies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚜</div>
          <p>No technologies available yet.</p>
        </div>
      ) : (
        <div className="tech-grid">
          {notification.technologies.map((t, i) => {
            const icons = ['💧', '🌱', '🤖', '☀️', '🔬', '📡'];
            return (
              <div className="tech-card" key={t._id}>
                <div className="tech-icon">{icons[i % icons.length]}</div>
                <h4>{t.title}</h4>
                <p>{t.description}</p>
                {t.resourceLink && (
                  <a href={t.resourceLink} target="_blank" rel="noreferrer" className="tech-link">Learn More →</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderTrainings = () => (
    <>
      <h2 className="db-section-title">🎓 Agricultural Trainings & KVK Workshops</h2>
      {trainingsLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Loading workshops...</div>
      ) : trainings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎓</div>
          <p>No training workshops listed at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {trainings.map(t => (
            <div key={t._id || t.id} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', padding: '4px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  🏛 {t.organizer}
                </span>
                <h4 style={{ margin: '12px 0 8px 0', fontSize: '1.05rem', fontWeight: 700 }}>{t.title}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  📅 {new Date(t.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  📍 {t.location || 'Online Session'}
                </div>
              </div>
              {t.registrationLink && (
                <a
                  href={t.registrationLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginTop: '16px', display: 'inline-block', textAlign: 'center', padding: '9px 16px', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  Register Now ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderMarketPrices = () => {
    const search = cropFilter.toLowerCase().trim();
    const filtered = marketPrices.filter(mp => 
      !search || (mp.cropName || '').toLowerCase().includes(search) || (mp.district || '').toLowerCase().includes(search)
    );

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <h2 className="db-section-title" style={{ margin: 0 }}>📈 APMC Daily Mandi Benchmark Prices</h2>
          <input
            type="text"
            placeholder="🔍 Filter by crop or mandi (e.g. Tomato, Pune)..."
            value={cropFilter}
            onChange={e => setCropFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', fontSize: '0.85rem', minWidth: '260px' }}
          />
        </div>

        {marketPricesLoading ? (
          <div className="loading-state"><span className="geo-spinner"></span> Loading mandi rates...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <p>No benchmark prices found matching your filter.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {filtered.map(mp => (
              <div key={mp._id || mp.id} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>🌾 {mp.cropName}</h4>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    📍 {mp.district}
                  </span>
                </div>
                <div style={{ margin: '14px 0 6px 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
                  ₹{parseFloat(mp.marketPrice || 0).toFixed(2)}
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>/{mp.unit || 'kg'}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  Updated: {new Date(mp.updatedAt || Date.now()).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderWeather = () => (
    <>
      <h2 className="db-section-title">🌦 Weather Forecast</h2>
      {weatherLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Fetching weather...</div>
      ) : weatherError ? (
        <div className="db-error">{weatherError}</div>
      ) : weather ? (
        <>
          <div className="weather-card">
            <div className="weather-main">
              <div className="weather-icon-big">{weatherIcon(weather.code)}</div>
              <div>
                <div className="weather-temp">{weather.temp}°C</div>
                <div className="weather-desc">
                  {weather.code === 800 ? 'Clear Sky' : weather.rain > 60 ? 'Rainy' : weather.code > 800 ? 'Cloudy' : 'Partly Cloudy'}
                </div>
                <div className="weather-location">📍 {weather.location}</div>
              </div>
            </div>
            <div className="weather-metrics">
              <div className="weather-metric">
                <div className="weather-metric-icon">💧</div>
                <div className="weather-metric-value">{weather.humidity}%</div>
                <div className="weather-metric-label">Humidity</div>
              </div>
              <div className="weather-metric">
                <div className="weather-metric-icon">🌧</div>
                <div className="weather-metric-value">{weather.rain}%</div>
                <div className="weather-metric-label">Rain Chance</div>
              </div>
              <div className="weather-metric">
                <div className="weather-metric-icon">💨</div>
                <div className="weather-metric-value">{weather.wind} km/h</div>
                <div className="weather-metric-label">Wind Speed</div>
              </div>
              <div className="weather-metric">
                <div className="weather-metric-icon">🌡</div>
                <div className="weather-metric-value">{weather.temp}°C</div>
                <div className="weather-metric-label">Temperature</div>
              </div>
            </div>
          </div>

          <h3 className="db-section-title" style={{ fontSize: '1.1rem' }}>7-Day Forecast</h3>
          <div className="weather-forecast">
            {forecast.map((day, i) => (
              <div className="forecast-day" key={i}>
                <div className="forecast-day-name">{i === 0 ? 'Today' : day.day}</div>
                <div className="forecast-icon">{weatherIcon(day.code)}</div>
                <div className="forecast-temp">{day.max}° / {day.min}°</div>
                <div className="forecast-rain">🌧 {day.rain}%</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🌦</div>
          <p>Click below to load weather for your location.</p>
          <button onClick={fetchWeather} className="btn-primary" style={{ padding: '12px 28px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff' }}>Load Weather</button>
        </div>
      )}
    </>
  );

  const renderOrders = () => (
    <>
      <h2 className="db-section-title">📦 Orders Received</h2>
      {ordersLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <p>You haven't received any orders yet.</p>
        </div>
      ) : (
        <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {orders.map(order => {
            const farmerId = user._id || user.id;
            const myItems = (order.items || []).filter(item => {
              const itemFarmerId = typeof item.farmer === 'object' ? (item.farmer?._id || item.farmer?.id) : item.farmer;
              return !itemFarmerId || itemFarmerId === farmerId;
            });
            const displayItems = myItems.length > 0 ? myItems : (order.items || []);
            const productNames = displayItems
              .map(item => `${item.product?.name || item.product || 'Produce'}${item.quantity ? ` (${item.quantity} ${item.product?.unit || 'unit'})` : ''}`)
              .join(', ');

            return (
              <div className="order-card" key={order._id} style={{ background: 'var(--color-bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>
                    {productNames || 'Produce'}
                  </h4>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Customer: {order.customer?.name} ({order.customer?.email})</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Delivery Address: {order.deliveryAddress || 'N/A'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: '20px', fontWeight: 600, fontSize: '0.9rem' }}>
                    {order.orderStatus || 'Pending'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: order.paymentStatus === 'Paid' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    {order.paymentStatus === 'Paid' ? '💳 Paid via Razorpay' : '⏳ Payment Pending'}
                  </div>
                  <select 
                    style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer' }}
                    value={order.orderStatus}
                    onChange={(e) => handleUpdateOrderStatus(order._id, e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Packed">Packed</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const handlePincodeChange = async (pinValue) => {
    const cleanPin = pinValue.replace(/\D/g, '').slice(0, 6);
    setProfileData(prev => ({ ...prev, pincode: cleanPin }));

    if (cleanPin.length === 6) {
      setPincodeStatus('🔍 Calculating farm coordinates from pincode...');
      try {
        const geo = await geocodePincode(cleanPin, profileData.district, profileData.state);
        if (geo && geo.lat != null && geo.lng != null) {
          setPincodeStatus(`📍 Farm Coordinates: [${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}] (${geo.district}, ${geo.state})`);
          setProfileData(prev => ({
            ...prev,
            pincode: cleanPin,
            state: prev.state || geo.state,
            district: prev.district || geo.district,
          }));
        } else {
          setPincodeStatus('⚠️ Pincode entered. Will be resolved on update.');
        }
      } catch {
        setPincodeStatus('');
      }
    } else {
      setPincodeStatus('');
    }
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      let finalLocation = user.location;
      if (profileData.pincode && /^\d{6}$/.test(profileData.pincode.trim())) {
        const pinGeo = await geocodePincode(profileData.pincode, profileData.district, profileData.state);
        if (pinGeo) {
          finalLocation = { type: 'Point', coordinates: [pinGeo.lng, pinGeo.lat] };
        }
      }

      const res = await authFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          state: profileData.state,
          district: profileData.district,
          address: profileData.address,
          pincode: profileData.pincode,
          location: finalLocation,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        const updatedUser = {
          ...currentUser,
          ...updated,
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('agriconnect_user', JSON.stringify(updatedUser));
        alert('🎉 Farm profile updated! Coordinates calculated from pincode: ' + (profileData.pincode || ''));
      } else {
        const err = await res.json();
        alert('Failed to update profile: ' + (err.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error updating profile: ' + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const renderProfile = () => (
    <>
      <h2 className="db-section-title">👤 My Profile</h2>
      <div className="profile-card">
        <div className="profile-avatar-lg">
          {(user.name || 'F')[0].toUpperCase()}
        </div>
        <div className="profile-fields">
          <div className="profile-field">
            <label>Full Name</label>
            <input
              type="text"
              value={profileData.name}
              onChange={e => setProfileData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your Full Name"
            />
          </div>
          <div className="profile-field">
            <label>Email</label>
            <input
              type="text"
              value={profileData.email}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </div>
          <div className="profile-field">
            <label>Phone</label>
            <input
              type="text"
              value={profileData.phone}
              onChange={e => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Mobile Number"
            />
          </div>
          <div className="profile-field">
            <label>Pincode (Calculates Farm GPS Coordinates) *</label>
            <input
              type="text"
              value={profileData.pincode}
              onChange={e => handlePincodeChange(e.target.value)}
              placeholder="e.g. 700001 or 400001"
              maxLength={6}
            />
            {pincodeStatus && (
              <div style={{ fontSize: '0.8rem', marginTop: '4px', color: '#10b981', fontWeight: 600 }}>
                {pincodeStatus}
              </div>
            )}
          </div>
          <div className="profile-field">
            <label>District</label>
            <input
              type="text"
              value={profileData.district}
              onChange={e => setProfileData(prev => ({ ...prev, district: e.target.value }))}
              placeholder="District"
            />
          </div>
          <div className="profile-field">
            <label>State</label>
            <input
              type="text"
              value={profileData.state}
              onChange={e => setProfileData(prev => ({ ...prev, state: e.target.value }))}
              placeholder="State"
            />
          </div>
          <div className="profile-field">
            <label>Farm Address</label>
            <input
              type="text"
              value={profileData.address}
              onChange={e => setProfileData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Farm or Village Address"
            />
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ padding: '12px 32px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff' }}
          onClick={handleUpdateProfile}
          disabled={isUpdatingProfile}
        >
          {isUpdatingProfile ? 'Updating Profile...' : 'Update Profile & Calculate Farm Coordinates'}
        </button>
        <div style={{ marginTop: '12px' }}>
          <UpdateLocationButton onUpdated={(updated) => {
            const updatedUser = {
              ...currentUser,
              location: updated.location,
              state:    updated.state    || currentUser.state,
              district: updated.district || currentUser.district,
              address:  updated.address  || currentUser.address,
              pincode:  updated.pincode  || currentUser.pincode,
            };
            setCurrentUser(updatedUser);
            localStorage.setItem('agriconnect_user', JSON.stringify(updatedUser));
            setProfileData(prev => ({
              ...prev,
              state:    updated.state    || prev.state,
              district: updated.district || prev.district,
              address:  updated.address  || prev.address,
              pincode:  updated.pincode  || prev.pincode,
            }));
          }} />
          {user.location?.coordinates?.length === 2
            ? <p style={{ fontSize: '0.78rem', color: '#86efac', marginTop: 4 }}>
                📌 Active Farm PostGIS Coordinates: [{user.location.coordinates[1].toFixed(4)}, {user.location.coordinates[0].toFixed(4)}]
              </p>
            : <p style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: 4 }}>
                ⚠ No location saved yet — enter Pincode above or click Update Location.
              </p>
          }
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':      return renderOverview();
      case 'products':      return renderProducts();
      case 'orders':        return renderOrders();
      case 'schemes':       return renderSchemes();
      case 'technologies':  return renderTechnologies();
      case 'trainings':     return renderTrainings();
      case 'market-prices': return renderMarketPrices();
      case 'weather':       return renderWeather();
      case 'ai-assistant':  return <AIAssistant />;
      case 'profile':       return renderProfile();
      default:              return renderOverview();
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* ── Sidebar ── */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
          <span className="text-gradient">AgriConnect</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{(user.name || 'F')[0].toUpperCase()}</div>
          <div className="sidebar-user-info">
            <h4>{user.name || 'Farmer'}</h4>
            <span>{user.role || 'farmer'}</span>
          </div>
        </div>
<nav className="sidebar-nav">
           {navItems.map(item => {
             let badge = null;
             if (!notifLoading) {
               if (item.id === 'schemes') {
                 badge = unreadSchemesCount > 0 && (
                   <span className="notification-badge">{unreadSchemesCount}</span>
                 );
               } else if (item.id === 'technologies') {
                 badge = unreadTechnologiesCount > 0 && (
                   <span className="notification-badge">{unreadTechnologiesCount}</span>
                 );
               }
             }
             return (
               <button
                 key={item.id}
                 className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
                 onClick={() => setActiveTab(item.id)}
               >
                 <span className="nav-icon">{item.icon}</span>
                 {item.label}
                 {badge}
               </button>
             );
           })}
         </nav>
        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={onLogout} style={{ color: '#f87171' }}>
            <span className="nav-icon">🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="dashboard-main">
        {renderContent()}
      </main>

      {/* ── Add/Edit Product Modal ── */}
      {showProductModal && (
        <div className="db-modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
            <form className="db-modal-form" onSubmit={handleProductSubmit}>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label>Product Name *</label>
                  <input name="name" required value={productForm.name} onChange={handleProductFormChange} placeholder="e.g. Tomatoes" />
                </div>
                <div className="db-form-group">
                  <label>Category *</label>
                  <select name="category" required value={productForm.category} onChange={handleProductFormChange}>
                    <option value="">Select...</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Grains">Grains</option>
                    <option value="Pulses">Pulses</option>
                    <option value="Spices">Spices</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="db-form-group">
                <label>Description</label>
                <input name="description" value={productForm.description} onChange={handleProductFormChange} placeholder="Briefly describe your product" />
              </div>
              <div className="db-form-group">
                <label>Product Image (via Cloudinary)</label>
                {imagePreview ? (
                  <div className="image-preview-box">
                    <img src={imagePreview} alt="Product Preview" className="image-preview-thumb" />
                    <button type="button" className="btn-remove-image" onClick={handleRemoveImage}>
                      ✕ Remove Image
                    </button>
                  </div>
                ) : (
                  <label className="image-upload-zone">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '1.6rem' }}>📷</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click to select product image</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>PNG, JPG, WEBP (Max 8MB)</span>
                  </label>
                )}
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label>Price (₹) *</label>
                  <input name="price" type="number" min="0" required value={productForm.price} onChange={handleProductFormChange} placeholder="40" />
                </div>
                <div className="db-form-group">
                  <label>Stock *</label>
                  <input name="stock" type="number" min="0" required value={productForm.stock} onChange={handleProductFormChange} placeholder="200" />
                </div>
                <div className="db-form-group">
                  <label>Unit</label>
                  <select name="unit" value={productForm.unit} onChange={handleProductFormChange}>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litre">litre</option>
                    <option value="piece">piece</option>
                    <option value="dozen">dozen</option>
                  </select>
                </div>
              </div>
              <div className="db-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '11px', border: 'none', cursor: productSubmitting ? 'not-allowed' : 'pointer', borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff', opacity: productSubmitting ? 0.7 : 1 }} disabled={productSubmitting}>
                  {productSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FarmerDashboard;
