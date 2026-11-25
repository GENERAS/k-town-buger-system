import { useState } from 'react';
import { MessageSquare, Printer, Search } from 'lucide-react';
import {
  formatCurrency,
  formatWhatsAppOrderMessage,
  getNextOrderStatus,
} from '../../domain/rules';
import type { Order, OrderStatus, RestaurantState, StaffRole } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface OrdersDashboardProps {
  state: RestaurantState;
  activeRole: StaffRole;
  onRefresh: () => void;
}

export function OrdersDashboard({
  state,
  activeRole,
  onRefresh,
}: OrdersDashboardProps) {
  const { actions } = usePlatform();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Active' | 'All' | 'Completed' | 'Cancelled'>('Active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const filtered = state.orders.filter((o) => {
    const matchesSearch =
      !search.trim() ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone.includes(search);
    if (!matchesSearch) return false;
    if (statusFilter === 'Active') {
      return o.status !== 'Completed' && o.status !== 'Cancelled';
    }
    if (statusFilter === 'Completed') return o.status === 'Completed';
    if (statusFilter === 'Cancelled') return o.status === 'Cancelled';
    return true;
  });

  const handleUpdate = async (
    orderId: string,
    payload: {
      status?: OrderStatus;
      paymentStatus?: 'Pending' | 'Confirmed' | 'Failed' | 'Refunded';
      cancellationReason?: string;
      refundAmount?: number;
    },
  ) => {
    setBusyId(orderId);
    try {
      await actions.updateOrderStatus(orderId, {
        ...payload,
        actorName: `${activeRole} Desk`,
        actorRole: activeRole,
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#141413]">Orders & Payments Queue</h1>
          <p className="text-sm text-stone-600 mt-0.5">
            Confirm incoming orders, reconcile MoMo/Airtel/COD payments, send WhatsApp updates, and issue refunds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #KTB or customer..."
              aria-label="Search orders"
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
            />
          </div>
          <div className="flex gap-1 p-1 bg-stone-100 rounded-lg">
            {(['Active', 'Completed', 'Cancelled', 'All'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-[#141413] shadow-sm'
                    : 'text-stone-600 hover:text-[#141413]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Takeover Alerts from AI Assistant */}
      {state.takeoverRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-bold text-amber-900">
            Assistant Staff Takeover Requests ({state.takeoverRequests.length})
          </div>
          {state.takeoverRequests.slice(0, 3).map((t) => (
            <div key={t.id} className="text-xs text-amber-800">
              • "{t.customerPrompt}" ({new Date(t.createdAt).toLocaleTimeString()})
            </div>
          ))}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 text-left">
                <th className="py-3 px-4 font-medium">Order</th>
                <th className="py-3 px-4 font-medium">Customer & Fulfillment</th>
                <th className="py-3 px-4 font-medium">Items</th>
                <th className="py-3 px-4 font-medium">Payment</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-stone-500">
                    No orders match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const nextStatus = getNextOrderStatus(order.status, order.fulfillmentType);
                  const waText = formatWhatsAppOrderMessage(order, state.settings);

                  return (
                    <tr key={order.id} className="hover:bg-stone-50/60 align-top">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#141413]">
                          {order.orderNumber}
                        </div>
                        <div className="text-stone-500 font-mono mt-0.5">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {order.qrSource && (
                          <div className="text-[11px] text-[#C8231B] mt-0.5">
                            QR: {order.qrSource}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#141413]">{order.customerName}</div>
                        <div className="text-stone-500 font-mono">{order.customerPhone}</div>
                        <div className="text-stone-600 mt-0.5">
                          {order.fulfillmentType}
                          {order.deliveryAddress ? ` · ${order.deliveryAddress}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        {order.items.map((it, i) => (
                          <div key={i} className="text-stone-700 truncate">
                            {it.quantity}x {it.name}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#141413]">{order.paymentMethod}</div>
                        <div
                          className={`mt-0.5 font-semibold ${
                            order.paymentStatus === 'Confirmed'
                              ? 'text-emerald-700'
                              : order.paymentStatus === 'Refunded' || order.paymentStatus === 'Failed'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {order.paymentStatus} · {order.paymentReference}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#141413]">{order.status}</span>
                        {order.riderName && (
                          <div className="text-stone-500 mt-0.5">Rider: {order.riderName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#141413]">
                        {formatCurrency(order.total, state.settings.currency)}
                      </td>
                      <td className="py-3 px-4 text-right space-y-1.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.paymentStatus === 'Pending' && order.status !== 'Cancelled' && (
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() =>
                                handleUpdate(order.id, { paymentStatus: 'Confirmed' })
                              }
                              className="px-2.5 py-1 rounded bg-emerald-700 text-white font-semibold hover:bg-emerald-800 cursor-pointer"
                            >
                              Confirm Pay
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() => handleUpdate(order.id, { status: nextStatus })}
                              className="px-2.5 py-1 rounded bg-[#141413] text-white font-semibold hover:bg-[#C8231B] cursor-pointer"
                            >
                              {nextStatus === 'Order confirmed' ? 'Confirm Order' : `→ ${nextStatus}`}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(order)}
                            aria-label={`Print receipt for ${order.orderNumber}`}
                            className="p-1.5 rounded border border-stone-200 text-stone-600 hover:bg-stone-100 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waText)}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Send WhatsApp update for ${order.orderNumber}`}
                            className="p-1.5 rounded border border-stone-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {order.status !== 'Cancelled' && order.status !== 'Completed' && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() =>
                                handleUpdate(order.id, {
                                  status: 'Cancelled',
                                  cancellationReason: 'Cancelled at order desk',
                                })
                              }
                              className="text-[11px] text-red-700 hover:underline cursor-pointer"
                            >
                              Cancel
                            </button>
                            {order.paymentStatus === 'Confirmed' && (
                              <button
                                type="button"
                                disabled={busyId === order.id}
                                onClick={() =>
                                  handleUpdate(order.id, {
                                    status: 'Cancelled',
                                    paymentStatus: 'Refunded',
                                    refundAmount: order.total,
                                    cancellationReason: 'Refunded by staff',
                                  })
                                }
                                className="text-[11px] text-stone-600 hover:underline cursor-pointer"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 border border-stone-200">
            <div className="text-center border-b border-stone-200 pb-3">
              <div className="font-bold text-base text-[#141413]">K Town Burger</div>
              <div className="text-xs text-stone-500">{state.settings.address}</div>
              <div className="text-xs font-mono font-bold mt-1">{receiptOrder.orderNumber}</div>
            </div>
            <div className="text-xs space-y-1 text-stone-600">
              <div>Customer: {receiptOrder.customerName}</div>
              <div>Phone: {receiptOrder.customerPhone}</div>
              <div>Payment: {receiptOrder.paymentMethod} ({receiptOrder.paymentStatus})</div>
            </div>
            <div className="border-y border-stone-200 py-2 space-y-1.5 text-xs">
              {receiptOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.quantity}x {it.name}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(it.lineTotal, state.settings.currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-bold text-[#141413]">
              <span>Total</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(receiptOrder.total, state.settings.currency)}
              </span>
            </div>
            <div className="flex gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="px-4 py-2 rounded-lg border border-stone-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
