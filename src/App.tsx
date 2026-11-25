import { useEffect, useRef, useState } from 'react';
import type { CartItem, MenuItem, Order } from './domain/types';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { TopBar, type CustomerPage } from './components/storefront/TopBar';
import { StorefrontView } from './components/storefront/StorefrontView';
import { ProductCustomizerModal } from './components/storefront/ProductCustomizerModal';
import { CartCheckoutDrawer } from './components/storefront/CartCheckoutDrawer';
import { OrderTrackingView } from './components/storefront/OrderTrackingView';
import { GroupOrderingView } from './components/storefront/GroupOrderingView';
import { DigitalMenuBoardView } from './components/storefront/DigitalMenuBoardView';
import { AssistantDrawer } from './components/storefront/AssistantDrawer';
import { OpsShell } from './components/ops/OpsShell';

function AppContent() {
  const { state, loadError, dataMode, setDataMode, refreshState, actions } = usePlatform();
  const [mode, setMode] = useState<'storefront' | 'ops'>('storefront');
  const [customerPage, setCustomerPage] = useState<CustomerPage>('menu');
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string>('');
  const [qrSource, setQrSource] = useState<string | undefined>(undefined);
  const trackedQrRef = useRef<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('source');
    if (src) {
      setQrSource(src);
    }
    const orderParam = params.get('order');
    if (orderParam) {
      setTrackingOrderNumber(orderParam);
      setCustomerPage('track');
    }
    const viewParam = params.get('view');
    if (viewParam === 'ops') {
      setMode('ops');
    }
  }, []);

  useEffect(() => {
    if (!qrSource || !state) return;
    const trackKey = `${dataMode}:${qrSource}`;
    if (trackedQrRef.current === trackKey) return;
    trackedQrRef.current = trackKey;
    actions.trackQrScan(qrSource).catch(() => {});
  }, [qrSource, state, dataMode, actions]);

  const handleAddToCart = (newItem: CartItem) => {
    setCart((prev) => [...prev, newItem]);
    setCartOpen(true);
  };

  const handleQuickAddUpsell = (menuItem: MenuItem) => {
    setCart((prev) => [
      ...prev,
      {
        cartItemId: `${menuItem.id}-${Date.now()}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        category: menuItem.category,
        basePrice: menuItem.price,
        quantity: 1,
        selectedSize: menuItem.sizes?.[0],
        selectedExtras: [],
        isComboUpgrade: false,
        comboUpgradePrice: menuItem.comboUpgradePrice ?? 0,
      },
    ]);
  };

  const handleUpdateQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((c) => c.cartItemId !== cartItemId));
  };

  const handleOrderCreated = async (order: Order) => {
    setCartOpen(false);
    setTrackingOrderNumber(order.orderNumber);
    setCustomerPage('track');
    if (dataMode === 'demo') {
      await refreshState();
    }
  };

  const totalBagCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAF9]">
        <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-md w-full text-center space-y-3">
          <h1 className="text-lg font-bold text-[#141413]">Connection Issue</h1>
          <p className="text-sm text-stone-600">{loadError}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void refreshState()}
              className="px-4 py-2 rounded-lg bg-[#C8231B] text-white text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
            {dataMode === 'live' && (
              <button
                type="button"
                onClick={() => setDataMode('demo')}
                className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-[#141413] hover:bg-stone-50 cursor-pointer"
              >
                Switch to Developer Demo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-sm font-medium text-stone-500">
          Loading K Town Burger ({dataMode === 'live' ? 'Live Firebase' : 'Developer Demo'})...
        </div>
      </div>
    );
  }

  if (mode === 'ops') {
    return (
      <OpsShell
        state={state}
        onRefresh={() => void refreshState()}
        onExitOps={() => {
          setMode('storefront');
          void refreshState();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#141413]">
      {customerPage !== 'board' && (
        <TopBar
          activePage={customerPage}
          onNavigate={setCustomerPage}
          onOpenOps={() => {
            setMode('ops');
            void refreshState();
          }}
          onOpenCart={() => setCartOpen(true)}
          cartCount={totalBagCount}
        />
      )}

      <main className={customerPage === 'board' ? '' : 'pb-20'}>
        {customerPage === 'menu' && (
          <StorefrontView
            menu={state.menu}
            settings={state.settings}
            qrSource={qrSource}
            onSelectItem={setCustomizingItem}
            onGoTrack={() => setCustomerPage('track')}
            onGoGroup={() => setCustomerPage('group')}
          />
        )}

        {customerPage === 'group' && (
          <GroupOrderingView
            packages={state.groupPackages}
            settings={state.settings}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {customerPage === 'track' && (
          <OrderTrackingView
            orders={state.orders}
            riders={state.riders}
            settings={state.settings}
            initialOrderNumber={trackingOrderNumber}
            onFeedbackSubmitted={() => void refreshState()}
          />
        )}

        {customerPage === 'board' && (
          <DigitalMenuBoardView
            menu={state.menu}
            campaigns={state.campaigns}
            settings={state.settings}
            onExitBoard={() => setCustomerPage('menu')}
          />
        )}
      </main>

      {customizingItem && (
        <ProductCustomizerModal
          item={customizingItem}
          currency={state.settings.currency}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      <CartCheckoutDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onQuickAddMenu={handleQuickAddUpsell}
        onClearCart={() => setCart([])}
        menu={state.menu}
        campaigns={state.campaigns}
        settings={state.settings}
        qrSource={qrSource}
        onOrderCreated={handleOrderCreated}
      />

      {customerPage !== 'board' && <AssistantDrawer />}
    </div>
  );
}

function GuardedApp() {
  const { setDataMode } = usePlatform();
  return (
    <ErrorBoundary onSwitchToDemo={() => setDataMode('demo')}>
      <AppContent />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary
      onSwitchToDemo={() => {
        try {
          window.localStorage.setItem('ktown_data_mode', 'demo');
        } catch {
          // ignore storage errors
        }
        window.location.reload();
      }}
    >
      <PlatformProvider>
        <GuardedApp />
      </PlatformProvider>
    </ErrorBoundary>
  );
}
