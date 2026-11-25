import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Phone,
  Printer,
  Star,
} from 'lucide-react';
import {
  formatCurrency,
  formatWhatsAppOrderMessage,
  ORDER_STATUS_SEQUENCE,
} from '../../domain/rules';
import { usePlatform } from '../../context/PlatformContext';
import type { Order, Rider, StoreSettings } from '../../domain/types';

interface OrderTrackingViewProps {
  orders: Order[];
  riders: Rider[];
  settings: StoreSettings;
  initialOrderNumber?: string;
  onFeedbackSubmitted: () => void;
}

export function OrderTrackingView({
  orders,
  riders,
  settings,
  initialOrderNumber,
  onFeedbackSubmitted,
}: OrderTrackingViewProps) {
  const { dataMode, setDataMode, user, signInWithGoogle, actions } = usePlatform();
  const [lookupInput, setLookupInput] = useState(
    initialOrderNumber || orders[0]?.orderNumber || '',
  );
  const [copiedWa, setCopiedWa] = useState(false);

  // Feedback state
  const [rating, setRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const selectedOrder =
    orders.find(
      (o) =>
        o.orderNumber.toLowerCase() === lookupInput.trim().toLowerCase() ||
        o.id.toLowerCase() === lookupInput.trim().toLowerCase(),
    ) ?? orders[0];

  const assignedRider = selectedOrder?.riderId
    ? riders.find((r) => r.id === selectedOrder.riderId)
    : undefined;

  const waMessage = selectedOrder
    ? formatWhatsAppOrderMessage(selectedOrder, settings)
    : '';

  const handleCopyWhatsApp = async () => {
    if (!waMessage) return;
    try {
      await navigator.clipboard.writeText(waMessage);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2000);
    } catch {
      setCopiedWa(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmittingFeedback(true);
    setFeedbackError('');
    try {
      await actions.submitFeedback(selectedOrder.id, {
        rating,
        foodRating,
        deliveryRating,
        comment,
      });
      setFeedbackSuccess(true);
      onFeedbackSubmitted();
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Error submitting feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const activeStepIdx = selectedOrder
    ? ORDER_STATUS_SEQUENCE.indexOf(selectedOrder.status)
    : -1;

  const mapsDestination = selectedOrder?.locationPin || selectedOrder?.deliveryAddress || settings.address;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    settings.locationPin || settings.address,
  )}&destination=${encodeURIComponent(mapsDestination)}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#141413]">
            Order Tracking & Receipt
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Enter your order number to follow live kitchen preparation, rider assignment, and receipt details.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input
            type="text"
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value)}
            placeholder="e.g., KTB-1048"
            aria-label="Order tracking number"
            className="w-full sm:w-44 px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg font-mono uppercase focus:outline-none focus:border-[#C8231B]"
          />
          <select
            aria-label="Quick select recent order"
            value={selectedOrder?.orderNumber || ''}
            onChange={(e) => setLookupInput(e.target.value)}
            className="w-full sm:w-56 min-w-0 px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg font-mono"
          >
            {orders.slice(0, 8).map((o) => (
              <option key={o.id} value={o.orderNumber}>
                {o.orderNumber} ({o.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedOrder ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-3">
          {dataMode === 'live' && !user ? (
            <>
              <p className="text-sm font-semibold text-[#141413]">
                Sign in with Google to view your live K Town Burger orders
              </p>
              <p className="text-xs text-stone-600 max-w-md mx-auto">
                Your live Firestore orders and delivery receipts are private to your verified Google account, or switch to Developer Demo Mode to inspect sample orders.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="px-4 py-2 rounded-lg bg-[#C8231B] text-white text-xs font-semibold cursor-pointer"
                >
                  Sign in with Google
                </button>
                <button
                  type="button"
                  onClick={() => setDataMode('demo')}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-[#141413] hover:bg-stone-50 cursor-pointer"
                >
                  Switch to Developer Demo Mode
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-600">
              No orders found. Place an order from the Menu to track it live.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Status Timeline & Dispatch Info */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-100">
                <div>
                  <div className="text-xs text-stone-500">
                    Tracking Link · #{selectedOrder.orderNumber}
                  </div>
                  <h2 className="text-xl font-bold text-[#141413] mt-0.5">
                    {selectedOrder.status}
                  </h2>
                  <div className="text-xs text-stone-500 mt-1">
                    {selectedOrder.fulfillmentType} · Est. {selectedOrder.estimatedMinutes} min ·{' '}
                    {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-xs text-stone-500">Order Total</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#141413]">
                    {formatCurrency(selectedOrder.total, settings.currency)}
                  </div>
                </div>
              </div>

              {selectedOrder.status === 'Cancelled' ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  Order cancelled: {selectedOrder.cancellationReason || 'Cancelled by restaurant.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {ORDER_STATUS_SEQUENCE.filter((step) =>
                    selectedOrder.fulfillmentType === 'Pickup'
                      ? step !== 'Assigned to rider' &&
                        step !== 'Out for delivery' &&
                        step !== 'Delivered'
                      : true,
                  ).map((step) => {
                    const stepIdx = ORDER_STATUS_SEQUENCE.indexOf(step);
                    const done = activeStepIdx >= stepIdx;
                    const current = selectedOrder.status === step;
                    const event = selectedOrder.statusHistory.find((h) => h.status === step);

                    return (
                      <div key={step} className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                            done
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-stone-300 text-stone-400'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 flex items-center justify-between gap-2 text-sm">
                          <span
                            className={
                              current
                                ? 'font-bold text-[#141413]'
                                : done
                                  ? 'font-medium text-stone-800'
                                  : 'text-stone-400'
                            }
                          >
                            {step}
                          </span>
                          {event && (
                            <span className="text-xs font-mono tabular-nums text-stone-500">
                              {new Date(event.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rider & Dispatch Card */}
              {selectedOrder.fulfillmentType === 'Delivery' && (
                <div className="pt-4 border-t border-stone-100 space-y-2 text-xs text-stone-600">
                  <div className="font-semibold text-[#141413] text-sm">
                    Delivery & Rider Dispatch
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>
                      {selectedOrder.deliveryAddress} ({selectedOrder.deliveryZone})
                    </span>
                  </div>
                  {assignedRider ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span>
                        Rider: <strong className="text-[#141413]">{assignedRider.name}</strong> ·{' '}
                        {assignedRider.vehicleType} ({assignedRider.plateNumber}) ·{' '}
                        <span className="font-mono">{assignedRider.phone}</span>
                      </span>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#C8231B] hover:underline whitespace-nowrap shrink-0"
                      >
                        Google Maps Route
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-stone-500">
                      Rider will be assigned once the kitchen finishes preparing your order. Status updates reflect dispatch milestones (live GPS map tracking is not enabled yet).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Customer Feedback Form */}
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#141413]">
                    Rate Your Experience
                  </h3>
                  <p className="text-xs text-stone-500">
                    Tell us how the food and delivery were for #{selectedOrder.orderNumber}.
                  </p>
                </div>
                <a
                  href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
                    `Hi K Town Burger, I need help with Order ${selectedOrder.orderNumber}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-[#141413] hover:bg-stone-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Phone className="w-3.5 h-3.5 text-[#C8231B]" />
                  Contact Restaurant
                </a>
              </div>

              {selectedOrder.feedbackSubmitted || feedbackSuccess ? (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                  <div className="font-semibold">Thank you for your feedback!</div>
                  <p>
                    Loved your meal? Leave us a quick public Google Review to help other burger fans find K Town Burger.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label htmlFor="fb-overall" className="block font-semibold text-stone-700 mb-1">
                        Overall
                      </label>
                      <select
                        id="fb-overall"
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-stone-200 rounded-lg bg-white"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fb-food" className="block font-semibold text-stone-700 mb-1">
                        Food Quality
                      </label>
                      <select
                        id="fb-food"
                        value={foodRating}
                        onChange={(e) => setFoodRating(Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-stone-200 rounded-lg bg-white"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fb-delivery" className="block font-semibold text-stone-700 mb-1">
                        Delivery
                      </label>
                      <select
                        id="fb-delivery"
                        value={deliveryRating}
                        onChange={(e) => setDeliveryRating(Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-stone-200 rounded-lg bg-white"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Share what you liked or what we can improve..."
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
                  />
                  {feedbackError && (
                    <p className="text-xs text-red-600">{feedbackError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right: Receipt & WhatsApp Formatted Order */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#141413]">Order Receipt</h3>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5 no-print cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
              </div>

              <div className="text-xs text-stone-500 space-y-0.5">
                <div>Customer: {selectedOrder.customerName}</div>
                <div>Phone: {selectedOrder.customerPhone}</div>
                <div>
                  Payment: {selectedOrder.paymentMethod} · Ref{' '}
                  <span className="font-mono">{selectedOrder.paymentReference}</span>
                </div>
              </div>

              <div className="divide-y divide-stone-100 border-y border-stone-200 py-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-[#141413]">
                        {item.quantity}x {item.name}
                      </div>
                      {(item.sizeLabel || item.extrasLabels.length > 0 || item.isComboUpgrade) && (
                        <div className="text-stone-500">
                          {[
                            item.sizeLabel,
                            item.isComboUpgrade ? 'Combo' : null,
                            ...item.extrasLabels,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="font-mono tabular-nums font-medium text-[#141413]">
                      {formatCurrency(item.lineTotal, settings.currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(selectedOrder.subtotal, settings.currency)}
                  </span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">
                      -{formatCurrency(selectedOrder.discount, settings.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-mono tabular-nums">
                    {selectedOrder.deliveryFee === 0
                      ? 'Free'
                      : formatCurrency(selectedOrder.deliveryFee, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#141413] pt-2 border-t border-stone-200">
                  <span>Total Paid / Due</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(selectedOrder.total, settings.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* WhatsApp Integration Dispatch */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3 no-print">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#141413]">WhatsApp Order Dispatch</h3>
                <span className="text-[11px] text-stone-500">Formatted Summary</span>
              </div>
              <pre className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-[11px] font-mono text-stone-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {waMessage}
              </pre>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(waMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 inline-flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send via WhatsApp
                </a>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedWa ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
