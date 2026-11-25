import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency } from '../../domain/rules';
import type { MenuCategory, RestaurantState, StaffRole } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';

interface AdminDashboardProps {
  state: RestaurantState;
  onRefresh: () => void;
}

export function AdminDashboard({ state, onRefresh }: AdminDashboardProps) {
  const { actions } = usePlatform();
  // New Menu Item
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<MenuCategory>('Burgers');
  const [itemPrice, setItemPrice] = useState('22000');
  const [itemDesc, setItemDesc] = useState('');

  // New Staff Member
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('Cashier');
  const [staffPhone, setStaffPhone] = useState('');

  // Store Settings
  const [promoBanner, setPromoBanner] = useState(state.settings.activePromoBanner);
  const [deliveryFee, setDeliveryFee] = useState(String(state.settings.deliveryFeeBase));
  const [openingHours, setOpeningHours] = useState(state.settings.openingHours);
  const [savedSettings, setSavedSettings] = useState(false);

  useEffect(() => {
    setPromoBanner(state.settings.activePromoBanner);
    setDeliveryFee(String(state.settings.deliveryFeeBase));
    setOpeningHours(state.settings.openingHours);
  }, [
    state.settings.activePromoBanner,
    state.settings.deliveryFeeBase,
    state.settings.openingHours,
  ]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice) return;
    await actions.createMenuItem({
      name: itemName.trim(),
      category: itemCategory,
      price: Number(itemPrice),
      description: itemDesc.trim() || 'Freshly grilled K Town Burger specialty.',
    });
    setItemName('');
    setItemDesc('');
    await onRefresh();
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffPhone.trim()) return;
    await actions.createStaff({
      name: staffName.trim(),
      role: staffRole,
      phone: staffPhone.trim(),
    });
    setStaffName('');
    setStaffPhone('');
    await onRefresh();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await actions.updateSettings({
      activePromoBanner: promoBanner,
      deliveryFeeBase: Number(deliveryFee),
      openingHours,
    });
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#141413]">
          Admin: Menu, Staff Permissions & System Settings
        </h1>
        <p className="text-sm text-stone-600 mt-0.5">
          Manage menu items and availability, staff accounts and role permissions, activity history, and sandbox gateway settings.
        </p>
      </div>

      {/* Menu & Product Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">Menu & Product Availability</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-left">
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 font-medium">Category</th>
                  <th className="py-2 font-medium text-right">Price</th>
                  <th className="py-2 font-medium text-right">Featured</th>
                  <th className="py-2 font-medium text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {state.menu.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 font-semibold text-[#141413]">{item.name}</td>
                    <td className="py-2.5 text-stone-600">{item.category}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(item.price, state.settings.currency)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          actions
                            .updateMenuItem(item.id, { bestseller: !item.bestseller })
                            .then(onRefresh)
                        }
                        className="text-stone-600 hover:text-[#141413] cursor-pointer"
                      >
                        {item.bestseller ? 'Bestseller' : 'Standard'}
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          actions
                            .updateMenuItem(item.id, { available: !item.available })
                            .then(onRefresh)
                        }
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          item.available
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {item.available ? 'In Stock' : 'Sold Out'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={handleAddProduct}
          className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-[#141413]">Add Menu Product</h3>
          <input
            type="text"
            required
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Product Name"
            className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value as MenuCategory)}
              className="px-2.5 py-2 text-xs border border-stone-200 rounded-lg bg-white"
            >
              <option value="Burgers">Burgers</option>
              <option value="Chicken">Chicken</option>
              <option value="Pizza">Pizza</option>
              <option value="Fries">Fries</option>
              <option value="Drinks">Drinks</option>
              <option value="Combos">Combos</option>
            </select>
            <input
              type="number"
              required
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="Price (UGX)"
              className="px-3 py-2 text-xs border border-stone-200 rounded-lg font-mono"
            />
          </div>
          <textarea
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            rows={2}
            placeholder="Product description..."
            className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        </form>
      </div>

      {/* Staff & Role-Based Permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-[#141413]">
            Staff Accounts & Role-Based Permissions
          </h2>
          <div className="divide-y divide-stone-100 text-xs">
            {state.staff.map((st) => (
              <div key={st.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-[#141413]">
                    {st.name} · <span className="text-[#C8231B]">{st.role}</span>
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {st.phone} · Permissions: {st.permissions.join(', ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => actions.updateStaff(st.id, { active: !st.active }).then(onRefresh)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    st.active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border border-stone-200'
                  }`}
                >
                  {st.active ? 'Active' : 'Suspended'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <form
            onSubmit={handleAddStaff}
            className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-[#141413]">Add Staff Account</h3>
            <input
              type="text"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Staff Full Name"
              className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                className="px-2.5 py-2 text-xs border border-stone-200 rounded-lg bg-white"
              >
                <option value="Owner">Owner</option>
                <option value="Admin">Admin</option>
                <option value="Cashier">Cashier</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Delivery Manager">Delivery Manager</option>
                <option value="Rider">Rider</option>
              </select>
              <input
                type="tel"
                required
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                placeholder="Phone (+256...)"
                className="px-3 py-2 text-xs border border-stone-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] cursor-pointer"
            >
              Create Account
            </button>
          </form>

          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-[#141413]">
              Store & Sandbox Integration Settings
            </h3>
            <input
              type="text"
              value={promoBanner}
              onChange={(e) => setPromoBanner(e.target.value)}
              placeholder="Storefront Top Promo Banner"
              className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="Base Delivery Fee"
                className="px-3 py-2 text-xs border border-stone-200 rounded-lg font-mono"
              />
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Opening Hours"
                className="px-3 py-2 text-xs border border-stone-200 rounded-lg"
              />
            </div>
            <div className="text-[11px] text-stone-500">
              Sandbox mode active for MTN MoMo, Airtel Money, WhatsApp & SMS until live merchant keys are approved.
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#C8231B] text-white text-xs font-semibold hover:bg-[#A91B14] cursor-pointer"
            >
              {savedSettings ? 'Settings Saved' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Staff Accountability Activity Log */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <h2 className="text-base font-bold text-[#141413]">Staff Activity & Accountability Log</h2>
        <div className="divide-y divide-stone-100 text-xs max-h-56 overflow-y-auto">
          {state.staffActivity.slice(0, 12).map((act) => (
            <div key={act.id} className="py-2 flex items-center justify-between gap-4">
              <div>
                <strong className="text-[#141413]">{act.staffName}</strong> ({act.role}) ·{' '}
                <span className="text-stone-700">{act.action}</span>
              </div>
              <span className="font-mono text-stone-400 shrink-0">
                {new Date(act.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
