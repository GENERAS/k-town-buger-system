import { useState } from 'react';
import { ExternalLink, MapPin, Plus } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import type { OrderStatus, RestaurantState, StaffRole } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface DeliveryDashboardProps {
  state: RestaurantState;
  activeRole: StaffRole;
  onRefresh: () => void;
}

export function DeliveryDashboard({
  state,
  activeRole,
  onRefresh,
}: DeliveryDashboardProps) {
  const { actions } = usePlatform();
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const deliveryOrders = state.orders.filter(
    (o) =>
      o.fulfillmentType === 'Delivery' &&
      o.status !== 'Cancelled' &&
      o.status !== 'Completed',
  );

  const handleAssignAndDispatch = async (
    orderId: string,
    riderId: string,
    status: OrderStatus,
  ) => {
    setBusyId(orderId);
    try {
      await actions.updateOrderStatus(orderId, {
        riderId,
        status,
        actorName: 'Dispatch Desk',
        actorRole: activeRole,
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleAddRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderName.trim() || !riderPhone.trim()) return;
    await actions.createRider({
      name: riderName.trim(),
      phone: riderPhone.trim(),
      vehicleType: 'Motorbike',
      plateNumber: plate.trim() || 'UFM 210C',
    });
    setRiderName('');
    setRiderPhone('');
    setPlate('');
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">Delivery & Rider Dispatch</h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Assign riders, open Google Maps turn-by-turn routes, monitor delivery times, and track failed delivery logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Deliveries */}
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-base font-bold text-[#141413]">
            Active Delivery Queue ({deliveryOrders.length})
          </h2>
          {deliveryOrders.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-10 text-center text-xs text-stone-500">
              No active deliveries right now.
            </div>
          ) : (
            <div className="space-y-3">
              {deliveryOrders.map((order) => {
                const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                  state.settings.locationPin || state.settings.address,
                )}&destination=${encodeURIComponent(
                  order.locationPin || order.deliveryAddress || state.settings.address,
                )}`;

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-stone-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-mono font-bold text-[#141413]">
                          {order.orderNumber} · {order.status}
                        </div>
                        <div className="text-xs text-stone-600 mt-0.5">
                          {order.customerName} ({order.customerPhone})
                        </div>
                        <div className="text-xs text-stone-600 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#C8231B] shrink-0" />
                          <span>
                            {order.deliveryAddress} ({order.deliveryZone})
                          </span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-mono tabular-nums font-bold text-[#141413]">
                          {formatCurrency(order.total, state.settings.currency)}
                        </div>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8231B] hover:underline"
                        >
                          Google Maps Directions
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
                      <select
                        aria-label={`Select rider for ${order.orderNumber}`}
                        value={order.riderId || ''}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          handleAssignAndDispatch(
                            order.id,
                            e.target.value,
                            order.status === 'Ready for pickup' ||
                              order.status === 'Order confirmed' ||
                              order.status === 'Preparing food'
                              ? 'Assigned to rider'
                              : order.status,
                          );
                        }}
                        className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg bg-stone-50"
                      >
                        <option value="">Assign Rider...</option>
                        {state.riders.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.status} · Avg {r.avgDeliveryMinutes}m)
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        {order.status === 'Assigned to rider' && (
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() =>
                              actions
                                .updateOrderStatus(order.id, {
                                  status: 'Out for delivery',
                                  actorRole: activeRole,
                                })
                                .then(onRefresh)
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] cursor-pointer"
                          >
                            Start Delivery
                          </button>
                        )}
                        {order.status === 'Out for delivery' && (
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() =>
                              actions
                                .updateOrderStatus(order.id, {
                                  status: 'Delivered',
                                  actorRole: activeRole,
                                })
                                .then(onRefresh)
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {order.status === 'Delivered' && (
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() =>
                              actions
                                .updateOrderStatus(order.id, {
                                  status: 'Completed',
                                  actorRole: activeRole,
                                })
                                .then(onRefresh)
                            }
                            className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-semibold cursor-pointer"
                          >
                            Close Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Riders Roster & Registration */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-[#141413]">Rider Fleet & Performance</h2>
            <div className="divide-y divide-stone-100 text-xs">
              {state.riders.map((r) => (
                <div key={r.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">{r.name}</span>
                    <span
                      className={`font-semibold ${
                        r.status === 'Available'
                          ? 'text-emerald-700'
                          : r.status === 'On Delivery'
                            ? 'text-amber-700'
                            : 'text-stone-500'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-stone-500">
                    {r.vehicleType} ({r.plateNumber}) · {r.phone}
                  </div>
                  <div className="text-stone-600 font-mono tabular-nums flex items-center justify-between">
                    <span>
                      {r.completedDeliveries} done · {r.failedDeliveries} failed · Avg {r.avgDeliveryMinutes}m
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        actions
                          .updateRider(r.id, {
                            failedDeliveries: r.failedDeliveries + 1,
                          })
                          .then(onRefresh)
                      }
                      className="text-[11px] text-red-700 hover:underline cursor-pointer"
                    >
                      + Log Fail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddRider}
            className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-[#141413]">Register New Rider</h3>
            <input
              type="text"
              required
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              placeholder="Rider Full Name"
              className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
            <input
              type="tel"
              required
              value={riderPhone}
              onChange={(e) => setRiderPhone(e.target.value)}
              placeholder="Phone (+256...)"
              className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Bike Plate (e.g., UFN 204A)"
              className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Rider
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
