import { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ChefHat,
  ClipboardList,
  Database,
  DollarSign,
  LogOut,
  Megaphone,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import type { RestaurantState, StaffRole } from '../../domain/types';
import { usePlatform } from '../../context/PlatformContext';
import { OwnerDashboard } from './OwnerDashboard';
import { OrdersDashboard } from './OrdersDashboard';
import { KitchenDashboard } from './KitchenDashboard';
import { DeliveryDashboard } from './DeliveryDashboard';
import { MarketingDashboard } from './MarketingDashboard';
import { CustomersDashboard } from './CustomersDashboard';
import { InventoryDashboard } from './InventoryDashboard';
import { FinanceDashboard } from './FinanceDashboard';
import { AdminDashboard } from './AdminDashboard';

export type OpsTab =
  | 'owner'
  | 'orders'
  | 'kitchen'
  | 'delivery'
  | 'marketing'
  | 'customers'
  | 'inventory'
  | 'finance'
  | 'admin';

interface OpsShellProps {
  state: RestaurantState;
  onRefresh: () => void;
  onExitOps: () => void;
}

const NAV_ITEMS: Array<{
  id: OpsTab;
  label: string;
  responsibility: string;
  icon: typeof BarChart3;
  roles: StaffRole[];
}> = [
  {
    id: 'owner',
    label: 'Owner',
    responsibility: 'Revenue, Profit & Forecast',
    icon: BarChart3,
    roles: ['Owner', 'Admin'],
  },
  {
    id: 'orders',
    label: 'Orders',
    responsibility: 'Queue, Payments & WhatsApp',
    icon: ClipboardList,
    roles: ['Owner', 'Admin', 'Cashier'],
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    responsibility: 'Prep Queue & 30m Timers',
    icon: ChefHat,
    roles: ['Owner', 'Admin', 'Kitchen'],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    responsibility: 'Riders & Route Dispatch',
    icon: Truck,
    roles: ['Owner', 'Admin', 'Delivery Manager', 'Rider'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    responsibility: 'Loyalty, Campaigns & QR',
    icon: Megaphone,
    roles: ['Owner', 'Admin'],
  },
  {
    id: 'customers',
    label: 'Customers',
    responsibility: 'CRM, Consent & Feedback',
    icon: Users,
    roles: ['Owner', 'Admin', 'Cashier'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    responsibility: 'Stock, Recipes & Suppliers',
    icon: Package,
    roles: ['Owner', 'Admin', 'Kitchen'],
  },
  {
    id: 'finance',
    label: 'Finance',
    responsibility: 'Expenses & P&L Reports',
    icon: DollarSign,
    roles: ['Owner', 'Admin'],
  },
  {
    id: 'admin',
    label: 'Admin',
    responsibility: 'Menu, Staff & Settings',
    icon: Settings,
    roles: ['Owner', 'Admin'],
  },
];

export function OpsShell({ state, onRefresh, onExitOps }: OpsShellProps) {
  const {
    dataMode,
    setDataMode,
    user,
    access,
    authError,
    connectionStatus,
    seedingLive,
    signInWithGoogle,
    signOutUser,
    seedLiveCatalog,
    resetDemoData,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<OpsTab>('orders');
  const [activeRole, setActiveRole] = useState<StaffRole>('Owner');
  const [resettingDemo, setResettingDemo] = useState(false);

  const currentItem = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const roleAllowed = currentItem.roles.includes(activeRole);
  const liveAuthBlocked = dataMode === 'live' && (!user || !access.isStaff);

  const pendingOrdersCount = state.orders.filter(
    (o) => o.status !== 'Completed' && o.status !== 'Cancelled',
  ).length;

  const handleResetDemo = async () => {
    setResettingDemo(true);
    try {
      await resetDemoData();
    } finally {
      setResettingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Sidebar */}
      <aside className="lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0 flex flex-col justify-between no-print">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold font-display text-[#141413]">
                K Town Operations
              </div>
              <div className="text-[11px] text-slate-500">Separated Role Workspaces</div>
            </div>
          </div>

          {/* Environment & Firebase Mode Switcher */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600 inline-flex items-center gap-1">
                <Database className="w-3 h-3" />
                Environment
              </span>
              <span
                className={`font-mono font-semibold ${
                  dataMode === 'live'
                    ? connectionStatus === 'offline'
                      ? 'text-red-700'
                      : 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {dataMode === 'live'
                  ? connectionStatus === 'offline'
                    ? 'Offline'
                    : 'Firestore Live'
                  : 'Demo Sandbox'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setDataMode('live')}
                className={`py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                  dataMode === 'live'
                    ? 'bg-white text-[#141413] shadow-sm'
                    : 'text-slate-600 hover:text-[#141413]'
                }`}
              >
                Live Firebase
              </button>
              <button
                type="button"
                onClick={() => setDataMode('demo')}
                className={`py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                  dataMode === 'demo'
                    ? 'bg-white text-[#141413] shadow-sm'
                    : 'text-slate-600 hover:text-[#141413]'
                }`}
              >
                Developer Demo
              </button>
            </div>

            {dataMode === 'demo' ? (
              <div className="space-y-2 pt-0.5">
                <div className="text-[11px] text-slate-500 leading-snug">
                  Sandbox Isolated — edits do not touch live Firestore.
                </div>
                <button
                  type="button"
                  disabled={resettingDemo}
                  onClick={() => void handleResetDemo()}
                  className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  {resettingDemo ? 'Resetting...' : 'Reset Demo Data'}
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-0.5">
                {user ? (
                  <>
                    <div className="text-[11px] text-slate-600 truncate" title={user.email ?? ''}>
                      {user.email}
                    </div>
                    <div className="flex gap-1.5">
                      {access.isAdmin && (
                        <button
                          type="button"
                          disabled={seedingLive}
                          onClick={() => void seedLiveCatalog()}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-[#C8231B] text-white text-[11px] font-semibold hover:bg-[#A91B14] disabled:opacity-60 cursor-pointer"
                        >
                          {seedingLive ? 'Seeding...' : 'Seed Catalog'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void signOutUser()}
                        className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-[#141413] text-white text-[11px] font-semibold hover:bg-[#C8231B] cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                )}
                {authError && (
                  <div className="text-[11px] text-red-700 leading-snug">{authError}</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="ops-role-select"
              className="block text-[11px] font-semibold text-slate-500 mb-1"
            >
              Active Staff Role
            </label>
            <select
              id="ops-role-select"
              value={activeRole}
              onChange={(e) => {
                const nextRole = e.target.value as StaffRole;
                setActiveRole(nextRole);
                const firstAllowed = NAV_ITEMS.find((item) => item.roles.includes(nextRole));
                if (firstAllowed && !currentItem.roles.includes(nextRole)) {
                  setActiveTab(firstAllowed.id);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-[#141413]"
            >
              <option value="Owner">Owner (Full Access)</option>
              <option value="Admin">Administrator</option>
              <option value="Cashier">Cashier</option>
              <option value="Kitchen">Kitchen Staff</option>
              <option value="Delivery Manager">Delivery Manager</option>
              <option value="Rider">Rider</option>
            </select>
          </div>

          <nav
            className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0"
            aria-label="Operations Dashboards"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const allowed = item.roles.includes(activeRole);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#141413] text-white'
                      : allowed
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.label}</div>
                      <div
                        className={`text-[10px] truncate hidden lg:block ${
                          isActive ? 'text-stone-300' : 'text-slate-400'
                        }`}
                      >
                        {item.responsibility}
                      </div>
                    </div>
                  </div>
                  {item.id === 'orders' && pendingOrdersCount > 0 && (
                    <span
                      className={`text-[11px] font-mono tabular-nums font-bold ${
                        isActive ? 'text-amber-300' : 'text-[#C8231B]'
                      }`}
                    >
                      {pendingOrdersCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 hidden lg:block">
          <button
            type="button"
            onClick={onExitOps}
            className="w-full py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Customer Storefront
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 no-print">
          <div className="text-xs text-slate-500 truncate">
            <span>Operations</span>
            <span aria-hidden="true"> / </span>
            <span className="font-semibold text-[#141413]">{currentItem.label} Dashboard</span>
            <span aria-hidden="true"> · </span>
            <span>Role: {activeRole}</span>
            <span aria-hidden="true"> · </span>
            <span className={dataMode === 'live' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
              {dataMode === 'live' ? 'Live Firebase' : 'Developer Demo'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExitOps}
              className="lg:hidden px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
            >
              Storefront
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {dataMode === 'live' ? 'Refresh Catalog' : 'Sync Sandbox'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {liveAuthBlocked ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto text-center space-y-4">
              <div className="w-10 h-10 rounded-lg bg-stone-100 text-[#141413] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-[#141413]">
                {!user ? 'Live Operations Sign-In Required' : 'Staff / Owner Access Required'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {!user
                  ? 'Sign in with your authorized K Town Burger Google account to manage live orders, kitchen tickets, rider dispatch, inventory, and finances — or switch to Developer Demo Mode to test every dashboard safely in the isolated sandbox.'
                  : `Signed in as ${user.email}, which does not have live staff or owner permissions on this database. Sign in with the owner account or switch to Developer Demo Mode.`}
              </p>
              {authError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  {authError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="px-4 py-2.5 rounded-lg bg-[#C8231B] text-white text-xs font-semibold hover:bg-[#A91B14] cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="px-4 py-2.5 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#C8231B] cursor-pointer"
                  >
                    Switch Google Account
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDataMode('demo')}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#141413] hover:bg-slate-50 cursor-pointer"
                >
                  Switch to Developer Demo Mode
                </button>
              </div>
            </div>
          ) : !roleAllowed ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto text-center space-y-3">
              <h2 className="text-lg font-bold text-[#141413]">
                Role Access Restricted ({activeRole})
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                The <strong>{currentItem.label}</strong> dashboard is restricted to{' '}
                {currentItem.roles.join(', ')}. Switch your Active Staff Role in the sidebar to inspect this module.
              </p>
              <button
                type="button"
                onClick={() => setActiveRole('Owner')}
                className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
              >
                Switch to Owner Role
              </button>
            </div>
          ) : (
            <>
              {dataMode === 'live' && state.menu.length === 0 && access.isAdmin && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-amber-900">
                    <strong>Live Firestore Catalog Is Empty:</strong> Publish the initial menu, ingredients, riders, campaigns, QR channels, and settings so customers can order immediately.
                  </div>
                  <button
                    type="button"
                    disabled={seedingLive}
                    onClick={() => void seedLiveCatalog()}
                    className="px-3.5 py-2 rounded-lg bg-[#C8231B] text-white text-xs font-semibold hover:bg-[#A91B14] disabled:opacity-60 cursor-pointer shrink-0"
                  >
                    {seedingLive ? 'Publishing...' : 'Initialize Live Menu & Store Defaults'}
                  </button>
                </div>
              )}

              {activeTab === 'owner' && <OwnerDashboard state={state} />}
              {activeTab === 'orders' && (
                <OrdersDashboard state={state} activeRole={activeRole} onRefresh={onRefresh} />
              )}
              {activeTab === 'kitchen' && (
                <KitchenDashboard state={state} activeRole={activeRole} onRefresh={onRefresh} />
              )}
              {activeTab === 'delivery' && (
                <DeliveryDashboard state={state} activeRole={activeRole} onRefresh={onRefresh} />
              )}
              {activeTab === 'marketing' && (
                <MarketingDashboard state={state} onRefresh={onRefresh} />
              )}
              {activeTab === 'customers' && (
                <CustomersDashboard state={state} onRefresh={onRefresh} />
              )}
              {activeTab === 'inventory' && (
                <InventoryDashboard state={state} onRefresh={onRefresh} />
              )}
              {activeTab === 'finance' && (
                <FinanceDashboard state={state} onRefresh={onRefresh} />
              )}
              {activeTab === 'admin' && (
                <AdminDashboard key={dataMode} state={state} onRefresh={onRefresh} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
