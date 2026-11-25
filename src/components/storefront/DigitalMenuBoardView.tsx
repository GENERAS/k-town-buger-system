import { formatCurrency } from '../../domain/rules';
import type { Campaign, MenuCategory, MenuItem, StoreSettings } from '../../domain/types';

interface DigitalMenuBoardViewProps {
  menu: MenuItem[];
  campaigns: Campaign[];
  settings: StoreSettings;
  onExitBoard: () => void;
}

const BOARD_GROUPS: MenuCategory[] = [
  'Burgers',
  'Chicken',
  'Pizza',
  'Combos',
  'Fries',
  'Drinks',
];

export function DigitalMenuBoardView({
  menu,
  campaigns,
  settings,
  onExitBoard,
}: DigitalMenuBoardViewProps) {
  const activePromos = campaigns.filter((c) => c.active);

  return (
    <div className="bg-[#141413] text-stone-100 min-h-[calc(100vh-4rem)] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-800">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
              {settings.restaurantName} · Digital Menu Board
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Live pricing & kitchen availability · {settings.openingHours}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-stone-400">Loyalty Program</div>
              <div className="text-sm font-semibold text-amber-400">
                Buy 5 Burgers, Get 1 Free Reward
              </div>
            </div>
            <button
              type="button"
              onClick={onExitBoard}
              className="px-4 py-2 rounded-lg border border-stone-700 text-xs font-semibold text-stone-200 hover:bg-stone-800 cursor-pointer"
            >
              Back to Ordering
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BOARD_GROUPS.map((cat) => {
            const items = menu.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <div
                key={cat}
                className="bg-stone-900/90 border border-stone-800 rounded-xl p-5 space-y-4"
              >
                <h2 className="text-lg font-bold text-amber-400 border-b border-stone-800 pb-2">
                  {cat}
                </h2>
                <div className="space-y-3.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start justify-between gap-3 ${
                        !item.available ? 'opacity-45' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {item.name}
                          {!item.available && (
                            <span className="ml-2 text-xs text-red-400 font-normal">
                              (Sold Out)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                      <div className="text-sm font-mono tabular-nums font-bold text-white shrink-0">
                        {formatCurrency(item.price, settings.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {activePromos.length > 0 && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm font-semibold text-white">Active In-Store & Online Offers</div>
            <div className="flex flex-wrap gap-6 text-xs text-stone-300">
              {activePromos.map((p) => (
                <span key={p.id}>
                  Code <strong className="font-mono text-amber-400">{p.code}</strong> · {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
