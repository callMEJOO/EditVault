const fs = require('fs');

const file = 'client/src/main.jsx';
let code = fs.readFileSync(file, 'utf8');

function replaceOnce(oldText, newText, label) {
  const first = code.indexOf(oldText);
  if (first === -1 || code.indexOf(oldText, first + oldText.length) !== -1) {
    throw new Error('Could not safely locate a unique insertion point: ' + label);
  }
  code = code.slice(0, first) + newText + code.slice(first + oldText.length);
  console.log('Prepared: ' + label);
}

replaceOnce(
  "  const [authLoading, setAuthLoading] = useState(false);",
  `  const [authLoading, setAuthLoading] = useState(false);

  // Premium accounts
  const [premiumProducts, setPremiumProducts] = useState([]);
  const [premiumOrders, setPremiumOrders] = useState([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumBuying, setPremiumBuying] = useState('');`,
  'Premium state'
);

replaceOnce(
  '  const filtered = useMemo(',
  `  useEffect(() => {
    let cancelled = false;

    const loadPremiumProducts = async () => {
      setPremiumLoading(true);
      try {
        const response = await fetch(\`\${API_URL}/api/premium\`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Could not load premium products.');
        }
        if (!cancelled) {
          setPremiumProducts(Array.isArray(data.products) ? data.products : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Loading premium products failed:', error);
          setNotice(error.message || 'Could not load premium products.');
        }
      } finally {
        if (!cancelled) setPremiumLoading(false);
      }
    };

    loadPremiumProducts();
    return () => { cancelled = true; };
  }, []);

  const loadPremiumOrders = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!user || !token) {
      setPremiumOrders([]);
      return;
    }

    try {
      const response = await fetch(\`\${API_URL}/api/premium/orders/mine\`, {
        headers: { Authorization: \`Bearer \${token}\` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not load your premium orders.');
      }
      setPremiumOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      console.error('Loading premium orders failed:', error);
    }
  };

  useEffect(() => {
    loadPremiumOrders();
  }, [user]);

  const buyPremium = async (product) => {
    if (!user) {
      setNotice('Please log in before ordering a premium account.');
      openAuth('login');
      return;
    }

    if (premiumBuying) return;

    const token = localStorage.getItem('editvault_token');
    if (!token) {
      setNotice('Your session expired. Please log in again.');
      logout();
      return;
    }

    const price = Number(product.price_points || 0);
    if (points < price) {
      setNotice(\`You need \${price - points} more points for this product.\`);
      return;
    }

    setPremiumBuying(product.id);
    setNotice('');

    try {
      const response = await fetch(
        \`\${API_URL}/api/premium/\${product.id}/order\`,
        {
          method: 'POST',
          headers: { Authorization: \`Bearer \${token}\` },
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Could not place your order.');
      }

      const walletResponse = await fetch(\`\${API_URL}/api/wallet\`, {
        headers: { Authorization: \`Bearer \${token}\` },
      });

      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setPoints(Number(walletData.balance || 0));
      }

      await loadPremiumOrders();
      setNotice('Order placed! Your order is waiting for admin fulfillment.');
    } catch (error) {
      setNotice(error.message || 'Could not place your order.');
    } finally {
      setPremiumBuying('');
    }
  };

  const filtered = useMemo(`,
  'Premium API functions'
);

replaceOnce(
  '        <section className="creator-banner" id="creators">',
  `        <section className="premium-section" id="premium">
          <div className="premium-heading">
            <div>
              <div className="eyebrow">EXCLUSIVE ACCESS</div>
              <h2>Premium <span>Accounts.</span></h2>
              <p>Place an order with points. The admin will handle delivery.</p>
            </div>
            <span className="premium-count">
              {premiumProducts.length} AVAILABLE
            </span>
          </div>

          {premiumLoading ? (
            <div className="premium-empty">Loading premium products...</div>
          ) : premiumProducts.length === 0 ? (
            <div className="premium-empty">
              No premium products are available right now.
            </div>
          ) : (
            <div className="premium-grid">
              {premiumProducts.map((product) => (
                <article className="premium-card" key={product.id}>
                  {product.image_url ? (
                    <img
                      className="premium-image"
                      src={product.image_url}
                      alt={product.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="premium-image premium-image-placeholder">
                      <ShieldCheck size={34} />
                    </div>
                  )}

                  <div className="premium-card-content">
                    <span className="premium-service">
                      {product.service_name}
                    </span>
                    <h3>{product.title}</h3>
                    <p>{product.description || 'Premium digital access.'}</p>
                    {product.duration && (
                      <span className="premium-duration">
                        {product.duration}
                      </span>
                    )}

                    <div className="premium-card-footer">
                      <span className="price">
                        <Coins size={16} />
                        <b>{Number(product.price_points || 0)}</b>
                        <small>PTS</small>
                      </span>

                      <button
                        className="buy-btn"
                        disabled={Boolean(premiumBuying)}
                        onClick={() => buyPremium(product)}
                      >
                        {premiumBuying === product.id
                          ? 'Processing...'
                          : 'Order now'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {user && (
            <div className="premium-orders">
              <div className="premium-orders-heading">
                <div className="eyebrow">YOUR ACTIVITY</div>
                <h3>My premium orders</h3>
              </div>

              {premiumOrders.length === 0 ? (
                <p className="premium-empty">You haven't placed any orders yet.</p>
              ) : (
                <div className="premium-order-list">
                  {premiumOrders.map((order) => (
                    <div className="premium-order" key={order.id}>
                      <div>
                        <strong>
                          {order.title || order.service_name || 'Premium order'}
                        </strong>
                        <small>
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString()
                            : ''}
                          {' · '}
                          {Number(order.price_points || 0)} points
                        </small>
                      </div>
                      <span className={\`premium-status status-\${order.status}\`}>
                        {order.status === 'pending'
                          ? 'Pending'
                          : order.status === 'completed'
                          ? 'Completed'
                          : order.status === 'rejected'
                          ? 'Rejected / refunded'
                          : order.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="creator-banner" id="creators">`,
  'Premium storefront section'
);

fs.writeFileSync(file, code, 'utf8');
console.log('Premium frontend changes saved.');
