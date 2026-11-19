import React, { useState, useEffect, useCallback } from 'react';
import './AdminDashboard.css';

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

const AdminDashboard = ({ onLogout, onLogoClick }) => {
  const user = JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
  const [activeTab, setActiveTab] = useState('overview');

  // State
  const [products, setProducts] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [technologies, setTechnologies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  // Core Admin Managed Tables
  const [trainings, setTrainings] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);
  const [priceSearch, setPriceSearch] = useState('');

  // Orders state
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch products
      const prodRes = await fetch('/api/products');
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : []);
      }

      // Fetch schemes (Official Admin authored)
      const schemesRes = await fetch('/api/schemes');
      if (schemesRes.ok) {
        const schemesData = await schemesRes.json();
        setSchemes(Array.isArray(schemesData.schemes) ? schemesData.schemes : []);
      }

      // Fetch technologies (Official Admin authored)
      const techRes = await fetch('/api/technology');
      if (techRes.ok) {
        const techData = await techRes.json();
        setTechnologies(Array.isArray(techData.technologies) ? techData.technologies : []);
      }

      // Fetch trainings (Official Admin authored)
      const trainingsRes = await fetch('/api/trainings');
      if (trainingsRes.ok) {
        const trainingsData = await trainingsRes.json();
        setTrainings(Array.isArray(trainingsData.trainings) ? trainingsData.trainings : []);
      }

      // Fetch APMC market prices (Official Admin authored benchmark prices)
      const pricesRes = await fetch('/api/market-prices');
      if (pricesRes.ok) {
        const pricesData = await pricesRes.json();
        setMarketPrices(Array.isArray(pricesData.marketPrices) ? pricesData.marketPrices : []);
      }

      // Fetch users
      const usersRes = await authFetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      }

      // Fetch orders with items & customer details
      const ordersRes = await authFetch('/api/admin/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    if (item) {
      let initialData = { ...item };
      if (type === 'training' && item.date) {
        try {
          initialData.date = new Date(item.date).toISOString().slice(0, 16);
        } catch { /* silent */ }
      }
      setFormData(initialData);
    } else {
      if (type === 'market-price') {
        setFormData({ cropName: '', district: '', marketPrice: '', unit: 'kg' });
      } else if (type === 'training') {
        setFormData({ title: '', organizer: '', date: '', location: '', registrationLink: '' });
      } else if (type === 'scheme') {
        setFormData({ title: '', description: '', state: '', district: '', eligibility: '', applicationLink: '' });
      } else if (type === 'technology') {
        setFormData({ title: '', description: '', state: 'All', district: '', resourceLink: '' });
      } else {
        setFormData({});
      }
    }
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!editingItem;
    const itemId = editingItem?._id || editingItem?.id;
    let url = '';

    if (modalType === 'scheme') {
      url = isEdit ? `/api/schemes/${itemId}` : '/api/schemes';
    } else if (modalType === 'technology') {
      url = isEdit ? `/api/technology/${itemId}` : '/api/technology';
    } else if (modalType === 'training') {
      url = isEdit ? `/api/trainings/${itemId}` : '/api/trainings';
    } else if (modalType === 'market-price') {
      url = isEdit ? `/api/market-prices/${itemId}` : '/api/market-prices';
    }

    try {
      const res = await authFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save data: ' + (err.message || 'Server error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error saving data');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteScheme = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scheme?')) return;
    try {
      const res = await authFetch(`/api/schemes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTechnology = async (id) => {
    if (!window.confirm('Are you sure you want to delete this technology?')) return;
    try {
      const res = await authFetch(`/api/technology/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTraining = async (id) => {
    if (!window.confirm('Are you sure you want to delete this training workshop?')) return;
    try {
      const res = await authFetch(`/api/trainings/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to delete training: ' + (err.message || 'Server error'));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteMarketPrice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this APMC market benchmark price?')) return;
    try {
      const res = await authFetch(`/api/market-prices/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to delete market price: ' + (err.message || 'Server error'));
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await authFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ orderStatus: newStatus }),
      });
      if (res.ok) {
        fetchData();
        if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
          setSelectedOrder(prev => ({ ...prev, orderStatus: newStatus }));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to update order status: ' + (err.message || 'Server error'));
      }
    } catch (e) {
      alert('Error updating order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdatePaymentStatus = async (orderId, newStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await authFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ paymentStatus: newStatus }),
      });
      if (res.ok) {
        fetchData();
        if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
          setSelectedOrder(prev => ({ ...prev, paymentStatus: newStatus }));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to update payment status: ' + (err.message || 'Server error'));
      }
    } catch (e) {
      alert('Error updating payment status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    try {
      const res = await authFetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedOrder && (selectedOrder._id === id || selectedOrder.id === id)) {
          setSelectedOrder(null);
        }
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to delete order: ' + (err.message || 'Server error'));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'orders', label: 'Orders & Payments', icon: '📦' },
    { id: 'schemes', label: 'Govt. Schemes', icon: '🏛' },
    { id: 'technologies', label: 'Technologies', icon: '🚜' },
    { id: 'trainings', label: 'Farmer Trainings', icon: '🎓' },
    { id: 'market-prices', label: 'APMC Market Prices', icon: '📈' },
    { id: 'users', label: 'Users Management', icon: '👥' },
    { id: 'products', label: 'Marketplace', icon: '🛒' },
  ];

  const totalPaidRevenue = orders
    .filter(o => o.paymentStatus === 'Paid')
    .reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);

  const renderOverview = () => (
    <>
      <div className="admin-header">
        <h1>Welcome, {user.name || 'Admin'} 👑</h1>
        <p>Here is the overall status of the AgriConnect platform.</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📦</div>
          <div className="admin-stat-value">{orders.length}</div>
          <div className="admin-stat-label">Total Placed Orders</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">💳</div>
          <div className="admin-stat-value">₹{totalPaidRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="admin-stat-label">Total Paid Revenue</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🏛</div>
          <div className="admin-stat-value">{schemes.length}</div>
          <div className="admin-stat-label">Govt. Schemes</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🚜</div>
          <div className="admin-stat-value">{technologies.length}</div>
          <div className="admin-stat-label">Technologies</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎓</div>
          <div className="admin-stat-value">{trainings.length}</div>
          <div className="admin-stat-label">Farmer Trainings</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📈</div>
          <div className="admin-stat-value">{marketPrices.length}</div>
          <div className="admin-stat-label">APMC Price Rates</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-value">{users.length}</div>
          <div className="admin-stat-label">Total Users</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🛒</div>
          <div className="admin-stat-value">{products.length}</div>
          <div className="admin-stat-label">Listed Products</div>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div style={{ marginTop: '30px' }}>
        <div className="flex-between" style={{ marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>📦 Recent Placed Orders</h3>
          <button 
            className="admin-btn admin-btn-primary" 
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            onClick={() => setActiveTab('orders')}
          >
            View All Orders ({orders.length}) →
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="admin-empty" style={{ padding: '30px 20px' }}>
            <div className="admin-empty-icon">📦</div>
            <p style={{ margin: 0 }}>No orders have been placed on AgriConnect yet.</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map(o => (
                  <tr key={o._id || o.id}>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                        {(o._id || o.id).slice(0, 8)}...
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customer?.name || 'Customer'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{o.customer?.email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {o.items?.map(it => it.product?.name || 'Product').join(', ') || `${o.items?.length || 0} items`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {o.items?.reduce((s, it) => s + (it.quantity || 1), 0)} unit(s)
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>
                      ₹{parseFloat(o.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`admin-order-badge ${(o.paymentStatus || 'Pending').toLowerCase()}`}>
                        {o.paymentStatus === 'Paid' ? '💳 Paid' : '⏳ ' + (o.paymentStatus || 'Pending')}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-order-badge ${(o.orderStatus || 'Pending').toLowerCase()}`}>
                        {o.orderStatus || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="admin-btn admin-btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => setSelectedOrder(o)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  const renderUsers = () => (
    <>
      <div className="admin-header flex-between">
        <div>
          <h1>User Management</h1>
          <p>View and manage platform users.</p>
        </div>
      </div>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`admin-badge ${u.role}`}>{u.role}</span>
                </td>
                <td>{u.state || 'N/A'}</td>
                <td>
                  <button className="admin-btn-icon" title="View Details" onClick={() => alert('View user details')}>👁</button>
                  <button className="admin-btn-icon" title="Delete User" onClick={() => handleDeleteUser(u._id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderProducts = () => (
    <>
      <div className="admin-header flex-between">
        <div>
          <h1>Marketplace Products</h1>
          <p>Monitor all products listed by farmers.</p>
        </div>
      </div>
      {products.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🛒</div>
          <h3>No Products</h3>
          <p>There are no products listed on the platform yet.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.category}</td>
                  <td>₹{p.price}/{p.unit}</td>
                  <td>{p.stock}</td>
                  <td>
                    <button className="admin-btn-icon" title="Remove Product" onClick={() => handleDeleteProduct(p._id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderSchemes = () => (
    <>
      <div className="admin-header flex-between">
        <div>
          <h1>🏛 Government Schemes</h1>
          <p>Official Government subsidies, grants, and eligibility rules (e.g. PMKSY, MahaDBT, PM-KUSUM). Authored & managed by Admin.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => openModal('scheme')}>+ Add Scheme</button>
      </div>
      {schemes.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🏛</div>
          <h3>No Schemes</h3>
          <p>Add some government schemes to notify farmers.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Target Eligibility</th>
                <th>Coverage Region</th>
                <th>Official Portal</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map(s => (
                <tr key={s._id || s.id}>
                  <td style={{ fontWeight: 600, maxWidth: '280px' }}>
                    <div>{s.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {s.description?.slice(0, 90)}...
                    </div>
                  </td>
                  <td>
                    <span className="admin-badge admin" style={{ fontSize: '0.75rem' }}>
                      👥 {s.eligibility || 'All Farmers'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>
                      📍 {s.state || 'All India'}{s.district ? ` (${s.district})` : ''}
                    </span>
                  </td>
                  <td>
                    {s.applicationLink ? (
                      <a href={s.applicationLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>
                        Official Portal ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Direct District Office</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="admin-btn-icon" title="Edit Scheme" onClick={() => openModal('scheme', s)}>✏</button>
                      <button className="admin-btn-icon" title="Delete Scheme" onClick={() => handleDeleteScheme(s._id || s.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderTechnologies = () => (
    <>
      <div className="admin-header flex-between">
        <div>
          <h1>🚜 Agricultural Technologies</h1>
          <p>Verified modern farming guides, machinery advisories, and techniques (e.g. Drip Fertigation, Drone Spraying). Authored & managed by Admin.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => openModal('technology')}>+ Add Technology</button>
      </div>
      {technologies.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🚜</div>
          <h3>No Technologies</h3>
          <p>Add new technologies to educate farmers.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Technical Advisory Description</th>
                <th>Coverage</th>
                <th>Resource Link</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {technologies.map(t => (
                <tr key={t._id || t.id}>
                  <td style={{ fontWeight: 600, minWidth: '180px' }}>{t.title}</td>
                  <td style={{ maxWidth: '320px', fontSize: '0.85rem' }}>
                    {t.description}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem' }}>
                      📍 {t.state || 'All'}{t.district ? ` (${t.district})` : ''}
                    </span>
                  </td>
                  <td>
                    {t.resourceLink ? (
                      <a href={t.resourceLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                        Research PDF / Link ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>AgriConnect Advisory</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="admin-btn-icon" title="Edit Technology" onClick={() => openModal('technology', t)}>✏</button>
                      <button className="admin-btn-icon" title="Delete Technology" onClick={() => handleDeleteTechnology(t._id || t.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderTrainings = () => (
    <>
      <div className="admin-header flex-between">
        <div>
          <h1>🎓 Farmer Trainings & KVK Workshops</h1>
          <p>Official government, ICAR, and Krishi Vigyan Kendra workshops, sessions, and registration links. Authored & managed by Admin.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => openModal('training')}>
          + Add Training Workshop
        </button>
      </div>

      {trainings.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🎓</div>
          <h3>No Training Workshops</h3>
          <p>Add official training sessions and KVK workshops to upskill local farmers.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Workshop Title</th>
                <th>Organizer</th>
                <th>Date & Time</th>
                <th>Location / Mode</th>
                <th>Registration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trainings.map(t => (
                <tr key={t._id || t.id}>
                  <td style={{ fontWeight: 600, minWidth: '200px' }}>{t.title}</td>
                  <td>
                    <span className="admin-badge admin" style={{ fontSize: '0.78rem' }}>
                      🏛 {t.organizer}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {new Date(t.date).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>📍 {t.location || 'Online Session'}</span>
                  </td>
                  <td>
                    {t.registrationLink ? (
                      <a
                        href={t.registrationLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.8rem',
                          color: '#10b981',
                          textDecoration: 'none',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        Portal Link ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Walk-in / Free</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="admin-btn-icon" title="Edit Training" onClick={() => openModal('training', t)}>✏</button>
                      <button className="admin-btn-icon" title="Delete Training" onClick={() => handleDeleteTraining(t._id || t.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderMarketPrices = () => {
    const searchLower = priceSearch.toLowerCase().trim();
    const filteredPrices = marketPrices.filter(mp => {
      if (!searchLower) return true;
      return (
        (mp.cropName || '').toLowerCase().includes(searchLower) ||
        (mp.district || '').toLowerCase().includes(searchLower)
      );
    });

    return (
      <>
        <div className="admin-header flex-between">
          <div>
            <h1>📈 APMC & Mandi Benchmark Market Prices</h1>
            <p>Official baseline crop rates per mandi/district. Controlled centrally by Admin to prevent unfair marketplace price distortion.</p>
          </div>
          <button className="admin-btn admin-btn-primary" onClick={() => openModal('market-price')}>
            + Add Benchmark Price
          </button>
        </div>

        <div className="admin-filters-bar">
          <input
            type="text"
            className="admin-search-input"
            placeholder="🔍 Search benchmark rates by Crop Name or Mandi/District..."
            value={priceSearch}
            onChange={(e) => setPriceSearch(e.target.value)}
          />
        </div>

        {filteredPrices.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">📈</div>
            <h3>No Market Prices Found</h3>
            <p>{marketPrices.length === 0 ? "No APMC benchmark crop rates recorded yet." : "No market rates match your search filter."}</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Crop Name</th>
                  <th>Mandi / District</th>
                  <th>Official Benchmark Rate</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrices.map(mp => (
                  <tr key={mp._id || mp.id}>
                    <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      🌾 {mp.cropName}
                    </td>
                    <td>
                      <span className="admin-badge customer" style={{ fontSize: '0.8rem' }}>
                        📍 {mp.district} Mandi
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-display)' }}>
                        ₹{parseFloat(mp.marketPrice || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                        /{mp.unit || 'kg'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {new Date(mp.updatedAt || Date.now()).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {new Date(mp.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="admin-btn-icon" title="Edit Price" onClick={() => openModal('market-price', mp)}>✏</button>
                        <button className="admin-btn-icon" title="Delete Price" onClick={() => handleDeleteMarketPrice(mp._id || mp.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderOrders = () => {
    // Filter orders by search term and dropdown filters
    const searchLower = orderSearch.toLowerCase().trim();
    const filteredOrders = orders.filter(o => {
      // Status filter
      if (orderStatusFilter !== 'ALL' && (o.orderStatus || 'Pending') !== orderStatusFilter) {
        return false;
      }
      // Payment filter
      if (paymentStatusFilter !== 'ALL' && (o.paymentStatus || 'Pending') !== paymentStatusFilter) {
        return false;
      }
      // Search filter
      if (searchLower) {
        const orderIdMatch = (o._id || o.id || '').toLowerCase().includes(searchLower);
        const customerNameMatch = (o.customer?.name || '').toLowerCase().includes(searchLower);
        const customerEmailMatch = (o.customer?.email || '').toLowerCase().includes(searchLower);
        const paymentIdMatch = (o.paymentId || '').toLowerCase().includes(searchLower);
        const itemsMatch = o.items?.some(it => 
          (it.product?.name || '').toLowerCase().includes(searchLower) ||
          (it.farmer?.name || '').toLowerCase().includes(searchLower)
        );
        return orderIdMatch || customerNameMatch || customerEmailMatch || paymentIdMatch || itemsMatch;
      }
      return true;
    });

    return (
      <>
        <div className="admin-header flex-between">
          <div>
            <h1>📦 Orders & Transactions</h1>
            <p>Track all marketplace customer purchases, payment verification, and delivery stages.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="admin-btn admin-btn-primary" onClick={fetchData}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="admin-filters-bar">
          <input
            type="text"
            className="admin-search-input"
            placeholder="🔍 Search orders by ID, Customer, Farmer, Product..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
          />
          <select 
            className="admin-filter-select"
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
          >
            <option value="ALL">All Order Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Packed">Packed</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select 
            className="admin-filter-select"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Payment Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">📦</div>
            <h3>No Orders Found</h3>
            <p>{orders.length === 0 ? "No customer orders have been placed yet." : "No orders match the selected search and filter criteria."}</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Placed Date</th>
                  <th>Customer</th>
                  <th>Items & Farmers</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o._id || o.id}>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                        {(o._id || o.id).slice(0, 8)}...
                      </code>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {new Date(o.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customer?.name || 'Customer'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{o.customer?.email}</div>
                      {o.customer?.phone && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>📞 {o.customer.phone}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {o.items?.map(it => it.product?.name || 'Product').join(', ') || `${o.items?.length || 0} items`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {o.items?.length} crop item(s) • Total qty: {o.items?.reduce((s, it) => s + (it.quantity || 1), 0)}
                      </div>
                      {o.items?.[0]?.farmer?.name && (
                        <div style={{ fontSize: '0.72rem', color: '#10b981' }}>
                          👨‍🌾 Farmer: {o.items[0].farmer.name}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                        ₹{parseFloat(o.totalAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-order-badge ${(o.paymentStatus || 'Pending').toLowerCase()}`}>
                        {o.paymentStatus === 'Paid' ? '💳 Paid' : '⏳ ' + (o.paymentStatus || 'Pending')}
                      </span>
                      {o.paymentId && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: '3px' }}>
                          {o.paymentId.slice(0, 12)}...
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        className="admin-filter-select"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
                        value={o.orderStatus || 'Pending'}
                        disabled={updatingOrderId === (o._id || o.id)}
                        onChange={(e) => handleUpdateOrderStatus(o._id || o.id, e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Packed">Packed</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="admin-btn admin-btn-primary" 
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          title="View complete order invoice and items"
                          onClick={() => setSelectedOrder(o)}
                        >
                          Invoice
                        </button>
                        <button 
                          className="admin-btn admin-btn-danger" 
                          style={{ padding: '5px 8px', fontSize: '0.78rem' }}
                          title="Delete Order"
                          onClick={() => handleDeleteOrder(o._id || o.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderContent = () => {
    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading dashboard data...</div>;

    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'orders': return renderOrders();
      case 'schemes': return renderSchemes();
      case 'technologies': return renderTechnologies();
      case 'trainings': return renderTrainings();
      case 'market-prices': return renderMarketPrices();
      case 'users': return renderUsers();
      case 'products': return renderProducts();
      default: return renderOverview();
    }
  };

  const modalTitles = {
    scheme: 'Government Scheme',
    technology: 'Agricultural Technology',
    training: 'Farmer Training Workshop',
    'market-price': 'APMC Benchmark Market Price',
  };

  return (
    <div className="admin-dashboard-wrapper">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
          <span className="text-gradient">AgriConnect</span>
          <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--color-text-muted)' }}>Admin Panel</span>
        </div>
        <nav className="admin-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`admin-sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-sidebar-btn" onClick={onLogout} style={{ color: '#ef4444' }}>
            <span className="admin-nav-icon">🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {renderContent()}
      </main>

      {/* Unified Edit/Add Modal for Core Admin-Managed Tables */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '28px', borderRadius: '14px', width: '540px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                {editingItem ? 'Edit ' : 'Add '}
                {modalTitles[modalType] || 'Item'}
              </h2>
              <button 
                className="admin-btn-icon" 
                onClick={() => setShowModal(false)}
                style={{ fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* 1. SCHEMES FORM */}
              {modalType === 'scheme' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Scheme Title *</label>
                    <input required name="title" value={formData.title || ''} onChange={handleFormChange} placeholder="e.g. PM-KUSUM Component-B" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description & Subsidies *</label>
                    <textarea required name="description" value={formData.description || ''} onChange={handleFormChange} placeholder="Subsidy percentages, eligible pumps, grants..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', minHeight: '80px', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>State *</label>
                      <input required name="state" value={formData.state || ''} onChange={handleFormChange} placeholder="e.g. Maharashtra or All" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>District (Optional)</label>
                      <input name="district" value={formData.district || ''} onChange={handleFormChange} placeholder="e.g. Pune, All" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Eligibility Criteria</label>
                    <input name="eligibility" value={formData.eligibility || ''} onChange={handleFormChange} placeholder="e.g. Small & marginal farmers with 7/12 land extract" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Application Link (URL)</label>
                    <input name="applicationLink" value={formData.applicationLink || ''} onChange={handleFormChange} placeholder="https://pmkusum.mnre.gov.in" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                </>
              )}

              {/* 2. TECHNOLOGIES FORM */}
              {modalType === 'technology' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Technology / Advisory Title *</label>
                    <input required name="title" value={formData.title || ''} onChange={handleFormChange} placeholder="e.g. Automated Drip & Fertigation System" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Technical Description & Practices *</label>
                    <textarea required name="description" value={formData.description || ''} onChange={handleFormChange} placeholder="Details, water savings, pest control guidelines..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', minHeight: '80px', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Target State</label>
                      <input name="state" value={formData.state || 'All'} onChange={handleFormChange} placeholder="All or State name" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>District (Optional)</label>
                      <input name="district" value={formData.district || ''} onChange={handleFormChange} placeholder="e.g. Pune, All" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Research / Resource Link (URL)</label>
                    <input name="resourceLink" value={formData.resourceLink || ''} onChange={handleFormChange} placeholder="https://icar.org.in" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                </>
              )}

              {/* 3. TRAININGS FORM */}
              {modalType === 'training' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Workshop Title *</label>
                    <input required name="title" value={formData.title || ''} onChange={handleFormChange} placeholder="e.g. Organic Crop Production and Export Standards" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Organizing Body / Institution *</label>
                    <input required name="organizer" value={formData.organizer || ''} onChange={handleFormChange} placeholder="e.g. KVK Pune & ICAR-NIASM" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Date & Time *</label>
                      <input required type="datetime-local" name="date" value={formData.date || ''} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Location / Venue</label>
                      <input name="location" value={formData.location || ''} onChange={handleFormChange} placeholder="e.g. Pune Krishi Vigyan Kendra" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Registration Portal Link (URL)</label>
                    <input name="registrationLink" value={formData.registrationLink || ''} onChange={handleFormChange} placeholder="https://agri.maharashtra.gov.in/trainings" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                </>
              )}

              {/* 4. APMC MARKET PRICES FORM */}
              {modalType === 'market-price' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Crop / Commodity *</label>
                      <input required name="cropName" value={formData.cropName || ''} onChange={handleFormChange} placeholder="e.g. Tomato, Onion, Wheat" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Mandi / District *</label>
                      <input required name="district" value={formData.district || ''} onChange={handleFormChange} placeholder="e.g. Pune, Nashik, Nagpur" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Benchmark APMC Price (₹) *</label>
                      <input required type="number" step="0.01" min="0" name="marketPrice" value={formData.marketPrice ?? ''} onChange={handleFormChange} placeholder="e.g. 24.50" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Unit *</label>
                      <select name="unit" value={formData.unit || 'kg'} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>
                        <option value="kg">kg</option>
                        <option value="quintal">quintal (100 kg)</option>
                        <option value="crate">crate (20 kg)</option>
                        <option value="tonne">tonne</option>
                        <option value="dozen">dozen</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', background: 'var(--color-primary, #10b981)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                  {editingItem ? 'Update ' : 'Publish '}
                  {modalTitles[modalType]?.split(' ')[0] || 'Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details & Invoice Modal */}
      {selectedOrder && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  📄 Order Invoice & Full Details
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  ID: {selectedOrder._id || selectedOrder.id}
                </span>
              </div>
              <button
                className="admin-btn-icon"
                style={{ fontSize: '1.2rem', cursor: 'pointer' }}
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-detail-grid">
                {/* Customer Details Box */}
                <div className="admin-detail-box">
                  <h4>👤 Customer Information</h4>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Name:</span>
                    <span style={{ fontWeight: 600 }}>{selectedOrder.customer?.name || 'Customer'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Email:</span>
                    <span>{selectedOrder.customer?.email || 'N/A'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Delivery Address:</span>
                    <span style={{ textAlign: 'right', maxWidth: '180px' }}>
                      {selectedOrder.deliveryAddress || 'Standard Delivery'}
                    </span>
                  </div>
                </div>

                {/* Payment & Status Box */}
                <div className="admin-detail-box">
                  <h4>💳 Payment & Status</h4>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Payment Status:</span>
                    <span className={`admin-order-badge ${(selectedOrder.paymentStatus || 'Pending').toLowerCase()}`}>
                      {selectedOrder.paymentStatus || 'Pending'}
                    </span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Razorpay Order:</span>
                    <code style={{ fontSize: '0.75rem' }}>{selectedOrder.razorpayOrderId || 'N/A'}</code>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Payment ID:</span>
                    <code style={{ fontSize: '0.75rem' }}>{selectedOrder.paymentId || 'N/A'}</code>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Placed On:</span>
                    <span style={{ fontSize: '0.8rem' }}>
                      {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Status Control */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Order Delivery Stage:</span>
                <select
                  className="admin-filter-select"
                  style={{ padding: '6px 12px' }}
                  value={selectedOrder.orderStatus || 'Pending'}
                  onChange={(e) => handleUpdateOrderStatus(selectedOrder._id || selectedOrder.id, e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Packed">Packed</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>📦 Ordered Items ({selectedOrder.items?.length || 0})</h4>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Farmer</th>
                        <th>Unit Price</th>
                        <th>Quantity</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((it, idx) => (
                        <tr key={it._id || it.id || idx}>
                          <td style={{ fontWeight: 600 }}>{it.product?.name || 'Product'}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            {it.farmer?.name || 'Local Farmer'}
                          </td>
                          <td>₹{parseFloat(it.price || 0).toFixed(2)}</td>
                          <td>{it.quantity}</td>
                          <td style={{ fontWeight: 700, color: '#10b981' }}>
                            ₹{parseFloat(it.subtotal || (it.price * it.quantity) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Grand Total: <span style={{ color: '#10b981' }}>₹{parseFloat(selectedOrder.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
