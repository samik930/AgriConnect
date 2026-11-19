import React, { useState } from 'react';
import './RazorpayModal.css';

const RazorpayModal = ({
  isOpen,
  orderData,
  user,
  onSuccess,
  onClose,
  isProcessing,
}) => {
  const [selectedMethod, setSelectedMethod] = useState('upi');

  if (!isOpen || !orderData) return null;

  const paymentMethods = [
    { id: 'upi', name: 'UPI (GPay, PhonePe, Paytm)', icon: '📱' },
    { id: 'card', name: 'Credit / Debit Card', icon: '💳' },
    { id: 'netbanking', name: 'Net Banking', icon: '🏦' },
    { id: 'wallet', name: 'Wallets / Cash', icon: '👛' },
  ];

  const handleSimulatePayment = () => {
    // Generate simulated payment credentials matching Razorpay structure
    const simPaymentId = `pay_sim_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const simOrderId = orderData.orderId || `order_sim_${Date.now()}`;
    const simSignature = `sig_sim_${Date.now()}`;

    onSuccess({
      razorpay_order_id: simOrderId,
      razorpay_payment_id: simPaymentId,
      razorpay_signature: simSignature,
      isSimulation: true,
      items: orderData.items,
      deliveryAddress: orderData.deliveryAddress,
    });
  };

  return (
    <div className="rzp-backdrop" onClick={onClose}>
      <div className="rzp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rzp-header">
          <div className="rzp-header-brand">
            <div className="rzp-logo-badge">⚡</div>
            <div>
              <div className="rzp-header-title">Razorpay Checkout</div>
              <div className="rzp-header-subtitle">
                AgriConnect Platform
                <span className="rzp-test-badge">Test Sandbox</span>
              </div>
            </div>
          </div>
          <button className="rzp-close-btn" onClick={onClose} title="Cancel Payment">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="rzp-body">
          {/* Amount Card */}
          <div className="rzp-amount-card">
            <div>
              <div className="rzp-amount-label">Amount Payable</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                Inclusive of all taxes & local delivery
              </div>
            </div>
            <div className="rzp-amount-value">₹{orderData.totalAmount?.toFixed(2) || '0.00'}</div>
          </div>

          {/* Order Details */}
          <div className="rzp-summary-box">
            <div className="rzp-summary-row">
              <span className="rzp-summary-label">Order Reference:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{orderData.orderId}</span>
            </div>
            <div className="rzp-summary-row">
              <span className="rzp-summary-label">Items:</span>
              <span>{orderData.items?.length || 1} product(s)</span>
            </div>
            <div className="rzp-summary-row">
              <span className="rzp-summary-label">Customer:</span>
              <span>{user?.name || 'Customer'}</span>
            </div>
            <div className="rzp-summary-row">
              <span className="rzp-summary-label">Delivery Address:</span>
              <span style={{ maxWidth: '240px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {orderData.deliveryAddress}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <div className="rzp-methods-label">Select Payment Method</div>
            <div className="rzp-methods-grid">
              {paymentMethods.map((m) => (
                <div
                  key={m.id}
                  className={`rzp-method-card ${selectedMethod === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMethod(m.id)}
                >
                  <span className="rzp-method-icon">{m.icon}</span>
                  <span>{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Mode Info Banner */}
          <div className="rzp-notice">
            <strong>ℹ️ Developer / Test Simulation Active</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              Razorpay credentials are currently in placeholder mode in <code>Server/.env</code>. Clicking "Pay with Razorpay" will simulate a successful transaction and record the order as <strong>Paid</strong> in Supabase. Once you paste your real Razorpay Key & Secret into <code>Server/.env</code>, the live Razorpay popup will open automatically.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="rzp-footer">
          <button className="rzp-cancel-btn" onClick={onClose} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="rzp-pay-btn"
            onClick={handleSimulatePayment}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="geo-spinner" style={{ width: 18, height: 18 }} />
                Processing Payment...
              </>
            ) : (
              <>
                <span>🔒 Pay ₹{orderData.totalAmount?.toFixed(2)} with Razorpay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RazorpayModal;

