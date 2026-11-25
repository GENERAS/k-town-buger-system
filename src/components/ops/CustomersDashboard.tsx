import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import type { CustomerSegment, RestaurantState } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface CustomersDashboardProps {
  state: RestaurantState;
  onRefresh: () => void;
}

export function CustomersDashboard({ state, onRefresh }: CustomersDashboardProps) {
  const { actions } = usePlatform();
  const [segmentFilter, setSegmentFilter] = useState<'All' | CustomerSegment>('All');
  const [search, setSearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const customers = state.customers.filter((c) => {
    const segMatch = segmentFilter === 'All' || c.segment === segmentFilter;
    const qMatch =
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    return segMatch && qMatch;
  });

  const avgRating =
    state.feedback.length > 0
      ? (
          state.feedback.reduce((s, f) => s + f.rating, 0) / state.feedback.length
        ).toFixed(1)
      : '5.0';

  const handleSaveNote = async (id: string) => {
    await actions.updateCustomer(id, { notes: noteText });
    setEditingNoteId(null);
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">
          Customer CRM, Loyalty & Reputation
        </h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Track spending, order frequency, Buy-5-Burgers stamps, marketing opt-in consent, and customer ratings.
        </p>
      </div>

      {/* CRM Profiles Table */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto">
            {(['All', 'VIP', 'Returning', 'First-Time', 'At-Risk'] as const).map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegmentFilter(seg)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  segmentFilter === seg
                    ? 'bg-white text-[#141413] shadow-sm'
                    : 'text-stone-600 hover:text-[#141413]'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              aria-label="Search customers"
              className="pl-8 pr-3 py-1.5 text-xs border border-stone-200 rounded-lg"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 text-left">
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium">Segment</th>
                <th className="py-2 font-medium text-right">Orders</th>
                <th className="py-2 font-medium text-right">Total Spend</th>
                <th className="py-2 font-medium">Loyalty (Buy 5)</th>
                <th className="py-2 font-medium">Consent</th>
                <th className="py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {customers.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="py-3 pr-3">
                    <div className="font-bold text-[#141413]">{c.name}</div>
                    <div className="font-mono text-stone-500">{c.phone}</div>
                  </td>
                  <td className="py-3 pr-3 font-semibold text-stone-700">{c.segment}</td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums">{c.orderCount}</td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(c.totalSpent, state.settings.currency)}
                  </td>
                  <td className="py-3 pr-3 font-mono tabular-nums">
                    <div>{c.burgerStamps}/5 stamps · {c.loyaltyPoints} pts</div>
                    {c.rewardsAvailable > 0 && (
                      <div className="text-emerald-700 font-semibold">
                        {c.rewardsAvailable} free reward ready
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() =>
                        actions
                          .updateCustomer(c.id, { marketingOptIn: !c.marketingOptIn })
                          .then(onRefresh)
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        c.marketingOptIn
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-500 border border-stone-200'
                      }`}
                    >
                      {c.marketingOptIn ? 'Opted-In' : 'Opted-Out'}
                    </button>
                  </td>
                  <td className="py-3 max-w-[220px]">
                    {editingNoteId === c.id ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNote(c.id)}
                          className="px-2 py-1 bg-[#141413] text-white rounded text-[11px] cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(c.id);
                          setNoteText(c.notes);
                        }}
                        className="text-left text-stone-600 hover:text-[#141413] cursor-pointer"
                      >
                        {c.notes || 'Add customer note...'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback & Reputation */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#141413]">
              Customer Feedback & Complaint Resolution
            </h2>
            <p className="text-xs text-stone-500">
              Average Rating: <strong className="font-mono text-[#141413]">{avgRating}/5.0</strong> ({state.feedback.length} reviews)
            </p>
          </div>
        </div>

        <div className="divide-y divide-stone-100">
          {state.feedback.map((fb) => (
            <div key={fb.id} className="py-3 flex flex-wrap items-start justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#141413]">{fb.customerName}</span>
                  <span className="font-mono text-stone-500">#{fb.orderNumber}</span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {fb.rating}/5
                  </span>
                </div>
                <p className="text-stone-700">{fb.comment}</p>
                <div className="text-[11px] text-stone-500">
                  Food: {fb.foodRating}/5 · Delivery: {fb.deliveryRating}/5
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Feedback status for ${fb.orderNumber}`}
                  value={fb.status}
                  onChange={(e) =>
                    actions.updateFeedbackStatus(fb.id, e.target.value).then(onRefresh)
                  }
                  className="px-2.5 py-1.5 border border-stone-200 rounded-lg bg-stone-50 text-xs"
                >
                  <option value="Open">Open</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Google Review Requested">Google Review Requested</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
