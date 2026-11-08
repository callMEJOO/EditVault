const fs = require('fs');

const file = 'client/src/main.jsx';
let s = fs.readFileSync(file, 'utf8');

function replaceOnce(oldText, newText, label) {
  const first = s.indexOf(oldText);
  if (first < 0) throw new Error('Could not find insertion point: ' + label);
  if (s.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error('Insertion point is not unique: ' + label);
  }
  s = s.replace(oldText, newText);
  console.log('Patched:', label);
}

// Add admin dashboard state
replaceOnce(
  "  const [premiumBuying, setPremiumBuying] = useState('');",
  `  const [premiumBuying, setPremiumBuying] = useState('');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [premiumForm, setPremiumForm] = useState({
    title: '',
    serviceName: '',
    description: '',
    duration: '',
    pricePoints: '',
    imageUrl: '',
  });`,
  'admin states'
);

// Add admin functions before filtered edits
replaceOnce(
  '  const filtered = useMemo(',
  `  const loadAdminOrders = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!user || user.role !== 'admin' || !token) {
      setAdminOrders([]);
      return;
    }

    setAdminLoading(true);
    try {
      const response = await fetch(\`\${API_URL}/api/premium/orders\`, {
        headers: { Authorization: \`Bearer \${token}\` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load admin orders.');
      setAdminOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setNotice(error.message || 'Could not load admin orders.');
    } finally {
      setAdminLoading(false);
    }
  };

  const refreshPremiumProducts = async () => {
    const response = await fetch(\`\${API_URL}/api/premium\`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not refresh products.');
    setPremiumProducts(Array.isArray(data.products) ? data.products : []);
  };

  const createPremiumProduct = async (event) => {
    event.preventDefault();
    if (adminSaving) return;

    const token = localStorage.getItem('editvault_token');
    if (!token) {
      setNotice('Your session expired. Please log in again.');
      return;
    }

    const price = Number(premiumForm.pricePoints);
    if (!premiumForm.title.trim() || !premiumForm.serviceName.trim() ||
        !Number.isInteger(price) || price < 1) {
      setNotice('Enter a product title, service name, and a whole-number price of at least 1 point.');
      return;
    }

    setAdminSaving(true);
    setNotice('');
    try {
      const response = await fetch(\`\${API_URL}/api/premium\`, {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: premiumForm.title.trim(),
          serviceName: premiumForm.serviceName.trim(),
          description: premiumForm.description.trim(),
          duration: premiumForm.duration.trim(),
          pricePoints: price,
          imageUrl: premiumForm.imageUrl.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create product.');

      setPremiumForm({
        title: '', serviceName: '', description: '',
        duration: '', pricePoints: '', imageUrl: '',
      });
      await refreshPremiumProducts();
      setNotice('Premium product added successfully.');
    } catch (error) {
      setNotice(error.message || 'Could not create product.');
    } finally {
      setAdminSaving(false);
    }
  };

  const setPremiumProductStatus = async (product, status) => {
    const token = localStorage.getItem('editvault_token');
    if (!token) return setNotice('Your session expired. Please log in again.');

    try {
      const response = await fetch(\`\${API_URL}/api/premium/\${product.id}\`, {
        method: 'PATCH',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update product.');
      await refreshPremiumProducts();
      setNotice(status === 'hidden' ? 'Product hidden.' : 'Product is available again.');
    } catch (error) {
      setNotice(error.message || 'Could not update product.');
    }
  };

  const updatePremiumOrder = async (order, status) => {
    const token = localStorage.getItem('editvault_token');
    if (!token) return setNotice('Your session expired. Please log in again.');

    const action = status === 'completed' ? 'mark this order as completed' : 'reject this order and refund its points';
    if (!window.confirm(\`Are you sure you want to \${action}?\`)) return;

    try {
      const response = await fetch(\`\${API_URL}/api/premium/orders/\${order.id}\`, {
        method: 'PATCH',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update order.');

      await loadAdminOrders();
      await loadPremiumOrders();
      setNotice(status === 'completed' ? 'Order marked as completed.' : 'Order rejected; the backend should refund the points.');
    } catch (error) {
      setNotice(error.message || 'Could not update order.');
    }
  };

  useEffect(() => {
    loadAdminOrders();
  }, [user]);

  const filtered = useMemo(`,
  'admin functions'
);

// Add navigation link
replaceOnce(
  '  <a href="#how" onClick={() => setMobileNav(false)}>How it works</a>',
  '  <a href="#how" onClick={() => setMobileNav(false)}>How it works</a>\\n  <a href="#premium" onClick={() => setMobileNav(false)}>Premium</a>',
  'premium navigation link'
);

