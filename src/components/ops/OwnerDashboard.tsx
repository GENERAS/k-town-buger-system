import { computeOwnerAnalytics, formatCurrency } from '../../domain/rules';
import type { RestaurantState } from '../../domain/types';

interface OwnerDashboardProps {
  state: RestaurantState;
}

export function OwnerDashboard({ state }: OwnerDashboardProps) {
  const analytics = computeOwnerAnalytics({
    orders: state.orders,
    customers: state.customers,
    expenses: state.expenses,
    menuItems: state.menu,
    ingredients: state.ingredients,
  });

  const maxHourCount = Math.max(1, ...analytics.hourCounts);
  const currency = state.settings.currency;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">Owner Performance & Forecasting</h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Live revenue, order economics, customer retention, delivery SLA, and 7-day ingredient demand forecast.
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Total Revenue (Period)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#141413] mt-1">
            {formatCurrency(analytics.totalRevenue, currency)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Daily: {formatCurrency(analytics.dailyRevenue, currency)}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Total Orders & AOV</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#141413] mt-1">
            {analytics.totalOrders} orders
          </div>
          <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
            AOV: {formatCurrency(analytics.averageOrderValue, currency)}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">30-Min Delivery SLA</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {analytics.onTimeRate}% On-Time
          </div>
          <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
            Avg: {analytics.avgDeliveryMinutes} min · {analytics.cancelledCount} cancelled
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">Estimated Net Profit</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-1 ${
              analytics.netProfit >= 0 ? 'text-[#141413]' : 'text-red-700'
            }`}
          >
            {formatCurrency(analytics.netProfit, currency)}
          </div>
          <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
            Gross: {formatCurrency(analytics.grossProfit, currency)}
          </div>
        </div>
      </div>

      {/* Revenue Windows & Customer Acquisition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#141413]">Peak Ordering Hours</h2>
            <span className="text-xs text-stone-500">Orders by hour of day</span>
          </div>
          <div className="grid grid-cols-12 gap-1.5 items-end h-32 pt-4">
            {analytics.hourCounts.slice(10, 22).map((count, i) => {
              const hour = i + 10;
              const pct = count === 0 ? 4 : Math.max(14, Math.round((count / maxHourCount) * 100));
              return (
                <div key={hour} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className={`w-full rounded-t ${count === 0 ? 'bg-stone-200' : 'bg-[#C8231B]/90'}`}
                    style={{ height: `${pct}%` }}
                    title={`${hour}:00 — ${count} ${count === 1 ? 'order' : 'orders'}`}
                  />
                  <span className="text-[10px] font-mono tabular-nums text-stone-500">
                    {hour}h
                  </span>
                </div>
              );
            })}
          </div>
          <div className="pt-3 border-t border-stone-100 grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-stone-500">Weekly Revenue</span>
              <div className="font-mono tabular-nums font-bold text-[#141413] mt-0.5">
                {formatCurrency(analytics.weeklyRevenue, currency)}
              </div>
            </div>
            <div>
              <span className="text-stone-500">Monthly Revenue</span>
              <div className="font-mono tabular-nums font-bold text-[#141413] mt-0.5">
                {formatCurrency(analytics.monthlyRevenue, currency)}
              </div>
            </div>
            <div>
              <span className="text-stone-500">Returning vs New</span>
              <div className="font-mono tabular-nums font-bold text-[#141413] mt-0.5">
                {analytics.returningCustomers} returning / {analytics.newCustomers} new
              </div>
            </div>
          </div>
        </div>

        {/* Payment Breakdown & Promotion ROI */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-bold text-[#141413]">Payment Method Breakdown</h2>
          <div className="divide-y divide-stone-100 text-xs">
            {Object.entries(analytics.paymentBreakdown).map(([method, data]) => (
              <div key={method} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#141413]">{method}</div>
                  <div className="text-stone-500">
                    {data.count} {data.count === 1 ? 'order' : 'orders'}
                  </div>
                </div>
                <div className="font-mono tabular-nums font-bold text-[#141413]">
                  {formatCurrency(data.amount, currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bestsellers & Least-Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">Bestselling Products</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 text-left">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium text-right">Qty Sold</th>
                <th className="py-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {analytics.bestSellers.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 font-medium text-[#141413]">{p.name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{p.qty}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(p.revenue, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">Slow-Moving Items & Promo ROI</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 text-left">
                <th className="py-2 font-medium">Least-Selling Item</th>
                <th className="py-2 font-medium text-right">Qty Sold</th>
                <th className="py-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {analytics.leastSellers.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 font-medium text-[#141413]">{p.name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{p.qty}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatCurrency(p.revenue, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pt-2 border-t border-stone-100 text-xs text-stone-600 flex justify-between">
            <span>Active Campaign Revenue</span>
            <span className="font-mono tabular-nums font-semibold text-[#141413]">
              {formatCurrency(
                state.campaigns.reduce((s, c) => s + c.revenueGenerated, 0),
                currency,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Demand & Stock Forecasting */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-[#141413]">7-Day Demand & Stock Forecasting</h2>
          <p className="text-xs text-stone-500">
            Projected ingredient consumption based on order velocity to prevent stockouts and over-purchasing.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 text-left">
                <th className="py-2 font-medium">Ingredient</th>
                <th className="py-2 font-medium text-right">Current Stock</th>
                <th className="py-2 font-medium text-right">Est. 7-Day Need</th>
                <th className="py-2 font-medium text-right">Days Left</th>
                <th className="py-2 font-medium text-right">Suggested Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {analytics.forecastedIngredients.map((f) => (
                <tr key={f.ingredientId}>
                  <td className="py-2.5 font-medium text-[#141413]">{f.name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {f.currentStock} {f.unit}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {f.projected7DayNeed} {f.unit}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono tabular-nums font-semibold ${
                      f.daysRemaining <= 3 ? 'text-red-700' : 'text-stone-700'
                    }`}
                  >
                    {f.daysRemaining}d
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                    {f.suggestedOrderQty > 0 ? (
                      <span className="text-amber-700">
                        +{f.suggestedOrderQty} {f.unit}
                      </span>
                    ) : (
                      <span className="text-emerald-700">Covered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
