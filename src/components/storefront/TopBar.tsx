import { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';

export type CustomerPage = 'menu' | 'group' | 'track' | 'board';

interface TopBarProps {
  activePage: CustomerPage;
  onNavigate: (page: CustomerPage) => void;
  onOpenOps: () => void;
  onOpenCart: () => void;
  cartCount: number;
}

export function TopBar({
  activePage,
  onNavigate,
  onOpenOps,
  onOpenCart,
  cartCount,
}: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (page: CustomerPage) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => handleNav('menu')}
          className="text-xl font-bold tracking-tight text-[#141413] font-display whitespace-nowrap shrink-0 cursor-pointer"
        >
          K Town Burger
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => handleNav('menu')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activePage === 'menu'
                ? 'border-[#C8231B] text-[#141413] font-semibold'
                : 'border-transparent hover:text-[#141413]'
            }`}
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => handleNav('group')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activePage === 'group'
                ? 'border-[#C8231B] text-[#141413] font-semibold'
                : 'border-transparent hover:text-[#141413]'
            }`}
          >
            Group Orders
          </button>
          <button
            type="button"
            onClick={() => handleNav('track')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activePage === 'track'
                ? 'border-[#C8231B] text-[#141413] font-semibold'
                : 'border-transparent hover:text-[#141413]'
            }`}
          >
            Track Order
          </button>
          <button
            type="button"
            onClick={() => handleNav('board')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activePage === 'board'
                ? 'border-[#C8231B] text-[#141413] font-semibold'
                : 'border-transparent hover:text-[#141413]'
            }`}
          >
            Menu Board
          </button>
          <button
            type="button"
            onClick={onOpenOps}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-[#C8231B] text-stone-700 font-medium transition-colors cursor-pointer"
          >
            Operations
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Open shopping bag with ${cartCount} items`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C8231B] text-white text-sm font-semibold hover:bg-[#A91B14] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Bag</span>
            <span className="font-mono tabular-nums">({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => handleNav('menu')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => handleNav('group')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Group Orders
          </button>
          <button
            type="button"
            onClick={() => handleNav('track')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Track Order
          </button>
          <button
            type="button"
            onClick={() => handleNav('board')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Menu Board
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenOps();
            }}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#C8231B] hover:bg-red-50"
          >
            Operations Hub
          </button>
        </div>
      )}
    </header>
  );
}
