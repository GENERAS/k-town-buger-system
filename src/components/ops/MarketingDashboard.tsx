import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import type { Campaign, RestaurantState } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';
import { QrCodeImage } from '../shared/QrCodeImage';

interface MarketingDashboardProps {
  state: RestaurantState;
  onRefresh: () => void;
}

export function MarketingDashboard({ state, onRefresh }: MarketingDashboardProps) {
  const { actions } = usePlatform();
  const [campName, setCampName] = useState('');
  const [campCode, setCampCode] = useState('');
  const [campType, setCampType] = useState<Campaign['type']>('Percentage');
  const [campValue, setCampValue] = useState(15);
  const [scheduleLabel, setScheduleLabel] = useState('Weekends');

  const [qrLabel, setQrLabel] = useState('');
  const [qrSource, setQrSource] = useState('');
  const [qrType, setQrType] = useState<'Table' | 'Flyer' | 'Packaging' | 'Social'>('Table');

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://ktownburger.app';

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim() || !campCode.trim()) return;
    await actions.createCampaign({
      name: campName.trim(),
      code: campCode.trim().toUpperCase(),
      type: campType,
      value: Number(campValue),
      minOrderAmount: 20000,
      scheduleLabel,
    });
    setCampName('');
    setCampCode('');
    await onRefresh();
  };

  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrLabel.trim() || !qrSource.trim()) return;
    await actions.createQrChannel({
      label: qrLabel.trim(),
      channelType: qrType,
      sourceCode: qrSource.trim(),
    });
    setQrLabel('');
    setQrSource('');
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">
          Loyalty, Promotions, Automation & QR Channels
        </h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Manage Buy-5-Burgers loyalty rewards, promo campaigns, WhatsApp/SMS sandbox automations, and trackable QR codes.
        </p>
      </div>

      {/* Campaigns & Loyalty Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#141413]">
              Promotional Campaigns & ROI
            </h2>
            <span className="text-xs text-stone-500">
              Buy 5 Burgers → 1 Free Reward active automatically
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-left">
                  <th className="py-2 font-medium">Campaign</th>
                  <th className="py-2 font-medium">Code</th>
                  <th className="py-2 font-medium">Schedule</th>
                  <th className="py-2 font-medium text-right">Orders</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {state.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 font-semibold text-[#141413]">{c.name}</td>
                    <td className="py-2.5 font-mono font-bold text-[#C8231B]">{c.code}</td>
                    <td className="py-2.5 text-stone-600">{c.scheduleLabel}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {c.ordersGenerated}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(c.revenueGenerated, state.settings.currency)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => actions.toggleCampaign(c.id, !c.active).then(onRefresh)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          c.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-stone-100 text-stone-500 border border-stone-200'
                        }`}
                      >
                        {c.active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={handleCreateCampaign}
          className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-[#141413]">Launch New Campaign</h3>
          <input
            type="text"
            required
            value={campName}
            onChange={(e) => setCampName(e.target.value)}
            placeholder="Campaign Name (e.g., Friday Night Smash)"
            className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={campCode}
              onChange={(e) => setCampCode(e.target.value)}
              placeholder="Code (e.g., FRI15)"
              className="px-3 py-2 text-xs border border-stone-200 rounded-lg uppercase font-mono"
            />
            <select
              value={campType}
              onChange={(e) => setCampType(e.target.value as Campaign['type'])}
              className="px-2 py-2 text-xs border border-stone-200 rounded-lg bg-white"
            >
              <option value="Percentage">% Discount</option>
              <option value="Fixed">Fixed UGX Off</option>
              <option value="Free Delivery">Free Delivery</option>
              <option value="Birthday">Birthday Offer</option>
              <option value="Referral">Referral Reward</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={campValue}
              onChange={(e) => setCampValue(Number(e.target.value))}
              placeholder="Value"
              className="px-3 py-2 text-xs border border-stone-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              placeholder="Schedule (e.g., Lunch)"
              className="px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Campaign
          </button>
        </form>
      </div>

      {/* Marketing Automation Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">
            Marketing Automation (WhatsApp & SMS Sandbox)
          </h2>
          <div className="divide-y divide-stone-100">
            {state.automations.map((rule) => (
              <div key={rule.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#141413]">{rule.name}</div>
                  <div className="text-[11px] text-stone-500">
                    {rule.channel} · Trigger: {rule.trigger} · {rule.sentCount} sent ({rule.conversionCount} converted)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => actions.toggleAutomation(rule.id, !rule.enabled).then(onRefresh)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      rule.enabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border border-stone-200'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.triggerAutomation(rule.id).then(onRefresh)}
                    className="px-2.5 py-1 rounded bg-[#141413] text-white text-[11px] font-semibold hover:bg-[#C8231B] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    Test Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#141413]">Recent Sandbox Dispatch Log</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.automationLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-0.5">
                <div className="font-semibold text-[#141413]">
                  {log.ruleName} · <span className="font-normal text-stone-500">{log.channel}</span>
                </div>
                <div className="text-stone-600">{log.message}</div>
                <div className="text-[11px] text-stone-400">
                  To: {log.recipientName} ({log.recipientPhone})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QR Code Ordering Channels */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#141413]">
              QR Code Ordering & Channel Attribution
            </h2>
            <p className="text-xs text-stone-500">
              Place scannable QR codes on tables, flyers, and takeaway packaging to track orders per marketing channel.
            </p>
          </div>
          <form onSubmit={handleCreateQr} className="flex flex-wrap gap-2">
            <input
              type="text"
              required
              value={qrLabel}
              onChange={(e) => setQrLabel(e.target.value)}
              placeholder="Label (e.g., Table 08)"
              className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={qrSource}
              onChange={(e) => setQrSource(e.target.value)}
              placeholder="Code (e.g., table-08)"
              className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg font-mono"
            />
            <select
              value={qrType}
              onChange={(e) =>
                setQrType(e.target.value as 'Table' | 'Flyer' | 'Packaging' | 'Social')
              }
              className="px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-white"
            >
              <option value="Table">Table</option>
              <option value="Flyer">Flyer</option>
              <option value="Packaging">Packaging</option>
              <option value="Social">Social</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] cursor-pointer"
            >
              Generate QR
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {state.qrChannels.map((qr) => {
            const url = `${originUrl}/?source=${encodeURIComponent(qr.sourceCode)}`;
            return (
              <div
                key={qr.id}
                className="border border-stone-200 rounded-xl p-4 flex items-center gap-4"
              >
                <QrCodeImage value={url} size={96} label={qr.label} />
                <div className="min-w-0 space-y-1 text-xs">
                  <div className="font-bold text-[#141413] truncate">{qr.label}</div>
                  <div className="text-stone-500">
                    {qr.channelType} · <span className="font-mono">{qr.sourceCode}</span>
                  </div>
                  <div className="font-mono tabular-nums text-stone-700 pt-1">
                    {qr.scans} scans · {qr.ordersCount} orders
                  </div>
                  <div className="font-mono tabular-nums font-bold text-[#141413]">
                    {formatCurrency(qr.revenue, state.settings.currency)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
