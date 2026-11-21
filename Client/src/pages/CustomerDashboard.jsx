import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './FarmerDashboard.css'; // Reusing the same CSS for identical styling
import UpdateLocationButton from '../components/UpdateLocationButton';
import DeliveryRadiusMap from '../components/DeliveryRadiusMap';
import { loadRazorpayScript } from '../utils/razorpay';
import RazorpayModal from '../components/RazorpayModal';
import { geocodePincode } from '../utils/pincodeGeocode';

const authFetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
};

const CustomerDashboard = ({ onLogout, onLogoClick }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    return JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
  });
  const user = currentUser;
  const [activeTab, setActiveTab] = useState('overview');
  
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  // Profile Data
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

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [cart, setCart] = useState(null);
  const [cartLoading, setCartLoading] = useState(false);

  // Razorpay Payment States
  const [razorpayOrder, setRazorpayOrder] = useState(null);
  const [isRzpModalOpen, setIsRzpModalOpen] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [farmersViewMode, setFarmersViewMode] = useState('map'); // 'map' | 'cards'

  // Preload Razorpay Checkout SDK
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Derive nearby farmers from loaded products with geographical coordinates
  // Strictly enforces the 50 km delivery rule
  const nearbyFarmers = useMemo(() => {
    const cLng = user.location?.coordinates?.[0] ?? user.location?.lng;
    const cLat = user.location?.coordinates?.[1] ?? user.location?.lat;

    // Filter products: only products with a valid farmer and strictly within 50 km
    const validProducts = products.filter((p) => {
      if (!p.farmer) return false;
      if (p.distanceKm != null && p.distanceKm > 50) return false;
      return true;
    });

    const validFarmerIds = Array.from(
      new Set(validProducts.map((p) => p.farmer._id || p.farmer.id))
    );

    return validFarmerIds
      .map((id) => {
        const farmerProducts = validProducts.filter(
          (p) => (p.farmer?._id || p.farmer?.id) === id
        );
        const farmer = farmerProducts[0].farmer;
        const fLng = farmer.location?.coordinates?.[0] ?? farmer.location?.lng;
        const fLat = farmer.location?.coordinates?.[1] ?? farmer.location?.lat;

        let distanceKm = farmerProducts[0].distanceKm;
        if (distanceKm == null && cLat != null && cLng != null && fLat != null && fLng != null) {
          const R = 6371;
          const dLat = ((fLat - cLat) * Math.PI) / 180;
          const dLon = ((fLng - cLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((cLat * Math.PI) / 180) *
              Math.cos((fLat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceKm = parseFloat((R * c).toFixed(1));
        }

        return {
          id: farmer._id || farmer.id,
          name: farmer.name,
          email: farmer.email,
          state: farmer.state,
          district: farmer.district || 'Unknown',
          location: farmer.location,
          coordinates: farmer.location?.coordinates || (fLng != null && fLat != null ? [fLng, fLat] : null),
          distanceKm: distanceKm != null ? distanceKm : null,
          productsAvailable: farmerProducts.length,
          products: farmerProducts.map((p) => ({
            id: p._id || p.id,
            name: p.name,
            price: p.price,
            unit: p.unit || 'kg',
            stock: p.stock,
            image: p.image || p.imageUrl,
          })),
        };
      })
      .filter((f) => {
        // Enforce 50 km delivery radius: if distance is known, must be <= 50 km
        if (f.distanceKm != null) {
          return f.distanceKm <= 50;
        }
        return true;
      });
  }, [products, user.location]);

  const fetchProducts = useCallback(async (locOverride) => {
    setProductsLoading(true);
    try {
      const loc = locOverride || user.location;
      const cLng = loc?.coordinates?.[0] ?? loc?.lng;
      const cLat = loc?.coordinates?.[1] ?? loc?.lat;

      let url = '/api/products';
      if (cLat != null && cLng != null) {
        url = `/api/products?lat=${cLat}&lng=${cLng}&radius=50`;
      }
      const res = await authFetch(url);
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : [];
      // Strictly filter out any products > 50 km
      const filtered = rawList.filter((p) => {
        if (p.distanceKm != null && p.distanceKm > 50) return false;
        return true;
      });
      setProducts(filtered);
    } catch {
      // silent fail
    } finally {
      setProductsLoading(false);
    }
  }, [user.location]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await authFetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const res = await authFetch('/api/cart');
      if (res.ok) {
        const data = await res.json();
        setCart(data);
      }
    } catch {
      // silent
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchCart();
  }, [fetchProducts, fetchOrders, fetchCart]);

  const handleAddToCart = async (productId) => {
    try {
      const res = await authFetch('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 })
      });
      if (res.ok) {
        alert('Added to cart successfully!');
        fetchCart();
      } else {
        const err = await res.json();
        alert('Error: ' + err.message);
      }
    } catch (e) {
      alert('Failed to add to cart.');
    }
  };

  /**
   * Unified Payment Initiation Pipeline via Razorpay Gateway
   */
  const handleInitiatePayment = async (items) => {
    if (!profileData.address) {
      alert("Please update your profile with a delivery address first.");
      setActiveTab('profile');
      return;
    }

    try {
      setPaymentProcessing(true);
      const res = await authFetch('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({
          items,
          deliveryAddress: profileData.address || `${profileData.district}, ${profileData.state}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert('Payment setup failed: ' + (data.message || 'Please check items and location.'));
        setPaymentProcessing(false);
        return;
      }

      setRazorpayOrder(data);

      // Check if official live Razorpay keys are loaded and window.Razorpay SDK is available
      const scriptReady = await loadRazorpayScript();
      if (data.isConfigured && scriptReady && window.Razorpay) {
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'AgriConnect',
          description: `Order Payment (${data.items?.length || 1} product(s))`,
          image: 'https://cdn-icons-png.flaticon.com/512/3246/3246328.png',
          order_id: data.orderId,
          handler: async function (response) {
            await handleVerifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              items: data.items,
              deliveryAddress: data.deliveryAddress,
            });
          },
          prefill: {
            name: user.name || '',
            email: user.email || '',
            contact: user.phone || '',
          },
          notes: {
            address: data.deliveryAddress,
          },
          theme: {
            color: '#10b981',
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          alert('Payment failed: ' + (resp.error?.description || 'Transaction declined.'));
        });
        rzp.open();
      } else {
        // Open Razorpay Test Sandbox Modal (Credentials pending in .env)
        setIsRzpModalOpen(true);
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      alert('Failed to initiate payment gateway: ' + err.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  /**
   * Complete payment verification and place order
   */
  const handleVerifyPayment = async (payload) => {
    try {
      setPaymentProcessing(true);
      const res = await authFetch('/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        alert('🎉 Payment verified successfully! Your order has been placed.');
        setIsRzpModalOpen(false);
        setRazorpayOrder(null);
        fetchOrders();
        fetchCart();
        setActiveTab('orders');
      } else {
        alert('Payment verification failed: ' + (data.message || 'Please contact support.'));
      }
    } catch (err) {
      console.error('Verification error:', err);
      alert('Verification error: ' + err.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleBuyNow = (productId) => {
    handleInitiatePayment([{ product: productId, quantity: 1 }]);
  };

  const handleCartCheckout = () => {
    if (!cart || !cart.items || cart.items.length === 0) {
      alert('Your cart is empty.');
      return;
    }
    const items = cart.items.map((i) => ({
      product: i.product?._id || i.product?.id,
      quantity: i.quantity,
    }));
    handleInitiatePayment(items);
  };

  const handleRemoveFromCart = async (productId) => {
    try {
      const res = await authFetch(`/api/cart/remove/${productId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCart();
      } else {
        const err = await res.json();
        alert('Error: ' + err.message);
      }
    } catch (e) {
      alert('Failed to remove from cart.');
    }
  };

  /* ─── Sidebar nav items ─── */
  const navItems = [
    { id: 'overview',     label: 'Overview',           icon: '📊' },
    { id: 'browse',       label: 'Browse Products',    icon: '🛒' },
    { id: 'map',          label: '50 km Radius Map',   icon: '📍' },
    { id: 'farmers',      label: 'Nearby Farmers',     icon: '👨‍🌾' },
    { id: 'cart',         label: 'My Cart',            icon: '🛍️' },
    { id: 'orders',       label: 'My Orders',          icon: '📦' },
    { id: 'profile',      label: 'Profile',            icon: '👤' },
  ];

  const renderOverview = () => (
    <>
      <div className="dashboard-header">
        <h1>Welcome back, {user.name?.split(' ')[0] || 'Customer'} 👋</h1>
        <p>Find the best local produce around you.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">🛒</div>
          <div className="stat-card-value">{products.length}</div>
          <div className="stat-card-label">Nearby Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📦</div>
          <div className="stat-card-value">{orders.length}</div>
          <div className="stat-card-label">Orders Placed</div>
        </div>
        <div className="stat-card" onClick={() => setActiveTab('map')} style={{ cursor: 'pointer' }} title="Click to open 50 km delivery map">
          <div className="stat-card-icon">📍</div>
          <div className="stat-card-value">{nearbyFarmers.length}</div>
          <div className="stat-card-label">Farms on 50 km Map →</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 className="db-section-title" style={{ margin: 0 }}>🛒 Fresh Local Produce</h2>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setActiveTab('map')}
        >
          📍 Explore 50 km Delivery Map →
        </button>
      </div>
      {renderBrowseProducts(true)}
    </>
  );

  const renderBrowseProducts = (compact = false) => {
    const displayProducts = compact ? products.slice(0, 3) : products;
    return (
      <>
        {/*{!compact && (
          <div className="products-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="db-section-title" style={{ margin: 0 }}>🛒 All Products</h2>
            <div className="filters" style={{ display: 'flex', gap: '10px' }}>
              <select style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none' }}><option>Category</option></select>
              <select style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none' }}><option>District</option></select>
              <select style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none' }}><option>Price Range</option></select>
            </div>
          </div>
        )}*/}

        {productsLoading ? (
          <div className="loading-state"><span className="geo-spinner"></span> Loading products...</div>
        ) : displayProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛒</div>
            <p>No products found.</p>
          </div>
        ) : (
          <div className="products-grid">
            {displayProducts.map(p => (
              <div className="product-card" key={p._id || p.id}>
                {(p.image || p.imageUrl) && (
                  <div style={{ width: '100%', height: '160px', overflow: 'hidden', borderRadius: '8px', marginBottom: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    <img src={p.image || p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <span className="product-badge">{p.category}</span>
                <div className="product-name">{p.name}</div>
                <div className="product-price">₹{p.price}/{p.unit || 'kg'}</div>
                <div className="product-meta" style={{ marginTop: '10px' }}>
                  <span>👨‍🌾 Farmer: {p.farmer?.name || 'Local Farmer'}</span><br/>
                  <span>📍 District: {p.farmer?.district || 'Nearby'}</span>
                  {p.distanceKm != null && (
                    <span style={{ display: 'block', color: '#10b981', fontWeight: 600, fontSize: '0.82rem', marginTop: '4px' }}>
                      ⚡ {p.distanceKm} km away (within 50 km zone)
                    </span>
                  )}
                </div>
                {!compact && (
                  <div className="product-actions" style={{ marginTop: '15px', display: 'flex', gap: '8px' }}>
                    <button className="btn-sm btn-primary" style={{ flex: 1, padding: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '6px', cursor: 'pointer' }}>View</button>
                    <button className="btn-sm" style={{ flex: 1, padding: '8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => handleAddToCart(p._id)}>Add Cart</button>
                    <button className="btn-sm" style={{ flex: 1, padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => handleBuyNow(p._id)}>Buy Now</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {compact && products.length > 3 && (
          <p style={{ marginTop: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer' }} onClick={() => setActiveTab('browse')}>
            View all {products.length} products →
          </p>
        )}
      </>
    );
  };

  const renderOrders = () => (
    <>
      <h2 className="db-section-title">📦 My Orders</h2>
      {ordersLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <p>You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {orders.map(order => (
            <div className="order-card" key={order._id} style={{ background: 'var(--color-bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{order.items?.map(i => i.product?.name || 'Item').join(', ') || 'Unknown Product'}</h4>
                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Quantity: {order.items?.length || 0} items • Price: ₹{order.totalAmount}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem' }}>
                  {order.orderStatus || 'Pending'}
                </div>
                <div style={{ fontSize: '0.78rem', color: order.paymentStatus === 'Paid' ? '#10b981' : '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {order.paymentStatus === 'Paid' ? '💳 Paid via Razorpay' : '⏳ Payment Pending'}
                </div>
                {order.paymentId && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    Ref: {order.paymentId}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderCart = () => (
    <>
      <h2 className="db-section-title">🛍️ My Cart</h2>
      {cartLoading ? (
        <div className="loading-state"><span className="geo-spinner"></span> Loading cart...</div>
      ) : !cart || !cart.items || cart.items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛍️</div>
          <p>Your cart is empty.</p>
        </div>
      ) : (
        <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {cart.items.map(item => (
            <div className="order-card" key={item._id} style={{ background: 'var(--color-bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{item.product?.name || 'Unknown Product'}</h4>
                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Quantity: {item.quantity}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Price: ₹{item.product?.price || 0}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-sm" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleBuyNow(item.product?._id)} disabled={paymentProcessing}>Buy</button>
                <button className="btn-sm" style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleRemoveFromCart(item.product?._id)} disabled={paymentProcessing}>Remove</button>
              </div>
            </div>
          ))}
          <button 
            className="btn-primary" 
            style={{ marginTop: '20px', padding: '12px 32px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff', alignSelf: 'flex-start' }}
            onClick={handleCartCheckout}
            disabled={paymentProcessing}
          >
            {paymentProcessing ? 'Setting up Razorpay...' : '💳 Checkout Now with Razorpay'}
          </button>
        </div>
      )}
    </>
  );

  const renderMap = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="db-section-title" style={{ margin: 0 }}>📍 50 km PostGIS Delivery Radius Map</h2>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setActiveTab('farmers')}
        >
          👨‍🌾 View Farmer Cards List →
        </button>
      </div>
      <DeliveryRadiusMap
        customerLocation={user.location || { district: user.district, address: user.address }}
        farmers={nearbyFarmers}
      />
    </>
  );

  const renderFarmers = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="db-section-title" style={{ margin: 0 }}>👨‍🌾 Nearby Farmers ({nearbyFarmers.length})</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn-secondary ${farmersViewMode === 'map' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: farmersViewMode === 'map' ? 'var(--color-primary)' : 'var(--color-border)',
              background: farmersViewMode === 'map' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: farmersViewMode === 'map' ? '#34d399' : 'inherit'
            }}
            onClick={() => setFarmersViewMode('map')}
          >
            🗺️ Interactive 50 km Map
          </button>
          <button
            type="button"
            className={`btn-secondary ${farmersViewMode === 'cards' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: farmersViewMode === 'cards' ? 'var(--color-primary)' : 'var(--color-border)',
              background: farmersViewMode === 'cards' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: farmersViewMode === 'cards' ? '#34d399' : 'inherit'
            }}
            onClick={() => setFarmersViewMode('cards')}
          >
            📋 Grid Cards
          </button>
        </div>
      </div>

      {farmersViewMode === 'map' ? (
        <DeliveryRadiusMap
          customerLocation={user.location || { district: user.district, address: user.address }}
          farmers={nearbyFarmers}
        />
      ) : (
        <div className="farmers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {nearbyFarmers.map(farmer => (
            <div className="farmer-card" key={farmer.id} style={{ background: 'var(--color-bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {farmer.name[0]}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{farmer.name}</h4>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>📍 {farmer.district}</p>
                </div>
              </div>
              <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong>{farmer.productsAvailable}</strong> Products Available
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const handlePincodeChange = async (pinValue) => {
    const cleanPin = pinValue.replace(/\D/g, '').slice(0, 6);
    setProfileData(prev => ({ ...prev, pincode: cleanPin }));

    if (cleanPin.length === 6) {
      setPincodeStatus('🔍 Calculating coordinates from pincode...');
      try {
        const geo = await geocodePincode(cleanPin, profileData.district, profileData.state);
        if (geo && geo.lat != null && geo.lng != null) {
          setPincodeStatus(`📍 Calculated coordinates: [${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}] (${geo.district}, ${geo.state})`);
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
      // Calculate coordinates on the basis of pincode
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
        alert('🎉 Profile updated! Coordinates calculated from pincode: ' + (profileData.pincode || ''));
        fetchProducts(updated.location);
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
          {(user.name || 'C')[0].toUpperCase()}
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
            <label>Pincode (Calculates Delivery Coordinates) *</label>
            <input
              type="text"
              value={profileData.pincode}
              onChange={e => handlePincodeChange(e.target.value)}
              placeholder="e.g. 700001, 700039, 400001"
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
            <label>Street Address</label>
            <input
              type="text"
              value={profileData.address}
              onChange={e => setProfileData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="House, Street, Area"
            />
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ padding: '12px 32px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff' }}
          onClick={handleUpdateProfile}
          disabled={isUpdatingProfile}
        >
          {isUpdatingProfile ? 'Updating Profile...' : 'Update Profile & Calculate Coordinates'}
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
            fetchProducts(updated.location);
          }} />
          {user.location?.coordinates?.length === 2
            ? <p style={{ fontSize: '0.78rem', color: '#86efac', marginTop: 4 }}>
                📌 Active PostGIS Coordinates: [{user.location.coordinates[1].toFixed(4)}, {user.location.coordinates[0].toFixed(4)}]
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
      case 'overview': return renderOverview();
      case 'browse':   return renderBrowseProducts();
      case 'map':      return renderMap();
      case 'cart':     return renderCart();
      case 'orders':   return renderOrders();
      case 'farmers':  return renderFarmers();
      case 'profile':  return renderProfile();
      default:         return renderOverview();
    }
  };

  return (
    <div className="dashboard-wrapper">
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
          <span className="text-gradient">AgriConnect</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{(user.name || 'C')[0].toUpperCase()}</div>
          <div className="sidebar-user-info">
            <h4>{user.name || 'Customer'}</h4>
            <span>{user.role || 'customer'}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={onLogout} style={{ color: '#f87171' }}>
            <span className="nav-icon">🚪</span> Log Out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        {renderContent()}
      </main>

      {/* Razorpay Checkout Modal (Sandbox / Real Gateway) */}
      <RazorpayModal
        isOpen={isRzpModalOpen}
        orderData={razorpayOrder}
        user={user}
        onSuccess={handleVerifyPayment}
        onClose={() => {
          setIsRzpModalOpen(false);
          setRazorpayOrder(null);
        }}
        isProcessing={paymentProcessing}
      />
    </div>
  );
};

export default CustomerDashboard;
