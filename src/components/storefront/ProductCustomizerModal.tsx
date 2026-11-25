import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import type { CartItem, MenuItem, ProductExtra, ProductSize } from '../../domain/types';
import { SafeImage } from '../shared/SafeImage';

interface ProductCustomizerModalProps {
  item: MenuItem;
  currency: string;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
}

export function ProductCustomizerModal({
  item,
  currency,
  onClose,
  onAddToCart,
}: ProductCustomizerModalProps) {
  const [selectedSize, setSelectedSize] = useState<ProductSize | undefined>(
    item.sizes?.[0],
  );
  const [selectedExtras, setSelectedExtras] = useState<ProductExtra[]>([]);
  const [isComboUpgrade, setIsComboUpgrade] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const toggleExtra = (extra: ProductExtra) => {
    setSelectedExtras((prev) =>
      prev.some((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra],
    );
  };

  const sizeDelta = selectedSize?.priceDelta ?? 0;
  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
  const comboPrice = isComboUpgrade && item.comboUpgradePrice ? item.comboUpgradePrice : 0;
  const unitPrice = item.price + sizeDelta + extrasTotal + comboPrice;
  const lineTotal = unitPrice * quantity;

  const handleConfirm = () => {
    onAddToCart({
      cartItemId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: item.id,
      name: item.name,
      category: item.category,
      basePrice: item.price,
      quantity,
      selectedSize,
      selectedExtras,
      isComboUpgrade: Boolean(isComboUpgrade && item.comboUpgradePrice),
      comboUpgradePrice: item.comboUpgradePrice ?? 0,
      specialInstructions: specialInstructions.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl max-h-[90vh] flex flex-col overflow-hidden border border-stone-200">
        <div className="relative h-48 bg-stone-100 shrink-0">
          <SafeImage
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item customizer"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 text-stone-900 flex items-center justify-center border border-stone-200 hover:bg-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div>
            <div className="text-xs text-stone-500 font-medium">
              {item.category} · {item.prepMinutes} min prep
            </div>
            <h2 id="customizer-title" className="text-xl font-bold text-[#141413] mt-1">
              {item.name}
            </h2>
            <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{item.description}</p>
          </div>

          {item.sizes && item.sizes.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[#141413]">Choose Size</div>
              <div className="grid grid-cols-2 gap-2">
                {item.sizes.map((sz) => {
                  const active = selectedSize?.id === sz.id;
                  return (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`px-3 py-2.5 rounded-lg border text-left text-sm transition-colors cursor-pointer ${
                        active
                          ? 'border-[#C8231B] bg-red-50/50 text-[#141413] font-semibold'
                          : 'border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                    >
                      <div className="truncate">{sz.label}</div>
                      <div className="text-xs text-stone-500 font-mono tabular-nums mt-0.5">
                        {sz.priceDelta > 0
                          ? `+${formatCurrency(sz.priceDelta, currency)}`
                          : 'Included'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {item.comboUpgradePrice && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[#141413]">Make It a Meal Combo</div>
              <label className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:border-stone-300 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isComboUpgrade}
                    onChange={(e) => setIsComboUpgrade(e.target.checked)}
                    className="w-4 h-4 accent-[#C8231B]"
                  />
                  <div>
                    <div className="text-sm font-medium text-[#141413]">
                      Add Seasoned Fries + Chilled Drink
                    </div>
                    <div className="text-xs text-stone-500">Save UGX 4,500 vs ordering separately</div>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#141413]">
                  +{formatCurrency(item.comboUpgradePrice, currency)}
                </span>
              </label>
            </div>
          )}

          {item.extras && item.extras.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[#141413]">Add Extras</div>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg">
                {item.extras.map((ex) => {
                  const checked = selectedExtras.some((e) => e.id === ex.id);
                  return (
                    <label
                      key={ex.id}
                      className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-stone-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExtra(ex)}
                          className="w-4 h-4 accent-[#C8231B]"
                        />
                        <span className="text-sm text-stone-800">{ex.label}</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-stone-600">
                        +{formatCurrency(ex.price, currency)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="special-instructions" className="text-sm font-semibold text-[#141413] block">
              Special Instructions (Optional)
            </label>
            <input
              id="special-instructions"
              type="text"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g., No onions, extra pickles, well done..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
            />
          </div>
        </div>

        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center border border-stone-300 rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="p-2.5 text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-mono tabular-nums font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
              className="p-2.5 text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-5 rounded-lg bg-[#C8231B] text-white text-sm font-semibold hover:bg-[#A91B14] transition-colors flex items-center justify-between cursor-pointer"
          >
            <span>Add to Order</span>
            <span className="font-mono tabular-nums">{formatCurrency(lineTotal, currency)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