// Insert admin panel before the end of Premium section
replaceOnce(
  '          )}\\n        </section>\\n\\n        <section className="creator-banner"',
  `          )}

          {user?.role === 'admin' && (
            <div className="premium-admin">
              <div className="premium-orders-heading">
                <div className="eyebrow">ADMINISTRATION</div>
                <h3>Premium control panel</h3>
                <p>Create products, manage visibility, and fulfill customer orders.</p>
              </div>

              <form className="premium-admin-form" onSubmit={createPremiumProduct}>
                <label>
                  Product title *
                  <input required value={premiumForm.title}
                    onChange={(e) => setPremiumForm({ ...premiumForm, title: e.target.value })}
                    placeholder="e.g. Video editor account" />
                </label>
                <label>
                  Service name *
                  <input required value={premiumForm.serviceName}
                    onChange={(e) => setPremiumForm({ ...premiumForm, serviceName: e.target.value })}
                    placeholder="e.g. Example service" />
                </label>
                <label>
                  Description
                  <textarea value={premiumForm.description}
                    onChange={(e) => setPremiumForm({ ...premiumForm, description: e.target.value })}
                    placeholder="Describe what the customer receives" rows="3" />
                </label>
                <label>
                  Duration
                  <input value={premiumForm.duration}
                    onChange={(e) => setPremiumForm({ ...premiumForm, duration: e.target.value })}
                    placeholder="e.g. 30 days" />
                </label>
                <label>
                  Price (points) *
                  <input required type="number" min="1" step="1" value={premiumForm.pricePoints}
                    onChange={(e) => setPremiumForm({ ...premiumForm, pricePoints: e.target.value })}
                    placeholder="100" />
                </label>
                <label>
                  Image URL
                  <input type="url" value={premiumForm.imageUrl}
                    onChange={(e) => setPremiumForm({ ...premiumForm, imageUrl: e.target.value })}
                    placeholder="https://..." />
                </label>
                <button className="buy-btn" type="submit" disabled={adminSaving}>
                  {adminSaving ? 'Saving...' : 'Add premium product'}
                </button>
              </form>

              <div className="premium-admin-subsection">
                <h3>Manage products</h3>
                {premiumProducts.length === 0 ? (
                  <p className="premium-empty">No products to manage yet.</p>
                ) : (
                  <div className="premium-order-list">
                    {premiumProducts.map((product) => (
                      <div className="premium-order" key={product.id}>
                        <div>
                          <strong>{product.title}</strong>
                          <small>{product.service_name} · {Number(product.price_points)} points · {product.status || 'available'}</small>
                        </div>
                        <button className="buy-btn" type="button"
                          onClick={() => setPremiumProductStatus(product, product.status === 'hidden' ? 'available' : 'hidden')}>
                          {product.status === 'hidden' ? 'Make available' : 'Hide product'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="premium-admin-subsection">
                <div className="premium-orders-heading">
                  <h3>Customer orders</h3>
                  <button className="buy-btn" type="button" onClick={loadAdminOrders} disabled={adminLoading}>
                    {adminLoading ? 'Refreshing...' : 'Refresh orders'}
                  </button>
                </div>
                {adminLoading ? (
                  <p className="premium-empty">Loading orders...</p>
                ) : adminOrders.length === 0 ? (
                  <p className="premium-empty">No premium orders found.</p>
                ) : (
                  <div className="premium-order-list">
                    {adminOrders.map((order) => (
                      <div className="premium-order premium-admin-order" key={order.id}>
                        <div>
                          <strong>{order.title || order.service_name || 'Premium order'}</strong>
                          <small>
                            Customer: {order.buyer_email || order.email || order.buyer_name || order.buyer_id || 'Customer'}
                            {' · '}{Number(order.price_points || 0)} points
                            {' · '}{order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                          </small>
                          <span className={\`premium-status status-\${order.status}\`}>{order.status}</span>
                        </div>
                        {order.status === 'pending' && (
                          <div className="premium-admin-actions">
                            <button className="buy-btn" type="button" onClick={() => updatePremiumOrder(order, 'completed')}>Mark completed</button>
                            <button className="buy-btn premium-reject-btn" type="button" onClick={() => updatePremiumOrder(order, 'rejected')}>Reject & refund</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="creator-banner"`,
  'admin dashboard JSX'
);

fs.writeFileSync(file, s, 'utf8');
console.log('main.jsx updated successfully.');
