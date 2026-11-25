import { useState } from 'react';
import { Plus } from 'lucide-react';
import { computeOwnerAnalytics, formatCurrency } from '../../domain/rules';
import type { ExpenseRecord, RestaurantState } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface FinanceDashboardProps {
  state: RestaurantState;
  onRefresh: () => void;
}

export function FinanceDashboard({ state, onRefresh }: FinanceDashboardProps) {
  const { actions } = usePlatform();
  const [category, setCategory] = useState<ExpenseRecord['category']>('Ingredients');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const analytics = computeOwnerAnalytics({
    orders: state.orders,
    customers: state.customers,
    expenses: state.expenses,
    menuItems: state.menu,
    ingredients: state.ingredients,
  });

  const currency = state.settings.currency;

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    await actions.createExpense({
      category,
      description: description.trim(),
      amount: Number(amount),
    });
    setDescription('');
    setAmount('');
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">
          Financial Management & Reconciliation
        </h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Daily payment reconciliation, ingredient & delivery expenses, discounts, refunds, and gross/net profit statements.
        </p>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Gross Sales</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#141413] mt-1">
            {formatCurrency(analytics.totalRevenue, currency)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Est. Ingredient COGS</div>
          <div className="text-lg font-bold font-mono tabular-nums text-stone-700 mt-1">
            {formatCurrency(analytics.estimatedCogs, currency)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Discounts & Refunds</div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1">
            {formatCurrency(analytics.totalDiscounts + analytics.totalRefunds, currency)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Operating Expenses</div>
          <div className="text-lg font-bold font-mono tabular-nums text-red-700 mt-1">
            {formatCurrency(analytics.totalExpenses, currency)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Net Profit Estimate</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              analytics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatCurrency(analytics.netProfit, currency)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Reconciliation Ledger */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">Payment Reconciliation Ledger</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-left">
                  <th className="py-2 font-medium">Order</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {state.orders.slice(0, 12).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 font-mono font-bold text-[#141413]">{o.orderNumber}</td>
                    <td className="py-2.5 text-stone-700">{o.paymentMethod}</td>
                    <td className="py-2.5 font-mono text-stone-500">{o.paymentReference}</td>
                    <td
                      className={`py-2.5 font-semibold ${
                        o.paymentStatus === 'Confirmed'
                          ? 'text-emerald-700'
                          : o.paymentStatus === 'Refunded'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {o.paymentStatus}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(o.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses Entry & History */}
        <div className="lg:col-span-5 space-y-4">
          <form
            onSubmit={handleAddExpense}
            className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-[#141413]">Record Expense</h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Expense category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseRecord['category'])}
                className="px-3 py-2 text-xs border border-stone-200 rounded-lg bg-white"
              >
                <option value="Ingredients">Ingredients</option>
                <option value="Delivery">Delivery & Fuel</option>
                <option value="Utilities">Utilities & Gas</option>
                <option value="Marketing">Marketing</option>
                <option value="Staff">Staff Wages</option>
                <option value="Other">Other</option>
              </select>
              <input
                type="number"
                required
                min={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (UGX)"
                className="px-3 py-2 text-xs border border-stone-200 rounded-lg font-mono"
              />
            </div>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expense description (e.g., Cooking oil drums)"
              className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Expense
            </button>
          </form>

          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-[#141413]">Recent Expenses</h3>
            <div className="divide-y divide-stone-100 text-xs max-h-56 overflow-y-auto">
              {state.expenses.map((exp) => (
                <div key={exp.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#141413]">{exp.description}</div>
                    <div className="text-[11px] text-stone-500">{exp.category}</div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-red-700">
                    -{formatCurrency(exp.amount, currency)}
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
