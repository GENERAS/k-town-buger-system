import { useState } from 'react';
import { Calendar, Users } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import { usePlatform } from '../../context/PlatformContext';
import type { GroupPackage, Order, PaymentMethod, StoreSettings } from '../../domain/types';
import { SafeImage } from '../shared/SafeImage';

interface GroupOrderingViewProps {
  packages: GroupPackage[];
  settings: StoreSettings;
  onOrderCreated: (order: Order) => void;
}

export function GroupOrderingView({
  packages,
  settings,
  onOrderCreated,
}: GroupOrderingViewProps) {
  const { dataMode, setDataMode, user, signInWithGoogle, actions } = usePlatform();
  const [selectedPkg, setSelectedPkg] = useState<GroupPackage | undefined>(packages[0]);
  const [packCount, setPackCount] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [scheduledFor, setScheduledFor] = useState('2026-11-25T12:30');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MTN Mobile Money');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const activePkg = selectedPkg ?? packages[0];
  if (!activePkg) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-3">
          <h1 className="text-xl font-bold text-[#141413]">Group & Office Packages</h1>
          <p className="text-xs text-stone-600">
            No live group packages initialized yet. Switch to Developer Demo Mode to preview packages or initialize the live catalog from Operations.
          </p>
          <button
            type="button"
            onClick={() => setDataMode('demo')}
            className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
          >
            Switch to Developer Demo Mode
          </button>
        </div>
      </div>
    );
  }

  const subtotal = activePkg.pricePerPack * packCount;
  const officeDiscount = subtotal >= 150000 ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal - officeDiscount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!orgName.trim() || !contactName.trim() || !contactPhone.trim() || !deliveryAddress.trim()) {
      setErrorMsg('Please complete organization, contact, phone, and delivery address.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await actions.createOrder({
        customerName: contactName.trim(),
        customerPhone: contactPhone.trim(),
        marketingOptIn: true,
        fulfillmentType: 'Delivery',
        deliveryZone: 'Kampala Central / CBD',
        deliveryAddress: deliveryAddress.trim(),
        scheduledFor,
        isGroupOrder: true,
        groupOrgName: orgName.trim(),
        paymentMethod,
        promoCode: officeDiscount > 0 ? 'OFFICE15' : undefined,
        items: [
          {
            menuItemId: activePkg.id,
            name: `${activePkg.name} (${activePkg.headcount * packCount} pax)`,
            category: 'Combos',
            quantity: packCount,
            unitPrice: activePkg.pricePerPack,
            lineTotal: subtotal,
            extrasLabels: activePkg.itemsSummary,
            isComboUpgrade: false,
          },
        ],
        subtotal,
        discount: officeDiscount,
        deliveryFee: 0,
        total,
      });
      onOrderCreated(data.order);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Group order failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <div className="text-xs font-semibold text-[#C8231B]">
          Offices · Schools · Corporate Events & Parties
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#141413] mt-1">
          Group & Office Bulk Ordering
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-2xl">
          Predefined high-volume meal packs with automatic 15% corporate discount (orders over UGX 150,000), free scheduled delivery, and labeled boxes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 grid grid-cols-1 gap-4">
          {packages.map((pkg) => {
            const selected = activePkg.id === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`bg-white border rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-12 transition-colors ${
                  selected ? 'border-[#C8231B] ring-1 ring-[#C8231B]' : 'border-stone-200'
                }`}
              >
                <div className="sm:col-span-4 aspect-[4/3] sm:aspect-auto bg-stone-100">
                  <SafeImage
                    src={pkg.imageUrl}
                    alt={pkg.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="sm:col-span-8 p-5 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs text-stone-500 font-medium">
                      {pkg.audience} · Serves {pkg.headcount} guests
                    </div>
                    <h2 className="text-lg font-bold text-[#141413] mt-0.5">{pkg.name}</h2>
                    <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                      {pkg.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                    <span className="text-base font-mono tabular-nums font-bold text-[#141413]">
                      {formatCurrency(pkg.pricePerPack, settings.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPkg(pkg)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                        selected
                          ? 'bg-[#C8231B] text-white'
                          : 'bg-stone-100 text-[#141413] hover:bg-stone-200'
                      }`}
                    >
                      {selected ? 'Selected Package' : 'Select Package'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-[#141413]">Schedule Group Delivery</h2>
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs flex items-center justify-between">
            <span className="font-semibold text-[#141413] truncate pr-2">{activePkg.name}</span>
            <span className="inline-flex items-center gap-1 text-stone-600 font-mono shrink-0">
              <Users className="w-3.5 h-3.5" />
              {activePkg.headcount * packCount} pax
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="grp-packs" className="block text-xs font-semibold text-stone-700 mb-1">
                Number of Packs
              </label>
              <input
                id="grp-packs"
                type="number"
                min={1}
                max={20}
                value={packCount}
                onChange={(e) => setPackCount(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="grp-time" className="block text-xs font-semibold text-stone-700 mb-1">
                Scheduled Delivery
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="grp-time"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-xs border border-stone-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="grp-org" className="block text-xs font-semibold text-stone-700 mb-1">
              Company / School / Event Name *
            </label>
            <input
              id="grp-org"
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., Makerere Innovation Lab"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="grp-contact" className="block text-xs font-semibold text-stone-700 mb-1">
                Coordinator Name *
              </label>
              <input
                id="grp-contact"
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Mukasa"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="grp-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                Phone *
              </label>
              <input
                id="grp-phone"
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+256 772 000 111"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label htmlFor="grp-addr" className="block text-xs font-semibold text-stone-700 mb-1">
              Drop-off Address & Reception Notes *
            </label>
            <input
              id="grp-addr"
              type="text"
              required
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Plot 5 Lumumba Ave, 3rd Floor Reception"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
          </div>

          <div>
            <label htmlFor="grp-pay" className="block text-xs font-semibold text-stone-700 mb-1">
              Payment Method
            </label>
            <select
              id="grp-pay"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
            >
              <option value="MTN Mobile Money">MTN Mobile Money (Sandbox)</option>
              <option value="Airtel Money">Airtel Money (Sandbox)</option>
              <option value="Pay on Delivery">Pay on Delivery (Corporate Cash / MoMo)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-stone-200 space-y-1 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Package Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(subtotal, settings.currency)}</span>
            </div>
            {officeDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Group 15% Offer (OFFICE15)</span>
                <span className="font-mono tabular-nums">-{formatCurrency(officeDiscount, settings.currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Scheduled Delivery</span>
              <span className="font-mono text-emerald-700">Complimentary</span>
            </div>
            <div className="flex justify-between text-base font-bold text-[#141413] pt-1.5">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatCurrency(total, settings.currency)}</span>
            </div>
          </div>

          {dataMode === 'live' && !user && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p>Sign in with Google to submit a live Firebase group order, or test instantly in Developer Demo Mode.</p>
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
                  Use Developer Demo
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-lg bg-[#C8231B] text-white text-sm font-semibold hover:bg-[#A91B14] disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Scheduling...' : 'Confirm Group Order'}
          </button>
        </form>
      </div>
    </div>
  );
}
