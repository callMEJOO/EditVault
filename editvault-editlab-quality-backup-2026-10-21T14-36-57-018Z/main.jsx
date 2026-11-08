import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search,
  Coins,
  ShieldCheck,
  Play,
  Download,
  Sparkles,
  Clapperboard,
  Menu,
  X,
  ArrowUpRight,
  BadgeCheck,
  Video,
  UserRound,
  Heart,
  SlidersHorizontal,
  ExternalLink,
  UserPlus,
  UserMinus,
  Settings2,
} from 'lucide-react';
import './styles.css';
import './responsive-design-system.css';
import EditVaultLibrary from './EditVaultLibrary.jsx';
import './multipage-routing.css';
import './consumer-arabic-ui.css';
import CreatorStudio from './CreatorStudio.jsx';
import ProfileSettings from './ProfileSettings.jsx';
import MarketplaceSections from './MarketplaceSections.jsx';
import EditLabRewards from './EditLabRewards.jsx';
import AccountSettings from './AccountSettings.jsx';
import PublicCreatorProfile from './PublicCreatorProfile.jsx';
import CreatorRequests from './CreatorRequests.jsx';
import CreatorApplication from './CreatorApplication.jsx';
import TopazAdmin from './TopazAdmin.jsx';
import './creator-requests.css';
import './purchase-library-upgrade.css';
const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

const categories = ['All edits', 'Anime', 'Cinematic', 'Aesthetic', 'Gaming', 'AMV', 'Other'];

const PREMIUM_SERVICE_OPTIONS = ['CapCut Pro', 'Netflix', 'Spotify Premium', 'YouTube Premium', 'Disney+', 'ChatGPT Plus', 'Canva Pro', 'Adobe Creative Cloud', 'Microsoft 365', 'Telegram Premium', 'Discord Nitro', 'Crunchyroll', 'Shahid VIP', 'OSN+', 'Amazon Prime', 'Other'];

const EDITVAULT_PAGE_PATHS = {
  home: '/',
  explore: '/explore',
  'scene-packs': '/scene-packs',
  'clip-assembly': '/clip-assembly',
  editlab: '/editlab',
  library: '/library',
  earn: '/earn',
  accounts: '/accounts',
  creators: '/creators',
  requests: '/requests',
  how: '/how',
};

function resolveEditVaultPage(pathname) {
  const cleanPath = String(pathname || '/').replace(/\/+$/, '') || '/';
  return Object.entries(EDITVAULT_PAGE_PATHS).find(([, route]) => route === cleanPath)?.[0] || 'home';
}

