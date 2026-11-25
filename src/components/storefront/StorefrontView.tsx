import { useMemo, useState } from 'react';
import { Clock, MapPin, Phone, Search, X } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import { usePlatform } from '../../context/PlatformContext';
import type { MenuCategory, MenuItem, StoreSettings } from '../../domain/types';
import { HERO_IMAGE_URL } from '../../server/seed';
import { SafeImage } from '../shared/SafeImage';

const CATEGORIES: Array<'All' | MenuCategory> = [
  'All',
  'Burgers',
  'Chicken',
  'Pizza',
  'Fries',
  'Drinks',
  'Combos',
];

interface StorefrontViewProps {
  menu: MenuItem[];
  settings: StoreSettings;
  qrSource?: string;
  onSelectItem: (item: MenuItem) => void;
  onGoTrack: () => void;
  onGoGroup: () => void;
}

export function StorefrontView({
  menu,
  settings,
  qrSource,
  onSelectItem,
  onGoTrack,
  onGoGroup,
}: StorefrontViewProps) {
  const {
    dataMode,
    setDataMode,
    user,
    access,
    connectionStatus,
    seedingLive,
    signInWithGoogle,
    signOutUser,
    seedLiveCatalog,
  } = usePlatform();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [category, setCategory] = useState<'All' | MenuCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menu.filter((item) => {
      const catMatch = category === 'All' || item.category === category;
      const searchMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [menu, category, searchQuery]);

  const scrollToMenu = () => {
    const el = document.getElementById('menu-catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      {/* Optional single slim promo bar <= 40px */}
      {settings.activePromoBanner && !bannerDismissed && (
        <div className="bg-[#141413] text-stone-100 text-xs h-9 px-4 flex items-center justify-center relative">
          <p className="truncate pr-8">{settings.activePromoBanner}</p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss promotion banner"
            className="absolute right-3 p-1 text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
              {qrSource && (
                <div className="text-xs font-medium text-[#C8231B]">
                  QR Direct Menu · Channel {qrSource}
                </div>
              )}
              <div className="text-xs text-stone-500 font-medium">
                {settings.address} · {settings.openingHours}
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#141413] leading-[1.08] text-balance max-w-xl">
                Flame-Grilled Burgers, Delivered in 30 Minutes.
              </h1>
              <p className="text-base text-stone-600 leading-relaxed max-w-lg">
                Seared double smash patties, 24-hour buttermilk fried chicken, and wood-fired sourdough pizza crafted fresh to order. Pay effortlessly with MTN MoMo, Airtel Money, or Cash on Delivery.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={scrollToMenu}
                  className="px-6 py-3 rounded-lg bg-[#C8231B] text-white text-sm font-semibold hover:bg-[#A91B14] transition-colors cursor-pointer"
                >
                  Browse Menu
                </button>
                <button
                  type="button"
                  onClick={onGoTrack}
                  className="px-4 py-3 text-sm font-semibold text-[#141413] hover:text-[#C8231B] transition-colors cursor-pointer"
                >
                  Track Existing Order
                </button>
                <button
                  type="button"
                  onClick={onGoGroup}
                  className="px-4 py-3 text-sm font-medium text-stone-600 hover:text-[#141413] transition-colors cursor-pointer"
                >
                  Office & Group Packs
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] rounded-xl overflow-hidden border border-stone-200 bg-stone-900">
                <SafeImage
                  src={HERO_IMAGE_URL}
                  alt="K Town Burger signature double smash cheeseburger with melted cheddar and golden fries"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-column proof & trust strip placed cleanly below split hero */}
          <div className="mt-10 pt-8 border-t border-stone-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-sm font-bold text-[#141413]">30-Minute Target</div>
              <div className="text-xs text-stone-500 mt-1">
                Live kitchen timer and dedicated motorbike dispatch
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#141413]">Buy 5, Get 1 Reward</div>
              <div className="text-xs text-stone-500 mt-1">
                Automatic burger stamps tracked by phone number
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#141413]">Flexible Payments</div>
              <div className="text-xs text-stone-500 mt-1">
                MTN Mobile Money, Airtel Money, or Pay on Delivery
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#141413]">Free Delivery Offer</div>
              <div className="text-xs text-stone-500 mt-1">
                Complimentary delivery above {formatCurrency(settings.freeDeliveryThreshold, settings.currency)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Catalog Section */}
      <section id="menu-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#141413]">Fresh From the Grill</h2>
            <p className="text-sm text-stone-600 mt-1">
              Tap any item to choose size, extra toppings, or upgrade to a fries and drink combo.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search burgers, pizza, combos..."
              aria-label="Search menu items"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
            />
          </div>
        </div>

        {/* Category Filter Segmented Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#141413] text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* 3-Column Product Grid */}
        {dataMode === 'live' && menu.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-3">
            <div className="text-xs font-semibold text-[#C8231B]">
              Live Firebase Database Connected
            </div>
            <h3 className="text-lg font-bold text-[#141413]">
              Live Store Menu Catalog Is Ready to Initialize
            </h3>
            <p className="text-xs text-stone-600 max-w-lg mx-auto leading-relaxed">
              Your Cloud Firestore database is connected and empty. Sign in with your owner Google account to publish the initial menu, packages, and promo codes to Firestore — or switch to Developer Demo Mode to test all features in the sandbox.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {access.isAdmin ? (
                <button
                  type="button"
                  disabled={seedingLive}
                  onClick={() => void seedLiveCatalog()}
                  className="px-4 py-2.5 rounded-lg bg-[#C8231B] text-white text-xs font-semibold hover:bg-[#A91B14] disabled:opacity-60 cursor-pointer"
                >
                  {seedingLive ? 'Publishing Live Menu...' : 'Initialize Live Menu & Store Defaults'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="px-4 py-2.5 rounded-lg bg-[#C8231B] text-white text-xs font-semibold hover:bg-[#A91B14] cursor-pointer"
                >
                  Sign in with Google (Owner Setup)
                </button>
              )}
              <button
                type="button"
                onClick={() => setDataMode('demo')}
                className="px-4 py-2.5 rounded-lg border border-stone-300 text-xs font-semibold text-[#141413] hover:bg-stone-50 cursor-pointer"
              >
                Switch to Developer Demo Mode
              </button>
            </div>
          </div>
        ) : filteredMenu.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-[#141413]">No menu items match "{searchQuery}"</p>
            <button
              type="button"
              onClick={() => {
                setCategory('All');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#C8231B] hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenu.map((item) => (
              <article
                key={item.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs text-stone-500">
                      <span>{item.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.prepMinutes} min</span>
                      {item.bestseller && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-[#C8231B] font-semibold">Bestseller</span>
                        </>
                      )}
                      {!item.available && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-red-700 font-semibold">Sold Out</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#141413] mt-1">{item.name}</h3>
                    <p className="text-sm text-stone-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                    <span className="text-[15px] font-mono tabular-nums font-bold text-[#141413]">
                      {formatCurrency(item.price, settings.currency)}
                    </span>
                    <button
                      type="button"
                      disabled={!item.available}
                      onClick={() => onSelectItem(item)}
                      className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] disabled:bg-stone-200 disabled:text-stone-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {item.available ? 'Customize & Add' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Location & Contact Footer */}
      <footer className="bg-white border-t border-stone-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div className="space-y-2">
            <div className="text-base font-bold font-display text-[#141413]">
              {settings.restaurantName}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">{settings.tagline}</p>
          </div>
          <div className="space-y-2 text-xs text-stone-600">
            <div className="font-semibold text-[#141413]">Visit & Hours</div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{settings.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{settings.openingHours}</span>
            </div>
          </div>
          <div className="space-y-2 text-xs text-stone-600">
            <div className="font-semibold text-[#141413]">Direct Contact</div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="font-mono">{settings.phone}</span>
            </div>
            <a
              href={`https://wa.me/${settings.whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-semibold text-[#C8231B] hover:underline pt-1"
            >
              Message Restaurant on WhatsApp
            </a>
          </div>
        </div>

        {/* Workspace Environment & Firebase Account Switcher */}
        <div className="border-t border-stone-100 bg-stone-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-stone-600">
              <span className="font-semibold text-[#141413]">
                Storage: {dataMode === 'live' ? 'Live Firebase Firestore' : 'Developer Demo Sandbox'}
              </span>
              {dataMode === 'live' && (
                <span className="font-mono text-[11px] text-stone-500">
                  {connectionStatus === 'offline' ? 'Offline' : 'Connected'}
                </span>
              )}
              {user && (
                <span className="text-[11px] text-stone-500">
                  Signed in: <strong className="text-[#141413]">{user.email}</strong>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-lg bg-stone-200">
                <button
                  type="button"
                  onClick={() => setDataMode('live')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                    dataMode === 'live'
                      ? 'bg-white text-[#141413] shadow-sm'
                      : 'text-stone-600 hover:text-[#141413]'
                  }`}
                >
                  Live Firebase
                </button>
                <button
                  type="button"
                  onClick={() => setDataMode('demo')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                    dataMode === 'demo'
                      ? 'bg-white text-[#141413] shadow-sm'
                      : 'text-stone-600 hover:text-[#141413]'
                  }`}
                >
                  Developer Demo
                </button>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="px-2.5 py-1 rounded-md border border-stone-300 bg-white text-[11px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="px-2.5 py-1 rounded-md bg-[#141413] text-white text-[11px] font-semibold hover:bg-[#C8231B] cursor-pointer"
                >
                  Google Sign-In
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
