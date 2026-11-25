import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { api } from '../api/client';
import { auth, googleProvider, testConnection } from '../firebase/config';
import {
  adjustLiveInventory,
  checkUserAccess,
  createEmptyLiveState,
  createLiveCampaign,
  createLiveExpense,
  createLiveMenuItem,
  createLiveOrder,
  createLiveQrChannel,
  createLiveRider,
  createLiveStaff,
  fetchPublicCatalog,
  requestLiveTakeover,
  seedInitialLiveCatalog,
  submitLiveFeedback,
  subscribeAdminOperations,
  subscribeCustomerRecords,
  subscribePublicCatalog,
  toggleLiveAutomation,
  toggleLiveCampaign,
  trackLiveQrScan,
  triggerLiveAutomation,
  updateLiveCustomer,
  updateLiveFeedbackStatus,
  updateLiveMenuItem,
  updateLiveOrderStatus,
  updateLiveRider,
  updateLiveSettings,
  updateLiveStaff,
  type UserAccessInfo,
} from '../firebase/firestoreService';
import type {
  Campaign,
  CustomerProfile,
  MenuItem,
  Order,
  OrderStatus,
  RestaurantState,
  StaffRole,
  StoreSettings,
} from '../domain/types';

export type DataMode = 'live' | 'demo';

const STORAGE_MODE_KEY = 'ktown_data_mode';

function readInitialMode(): DataMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_MODE_KEY);
    if (saved === 'demo' || saved === 'live') return saved;
  } catch {
    // ignore storage errors
  }
  return 'live';
}

interface PlatformActions {
  createOrder: (
    payload: Record<string, unknown>,
  ) => Promise<{ order: Order; customer: CustomerProfile }>;
  updateOrderStatus: (
    orderId: string,
    payload: {
      status?: OrderStatus;
      paymentStatus?: 'Pending' | 'Confirmed' | 'Failed' | 'Refunded';
      kitchenAssignee?: string;
      riderId?: string;
      cancellationReason?: string;
      refundAmount?: number;
      actorName?: string;
      actorRole?: StaffRole;
    },
  ) => Promise<void>;
  submitFeedback: (
    orderId: string,
    payload: { rating: number; foodRating: number; deliveryRating: number; comment: string },
  ) => Promise<void>;
  updateFeedbackStatus: (id: string, status: string) => Promise<void>;
  createMenuItem: (payload: Partial<MenuItem>) => Promise<void>;
  updateMenuItem: (id: string, payload: Partial<MenuItem>) => Promise<void>;
  createRider: (payload: {
    name: string;
    phone: string;
    vehicleType?: 'Motorbike' | 'Bicycle' | 'Van';
    plateNumber?: string;
  }) => Promise<void>;
  updateRider: (
    id: string,
    payload: { status?: 'Available' | 'On Delivery' | 'Offline'; failedDeliveries?: number },
  ) => Promise<void>;
  adjustInventory: (payload: {
    ingredientId: string;
    delta: number;
    reason: 'Restock Purchase' | 'Manual Adjustment' | 'Waste';
  }) => Promise<void>;
  createExpense: (payload: { category: string; description: string; amount: number }) => Promise<void>;
  createCampaign: (payload: Partial<Campaign>) => Promise<void>;
  toggleCampaign: (id: string, active: boolean) => Promise<void>;
  toggleAutomation: (id: string, enabled: boolean) => Promise<void>;
  triggerAutomation: (id: string) => Promise<void>;
  updateCustomer: (id: string, payload: { notes?: string; marketingOptIn?: boolean }) => Promise<void>;
  createStaff: (payload: { name: string; role: StaffRole; phone: string }) => Promise<void>;
  updateStaff: (id: string, payload: { active?: boolean; role?: StaffRole }) => Promise<void>;
  createQrChannel: (payload: {
    label: string;
    channelType: 'Table' | 'Flyer' | 'Packaging' | 'Social';
    sourceCode: string;
  }) => Promise<void>;
  trackQrScan: (sourceCode: string) => Promise<void>;
  updateSettings: (payload: Partial<StoreSettings>) => Promise<void>;
  requestAssistantTakeover: (customerPrompt: string) => Promise<void>;
}

interface PlatformContextValue {
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  state: RestaurantState | null;
  loadError: string;
  fatalError: Error | null;
  authReady: boolean;
  user: User | null;
  access: UserAccessInfo;
  connectionStatus: 'checking' | 'connected' | 'offline';
  authError: string;
  seedingLive: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  seedLiveCatalog: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  refreshState: () => Promise<void>;
  actions: PlatformActions;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

const DEFAULT_ACCESS: UserAccessInfo = {
  isBootstrappedAdmin: false,
  isAdmin: false,
  isStaff: false,
};

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [dataMode, setDataModeState] = useState<DataMode>(readInitialMode);
  const [demoState, setDemoState] = useState<RestaurantState | null>(null);
  const [liveState, setLiveState] = useState<RestaurantState>(() => createEmptyLiveState());
  const [liveBootstrapped, setLiveBootstrapped] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<UserAccessInfo>(DEFAULT_ACCESS);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'offline'>(
    'checking',
  );
  const [authError, setAuthError] = useState('');
  const [seedingLive, setSeedingLive] = useState(false);