function App() {
  const [activePage, setActivePage] = useState(() => resolveEditVaultPage(window.location.pathname));
  const navigateTo = (page) => {
    const nextPage = Object.prototype.hasOwnProperty.call(EDITVAULT_PAGE_PATHS, page) ? page : 'home';
    const nextPath = EDITVAULT_PAGE_PATHS[nextPage];
    if (window.location.pathname !== nextPath) window.history.pushState({ editVaultPage: nextPage }, '', nextPath);
    setActivePage(nextPage);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleAppNavigation = (event) => {
    const anchor = event.target.closest?.('a[href^="#"]');
    if (!anchor) return;
    const sectionToPage = {
      top: 'home', explore: 'explore', 'scene-packs': 'scene-packs',
      'clip-assembly': 'clip-assembly', editlab: 'editlab',
      library: 'library',
      'earn-points': 'earn', premium: 'accounts', creators: 'creators', requests: 'requests', how: 'how',
    };
    const target = (anchor.getAttribute('href') || '').slice(1);
    const targetPage = sectionToPage[target];
    if (!targetPage) return;
    event.preventDefault();
    navigateTo(targetPage);
  };
  useEffect(() => {
    const syncPageFromUrl = () => {
      setActivePage(resolveEditVaultPage(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', syncPageFromUrl);
    return () => window.removeEventListener('popstate', syncPageFromUrl);
  }, []);

  const [category, setCategory] = useState('All edits');
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState(0);
  const [edits, setEdits] = useState([]);
  const [purchased, setPurchased] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [previewEdit, setPreviewEdit] = useState(null);
  const [publicCreatorId, setPublicCreatorId] = useState(null);
  const [creatorStudioOpen, setCreatorStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [creatorApplicationOpen, setCreatorApplicationOpen] = useState(false);
  const [topazOpen, setTopazOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('editvault_language') || 'en');
  const tx = (en, ar) => language === 'ar' ? ar : en;

  // Authentication state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Premium accounts
  const [premiumProducts, setPremiumProducts] = useState([]);
  const [premiumOrders, setPremiumOrders] = useState([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumBuying, setPremiumBuying] = useState('');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [creatorRequests, setCreatorRequests] = useState([]);
  const [creatorQueueLoading, setCreatorQueueLoading] = useState(false);
  const [creatorReviewing, setCreatorReviewing] = useState('');
  const [creatorMembers, setCreatorMembers] = useState([]);
  const [creatorMembersLoading, setCreatorMembersLoading] = useState(false);
  const [creatorMemberEmail, setCreatorMemberEmail] = useState('');
  const [creatorMemberBusy, setCreatorMemberBusy] = useState('');
  const [premiumForm, setPremiumForm] = useState({
    title: '',
    serviceName: 'CapCut Pro',
    customServiceName: '',
    description: '',
    duration: '30 days',
    pricePoints: '',
    imageUrl: '',
    credentials: '',
  });
  const [premiumInventoryInputs, setPremiumInventoryInputs] = useState({});
  const [premiumInventoryBusy, setPremiumInventoryBusy] = useState('');
  const visiblePremiumProducts = premiumProducts.filter((product) => product.status === 'available');



useEffect(() => {
    const pageLabels = language === 'ar' ? {
      home: 'الرئيسية', explore: 'استكشف الإيديتات', 'scene-packs': 'حزم المشاهد',
      'clip-assembly': 'تجميع المقاطع', editlab: 'معمل المونتاج', earn: 'جمع النقاط',
      accounts: 'الحسابات', creators: 'المبدعون', requests: 'طلبات التعديل', how: 'كيف يعمل الموقع',
    
      library: 'ظ…ظƒطھط¨طھظٹ',
    } : {
      home: 'Home', explore: 'Explore Edits', 'scene-packs': 'Scene Packs',
      'clip-assembly': 'Clip Assembly', editlab: 'EditLab', earn: 'Earn Points',
      accounts: 'Accounts', creators: 'Creators', requests: 'Creator Requests',
      how: 'How It Works',
    
      library: 'My Library',
    };
    document.title = `EditVault · ${pageLabels[activePage] || pageLabels.home || 'Home'}`;
  }, [activePage, language]);

  useEffect(() => {
    localStorage.setItem('editvault_language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  // Restore the saved session when the page loads.
  useEffect(() => {
    const token = localStorage.getItem('editvault_token');

    if (!token) return;

    let cancelled = false;

    const restoreSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem('editvault_token');
          localStorage.removeItem('editvault_user');

          if (!cancelled) setUser(null);
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data.user || data);
        }
      } catch (error) {
        console.error('Session restore failed:', error);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Enrich the authenticated account with profile-photo data from the profile API.
  useEffect(() => {
    const token = localStorage.getItem('editvault_token');
    if (!user?.id || !token) return undefined;
    let cancelled = false;
    fetch(`${API_URL}/api/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load profile photo.');
        return data.user || data;
      })
      .then((profileUser) => {
        if (!cancelled) setUser((current) => current && current.id === profileUser.id ? { ...current, ...profileUser } : current);
      })
      .catch((error) => console.warn('Profile photo data unavailable:', error.message));
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load published edits from the backend and keep wallet/library in sync with the account.
  useEffect(() => {
    let cancelled = false;
    const loadEdits = async () => {
      try {
        const response = await fetch(`${API_URL}/api/edits`);
        if (!response.ok) throw new Error('Could not load edits.');
        const data = await response.json();
        const rows = Array.isArray(data.edits) ? data.edits : [];
        if (!cancelled) {
          setEdits(rows.map((row, index) => ({
            ...row,
            id: row.id,
            previewUrl: row.has_preview
              ? `${API_URL}/api/edits/${row.id}/preview`
              : null,
            creator: row.creator_name || 'creator',
            verified: row.verification_status === 'verified',
            price: Number(row.price_points || 0),
            sold: Boolean(row.is_sold),
            avgRating: Number(row.avg_rating || 0),
            ratingCount: Number(row.rating_count || 0),
            likes: 'â€”',
            tone: ['violet', 'blue', 'pink', 'orange', 'green', 'lavender'][index % 6],
            tag: 'ORIGINAL EDIT',
            length: '--:--',
          })));
        }
      } catch (error) {
        console.error('Loading edits failed:', error);
        if (!cancelled) setNotice(error.message || 'Could not load edits from the server.');
      }
    };
    loadEdits();
    window.addEventListener('editvault:refresh-edits', loadEdits); return () => { cancelled = true; window.removeEventListener('editvault:refresh-edits', loadEdits); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAccountData = async () => {
      const token = localStorage.getItem('editvault_token');
      if (!user || !token) {
        setPoints(0);
        setPurchased([]);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [walletResponse, libraryResponse] = await Promise.all([
          fetch(`${API_URL}/api/wallet`, { headers }),
          fetch(`${API_URL}/api/edits/mine/library`, { headers }),
        ]);
        if (!walletResponse.ok) throw new Error('Could not load your wallet.');
        if (!libraryResponse.ok) throw new Error('Could not load your library.');
        const walletData = await walletResponse.json();
        const libraryData = await libraryResponse.json();
        if (!cancelled) {
          setPoints(Number(walletData.balance || 0));
          setPurchased((libraryData.library || []).map((item) => item.id));
        }
      } catch (error) {
        console.error('Loading wallet/library failed:', error);
        if (!cancelled) setNotice(error.message || 'Could not load your account data.');
      }
    };
    loadAccountData();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadPremiumProducts = async () => {
      setPremiumLoading(true);
      try {
        const token = localStorage.getItem('editvault_token');
        const isAdmin = user?.role === 'admin';
        const endpoint = isAdmin ? `${API_URL}/api/premium/admin/products` : `${API_URL}/api/premium`;
        const response = await fetch(endpoint, { headers: isAdmin && token ? { Authorization: `Bearer ${token}` } : {} });
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
  }, [user?.role]);

  const loadPremiumOrders = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!user || !token) {
      setPremiumOrders([]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/premium/orders/mine`, {
        headers: { Authorization: `Bearer ${token}` },
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
    if (Number(product.available_stock || 0) < 1) {
      setNotice('This product is sold out. Please check back after new stock is added.');
      return;
    }

    const token = localStorage.getItem('editvault_token');
    if (!token) {
      setNotice('Your session expired. Please log in again.');
      logout();
      return;
    }

    const price = Number(product.price_points || 0);
    if (points < price) {
      setNotice(`You need ${price - points} more points for this product.`);
      return;
    }

    setPremiumBuying(product.id);
    setNotice('');

    try {
      const response = await fetch(
        `${API_URL}/api/premium/${product.id}/order`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Could not place your order.');
      }
      if (data.order) {
        setPremiumOrders((current) => [data.order, ...current.filter((item) => String(item.id) !== String(data.order.id))]);
      }

      const walletResponse = await fetch(`${API_URL}/api/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setPoints(Number(walletData.balance || 0));
      }

      await Promise.all([loadPremiumOrders(), refreshPremiumProducts().catch(() => {})]);
      setNotice('Purchase successful. Your account details are ready under My Premium Orders.');
    } catch (error) {
      setNotice(error.message || 'Could not place your order.');
    } finally {
      setPremiumBuying('');
    }
  };

  const loadAdminOrders = async () => {
    const token = localStorage.getItem('editvault_token');

    if (!user || user.role !== 'admin' || !token) {
      setAdminOrders([]);
      return;
    }

    setAdminLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/premium/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not load admin orders.');
      }

      setAdminOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setNotice(error.message || 'Could not load admin orders.');
    } finally {
      setAdminLoading(false);
    }
  };

  const loadCreatorRequests = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!user || user.role !== 'admin' || !token) {
      setCreatorRequests([]);
      return;
    }
    setCreatorQueueLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/creators/applications/queue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load creator applications.');
      setCreatorRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      setNotice(error.message || 'Could not load creator applications.');
    } finally {
      setCreatorQueueLoading(false);
    }
  };

  const loadCreatorMembers = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!user || user.role !== 'admin' || !token) {
      setCreatorMembers([]);
      return;
    }
    setCreatorMembersLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/creators`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load creator accounts.');
      setCreatorMembers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      setNotice(error.message || 'Could not load creator accounts.');
    } finally {
      setCreatorMembersLoading(false);
    }
  };

  const activateCreatorByEmail = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('editvault_token');
    const email = creatorMemberEmail.trim();
    if (!token || user?.role !== 'admin') {
      setNotice('Only an administrator can activate creator access.');
      return;
    }
    if (!email) return;
    setCreatorMemberBusy('activate-by-email');
    try {
      const response = await fetch(`${API_URL}/api/admin/creators/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not activate creator.');
      setCreatorMemberEmail('');
      setNotice(`${data.user?.display_name || data.user?.email || email} now has creator access.`);
      await loadCreatorMembers();
      await loadCreatorRequests();
    } catch (error) {
      setNotice(error.message || 'Could not activate creator.');
    } finally {
      setCreatorMemberBusy('');
    }
  };

  const setCreatorAccess = async (member, active) => {
    const token = localStorage.getItem('editvault_token');
    if (!token || user?.role !== 'admin') {
      setNotice('Only an administrator can manage creator access.');
      return;
    }
    if (!active && !window.confirm(`Remove creator access from ${member.display_name || member.email}? Their account and purchases will remain.`)) return;
    setCreatorMemberBusy(String(member.id));
    try {
      const response = await fetch(`${API_URL}/api/admin/creators/${encodeURIComponent(member.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update creator access.');
      setNotice(active ? 'Creator access activated.' : 'Creator access removed. The user account was kept.');
      await loadCreatorMembers();
      await loadCreatorRequests();
    } catch (error) {
      setNotice(error.message || 'Could not update creator access.');
    } finally {
      setCreatorMemberBusy('');
    }
  };

  const reviewCreatorRequest = async (request, decision) => {
    const token = localStorage.getItem('editvault_token');
    if (!token || user?.role !== 'admin') {
      setNotice('Only an administrator can activate creator accounts.');
      return;
    }
    const key = `${request.id}:${decision}`;
    setCreatorReviewing(key);
    try {
      const response = await fetch(`${API_URL}/api/creators/applications/${encodeURIComponent(request.id)}/review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decision === 'verified' ? 'approved' : decision,
          note: decision === 'verified' ? 'Approved by administrator.' : 'Creator access request declined by administrator.',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not review this creator request.');
      setCreatorRequests((current) => current.filter((item) => String(item.id) !== String(request.id)));
      setNotice(decision === 'verified'
        ? `${request.display_name || request.email} is now an approved creator.`
        : `Creator application for ${request.display_name || request.email} was declined.`);
      await loadCreatorRequests();
    } catch (error) {
      setNotice(error.message || 'Could not review creator request.');
    } finally {
      setCreatorReviewing('');
    }
  };

  const refreshPremiumProducts = async () => {
    const isAdmin = user?.role === 'admin';
    const token = localStorage.getItem('editvault_token');
    const endpoint = isAdmin
      ? `${API_URL}/api/premium/admin/products`
      : `${API_URL}/api/premium`;

    const response = await fetch(endpoint, {
      headers: isAdmin && token
        ? { Authorization: `Bearer ${token}` }
        : {},
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Could not refresh products.');
    }

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
    const serviceName = premiumForm.serviceName === 'Other' ? premiumForm.customServiceName.trim() : premiumForm.serviceName.trim();
    const credentialLines = premiumForm.credentials.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    if (!premiumForm.title.trim() || !serviceName || !Number.isInteger(price) || price < 1 || credentialLines.length < 1) {
      setNotice('Enter a product title, service, price, and at least one account/code line.');
      return;
    }

    setAdminSaving(true);
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/api/premium`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: premiumForm.title.trim(),
          serviceName,
          description: premiumForm.description.trim(),
          duration: premiumForm.duration.trim(),
          pricePoints: price,
          imageUrl: premiumForm.imageUrl.trim() || null,
          credentials: premiumForm.credentials,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not create product.');
      }

      setPremiumForm({
        title: '', serviceName: 'CapCut Pro', customServiceName: '', description: '',
        duration: '30 days', pricePoints: '', imageUrl: '', credentials: '',
      });

      await refreshPremiumProducts();
      setNotice(data.message || 'Product added with account stock. Purchases are delivered instantly.');
    } catch (error) {
      setNotice(error.message || 'Could not create product.');
    } finally {
      setAdminSaving(false);
    }
  };

  const addPremiumInventory = async (product) => {
    const token = localStorage.getItem('editvault_token');
    const credentials = String(premiumInventoryInputs[product.id] || '');
    if (!token || user?.role !== 'admin') { setNotice('Only the administrator can add account stock.'); return; }
    if (!credentials.split(/\r?\n/).some((line) => line.trim())) { setNotice('Add at least one account/code line.'); return; }
    setPremiumInventoryBusy(String(product.id));
    try {
      const response = await fetch(`${API_URL}/api/premium/admin/products/${encodeURIComponent(product.id)}/inventory`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not add inventory.');
      setPremiumInventoryInputs((current) => ({ ...current, [product.id]: '' }));
      await refreshPremiumProducts();
      setNotice(data.message || 'Account stock added successfully.');
    } catch (error) { setNotice(error.message || 'Could not add inventory.'); }
    finally { setPremiumInventoryBusy(''); }
  };

  const setPremiumProductStatus = async (product, status) => {
    const token = localStorage.getItem('editvault_token');

    if (!token) {
      setNotice('Your session expired. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/premium/${product.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not update product.');
      }

      await refreshPremiumProducts();

      setNotice(
        status === 'hidden'
          ? 'Product hidden.'
          : 'Product is available again.'
      );
    } catch (error) {
      setNotice(error.message || 'Could not update product.');
    }
  };

  const updatePremiumOrder = async (order, status) => {
    const token = localStorage.getItem('editvault_token');

    if (!token) {
      setNotice('Your session expired. Please log in again.');
      return;
    }

    const action =
      status === 'completed'
        ? 'mark this order as completed'
        : 'reject this order and refund its points';

    if (!window.confirm(`Are you sure you want to ${action}?`)) return;

    try {
      const response = await fetch(
        `${API_URL}/api/premium/orders/${order.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not update order.');
      }

      await loadAdminOrders();
      await loadPremiumOrders();

      setNotice(
        status === 'completed'
          ? 'Order marked as completed.'
          : 'Order rejected. Points refund processed.'
      );
    } catch (error) {
      setNotice(error.message || 'Could not update order.');
    }
  };

  useEffect(() => {
    loadAdminOrders();
    loadCreatorRequests();
    loadCreatorMembers();
  }, [user?.id, user?.role]);

  const filtered = useMemo(
    () =>
      edits.filter(
        (edit) =>
          (category === 'All edits' || edit.category === category) &&
          `${edit.title} ${edit.creator} ${edit.category}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [category, query]
  );

  const resetAuthForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setAuthLoading(false);
  };

  const openAuth = (type) => {
    resetAuthForm();
    setNotice('');
    setModal(type);
  };

  const canAccessCreatorStudio = Boolean(user && (user.role === 'admin' || user.role === 'creator'));

  const openCreatorArea = () => {
    if (!user) {
      openAuth('signup');
      return;
    }
    if (canAccessCreatorStudio) {
      setCreatorStudioOpen(true);
      return;
    }
    setCreatorApplicationOpen(true);
  };

  const logout = () => {
    localStorage.removeItem('editvault_token');
    localStorage.removeItem('editvault_user');

    setUser(null);
    resetAuthForm();
    setModal('');

    setNotice('You have been logged out successfully.');
  };

  // Real signup/login API integration.
  const submitAuth = async (event) => {
    event.preventDefault();

    if (authLoading) return;

    const isSignup = modal === 'signup';

    if (isSignup && !displayName.trim()) {
      setNotice('Please enter your display name.');
      return;
    }

    if (password.length < 8) {
      setNotice('Password must be at least 8 characters.');
      return;
    }

    setAuthLoading(true);
    setNotice('');

    try {
      const endpoint = isSignup
        ? '/api/auth/signup'
        : '/api/auth/login';

      const payload = isSignup
        ? {
            displayName: displayName.trim(),
            email: email.trim(),
            password,
            referralCode: localStorage.getItem('editvault_referral_code') || new URLSearchParams(window.location.search).get('ref') || '',
          }
        : {
            email: email.trim(),
            password,
          };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            (response.status === 409
              ? 'An account with this email already exists.'
              : 'Authentication failed. Please try again.')
        );
      }

      if (!data.token || !data.user) {
        throw new Error(
          'The server response is missing the account or authentication token.'
        );
      }

      // Save the real authentication session.
      localStorage.setItem('editvault_token', data.token);
      localStorage.setItem('editvault_user', JSON.stringify(data.user));
      if (isSignup) localStorage.removeItem('editvault_referral_code');

      setUser(data.user);
      setModal('');
      resetAuthForm();

      setNotice(
        isSignup
          ? 'Your EditVault account was created successfully!'
          : 'Welcome back! You are now logged in.'
      );
    } catch (error) {
      console.error('Authentication error:', error);

      setNotice(
        error.message ||
          'Could not connect to the server. Make sure the backend is running.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const downloadEdit = async (edit) => {
    const token = localStorage.getItem('editvault_token');
    if (!token) {
      setNotice('Please log in again to download your edit.');
      openAuth('login');
      return;
    }
    try {
      const response = await fetch(API_URL + '/api/edits/' + edit.id + '/download', { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed. Please try again.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : (String(edit.title || 'edit').replace(/[^a-z0-9._-]+/gi, '-') || 'edit') + '.mp4';
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      setNotice('Downloading â€œ' + edit.title + 'â€‌.');
    } catch (error) {
      setNotice(error.message || 'Download failed.');
    }
  };

  const buy = async (edit) => {
    if (!user) {
      setNotice('Please log in before unlocking an edit.');
      openAuth('login');
      return;
    }
    if (purchased.includes(edit.id)) {
      setNotice(`You already own "${edit.title}".`);
      return;
    }
    if (purchaseLoading) return;

    const token = localStorage.getItem('editvault_token');
    if (!token) {
      setNotice('Your session expired. Please log in again.');
      logout();
      return;
    }

    setPurchaseLoading(true);
    setNotice('');
    try {
      const response = await fetch(`${API_URL}/api/edits/${edit.id}/purchase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || 'Purchase failed.');

      setPurchased((current) => current.includes(edit.id) ? current : [...current, edit.id]);
      // Fetch the server's balance after purchase; never calculate a trusted balance in the browser.
      const walletResponse = await fetch(`${API_URL}/api/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setPoints(Number(walletData.balance || 0));
      }
      setNotice(`Unlocked "${edit.title}". It is now in your library.`);
    } catch (error) {
      setNotice(error.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <div className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'} data-language={language} data-page={activePage} onClick={handleAppNavigation}>
      <AccountSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} user={user} language={language} onLanguageChange={setLanguage} onNotice={setNotice} onUserUpdate={(updatedUser) => setUser((current) => ({ ...current, ...updatedUser }))} />
      <ProfileSettings open={profileOpen} onClose={() => setProfileOpen(false)} user={user} onNotice={setNotice} onUserUpdate={(updatedUser) => setUser((current) => ({ ...current, ...updatedUser }))} />
      <CreatorApplication open={creatorApplicationOpen} onClose={() => setCreatorApplicationOpen(false)} user={user} onNotice={setNotice} onUserUpdate={(updatedUser) => setUser((current) => { const next = { ...(current || {}), ...updatedUser }; localStorage.setItem('editvault_user', JSON.stringify(next)); return next; })} />
      <TopazAdmin open={topazOpen} onClose={() => setTopazOpen(false)} user={user} onNotice={setNotice} />
      <CreatorStudio open={creatorStudioOpen} onClose={() => setCreatorStudioOpen(false)} user={user} onNotice={setNotice} onOpenProfile={() => setProfileOpen(true)} />
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <Clapperboard size={20} />
          </span>

          <span>
            EDIT<span className="brand-accent">VAULT</span>
            <small>{tx('CREATOR MARKETPLACE', 'سوق المبدعين')}</small>
          </span>
        </a>

        <nav className={mobileNav ? 'nav open' : 'nav'} aria-label={tx("Marketplace navigation", "التنقل الرئيسي")}>
          <a className={activePage === 'explore' ? 'nav-active' : ''} href="#explore" onClick={() => setMobileNav(false)}>{tx('Explore', 'استكشف')}</a>
          <a className={activePage === 'scene-packs' ? 'nav-active' : ''} href="#scene-packs" onClick={() => setMobileNav(false)}>{tx('Scene Packs', 'حزم المشاهد')}</a>
          <a className={activePage === 'editlab' ? 'nav-active' : ''} href="#editlab" onClick={() => setMobileNav(false)}>EditLab</a>
          <a className={activePage === 'earn' ? 'nav-active' : ''} href="#earn-points" onClick={() => setMobileNav(false)}>{tx('Earn Points', 'اجمع النقاط')}</a>
          <a className={activePage === 'accounts' ? 'nav-active' : ''} href="#premium" onClick={() => setMobileNav(false)}>{tx('Accounts', 'الحسابات')}</a>
          <a className={activePage === 'clip-assembly' ? 'nav-active' : ''} href="#clip-assembly" onClick={() => setMobileNav(false)}>{tx('Clip Assembly', 'تجميع المقاطع')}</a>
          <a className={activePage === 'creators' ? 'nav-active' : ''} href="#creators" onClick={() => setMobileNav(false)}>{tx('Creators', 'المبدعون')}</a>
          <a className={activePage === 'how' ? 'nav-active' : ''} href="#how" onClick={() => setMobileNav(false)}>{tx('How it works', 'كيف يعمل الموقع')}</a>
          <a className={activePage === 'requests' ? 'nav-active' : ''} href="#requests" onClick={() => setMobileNav(false)}>{language === 'ar' ? 'طلبات التعديل' : language === 'es' ? 'Solicitudes' : 'Requests'}</a>
        
          <a className={activePage === 'library' ? 'nav-active' : ''} href="#library" onClick={() => setMobileNav(false)}>My Library</a>
        </nav>

        <div className="top-actions">
          <button
            className="points-pill"
            onClick={() => setModal('points')}
          >
            <Coins size={16} />
            <b>{points}</b>
            <span>{tx('PTS', 'نقطة')}</span>
          </button>

          <button className="login-btn settings-access-btn" type="button" onClick={() => setSettingsOpen(true)} title={tx("Account settings", "إعدادات الحساب")}>
            <Settings2 size={14} /> <span>{language === 'ar' ? 'الإعدادات' : language === 'es' ? 'Ajustes' : 'Settings'}</span>
          </button>

          {user ? (
            <>
              <button className="account-identity" type="button" onClick={() => setProfileOpen(true)} title={user.email || 'Open profile'}>
                <span className="account-avatar">
                  {user.avatar_data_url ? <img src={user.avatar_data_url} alt="" /> : <span>{String(user.displayName || user.display_name || user.email || 'U').trim().charAt(0).toUpperCase()}</span>}
                </span>
                <span className="account-identity-copy">
                  <strong>{user.displayName || user.display_name || user.email}</strong>
                  {user.role === 'admin' ? <small className="role-pill role-admin">{tx('Administrator', 'مدير')}</small> : user.role === 'creator' ? <small className="role-pill role-creator"><BadgeCheck size={11} /> {tx('Creator', 'مبدع')}</small> : <small className="role-pill">{tx('Member', 'عضو')}</small>}
                </span>
              </button>

              {canAccessCreatorStudio ? (
                <button className="creator-access-btn" onClick={() => setCreatorStudioOpen(true)}>{tx('Creator Studio', 'استوديو المبدع')}</button>
              ) : (
                <button className="creator-access-btn" onClick={() => setCreatorApplicationOpen(true)}>{tx('Apply as creator', 'قدّم كصانع محتوى')}</button>
              )}
              {user.role === 'admin' && <button className="admin-access-btn" onClick={() => document.getElementById('creator-admin-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{tx('Admin', 'الإدارة')}</button>}
              {user.role === 'admin' && <button className="admin-access-btn" type="button" onClick={() => setTopazOpen(true)}>Topaz AI</button>}
              <button className="login-btn profile-access-btn" onClick={() => setProfileOpen(true)}>{tx('Profile', 'الملف الشخصي')}</button>
              <button className="login-btn" onClick={logout}>{tx('Log out', 'تسجيل الخروج')}</button>
            </>
          ) : (
            <>
              <button
                className="login-btn"
                onClick={() => openAuth('login')}
              >
                {tx('Log in', 'تسجيل الدخول')}
              </button>

              <button
                className="signup-btn"
                onClick={() => openAuth('signup')}
              >
                {tx('Join free', 'انضم مجانًا')} <ArrowUpRight size={15} />
              </button>
            </>
          )}

          <button
            className="mobile-menu"
            onClick={() => setMobileNav((value) => !value)}
            aria-label="Toggle menu"
          >
            {mobileNav ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" />
              {tx('MADE BY CREATORS. OWNED BY YOU.', 'من المبدعين وإليهم')}
            </div>

            <h1>
              {tx('Your next edit.', 'الإيديت اللي بتدور عليه')}
              <br />
              <span>{tx('One click away.', 'على بُعد ضغطة واحدة')}</span>
            </h1>

            <p>
              {tx('Discover original edits from independent creators. Support the talent, unlock the full-quality video, and make it yours.', 'اكتشف إيديتات أصلية من مبدعين مستقلين. ادعم أصحابها وافتح الفيديو بجودته الأصلية، واستخدمه حسب الترخيص.')}
            </p>

            <div className="hero-buttons">
              <a className="primary-cta" href="#explore">
                {tx('Explore edits', 'استكشف الإيديتات')} <ArrowUpRight size={17} />
              </a>

              <button className="secondary-cta" onClick={openCreatorArea}>
                {canAccessCreatorStudio ? <Video size={16} /> : <UserRound size={16} />}
                {canAccessCreatorStudio ? tx('Creator Studio', 'استوديو المبدع') : tx('Become a creator', 'ابدأ كمبدع')}
              </button>
            </div>

            <div className="hero-proof">
              <div className="avatar-stack">
                <i>k</i>
                <i>n</i>
                <i>m</i>
                <i>z</i>
              </div>

              <span>
                <b>{tx('Creator-first', 'المبدع أولًا')}</b>
                <br />
                {tx('A marketplace built on credit, not reposts.', 'سوق يحفظ حق المبدع وينسب العمل لصاحبه.')}
              </span>
            </div>
          </div>

          <div className="hero-art">
            <div className="art-glow" />

            <div className="poster poster-back">
              <span className="poster-mini">EV / 002</span>
              <div className="poster-lines">
                NO
                <br />
                LIMITS
              </div>
              <span className="poster-bottom">
                ORIGINAL CREATOR EDIT
              </span>
            </div>

            <div className="poster poster-front">
              <div className="poster-top">
                <span>FEATURED DROP</span>
                <span className="poster-dot" />
              </div>

              <div className="poster-orb" />

              <div className="poster-title">
                AFTER
                <br />
                <em>DARK</em>
              </div>

              <div className="poster-foot">
                <span>
                  kairo.fx <BadgeCheck size={12} />
                </span>
                <span>00:18 / 4K</span>
              </div>

              <div className="play-float">
                <Play size={17} fill="currentColor" />
              </div>
            </div>

            <div className="floating-chip chip-top">
              <Sparkles size={15} /> Creator verified
            </div>

            <div className="floating-chip chip-bottom">
              <Coins size={16} />
              <span>
                <b>80 points</b>
                <small>Unlock original</small>
              </span>
            </div>
          </div>
        </section>

        <section className="stats-row">
          <div>
            <strong>01</strong>
            <span>{tx('Find your style', 'اختار ستايلك')}</span>
          </div>

          <div>
            <strong>02</strong>
            <span>{tx('Earn points from rewarded ads', 'اجمع النقاط من الإعلانات المؤهلة')}</span>
          </div>

          <div>
            <strong>03</strong>
            <span>{tx('Unlock the original', 'افتح الملف الأصلي')}</span>
          </div>

          <div className="stats-note">
            <ShieldCheck size={18} />
            <span>
              {tx('Credit the creator.', 'احفظ حق المبدع.')}
              <br />
              <b>{tx('Always.', 'دائمًا.')}</b>
            </span>
          </div>
        </section>

        <section className="market-section" id="explore">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{tx('THE DROP ZONE / 001', 'اكتشف الإيديتات / ٠٠١')}</div>
              <h2>
                {tx('Find your', 'اكتشف')} <span>{tx('next favorite.', 'إيديتك المفضل.')}</span>
              </h2>
              <p>{tx('Handpicked edits. Real creators. Original quality.', 'إيديتات مختارة من مبدعين حقيقيين وبجودة أصلية.')}</p>
            </div>

            <button
              className="view-all"
              onClick={() => {
                setCategory('All edits');
                setQuery('');
              }}
            >
              {tx('View all edits', 'عرض كل الإيديتات')} <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="market-controls">
            <div className="category-tabs">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={
                    category === item
                      ? 'category-tab selected'
                      : 'category-tab'
                  }
                >
                  {language === 'ar' ? ({ 'All edits': 'كل الإيديتات', Anime: 'أنمي', Cinematic: 'سينمائي', Aesthetic: 'جمالي', Gaming: 'ألعاب', AMV: 'AMV', Other: 'أخرى' }[item] || item) : item}
                </button>
              ))}
            </div>

            <label className="search-box">
              <Search size={17} />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx("Search edits or creators...", "ابحث عن إيديت أو مبدع...")}
              />

              <SlidersHorizontal
                size={16}
                className="search-filter"
              />
            </label>
          </div>

          <div className="edit-grid">
            {filtered.map((edit, index) => (
              <article className="edit-card" key={edit.id}>
                <div className="edit-cover">
                  {edit.previewUrl ? (
                    <video
                      className="edit-preview-video"
                      src={edit.previewUrl}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-label={`Video preview: ${edit.title}`}
                      onClick={() => setPreviewEdit(edit)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(event) => {
                        const playback = event.currentTarget.play();
                        if (playback && typeof playback.catch === 'function') playback.catch(() => {});
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.pause();
                        try { event.currentTarget.currentTime = 0; } catch {}
                      }}
                    />
                  ) : (
                    <div className="edit-no-preview">{tx('No preview available', 'لا توجد معاينة')}</div>
                  )}
                  <div className="cover-noise" />

                  <div className="cover-top">
                    <span>{tx('PUBLIC PREVIEW', 'معاينة عامة')}</span>
                    <button
                      aria-label={tx("Save edit", "حفظ الإيديت")}
                      onClick={() => {
                        if (!user) {
                          setNotice(tx('Sign in to save edits to your favorites.', 'سجّل الدخول لحفظ الإيديتات في المفضلة.'));
                          openAuth('login');
                        } else {
                          setNotice(tx('Favorites are coming soon.', 'قائمة المفضلة ستتوفر قريبًا.'));
                        }
                      }}
                    >
                      <Heart size={16} />
                    </button>
                  </div>

                  <div className="cover-art">
                    <span className="cover-title">{edit.title}</span>
                  </div>

                  <span className="duration">{tx('PREVIEW', 'معاينة')}</span>

                  <button
                    className="preview-play"
                    aria-label={`${tx("Preview", "معاينة")} ${edit.title}`}
                    onClick={() => {
                      if (edit.previewUrl) setPreviewEdit(edit);
                      else setNotice(tx('Preview is not available for this edit yet.', 'معاينة هذا الإيديت غير متاحة حاليًا.'));
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>

                <div className="card-body">
                  <div className="creator-line">
                    <span className="creator-avatar">
                      {edit.creator[0]}
                    </span>

                    <button type="button" className="creator-name creator-profile-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (edit.creator_id) { setPreviewEdit(null); setPublicCreatorId(edit.creator_id); } else { setNotice(tx('Creator profile is not available.', 'صفحة المبدع غير متاحة حاليًا.')); } }}>@{edit.creator}</button>

                    {edit.verified && (
                      <span
                        className="verified"
                        title={tx("Verified creator", "مبدع موثّق")}
                      >
                        <BadgeCheck size={15} />
                      </span>
                    )}

                    <span className="likes">
                      <Heart size={12} />
                      {edit.likes}
                    </span>
                  </div>

                  <h3>{edit.title}</h3>
                  <div className="ev-card-review-summary" aria-label={String(Number(edit.avgRating || 0).toFixed(1)) + " out of 5, " + String(edit.ratingCount || 0) + " ratings"}>
                    <span className="ev-card-review-stars" aria-label={"Rating " + Number(edit.avgRating || 0).toFixed(1) + " out of 5"}>{String.fromCharCode(9733).repeat(Math.max(0, Math.min(5, Math.round(Number(edit.avgRating || 0)))))}{String.fromCharCode(9734).repeat(5 - Math.max(0, Math.min(5, Math.round(Number(edit.avgRating || 0)))))}</span>
                    <span className="ev-review-score">{edit.ratingCount ? Number(edit.avgRating || 0).toFixed(1) : (document.documentElement.dir === 'rtl' ? 'جديد' : 'New')}</span>
                    <span className="ev-card-review-count">{edit.ratingCount ? (document.documentElement.dir === 'rtl' ? '(' + edit.ratingCount + ' تقييم)' : '(' + edit.ratingCount + ' ratings)') : (document.documentElement.dir === 'rtl' ? 'لا توجد تقييمات بعد' : 'No ratings yet')}</span>
                    {edit.sold && !purchased.includes(edit.id) && <span className="ev-sold-badge">ONE-OF-ONE آ· SOLD</span>}
                  </div>

                  <div className="card-footer">
                    <span className="price">
                      <Coins size={16} />
                      <b>{edit.price}</b>
                      <small>{tx('PTS', 'نقطة')}</small>
                    </span>

                    <button
                      className={purchased.includes(edit.id) ? 'buy-btn owned' : edit.sold ? 'buy-btn sold' : 'buy-btn'}
                      disabled={!purchased.includes(edit.id) && (Boolean(edit.sold) || purchaseLoading)}
                      onClick={() => purchased.includes(edit.id) ? downloadEdit(edit) : buy(edit)}
                    >
                      {purchased.includes(edit.id) ? (
                        <><Download size={14} /> Download</>
                      ) : edit.sold ? (
                        'Sold out'
                      ) : purchaseLoading ? (
                        'Processing...'
                      ) : (
                        <>Buy once <ArrowUpRight size={14} /></>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              {tx('No public previews yet for this search. Try another category, or check back after creators upload preview clips.', 'لا توجد معاينات مطابقة حاليًا. جرّب تصنيفًا آخر أو ارجع بعد رفع المبدعين لمعاينات جديدة.')}
            </div>
          )}
        </section>

        <MarketplaceSections
          user={user}
          language={language}
          onNotice={setNotice}
          onLoginRequest={() => openAuth('login')}
          onPointsChange={setPoints}
        />

        <EditLabRewards user={user} language={language} onNotice={setNotice} onLoginRequest={() => openAuth('login')} onPointsChange={setPoints} />

        <section className="premium-section" id="premium">
          <div className="premium-heading">
            <div>
              <div className="eyebrow">{tx('EXCLUSIVE ACCESS', 'وصول مميز')}</div>
              <h2>{tx('Premium', 'حسابات')} <span>{tx('Accounts.', 'مميزة')}</span></h2>
              <p>{tx('Choose a service and receive your account details instantly after purchase.', 'اختار الخدمة واستلم بيانات الحساب فور نجاح الشراء.')}</p>
            </div>
            <span className="premium-count">
              {visiblePremiumProducts.length} {tx('AVAILABLE', 'متاحة')}
            </span>
          </div>

          {premiumLoading ? (
            <div className="premium-empty">{tx('Loading premium products...', 'جارٍ تحميل الحسابات...')}</div>
          ) : visiblePremiumProducts.length === 0 ? (
            <div className="premium-empty">
              {tx('No premium products are available right now.', 'لا توجد حسابات متاحة حاليًا.')}
            </div>
          ) : (
            <div className="premium-grid">
              {visiblePremiumProducts.map((product) => (
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
                    <p>{product.description || tx('Premium digital access.', 'وصول رقمي مميز.')}</p>
                    {product.duration && (
                      <span className="premium-duration">{product.duration}</span>
                    )}
                    <span className={`premium-stock ${Number(product.available_stock || 0) < 1 ? 'is-empty' : ''}`}>
                      {Number(product.available_stock || 0) > 0
                        ? tx(`${product.available_stock} available for instant delivery`, `متاح ${product.available_stock} للتسليم الفوري`)
                        : tx('Sold out', 'نفد المخزون')}
                    </span>

                    <div className="premium-card-footer">
                      <span className="price">
                        <Coins size={16} />
                        <b>{Number(product.price_points || 0)}</b>
                        <small>{tx('PTS', 'نقطة')}</small>
                      </span>

                      <button
                        className="buy-btn"
                        disabled={Boolean(premiumBuying) || Number(product.available_stock || 0) < 1}
                        onClick={() => buyPremium(product)}
                      >
                        {premiumBuying === product.id
                          ? tx('Processing...', 'جارٍ التنفيذ...')
                          : Number(product.available_stock || 0) < 1 ? tx('Sold out', 'نفد المخزون') : tx('Buy & receive instantly', 'اشترِ واستلم فورًا')}
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
                <h3>{tx('My premium orders', 'طلباتي')}</h3>
              </div>

              {premiumOrders.length === 0 ? (
                <p className="premium-empty">{tx("You haven't placed any orders yet.", 'لم تقم بأي طلبات حتى الآن.')}</p>
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
                          {' آ· '}
                          {Number(order.price_points || 0)} points
                        </small>
                      </div>
                      <span className={`premium-status status-${order.status}`}>
                        {order.delivery_data ? tx('Delivered instantly', 'تم التسليم فورًا') : order.status === 'pending'
                          ? tx('Pending', 'قيد الانتظار')
                          : order.status === 'completed'
                          ? tx('Completed', 'مكتمل')
                          : order.status === 'rejected'
                          ? tx('Rejected / refunded', 'مرفوض / تم رد النقاط')
                          : order.status}
                      </span>
                      {order.delivery_data && <div className="premium-delivery" dir="auto"><div className="premium-delivery-heading"><strong>{tx('Your account details', 'بيانات حسابك')}</strong><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(order.delivery_data); setNotice(tx('Account details copied.', 'تم نسخ بيانات الحساب.')); } catch { setNotice(tx('Select the details and copy them manually.', 'حدد البيانات وانسخها يدويًا.')); } }}>{tx('Copy details', 'نسخ البيانات')}</button></div><pre>{order.delivery_data}</pre><small>{tx('Keep these details private and store them safely.', 'احتفظ بالبيانات في مكان آمن ولا تشاركها مع الآخرين.')}</small></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="premium-admin">
              <div className="creator-admin-queue" id="creator-admin-queue">
                <div className="creator-admin-queue-heading">
                  <div><div className="eyebrow">ACCESS CONTROL</div><h2>Creator applications</h2><p>Applications are reviewed by an administrator. Creator access is separate from public profile details and verification.</p></div>
                  <span className="creator-queue-count">{creatorRequests.length} pending</span>
                </div>
                {creatorQueueLoading ? <div className="creator-queue-empty">Loading creator applications…</div> : creatorRequests.length === 0 ? <div className="creator-queue-empty"><ShieldCheck size={20} /><strong>No pending requests</strong><span>New creator applications will appear here.</span></div> : (
                  <div className="creator-request-list">
                    {creatorRequests.map((request) => {
                      const approveKey = `${request.id}:verified`;
                      const rejectKey = `${request.id}:rejected`;
                      const isReviewing = creatorReviewing === approveKey || creatorReviewing === rejectKey;
                      return <article className="creator-request-card" key={request.id}>
                        <div className="creator-request-avatar">{String(request.display_name || request.email || 'C').trim().charAt(0).toUpperCase()}</div>
                        <div className="creator-request-info"><strong>{request.display_name || 'Unnamed member'}</strong><span>{request.email}</span>{request.tiktok_url && <a href={request.tiktok_url} target="_blank" rel="noreferrer">Open TikTok profile <ExternalLink size={12} /></a>}{request.portfolio_url && <a href={request.portfolio_url} target="_blank" rel="noreferrer">Open portfolio / example <ExternalLink size={12} /></a>}{request.message && <p>{request.message}</p>}<small>Applied {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'recently'}</small></div>
                        <div className="creator-request-actions"><button type="button" className="approve-creator-btn" disabled={isReviewing} onClick={() => reviewCreatorRequest(request, 'verified')}>{creatorReviewing === approveKey ? 'Activating…' : 'Approve creator'}</button><button type="button" className="reject-creator-btn" disabled={isReviewing} onClick={() => reviewCreatorRequest(request, 'rejected')}>{creatorReviewing === rejectKey ? 'Rejecting…' : 'Reject'}</button></div>
                      </article>;
                    })}
                  </div>
                )}
              </div>

              <section className="creator-member-manager" aria-labelledby="creator-member-manager-title">
                <div className="creator-member-manager-heading">
                  <div><div className="eyebrow">DIRECT ACCESS</div><h2 id="creator-member-manager-title">Creator account management</h2><p>Activate an existing member by email, or remove creator privileges without deleting their account or purchase history.</p></div>
                  <span className="creator-queue-count">{creatorMembers.filter((member) => member.role === 'creator').length} active creators</span>
                </div>
                <form className="creator-member-add-form" onSubmit={activateCreatorByEmail}>
                  <label htmlFor="creator-member-email">Activate an existing account</label>
                  <div><input id="creator-member-email" type="email" required maxLength={254} value={creatorMemberEmail} onChange={(event) => setCreatorMemberEmail(event.target.value)} placeholder="member@example.com" autoComplete="email" /><button type="submit" className="approve-creator-btn" disabled={creatorMemberBusy === 'activate-by-email'}><UserPlus size={15}/>{creatorMemberBusy === 'activate-by-email' ? 'Activating…' : 'Add creator'}</button></div>
                  <small>The email must belong to an account that already exists. The server enforces administrator permissions.</small>
                </form>
                <div className="creator-member-list-heading"><strong>Accounts</strong><button type="button" className="creator-member-refresh" onClick={loadCreatorMembers} disabled={creatorMembersLoading}>{creatorMembersLoading ? 'Refreshing…' : 'Refresh list'}</button></div>
                {creatorMembersLoading ? <div className="creator-queue-empty">Loading accounts…</div> : creatorMembers.length === 0 ? <div className="creator-queue-empty">No member accounts to manage.</div> : <div className="creator-member-list">
                  {creatorMembers.map((member) => {
                    const activeCreator = member.role === 'creator';
                    const pendingCreator = false;
                    return <article className="creator-member-row" key={member.id}>
                      <div className="creator-member-avatar">{String(member.display_name || member.email || 'M').trim().charAt(0).toUpperCase()}</div>
                      <div className="creator-member-details"><strong>{member.display_name || 'Unnamed member'}</strong><span>{member.email}</span><small>{activeCreator ? 'Creator access approved' : 'Member account'}</small></div>
                      {activeCreator ? <button type="button" className="reject-creator-btn creator-member-action" disabled={creatorMemberBusy === String(member.id)} onClick={() => setCreatorAccess(member, false)}><UserMinus size={14}/>{creatorMemberBusy === String(member.id) ? 'Removing…' : 'Remove creator'}</button> : <button type="button" className="approve-creator-btn creator-member-action" disabled={creatorMemberBusy === String(member.id)} onClick={() => setCreatorAccess(member, true)}><UserPlus size={14}/>{creatorMemberBusy === String(member.id) ? 'Activating…' : 'Activate creator'}</button>}
                    </article>;
                  })}
                </div>}
              </section>

              <div className="premium-admin-heading">
                <div className="eyebrow">ADMIN CONTROL</div>
                <h2>Premium Accounts Dashboard</h2>
                <p>Manage premium products and customer orders.</p>
              </div>

              <div className="premium-admin-subsection">
                <h3>Add a premium product</h3>

                <form className="premium-admin-form" onSubmit={createPremiumProduct}>
                  <label>
                    Product title
                    <input
                      value={premiumForm.title}
                      onChange={(e) => setPremiumForm({ ...premiumForm, title: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Service / platform
                    <select value={premiumForm.serviceName} onChange={(e) => setPremiumForm({ ...premiumForm, serviceName: e.target.value })} required>
                      {PREMIUM_SERVICE_OPTIONS.map((service) => <option key={service} value={service}>{service}</option>)}
                    </select>
                  </label>
                  {premiumForm.serviceName === 'Other' && <label>Custom service name<input value={premiumForm.customServiceName} onChange={(e) => setPremiumForm({ ...premiumForm, customServiceName: e.target.value })} required maxLength={100} placeholder="Enter platform name" /></label>}

                  <label>
                    Duration
                    <input
                      value={premiumForm.duration}
                      onChange={(e) => setPremiumForm({ ...premiumForm, duration: e.target.value })}
                      placeholder="30 days"
                    />
                  </label>

                  <label>
                    Price in points
                    <input
                      type="number"
                      min="1"
                      value={premiumForm.pricePoints}
                      onChange={(e) => setPremiumForm({ ...premiumForm, pricePoints: e.target.value })}
                      required
                    />
                  </label>

                  <label className="premium-admin-full">
                    Image URL
                    <input
                      type="url"
                      value={premiumForm.imageUrl}
                      onChange={(e) => setPremiumForm({ ...premiumForm, imageUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </label>

                  <label className="premium-admin-full">
                    Description
                    <textarea
                      rows="3"
                      value={premiumForm.description}
                      onChange={(e) => setPremiumForm({ ...premiumForm, description: e.target.value })}
                    />
                  </label>

                  <label className="premium-admin-full">
                    Account stock (one account or access code per line)
                    <textarea rows="7" value={premiumForm.credentials} onChange={(e) => setPremiumForm({ ...premiumForm, credentials: e.target.value })} required placeholder={'email@example.com | password\nnext-account@example.com | password\nOR one activation code per line'} />
                    <small>These entries are encrypted at rest. Only you can add stock; each successful purchase delivers one entry to that buyer.</small>
                  </label>
                  <button type="submit" disabled={adminSaving}>
                    {adminSaving ? 'Saving...' : 'Add product & stock'}
                  </button>
                </form>
              </div>

              <div className="premium-admin-subsection">
                <h3>Manage products</h3>

                {premiumProducts.length === 0 ? (
                  <p>No products found.</p>
                ) : (
                  <div className="premium-admin-list">
                    {premiumProducts.map((product) => (
                      <div className="premium-admin-item" key={product.id}>
                        <div className="premium-admin-item-info">
                          <strong>{product.title}</strong>
                          <span>
                            {product.service_name || 'Premium'} · {product.price_points} points
                          </span>
                          <small>Status: {product.status || 'available'} · {Number(product.available_stock || 0)} available · {Number(product.sold_count || 0)} sold</small>
                          <form className="premium-inventory-form" onSubmit={(event) => { event.preventDefault(); addPremiumInventory(product); }}>
                            <label>Restock accounts / codes (one per line)
                              <textarea rows="3" value={premiumInventoryInputs[product.id] || ''} onChange={(event) => setPremiumInventoryInputs((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="account@example.com | password" />
                            </label>
                            <button type="submit" disabled={premiumInventoryBusy === String(product.id)}>{premiumInventoryBusy === String(product.id) ? 'Adding…' : 'Add inventory'}</button>
                          </form>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setPremiumProductStatus(
                              product,
                              product.status === 'hidden' ? 'available' : 'hidden'
                            )
                          }
                        >
                          {product.status === 'hidden' ? 'Show product' : 'Hide product'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="premium-admin-subsection">
                <h3>Customer orders</h3>

                {adminLoading ? (
                  <p>Loading orders...</p>
                ) : adminOrders.length === 0 ? (
                  <p>No customer orders yet.</p>
                ) : (
                  <div className="premium-admin-list">
                    {adminOrders.map((order) => (
                      <div className="premium-admin-item" key={order.id}>
                        <div className="premium-admin-item-info">
                          <strong>
                            {order.title || order.service_name || 'Premium order'}
                          </strong>
                          <span>
                            Customer: {order.buyer_name || order.buyer_email || order.user_id || 'Unknown'}
                          </span>
                          <span>{Number(order.price_points || 0)} points</span>
                          <small>Status: {order.status}</small>
                        </div>

                        {order.status === 'pending' && (
                          <div className="premium-admin-actions">
                            <button
                              type="button"
                              onClick={() => updatePremiumOrder(order, 'completed')}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePremiumOrder(order, 'rejected')}
                            >
                              Reject &amp; refund
                            </button>
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

        <section className={`creator-banner ${canAccessCreatorStudio ? 'creator-banner-enabled' : ''}`} id="creators">
          <div className="creator-banner-icon">
            {canAccessCreatorStudio ? <BadgeCheck size={28} /> : <Clapperboard size={28} />}
          </div>

          <div>
            <div className="eyebrow">
              {canAccessCreatorStudio ? tx('APPROVED CREATOR WORKSPACE', 'مساحة المبدع المعتمدة') : tx('FOR THE ONES BEHIND THE EDIT', 'لصنّاع الإيديتات')}
            </div>

            <h2>
              {canAccessCreatorStudio ? <>{tx('Ready for your next', 'جاهز تنشر')} <span>{tx('drop?', 'إيديتك الجاي؟')}</span></> : <>{tx('Your work deserves', 'شغلك يستحق')} <span>{tx('more than a repost.', 'أكتر من مجرد إعادة نشر.')}</span></>}
            </h2>

            <p>
              {canAccessCreatorStudio
                ? tx('Your creator access is active. Open Creator Studio to publish edits and manage your catalog.', 'حساب المبدع اتفعّل. افتح استوديو المبدع لنشر إيديتاتك وإدارة أعمالك.')
                : tx('Apply separately for creator access. Your public profile and profile settings will not be changed by the application.', 'قدّم طلب الانضمام بشكل مستقل؛ طلب المبدع لا يغيّر بيانات ملفك العام أو إعداداته.')}
            </p>
          </div>

          <button className="primary-cta" onClick={openCreatorArea}>
            {canAccessCreatorStudio ? tx('Open Creator Studio', 'افتح استوديو المبدع') : tx('Apply as creator', 'قدّم كمبدع')} <ArrowUpRight size={17} />
          </button>
        </section>

        <section className="how-section" id="how">
          <div className="eyebrow">{tx('SIMPLE BY DESIGN', 'بسيط من البداية')}</div>

          <h2>
            {tx('Good edits.', 'إيديتات حلوة.')} <span>{tx('Good credit.', 'وحقوق محفوظة.')}</span>
          </h2>

          <div className="how-grid">
            <div>
              <span className="step-no">01</span>
              <Search />
              <h3>{tx('Discover', 'استكشف')}</h3>
              <p>
                {tx('Browse previews and find the edit that fits your vision.', 'تصفّح المعاينات واختار الإيديت المناسب لذوقك.') }
              </p>
            </div>

            <div>
              <span className="step-no">02</span>
              <Coins />
              <h3>{tx('Earn points', 'اجمع النقاط')}</h3>
              <p>
                {tx('Complete eligible rewarded ads to build your balance.', 'أكمل الإعلانات المؤهلة لزيادة رصيد نقاطك.') }
              </p>
            </div>

            <div>
              <span className="step-no">03</span>
              <Download />
              <h3>{tx('Unlock & download', 'افتح وحمّل')}</h3>
              <p>
                {tx('Spend points to access the original file from your library.', 'استخدم نقاطك للوصول للملف الأصلي من مكتبتك.') }
              </p>
            </div>
          </div>
        </section>
      
        <CreatorRequests user={user} activePage={activePage} onLoginRequest={() => openAuth('login')} />
      
        <EditVaultLibrary
          active={activePage === 'library'}
          user={user}
          onLogin={() => openAuth('login')}
          onNotice={setNotice}
          onReviewSaved={(editId, avgRating, ratingCount) => setEdits((current) => current.map((edit) => edit.id === editId ? { ...edit, avgRating, ratingCount } : edit))}
        />
      </main>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark">
            <Clapperboard size={18} />
          </span>

          <span>
            EDIT<span className="brand-accent">VAULT</span>
            <small>{tx('CREATOR MARKETPLACE', 'سوق المبدعين')}</small>
          </span>
        </a>

        <span>{tx('Built for the people who make the edits.', 'منصة معمولة للناس اللي بتصنع الإيديتات.')}</span>

        <div>
          <a href="#how">{tx('How it works', 'كيف يعمل الموقع')}</a>
          <a href="#creators">Creators</a>
          <a href="mailto:hello@editvault.example">{tx('Contact', 'تواصل معنا')}</a>
        </div>

        <small>{tx('© 2026 EditVault · Respect the original.', '© 2026 EditVault · احترم العمل الأصلي.')}</small>
      </footer>

      {previewEdit && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewEdit(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${previewEdit.title}`}
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(900px, 94vw)', maxWidth: '900px' }}
          >
            <button
              className="modal-close"
              onClick={() => setPreviewEdit(null)}
              aria-label="Close preview"
            >
              <X />
            </button>

            <div className="eyebrow">EDITVAULT / VIDEO PREVIEW</div>

            <h2 style={{ marginBottom: '16px' }}>
              {previewEdit.title}
            </h2>

            <div className="ev-watermarked-preview">
              <video
              key={previewEdit.id}
              controls
              autoPlay
              playsInline
              preload="metadata"
              style={{
                display: 'block',
                width: '100%',
                maxHeight: '70vh',
                background: '#000',
                borderRadius: '12px',
              }}
              src={previewEdit.previewUrl}
            >
              Your browser does not support video playback.
            </video>
            </div>

            <p style={{ marginTop: '12px' }}>
              Preview only آ· Unlock the edit to access the original.
            </p>
          </div>
        </div>
      )}

      <PublicCreatorProfile creatorId={publicCreatorId} user={user} onLoginRequest={() => openAuth('login')} onClose={() => setPublicCreatorId(null)} onPreview={(edit) => { setPublicCreatorId(null); setPreviewEdit(edit); }} />

      {notice && (
        <div className="toast" role="status">
          {notice}

          <button
            onClick={() => setNotice('')}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!authLoading) setModal('');
          }}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => {
                if (!authLoading) setModal('');
              }}
              aria-label="Close"
              disabled={authLoading}
            >
              <X />
            </button>

            {modal === 'points' ? (
              <>
                <div className="modal-icon">
                  <Coins />
                </div>

                <div className="eyebrow">{tx('YOUR WALLET', 'محفظتك')}</div>

                <h2>
                  {points} <span>{tx('points', 'نقطة')}</span>
                </h2>

                <p>
                  {tx('Earn points by completing verified rewarded ads. Ad rewards will be enabled once the provider’s server-side verification is connected.', 'اجمع النقاط من الإعلانات المؤهلة بعد التحقق منها. سيتم تفعيل مكافآت الإعلانات عندما يكتمل ربط التحقق الآمن من جهة الخادم.')}
                </p>

                <button
                  className="primary-cta full"
                  onClick={() =>
                    setNotice(
                      'Reward ads are not connected in this preview yet.'
                    )
                  }
                >
                  {tx('Reward ads coming soon', 'الإعلانات بالمكافآت قريبًا')} <ArrowUpRight size={16} />
                </button>
              </>
            ) : modal === 'creator' ? (
              <>
                <div className="modal-icon">
                  <Clapperboard />
                </div>

                <div className="eyebrow">CREATOR ACCESS</div>

                <h2>
                  Make it. <span>Own it.</span>
                </h2>

                <p>
                  Creator accounts can upload original edits, set
                  point prices, and request manual verification.
                  Sign up first, then submit your TikTok profile
                  for review.
                </p>

                <button
                  className="primary-cta full"
                  onClick={() => openAuth('signup')}
                >
                  Create creator account <ArrowUpRight size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="modal-icon">
                  <UserRound />
                </div>

                <div className="eyebrow">
                  {modal === 'login'
                    ? tx('WELCOME BACK', 'أهلًا بعودتك')
                    : tx('YOUR CREATOR JOURNEY STARTS HERE', 'رحلتك كمبدع تبدأ هنا')}
                </div>

                <h2>
                  {modal === 'login'
                    ? tx('Good to see you.', 'سعداء بعودتك.')
                    : tx('Join the vault.', 'انضم إلى المنصة.')}
                </h2>

                <p>
                  {modal === 'login'
                    ? tx('Log in to access your library and points.', 'سجّل الدخول للوصول إلى مكتبتك ونقاطك.')
                    : tx('Create an account to unlock edits or publish your own.', 'أنشئ حسابًا لفتح الإيديتات أو نشر أعمالك.')}
                </p>

                <form onSubmit={submitAuth}>
                  {modal === 'signup' && (
                    <label>
                      {tx('Display name', 'الاسم المعروض')}
                      <input
                        required
                        type="text"
                        autoComplete="name"
                        value={displayName}
                        onChange={(event) =>
                          setDisplayName(event.target.value)
                        }
                        placeholder="Your creator name"
                        minLength={2}
                        maxLength={60}
                      />
                    </label>
                  )}

                  <label>
                    {tx('Email address', 'البريد الإلكتروني')}
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="you@example.com"
                    />
                  </label>

                  <label>
                    {tx('Password', 'كلمة المرور')}
                    <input
                      required
                      minLength={8}
                      type="password"
                      autoComplete={
                        modal === 'login'
                          ? 'current-password'
                          : 'new-password'
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      placeholder={tx("At least 8 characters", "8 أحرف على الأقل")}
                    />
                  </label>

                  <button
                    className="primary-cta full"
                    type="submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Please wait...'
                      : modal === 'login'
                      ? 'Log in'
                      : tx('Create account', 'إنشاء حساب')}

                    {!authLoading && <ArrowUpRight size={16} />}
                  </button>
                </form>

                <div className="modal-switch">
                  {modal === 'login' ? (
                    <>
                      New here?{' '}
                      <button
                        disabled={authLoading}
                        onClick={() => openAuth('signup')}
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        disabled={authLoading}
                        onClick={() => openAuth('login')}
                      >
                        Log in
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


