import { useState } from 'react';
import { Minus, Plus, Trash2, X, CheckCircle2, MapPin, Tag } from 'lucide-react';
import {
  calculateCartTotals,
  computeCartItemUnitPrice,
  DELIVERY_ZONES,
  formatCurrency,
  getUpsellRecommendations,
} from '../../domain/rules';
import { usePlatform } from '../../context/PlatformContext';
import type {
  Campaign,
  CartItem,
  FulfillmentType,
  MenuItem,
  Order,
  OrderItem,
  PaymentMethod,
  StoreSettings,
} from '../../domain/types';

interface CartCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onQuickAddMenu: (item: MenuItem) => void;
  onClearCart: () => void;
  menu: MenuItem[];
  campaigns: Campaign[];
  settings: StoreSettings;
  qrSource?: string;
  onOrderCreated: (order: Order) => void;
}

export function CartCheckoutDrawer({
  open,
  onClose,
  cart,
  onUpdateQty,
  onRemoveItem,
  onQuickAddMenu,
  onClearCart,
  menu,
  campaigns,
  settings,
  qrSource,
  onOrderCreated,
}: CartCheckoutDrawerProps) {
  const { dataMode, setDataMode, user, signInWithGoogle, actions } = usePlatform();
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('Delivery');
  const [deliveryZone, setDeliveryZone] = useState(DELIVERY_ZONES[0].name);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [locationPin, setLocationPin] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MTN Mobile Money');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const totals = calculateCartTotals({
    items: cart,
    fulfillmentType,
    deliveryZone,
    promoCode: appliedPromo,
    campaigns,
    deliveryFeeBase: settings.deliveryFeeBase,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
  });

  const upsells = getUpsellRecommendations(cart, menu);

  const handleApplyPromo = () => {
    setAppliedPromo(promoInput.trim().toUpperCase());
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cart.length === 0) {
      setErrorMsg('Your bag is empty.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg('Please enter your name and phone number.');
      return;
    }
    if (fulfillmentType === 'Delivery' && !deliveryAddress.trim()) {
      setErrorMsg('Please enter your delivery street address or landmark.');
      return;
    }

    setSubmitting(true);
    try {
      const orderItems: OrderItem[] = cart.map((c) => {
        const unitPrice = computeCartItemUnitPrice(c);
        return {
          menuItemId: c.menuItemId,
          name: c.name,
          category: c.category,
          quantity: c.quantity,
          unitPrice,
          lineTotal: unitPrice * c.quantity,
          sizeLabel: c.selectedSize?.label,
          extrasLabels: c.selectedExtras.map((ex) => ex.label),
          isComboUpgrade: c.isComboUpgrade,
          specialInstructions: c.specialInstructions,
        };
      });

      const data = await actions.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        marketingOptIn,
        fulfillmentType,
        deliveryZone: fulfillmentType === 'Delivery' ? deliveryZone : undefined,
        deliveryAddress: fulfillmentType === 'Delivery' ? deliveryAddress.trim() : undefined,
        locationPin: fulfillmentType === 'Delivery' ? locationPin.trim() || undefined : undefined,
        paymentMethod,
        promoCode: totals.appliedCampaign?.code,
        items: orderItems,
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        qrSource,
      });
      onClearCart();
      onOrderCreated(data.order);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping Bag and Guest Checkout">
      <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-stone-200">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#141413]">Your Order</h2>
            <p className="text-xs text-stone-500">Guest checkout · No account required</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shopping bag"
            className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-sm font-medium text-stone-700">Your bag is currently empty.</p>
              <p className="text-xs text-stone-500">
                Add flame-grilled burgers, crispy chicken, or combo boxes from the menu to get started.
              </p>
            </div>
          ) : (
            <>
              {/* Free delivery nudge */}
              {fulfillmentType === 'Delivery' && (
                <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-700">
                  {totals.amountToFreeDelivery > 0 ? (
                    <span>
                      Add{' '}
                      <strong className="font-mono tabular-nums text-[#141413]">
                        {formatCurrency(totals.amountToFreeDelivery, settings.currency)}
                      </strong>{' '}
                      more to unlock free delivery.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Free delivery unlocked on this order
                    </span>
                  )}
                </div>
              )}

              {/* Cart Items */}
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg">
                {cart.map((item) => {
                  const unit = computeCartItemUnitPrice(item);
                  const details = [
                    item.selectedSize?.label,
                    item.isComboUpgrade ? 'Meal Combo' : null,
                    ...item.selectedExtras.map((e) => e.label),
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div key={item.cartItemId} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#141413] truncate">
                            {item.name}
                          </div>
                          {details && (
                            <div className="text-xs text-stone-500 mt-0.5">{details}</div>
                          )}
                          {item.specialInstructions && (
                            <div className="text-xs text-stone-500 italic mt-0.5">
                              Note: {item.specialInstructions}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-mono tabular-nums font-semibold text-[#141413] shrink-0">
                          {formatCurrency(unit * item.quantity, settings.currency)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center border border-stone-200 rounded-md">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.cartItemId, -1)}
                            aria-label={`Decrease ${item.name} quantity`}
                            className="p-1.5 text-stone-600 hover:bg-stone-100 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono tabular-nums font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.cartItemId, 1)}
                            aria-label={`Increase ${item.name} quantity`}
                            className="p-1.5 text-stone-600 hover:bg-stone-100 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartItemId)}
                          aria-label={`Remove ${item.name}`}
                          className="text-xs text-stone-400 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Smart Upselling & Cross-Selling */}
              {upsells.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-stone-600">
                    Complete Your Meal
                  </div>
                  <div className="space-y-2">
                    {upsells.map(({ item, reason }) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-stone-200 bg-stone-50"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#141413] truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-stone-500 truncate">{reason}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onQuickAddMenu(item)}
                          className="px-2.5 py-1.5 rounded-md bg-white border border-stone-300 text-xs font-semibold text-[#141413] hover:border-[#C8231B] hover:text-[#C8231B] shrink-0 whitespace-nowrap cursor-pointer"
                        >
                          + {formatCurrency(item.price, settings.currency)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkout Form */}
              <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4 pt-2 border-t border-stone-200">
                {/* Fulfillment Toggle */}
                <div>
                  <div className="text-xs font-semibold text-stone-600 mb-1.5">
                    Order Type
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-lg">
                    {(['Delivery', 'Pickup'] as FulfillmentType[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFulfillmentType(mode)}
                        className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          fulfillmentType === mode
                            ? 'bg-white text-[#141413] shadow-sm'
                            : 'text-stone-600 hover:text-[#141413]'
                        }`}
                      >
                        {mode === 'Delivery' ? '30-Min Delivery' : 'Restaurant Pickup'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guest Details */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="checkout-name" className="block text-xs font-semibold text-stone-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g., Amina Namukasa"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                      Phone / WhatsApp Number *
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+256 772 000 000"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-email" className="block text-xs font-semibold text-stone-700 mb-1">
                      Email (Optional, for receipt)
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
                    />
                  </div>
                </div>

                {fulfillmentType === 'Delivery' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="checkout-zone" className="block text-xs font-semibold text-stone-700 mb-1">
                        Delivery Area
                      </label>
                      <select
                        id="checkout-zone"
                        value={deliveryZone}
                        onChange={(e) => setDeliveryZone(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:border-[#C8231B]"
                      >
                        {DELIVERY_ZONES.map((z) => (
                          <option key={z.name} value={z.name}>
                            {z.name} ({formatCurrency(settings.deliveryFeeBase * z.feeMultiplier, settings.currency)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="checkout-address" className="block text-xs font-semibold text-stone-700 mb-1">
                        Street Address & Gate / Landmark *
                      </label>
                      <input
                        id="checkout-address"
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Plot 14 Acacia Ave, Gate 2"
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="checkout-pin" className="block text-xs font-semibold text-stone-700 mb-1">
                        Location Pin / Coordinates (Optional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="checkout-pin"
                          type="text"
                          value={locationPin}
                          onChange={(e) => setLocationPin(e.target.value)}
                          placeholder="0.3351, 32.5934"
                          className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
                        />
                        <button
                          type="button"
                          onClick={() => setLocationPin('0.3351, 32.5934')}
                          className="px-3 py-2 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#C8231B]" />
                          Drop Pin
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Promo Code */}
                <div>
                  <label htmlFor="promo-code" className="block text-xs font-semibold text-stone-700 mb-1">
                    Promo / Campaign Code
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="promo-code"
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Try KTOWN10 or FREEDEL"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-stone-200 rounded-lg uppercase focus:outline-none focus:border-[#C8231B]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-3.5 py-2 rounded-lg border border-stone-300 text-xs font-semibold hover:bg-stone-50 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {totals.promoError && (
                    <p className="text-xs text-red-600 mt-1">{totals.promoError}</p>
                  )}
                  {totals.appliedCampaign && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Applied {totals.appliedCampaign.code} — {totals.appliedCampaign.name}
                    </p>
                  )}
                </div>

                {/* Payment Methods */}
                <div>
                  <div className="text-xs font-semibold text-stone-700 mb-1.5">
                    Payment Method
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'MTN Mobile Money', note: 'Sandbox instant confirm' },
                        { id: 'Airtel Money', note: 'Sandbox instant confirm' },
                        { id: 'Pay on Delivery', note: 'Cash / MoMo at door' },
                        { id: 'Pay at Restaurant', note: 'Counter pickup' },
                      ] as Array<{ id: PaymentMethod; note: string }>
                    ).map((pm) => {
                      const selected = paymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                            selected
                              ? 'border-[#C8231B] bg-red-50/40'
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#141413] truncate">
                            {pm.id}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">{pm.note}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#C8231B]"
                  />
                  <span>
                    Send me WhatsApp order updates, Buy-5-Burgers loyalty rewards, and weekend offers (opt out anytime).
                  </span>
                </label>

                {errorMsg && (
                  <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {errorMsg}
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-3 shrink-0">
            <div className="space-y-1 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(totals.subtotal, settings.currency)}
                </span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({totals.appliedCampaign?.code})</span>
                  <span className="font-mono tabular-nums">
                    -{formatCurrency(totals.discount, settings.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="font-mono tabular-nums">
                  {totals.deliveryFee === 0
                    ? 'Free'
                    : formatCurrency(totals.deliveryFee, settings.currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#141413] pt-1.5 border-t border-stone-200">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(totals.total, settings.currency)}
                </span>
              </div>
            </div>

            {dataMode === 'live' && !user && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <p>
                  Live Firebase orders require Google Sign-In to save your receipt and Buy-5-Burgers stamps.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="px-3 py-1.5 rounded-md bg-[#141413] text-white font-semibold cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataMode('demo')}
                    className="px-3 py-1.5 rounded-md border border-amber-300 bg-white text-[#141413] font-semibold cursor-pointer"
                  >
                    Switch to Demo Mode
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#C8231B] text-white text-sm font-semibold hover:bg-[#A91B14] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting ? 'Confirming Order...' : `Place Order · ${formatCurrency(totals.total, settings.currency)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