  const liveStateRef = useRef(liveState);
  liveStateRef.current = liveState;

  if (fatalError) {
    throw fatalError;
  }

  const setDataMode = useCallback((nextMode: DataMode) => {
    setDataModeState(nextMode);
    setLoadError('');
    setAuthError('');
    try {
      window.localStorage.setItem(STORAGE_MODE_KEY, nextMode);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Startup connection check & Auth state listener
  useEffect(() => {
    let active = true;
    testConnection().then((res) => {
      if (!active) return;
      setConnectionStatus(res.offline ? 'offline' : 'connected');
    });

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        const nextAccess = await checkUserAccess(
          nextUser.uid,
          nextUser.email,
          nextUser.emailVerified,
        );
        if (active) {
          setAccess(nextAccess);
        }
      } else {
        setAccess(DEFAULT_ACCESS);
      }
      if (active) {
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, []);

  const fetchDemoState = useCallback(async () => {
    try {
      const data = await api.getState();
      setDemoState(data);
      setLoadError('');
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to connect to K Town Burger demo server.',
      );
    }
  }, []);

  const refreshLivePublic = useCallback(async () => {
    try {
      const pub = await fetchPublicCatalog();
      setLiveState((prev) => ({ ...prev, ...pub }));
      setLiveBootstrapped(true);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load live Firebase catalog.');
    }
  }, []);

  // Subscribe to Demo OR Live Firestore state
  useEffect(() => {
    if (dataMode === 'demo') {
      void fetchDemoState();
      return;
    }

    let cancelled = false;
    setLoadError('');

    const unsubPublic = subscribePublicCatalog(
      (patch) => {
        if (cancelled) return;
        setLiveState((prev) => ({ ...prev, ...patch }));
        setLiveBootstrapped(true);
      },
      (err) => {
        if (!cancelled) setFatalError(err);
      },
    );

    let unsubUser: (() => void) | undefined;
    if (authReady && user && user.emailVerified) {
      if (access.isBootstrappedAdmin) {
        unsubUser = subscribeAdminOperations(
          (patch) => {
            if (!cancelled) setLiveState((prev) => ({ ...prev, ...patch }));
          },
          (err) => {
            if (!cancelled) setFatalError(err);
          },
        );
      } else {
        unsubUser = subscribeCustomerRecords(
          user.uid,
          (patch) => {
            if (!cancelled) setLiveState((prev) => ({ ...prev, ...patch }));
          },
          (err) => {
            if (!cancelled) setFatalError(err);
          },
        );
      }
    } else if (authReady && !user) {
      setLiveState((prev) => ({
        ...createEmptyLiveState(),
        menu: prev.menu,
        groupPackages: prev.groupPackages,
        campaigns: prev.campaigns,
        qrChannels: prev.qrChannels,
        settings: prev.settings,
      }));
    }

    return () => {
      cancelled = true;
      unsubPublic();
      unsubUser?.();
    };
  }, [dataMode, authReady, user, access.isBootstrappedAdmin, fetchDemoState]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const nextAccess = await checkUserAccess(
        cred.user.uid,
        cred.user.email,
        cred.user.emailVerified,
      );
      setAccess(nextAccess);
      return cred.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
      return null;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setAccess(DEFAULT_ACCESS);
  }, []);

  const seedLiveCatalog = useCallback(async () => {
    setSeedingLive(true);
    setAuthError('');
    try {
      await seedInitialLiveCatalog();
      await refreshLivePublic();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not seed live catalog.');
    } finally {
      setSeedingLive(false);
    }
  }, [refreshLivePublic]);

  const resetDemoData = useCallback(async () => {
    const reset = await api.resetDemo();
    setDemoState(reset);
  }, []);

  const refreshState = useCallback(async () => {
    if (dataMode === 'demo') {
      await fetchDemoState();
    } else {
      await refreshLivePublic();
    }
  }, [dataMode, fetchDemoState, refreshLivePublic]);

  const actions = useMemo<PlatformActions>(
    () => ({
      createOrder: async (payload) => {
        if (dataMode === 'demo') {
          const res = await api.createOrder(payload);
          await fetchDemoState();
          return res;
        }
        return createLiveOrder(payload, liveStateRef.current.orders.length);
      },
      updateOrderStatus: async (orderId, payload) => {
        if (dataMode === 'demo') {
          await api.updateOrderStatus(orderId, payload);
          await fetchDemoState();
          return;
        }
        const order = liveStateRef.current.orders.find(
          (o) => o.id === orderId || o.orderNumber === orderId,
        );
        if (!order) throw new Error('Order not found in live Firestore.');
        await updateLiveOrderStatus(order, liveStateRef.current, payload);
      },
      submitFeedback: async (orderId, payload) => {
        if (dataMode === 'demo') {
          await api.submitFeedback(orderId, payload);
          await fetchDemoState();
          return;
        }
        const order = liveStateRef.current.orders.find(
          (o) => o.id === orderId || o.orderNumber === orderId,
        );
        if (!order) throw new Error('Order not found.');
        await submitLiveFeedback(order, payload);
      },
      updateFeedbackStatus: async (id, status) => {
        if (dataMode === 'demo') {
          await api.updateFeedbackStatus(id, status);
          await fetchDemoState();
          return;
        }
        await updateLiveFeedbackStatus(id, status);
      },
      createMenuItem: async (payload) => {
        if (dataMode === 'demo') {
          await api.createMenuItem(payload as Record<string, unknown>);
          await fetchDemoState();
          return;
        }
        await createLiveMenuItem(payload);
      },
      updateMenuItem: async (id, payload) => {
        if (dataMode === 'demo') {
          await api.updateMenuItem(id, payload as Record<string, unknown>);
          await fetchDemoState();
          return;
        }
        await updateLiveMenuItem(id, payload);
      },
      createRider: async (payload) => {
        if (dataMode === 'demo') {
          await api.createRider(payload);
          await fetchDemoState();
          return;
        }
        await createLiveRider(payload);
      },
      updateRider: async (id, payload) => {
        if (dataMode === 'demo') {
          await api.updateRider(id, payload);
          await fetchDemoState();
          return;
        }
        await updateLiveRider(id, payload);
      },
      adjustInventory: async (payload) => {
        if (dataMode === 'demo') {
          await api.adjustInventory(payload);
          await fetchDemoState();
          return;
        }
        const ing = liveStateRef.current.ingredients.find((i) => i.id === payload.ingredientId);
        if (!ing) throw new Error('Ingredient not found.');
        await adjustLiveInventory(ing, payload.delta, payload.reason);
      },
      createExpense: async (payload) => {
        if (dataMode === 'demo') {
          await api.createExpense(payload);
          await fetchDemoState();
          return;
        }
        await createLiveExpense(payload);
      },
      createCampaign: async (payload) => {
        if (dataMode === 'demo') {
          await api.createCampaign(payload as Record<string, unknown>);
          await fetchDemoState();
          return;
        }
        await createLiveCampaign(payload);
      },
      toggleCampaign: async (id, active) => {
        if (dataMode === 'demo') {
          await api.toggleCampaign(id, active);
          await fetchDemoState();
          return;
        }
        await toggleLiveCampaign(id, active);
      },
      toggleAutomation: async (id, enabled) => {
        if (dataMode === 'demo') {
          await api.toggleAutomation(id, enabled);
          await fetchDemoState();
          return;
        }
        await toggleLiveAutomation(id, enabled);
      },
      triggerAutomation: async (id) => {
        if (dataMode === 'demo') {
          await api.triggerAutomation(id);
          await fetchDemoState();
          return;
        }
        const rule = liveStateRef.current.automations.find((a) => a.id === id);
        if (!rule) throw new Error('Automation rule not found.');
        await triggerLiveAutomation(rule, liveStateRef.current.customers);
      },
      updateCustomer: async (id, payload) => {
        if (dataMode === 'demo') {
          await api.updateCustomer(id, payload);
          await fetchDemoState();
          return;
        }
        await updateLiveCustomer(id, payload);
      },
      createStaff: async (payload) => {
        if (dataMode === 'demo') {
          await api.createStaff(payload);
          await fetchDemoState();
          return;
        }
        await createLiveStaff(payload);
      },
      updateStaff: async (id, payload) => {
        if (dataMode === 'demo') {
          await api.updateStaff(id, payload);
          await fetchDemoState();
          return;
        }
        await updateLiveStaff(id, payload);
      },
      createQrChannel: async (payload) => {
        if (dataMode === 'demo') {
          await api.createQrChannel(payload);
          await fetchDemoState();
          return;
        }
        await createLiveQrChannel(payload);
      },
      trackQrScan: async (sourceCode) => {
        if (dataMode === 'demo') {
          await api.trackQrScan(sourceCode);
          return;
        }
        const qr = liveStateRef.current.qrChannels.find((q) => q.sourceCode === sourceCode);
        if (qr) await trackLiveQrScan(qr);
      },
      updateSettings: async (payload) => {
        if (dataMode === 'demo') {
          await api.updateSettings(payload as Record<string, unknown>);
          await fetchDemoState();
          return;
        }
        await updateLiveSettings(liveStateRef.current.settings, payload);
      },
      requestAssistantTakeover: async (customerPrompt) => {
        if (dataMode === 'demo') {
          await api.requestAssistantTakeover(customerPrompt);
          await fetchDemoState();
          return;
        }
        await requestLiveTakeover(customerPrompt);
      },
    }),
    [dataMode, fetchDemoState],
  );

  const activeState =
    dataMode === 'demo' ? demoState : liveBootstrapped ? liveState : null;

  return (
    <PlatformContext.Provider
      value={{
        dataMode,
        setDataMode,
        state: activeState,
        loadError,
        fatalError,
        authReady,
        user,
        access,
        connectionStatus,
        authError,
        seedingLive,
        signInWithGoogle,
        signOutUser,
        seedLiveCatalog,
        resetDemoData,
        refreshState,
        actions,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform must be used within a PlatformProvider.');
  }
  return ctx;
}
