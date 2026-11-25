import { useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import type { RestaurantState } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface InventoryDashboardProps {
  state: RestaurantState;
  onRefresh: () => void;
}

export function InventoryDashboard({ state, onRefresh }: InventoryDashboardProps) {
  const { actions } = usePlatform();
  const [selectedIng, setSelectedIng] = useState(state.ingredients[0]?.id || '');
  const [qtyDelta, setQtyDelta] = useState(25);
  const [reason, setReason] = useState<'Restock Purchase' | 'Manual Adjustment' | 'Waste'>(
    'Restock Purchase',
  );

  useEffect(() => {
    if (!selectedIng && state.ingredients.length > 0) {
      setSelectedIng(state.ingredients[0].id);
    }
  }, [selectedIng, state.ingredients]);

  const lowStockItems = state.ingredients.filter(
    (i) => i.currentStock <= i.reorderLevel,
  );

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIng) return;
    const signedDelta = reason === 'Waste' ? -Math.abs(qtyDelta) : qtyDelta;
    await actions.adjustInventory({
      ingredientId: selectedIng,
      delta: signedDelta,
      reason,
    });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">
          Inventory, Suppliers & Recipe Deductions
        </h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Automatic recipe stock deductions on confirmed orders, low-stock alerts, supplier purchases, and movement ledger.
        </p>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <div className="font-bold">
              Low-Stock Alerts ({lowStockItems.length} ingredients at or below reorder threshold)
            </div>
            <div>
              {lowStockItems
                .map((i) => `${i.name}: ${i.currentStock} ${i.unit} left (Reorder ≤ ${i.reorderLevel})`)
                .join(' · ')}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">Ingredient Stock Levels</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-left">
                  <th className="py-2 font-medium">Ingredient</th>
                  <th className="py-2 font-medium">Supplier</th>
                  <th className="py-2 font-medium text-right">Unit Cost</th>
                  <th className="py-2 font-medium text-right">In Stock</th>
                  <th className="py-2 font-medium text-right">Reorder At</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {state.ingredients.map((ing) => {
                  const isLow = ing.currentStock <= ing.reorderLevel;
                  return (
                    <tr key={ing.id}>
                      <td className="py-2.5 font-semibold text-[#141413]">{ing.name}</td>
                      <td className="py-2.5 text-stone-600">{ing.supplierName}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {formatCurrency(ing.unitCost, state.settings.currency)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-bold">
                        {ing.currentStock} {ing.unit}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-stone-500">
                        {ing.reorderLevel} {ing.unit}
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        {isLow ? (
                          <span className="text-red-700">Low Stock</span>
                        ) : (
                          <span className="text-emerald-700">Nominal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Restock / Adjust Form */}
        <div className="lg:col-span-4 space-y-4">
          <form
            onSubmit={handleAdjust}
            className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-[#141413]">Log Restock or Adjustment</h3>
            <div>
              <label htmlFor="inv-ing" className="block text-xs font-semibold text-stone-700 mb-1">
                Ingredient
              </label>
              <select
                id="inv-ing"
                value={selectedIng}
                onChange={(e) => setSelectedIng(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg bg-white"
              >
                {state.ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.currentStock} {i.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="inv-reason" className="block text-xs font-semibold text-stone-700 mb-1">
                  Type
                </label>
                <select
                  id="inv-reason"
                  value={reason}
                  onChange={(e) =>
                    setReason(
                      e.target.value as 'Restock Purchase' | 'Manual Adjustment' | 'Waste',
                    )
                  }
                  className="w-full px-2.5 py-2 text-xs border border-stone-200 rounded-lg bg-white"
                >
                  <option value="Restock Purchase">Restock Purchase</option>
                  <option value="Manual Adjustment">Manual Adjustment</option>
                  <option value="Waste">Log Waste (-)</option>
                </select>
              </div>
              <div>
                <label htmlFor="inv-qty" className="block text-xs font-semibold text-stone-700 mb-1">
                  Quantity
                </label>
                <input
                  id="inv-qty"
                  type="number"
                  value={qtyDelta}
                  onChange={(e) => setQtyDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Update Stock
            </button>
          </form>

          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-[#141413]">Stock Movement History</h3>
            <div className="divide-y divide-stone-100 text-xs max-h-60 overflow-y-auto">
              {state.stockMovements.slice(0, 10).map((sm) => (
                <div key={sm.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-[#141413]">{sm.ingredientName}</div>
                    <div className="text-[11px] text-stone-500">
                      {sm.reason} {sm.referenceId ? `· ${sm.referenceId}` : ''}
                    </div>
                  </div>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      sm.delta >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {sm.delta > 0 ? `+${sm.delta}` : sm.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
