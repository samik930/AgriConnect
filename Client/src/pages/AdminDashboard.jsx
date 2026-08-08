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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch products
      const prodRes = await fetch('/api/products');
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : []);
      }

      // Fetch schemes
      const schemesRes = await fetch('/api/schemes');
      if (schemesRes.ok) {
        const schemesData = await schemesRes.json();
        setSchemes(Array.isArray(schemesData.schemes) ? schemesData.schemes : []);
      }

      // Fetch technologies
      const techRes = await fetch('/api/technology');
      if (techRes.ok) {
        const techData = await techRes.json();
        setTechnologies(Array.isArray(techData.technologies) ? techData.technologies : []);
      }

      // Fetch users
      const usersRes = await authFetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
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
    setFormData(item || {});
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!editingItem;
    const url = modalType === 'scheme' 
      ? (isEdit ? `/api/schemes/${editingItem._id}` : '/api/schemes')
      : (isEdit ? `/api/technology/${editingItem._id}` : '/api/technology');
      
    try {
      const res = await authFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        alert('Failed to save data');
      }
    } catch (err) {
      console.error(err);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users Management', icon: '👥' },
    { id: 'products', label: 'Marketplace', icon: '🛒' },
    { id: 'schemes', label: 'Govt. Schemes', icon: '🏛' },
    { id: 'technologies', label: 'Technologies', icon: '🚜' },
  ];

  const renderOverview = () => (
    <>
      <div className="admin-header">
        <h1>Welcome, {user.name || 'Admin'} 👑</h1>
        <p>Here is the overall status of the AgriConnect platform.</p>
      </div>

      <div className="admin-stats-grid">
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
          <h1>Government Schemes</h1>
          <p>Manage schemes visible to farmers.</p>
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
                <th>Target Audience</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map(s => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 600 }}>{s.title}</td>
                  <td>{s.eligibility || 'All'}</td>
                  <td>{s.state || 'All India'}</td>
                  <td>
                    <button className="admin-btn-icon" title="Edit Scheme" onClick={() => openModal('scheme', s)}>✏</button>
                    <button className="admin-btn-icon" title="Delete Scheme" onClick={() => handleDeleteScheme(s._id)}>🗑</button>
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
          <h1>Agricultural Technologies</h1>
          <p>Manage tech updates for farmers.</p>
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
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {technologies.map(t => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</td>
                  <td>
                    <button className="admin-btn-icon" title="Edit Technology" onClick={() => openModal('technology', t)}>✏</button>
                    <button className="admin-btn-icon" title="Delete Technology" onClick={() => handleDeleteTechnology(t._id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderContent = () => {
    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading dashboard data...</div>;

    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'users': return renderUsers();
      case 'products': return renderProducts();
      case 'schemes': return renderSchemes();
      case 'technologies': return renderTechnologies();
      default: return renderOverview();
    }
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

      {/* Unified Edit/Add Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-bg)', padding: '30px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingItem ? 'Edit ' : 'Add '}
              {modalType === 'scheme' ? 'Scheme' : 'Technology'}
            </h2>
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title *</label>
                <input required name="title" value={formData.title || ''} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description</label>
                <textarea name="description" value={formData.description || ''} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', minHeight: '80px', fontFamily: 'inherit' }} />
              </div>
              {modalType === 'scheme' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>State (Optional)</label>
                    <input name="state" value={formData.state || ''} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Eligibility (Optional)</label>
                    <input name="eligibility" value={formData.eligibility || ''} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                  </div>
                </>
              )}
              {modalType === 'technology' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Resource Link (Optional)</label>
                  <input name="resourceLink" value={formData.resourceLink || ''} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', background: 'var(--color-primary, #10b981)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
