import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { OrderStatus, RestaurantState, StaffRole } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface KitchenDashboardProps {
  state: RestaurantState;
  activeRole: StaffRole;
  onRefresh: () => void;
}

export function KitchenDashboard({
  state,
  activeRole,
  onRefresh,
}: KitchenDashboardProps) {
  const { actions } = usePlatform();
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const kitchenQueue = state.orders.filter((o) =>
    ['New order received', 'Order confirmed', 'Preparing food', 'Ready for pickup'].includes(
      o.status,
    ),
  );

  const kitchenStaff = state.staff.filter((s) => s.role === 'Kitchen' || s.role === 'Owner');

  const advanceKitchen = async (
    orderId: string,
    status: OrderStatus,
    kitchenAssignee?: string,
  ) => {
    setBusyId(orderId);
    try {
      await actions.updateOrderStatus(orderId, {
        status,
        kitchenAssignee,
        actorName: kitchenAssignee || 'Kitchen Display',
        actorRole: activeRole,
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#141413]">Kitchen Display System (KDS)</h1>
          <p className="text-sm text-stone-600 mt-0.5">
            Live preparation queue, 30-minute delivery target countdown, delayed order alerts, and station assignment.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-stone-600 bg-white border border-stone-200 px-3 py-2 rounded-lg">
          Active Tickets: <strong className="text-[#141413]">{kitchenQueue.length}</strong> · Target Prep ≤ 15m
        </div>
      </div>

      {kitchenQueue.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-sm text-stone-500">
          Kitchen queue is clear. New orders will appear here immediately.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kitchenQueue.map((order) => {
            const elapsedMins = Math.max(
              1,
              Math.round((nowMs - new Date(order.createdAt).getTime()) / 60000),
            );
            const remainingTo30 = state.settings.deliveryTargetMinutes - elapsedMins;
            const isDelayed = elapsedMins >= 15 && order.status !== 'Ready for pickup';

            const nextKitchenStatus: OrderStatus | null =
              order.status === 'New order received'
                ? 'Order confirmed'
                : order.status === 'Order confirmed'
                  ? 'Preparing food'
                  : order.status === 'Preparing food'
                    ? 'Ready for pickup'
                    : order.fulfillmentType === 'Pickup' && order.status === 'Ready for pickup'
                      ? 'Completed'
                      : null;

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-xl p-5 flex flex-col justify-between gap-4 ${
                  isDelayed
                    ? 'border-red-400 ring-1 ring-red-200'
                    : order.priority === 'High'
                      ? 'border-amber-400'
                      : 'border-stone-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-100">
                    <div>
                      <div className="text-base font-mono font-bold text-[#141413]">
                        {order.orderNumber}
                      </div>
                      <div className="text-xs text-stone-500">
                        {order.fulfillmentType} · {order.priority} Priority
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums font-bold ${
                          isDelayed ? 'text-red-700' : 'text-stone-700'
                        }`}
                      >
                        {isDelayed ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {elapsedMins}m elapsed
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-stone-500">
                        {remainingTo30 > 0
                          ? `${remainingTo30}m to 30m SLA`
                          : `${Math.abs(remainingTo30)}m past 30m SLA`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="font-bold text-[#141413]">
                          {it.quantity}x {it.name}
                        </div>
                        {(it.sizeLabel || it.extrasLabels.length > 0 || it.isComboUpgrade) && (
                          <div className="text-stone-600">
                            {[
                              it.sizeLabel,
                              it.isComboUpgrade ? '+ Fries & Drink Combo' : null,
                              ...it.extrasLabels,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                        {it.specialInstructions && (
                          <div className="text-red-700 font-medium mt-0.5">
                            Note: {it.specialInstructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-stone-100">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-500">Status:</span>
                    <span className="font-semibold text-[#141413]">{order.status}</span>
                  </div>

                  <select
                    aria-label={`Assign kitchen staff for ${order.orderNumber}`}
                    value={order.kitchenAssignee || ''}
                    onChange={(e) =>
                      actions
                        .updateOrderStatus(order.id, {
                          kitchenAssignee: e.target.value,
                          actorName: 'Kitchen Lead',
                          actorRole: activeRole,
                        })
                        .then(onRefresh)
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-stone-50"
                  >
                    <option value="">Assign Cook / Station...</option>
                    {kitchenStaff.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>

                  {nextKitchenStatus ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() =>
                        advanceKitchen(
                          order.id,
                          nextKitchenStatus,
                          order.kitchenAssignee || kitchenStaff[0]?.name,
                        )
                      }
                      className="w-full py-2.5 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] transition-colors cursor-pointer"
                    >
                      {nextKitchenStatus === 'Preparing food'
                        ? 'Start Preparing'
                        : nextKitchenStatus === 'Ready for pickup'
                          ? 'Mark Ready for Pickup'
                          : nextKitchenStatus === 'Completed'
                            ? 'Handed to Pickup Customer'
                            : 'Confirm Ticket'}
                    </button>
                  ) : (
                    <div className="text-center text-xs font-semibold text-emerald-700 py-1.5">
                      Ready · Awaiting Rider Dispatch
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
