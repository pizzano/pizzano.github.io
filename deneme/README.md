import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import CategoryTabs from "./components/CategoryTabs.jsx";
import Menu from "./components/Menu.jsx";
import ProductModal from "./components/ProductModal.jsx";
import BottomCartBar from "./components/BottomCartBar.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import Checkout from "./components/Checkout.jsx";
import OrderTracker from "./components/OrderTracker.jsx";
import InfoSheet from "./components/InfoSheet.jsx";
import ProfileSheet from "./components/ProfileSheet.jsx";
import { fetchStoreConfig, submitOrder, writeCustomerOrderIndex, fetchOrder, trackingUrl, firebaseGet } from "./lib/api.js";
import { normalizeStoreConfig } from "./lib/dataAdapter.js";
import { cleanPhone } from "./lib/format.js";
import { defaultReadyMinutes, storeStatus } from "./lib/time.js";

const CART_KEY = "kol-react-cart-v1";
const CUSTOMER_KEY = "kol-react-customer-v1";
const RECENT_KEY = "kol-react-recent-orders-v1";

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export default function App() {
  const [config, setConfig] = useState(() => normalizeStoreConfig({}));
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("menu");
  const [activeCategory, setActiveCategory] = useState("most");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cart, setCart] = useState(() => loadJson(CART_KEY, []));
  const [customer, setCustomer] = useState(() => loadJson(CUSTOMER_KEY, { name: "", phone: "" }));
  const [recentOrders, setRecentOrders] = useState(() => loadJson(RECENT_KEY, []));
  const [profilePhone, setProfilePhone] = useState(() => customer.phone || "");
  const [profileOrders, setProfileOrders] = useState([]);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [trackingId, setTrackingId] = useState(() => new URLSearchParams(window.location.search).get("order") || "");

  useEffect(() => {
    let alive = true;
    fetchStoreConfig()
      .then((root) => { if (alive) setConfig(normalizeStoreConfig(root || {})); })
      .catch((error) => console.warn("Meny kunne ikke hentes, bruker fallback", error))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => { saveJson(CART_KEY, cart); }, [cart]);
  useEffect(() => { saveJson(CUSTOMER_KEY, customer); }, [customer]);
  useEffect(() => { saveJson(RECENT_KEY, recentOrders); }, [recentOrders]);

  useEffect(() => {
    if (!trackingId) return;
    setScreen("tracking");
    let stopped = false;
    const load = async () => {
      try {
        const order = await fetchOrder(trackingId);
        if (!stopped) setTrackingOrder(order);
      } catch (e) {
        console.warn("Ordrestatus kunne ikke hentes", e);
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [trackingId]);

  const status = useMemo(() => storeStatus(config.settings), [config.settings]);
  const categories = useMemo(() => [{ id: "most", title: "Mest bestilt" }, ...config.sections.map((s) => ({ id: s.id, title: s.title }))], [config.sections]);
  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.lineTotal || line.total || 0), 0), [cart]);
  const count = useMemo(() => cart.reduce((sum, line) => sum + Number(line.quantity || 1), 0), [cart]);
  const selectedIds = useMemo(() => new Set(cart.map((line) => line.productId)), [cart]);

  const addToCart = (line) => setCart((prev) => [...prev, line]);
  const removeLine = (index) => setCart((prev) => prev.filter((_, i) => i !== index));

  const submitCustomerOrder = async ({ name, phone, pickupMode }) => {
    const now = new Date().toISOString();
    const clean = cleanPhone(phone);
    const readyMinutes = defaultReadyMinutes(config.settings);
    const payload = {
      status: "pending",
      createdAt: now,
      updatedAt: now,
      source: "website-react",
      sourceName: "website-react",
      client_order_count: 0,
      clientOrderCount: 0,
      confirmed_at: null,
      fulfill_time: null,
      confirmedAt: null,
      fulfillTime: null,
      printed: false,
      ready: false,
      payment: "pickup",
      order_type: "pickup",
      orderType: "pickup",
      processableAfter: "",
      outsideOpeningHours: false,
      readyMinutes,
      customer: { name, phone: clean },
      pickup: { mode: pickupMode || "asap", time: "" },
      items: cart.map((line) => ({ ...line })),
      subtotal: total,
      total
    };
    const order = await submitOrder(payload);
    await writeCustomerOrderIndex(order);
    const withLink = { ...order, trackingUrl: trackingUrl(order.id) };
    setRecentOrders((prev) => [withLink, ...prev.filter((x) => x.id !== order.id)].slice(0, 20));
    setCustomer({ name, phone: clean });
    setCart([]);
    setTrackingId(order.id);
    window.history.replaceState(null, "", `?order=${encodeURIComponent(order.id)}`);
    setTrackingOrder(withLink);
    setScreen("tracking");
  };

  const fetchProfileOrders = async () => {
    const phone = cleanPhone(profilePhone);
    if (!phone) return setProfileOrders([]);
    try {
      const idx = await firebaseGet(`customerOrders/${phone}`);
      const entries = Object.values(idx || {}).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 10);
      setProfileOrders(entries);
    } catch {
      setProfileOrders([]);
    }
  };

  const backToMenu = () => {
    setScreen("menu");
    setTrackingId("");
    window.history.replaceState(null, "", window.location.pathname);
  };

  if (loading) {
    return <div className="appShell"><div className="loadingCard">Laster meny...</div></div>;
  }

  return (
    <div className="appShell">
      <div className="phoneFrame">
        {screen !== "tracking" && (
          <>
            <Header
              restaurantName={config.settings.restaurantName}
              cartCount={count}
              onInfo={() => setInfoOpen(true)}
              onProfile={() => setProfileOpen(true)}
              onCart={() => setCartOpen(true)}
              onBack={() => screen === "checkout" ? setScreen("menu") : window.history.back()}
            />
            {screen === "menu" && <CategoryTabs categories={categories} activeId={activeCategory} onSelect={setActiveCategory} />}
          </>
        )}

        {screen === "menu" && (
          <Menu
            settings={config.settings}
            status={status}
            sections={config.sections}
            search={search}
            setSearch={setSearch}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            selectedIds={selectedIds}
            onOpenProduct={setSelectedProduct}
          />
        )}

        {screen === "checkout" && (
          <Checkout
            cart={cart}
            total={total}
            status={status}
            savedCustomer={customer}
            onBack={() => setScreen("menu")}
            onSubmit={submitCustomerOrder}
          />
        )}

        {screen === "tracking" && <OrderTracker order={trackingOrder} onClose={backToMenu} />}

        <ProductModal product={selectedProduct} optionGroups={config.optionGroups} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
        <BottomCartBar count={screen === "menu" ? count : 0} total={total} onClick={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} cart={cart} total={total} onClose={() => setCartOpen(false)} onRemove={removeLine} storeOpen={status.open} onCheckout={() => { setCartOpen(false); setScreen("checkout"); }} />
        <InfoSheet open={infoOpen} settings={config.settings} status={status} onClose={() => setInfoOpen(false)} />
        <ProfileSheet open={profileOpen} orders={profileOrders} phone={profilePhone} setPhone={setProfilePhone} onFetch={fetchProfileOrders} onClose={() => setProfileOpen(false)} />
      </div>
    </div>
  );
}
