import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { clampArray, clampString, nonNegativeNumber, removeUndefined, sanitizeId } from './validation';
import { createInitialSeedState } from '../server/seed';
import {
  canTransitionOrderStatus,
  computeInventoryDeductions,
  computeLoyaltyUpdate,
} from '../domain/rules';
import type {
  AssistantTakeoverRequest,
  AutomationLog,
  AutomationRule,
  Campaign,
  CustomerProfile,
  ExpenseRecord,
  FeedbackEntry,
  GroupPackage,
  InventoryIngredient,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PurchaseRecord,
  QRChannel,
  RestaurantState,
  Rider,
  StaffActivity,
  StaffMember,
  StaffRole,
  StockMovement,
  StoreSettings,
} from '../domain/types';

function toIso(val: unknown, fallback?: string): string {
  if (typeof val === 'string' && val.length > 0) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return fallback ?? new Date().toISOString();
}

function normalizeOrderDoc(raw: Record<string, unknown>): Order {
  const createdAt = toIso(raw.createdAtIso ?? raw.createdAt);
  const updatedAt = toIso(raw.updatedAtIso ?? raw.updatedAt, createdAt);
  return {
    ...(raw as unknown as Order),
    createdAt,
    updatedAt,
  };
}

function normalizeCreatedDoc<T extends object>(raw: Record<string, unknown>, dateField: string): T {
  const copy: Record<string, unknown> = { ...raw };
  if (dateField in copy) {
    copy[dateField] = toIso(copy[dateField]);
  }
  return copy as T;
}

export interface UserAccessInfo {
  isBootstrappedAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  staffRole?: StaffRole;
}

export async function checkUserAccess(
  uid: string,
  email: string | null,
  emailVerified: boolean,
): Promise<UserAccessInfo> {
  const isBootstrappedAdmin =
    emailVerified && email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  let isAdminDoc = false;
  let isStaff = false;
  let staffRole: StaffRole | undefined = isBootstrappedAdmin ? 'Owner' : undefined;

  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) {
      isAdminDoc = true;
      staffRole = staffRole ?? 'Admin';
    }
  } catch (err) {
    // Only fail if unexpected; verified owner reads own doc safely
    console.warn('Admin doc lookup note:', err);
  }

  try {
    const staffSnap = await getDoc(doc(db, 'staffUsers', uid));
    if (staffSnap.exists()) {
      const data = staffSnap.data() as { active?: boolean; role?: StaffRole };
      if (data.active) {
        isStaff = true;
        staffRole = staffRole ?? data.role ?? 'Cashier';
      }
    }
  } catch (err) {
    console.warn('Staff doc lookup note:', err);
  }

  return {
    isBootstrappedAdmin,
    isAdmin: isBootstrappedAdmin || isAdminDoc,
    isStaff: isBootstrappedAdmin || isAdminDoc || isStaff,
    staffRole,
  };
}

export const EMPTY_LIVE_SETTINGS: StoreSettings = {
  restaurantName: 'K Town Burger',
  tagline: 'Flame-grilled burgers, crispy chicken & wood-fired pizza delivered in 30 minutes.',
  address: 'Plot 18 Kira Road, Kamwokya, Kampala',
  locationPin: '0.3422, 32.5871',
  phone: '+256 772 410 890',
  whatsappNumber: '256772410890',
  openingHours: 'Daily · 10:00 AM – 11:30 PM',
  currency: 'UGX',
  deliveryFeeBase: 5000,
  freeDeliveryThreshold: 60000,
  deliveryTargetMinutes: 30,
  activePromoBanner: 'Free delivery over UGX 60,000 · Use code KTOWN10 for 10% off your order',
  sandboxMode: {
    mtnMomoEnabled: true,
    airtelMoneyEnabled: true,
    whatsappApiSandbox: true,
    smsGatewaySandbox: true,
  },
};

export function createEmptyLiveState(): RestaurantState {
  return {
    menu: [],
    orders: [],
    riders: [],
    customers: [],
    campaigns: [],
    automations: [],
    automationLogs: [],
    ingredients: [],
    stockMovements: [],
    purchases: [],
    expenses: [],
    feedback: [],
    staff: [],
    staffActivity: [],
    groupPackages: [],
    qrChannels: [],
    settings: EMPTY_LIVE_SETTINGS,
    takeoverRequests: [],
  };
}

export async function fetchPublicCatalog(): Promise<
  Pick<RestaurantState, 'menu' | 'groupPackages' | 'campaigns' | 'qrChannels' | 'settings'>
> {
  try {
    const [menuSnap, groupSnap, campSnap, qrSnap, settingsSnap] = await Promise.all([
      getDocs(query(collection(db, 'menu'), limit(200))),
      getDocs(query(collection(db, 'groupPackages'), limit(100))),
      getDocs(query(collection(db, 'campaigns'), limit(100))),
      getDocs(query(collection(db, 'qrChannels'), limit(100))),
      getDoc(doc(db, 'settings', 'public')),
    ]);

    return {
      menu: menuSnap.docs.map((d) => d.data() as MenuItem),
      groupPackages: groupSnap.docs.map((d) => d.data() as GroupPackage),
      campaigns: campSnap.docs.map((d) => d.data() as Campaign),
      qrChannels: qrSnap.docs.map((d) => d.data() as QRChannel),
      settings: settingsSnap.exists()
        ? (settingsSnap.data() as StoreSettings)
        : EMPTY_LIVE_SETTINGS,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'menu');
  }
}

export function subscribePublicCatalog(
  onUpdate: (
    patch: Partial<
      Pick<RestaurantState, 'menu' | 'groupPackages' | 'campaigns' | 'qrChannels' | 'settings'>
    >,
  ) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wrapErr = (path: string) => (err: unknown) => {
    try {
      handleFirestoreError(err, OperationType.GET, path);
    } catch (wrapped) {
      onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'menu'), limit(200)),
      (snap) => onUpdate({ menu: snap.docs.map((d) => d.data() as MenuItem) }),
      wrapErr('menu'),
    ),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, 'groupPackages'), limit(100)),
      (snap) => onUpdate({ groupPackages: snap.docs.map((d) => d.data() as GroupPackage) }),
      wrapErr('groupPackages'),
    ),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, 'campaigns'), limit(100)),
      (snap) => onUpdate({ campaigns: snap.docs.map((d) => d.data() as Campaign) }),
      wrapErr('campaigns'),
    ),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, 'qrChannels'), limit(100)),
      (snap) => onUpdate({ qrChannels: snap.docs.map((d) => d.data() as QRChannel) }),
      wrapErr('qrChannels'),
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'public'),
      (snap) => {
        if (snap.exists()) {
          onUpdate({ settings: snap.data() as StoreSettings });
        }
      },
      wrapErr('settings/public'),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeCustomerRecords(
  uid: string,
  onUpdate: (patch: Partial<Pick<RestaurantState, 'orders' | 'customers'>>) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wrapErr = (path: string) => (err: unknown) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (wrapped) {
      onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'orders'), where('userId', '==', uid)),
      (snap) => {
        const orders = snap.docs
          .map((d) => normalizeOrderDoc(d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate({ orders });
      },
      wrapErr(`orders?userId=${uid}`),
    ),
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'customers', uid),
      (snap) => {
        onUpdate({
          customers: snap.exists() ? [snap.data() as CustomerProfile] : [],
        });
      },
      wrapErr(`customers/${uid}`),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeAdminOperations(
  onUpdate: (patch: Partial<RestaurantState>) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wrapErr = (path: string) => (err: unknown) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (wrapped) {
      onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  unsubs.push(
    onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const orders = snap.docs
          .map((d) => normalizeOrderDoc(d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate({ orders });
      },
      wrapErr('orders'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        onUpdate({ customers: snap.docs.map((d) => d.data() as CustomerProfile) });
      },
      wrapErr('customers'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'riders'),
      (snap) => onUpdate({ riders: snap.docs.map((d) => d.data() as Rider) }),
      wrapErr('riders'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'ingredients'),
      (snap) => onUpdate({ ingredients: snap.docs.map((d) => d.data() as InventoryIngredient) }),
      wrapErr('ingredients'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'stockMovements'),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeCreatedDoc<StockMovement>(d.data(), 'timestamp'))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onUpdate({ stockMovements: list });
      },
      wrapErr('stockMovements'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'purchases'),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeCreatedDoc<PurchaseRecord>(d.data(), 'purchasedAt'))
          .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
        onUpdate({ purchases: list });
      },
      wrapErr('purchases'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'expenses'),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeCreatedDoc<ExpenseRecord>(d.data(), 'recordedAt'))
          .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        onUpdate({ expenses: list });
      },
      wrapErr('expenses'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'feedback'),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeCreatedDoc<FeedbackEntry>(d.data(), 'createdAt'))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate({ feedback: list });
      },
      wrapErr('feedback'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'automations'),
      (snap) => onUpdate({ automations: snap.docs.map((d) => d.data() as AutomationRule) }),
      wrapErr('automations'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'automationLogs'),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeCreatedDoc<AutomationLog>(d.data(), 'sentAt'))
          .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
        onUpdate({ automationLogs: list });
      },
      wrapErr('automationLogs'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'staff'),
      (snap) => onUpdate({ staff: snap.docs.map((d) => d.data() as StaffMember) }),
      wrapErr('staff'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'staffActivity'),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeCreatedDoc<StaffActivity>(d.data(), 'timestamp'))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onUpdate({ staffActivity: list });
      },
      wrapErr('staffActivity'),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'takeoverRequests'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const raw = d.data();
            return {
              id: String(raw.id),
              customerPrompt: String(raw.customerPrompt),
              createdAt: toIso(raw.createdAtIso ?? raw.createdAt),
              resolved: Boolean(raw.resolved),
            } as AssistantTakeoverRequest;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate({ takeoverRequests: list });
      },
      wrapErr('takeoverRequests'),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}

/**
 * Bootstraps initial live catalog, ingredients, riders, campaigns, automations,
 * group packages, QR channels, and settings into Firestore without seeding fake
 * orders or fake customer PII.
 */
export async function seedInitialLiveCatalog(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in with Google as Owner/Admin to initialize the live catalog.');

  const seed = createInitialSeedState();
  const batch = writeBatch(db);

  // Register admin grant doc
  batch.set(doc(db, 'admins', user.uid), {
    uid: user.uid,
    email: clampString(user.email || BOOTSTRAPPED_ADMIN_EMAIL, 160),
    createdAt: serverTimestamp(),
  });

  // Public settings
  batch.set(doc(db, 'settings', 'public'), {
    restaurantName: clampString(seed.settings.restaurantName, 100),
    tagline: clampString(seed.settings.tagline, 240),
    address: clampString(seed.settings.address, 200),
    locationPin: clampString(seed.settings.locationPin, 64),
    phone: clampString(seed.settings.phone, 30),
    whatsappNumber: clampString(seed.settings.whatsappNumber, 30),
    openingHours: clampString(seed.settings.openingHours, 100),
    currency: clampString(seed.settings.currency, 10),
    deliveryFeeBase: nonNegativeNumber(seed.settings.deliveryFeeBase),
    freeDeliveryThreshold: nonNegativeNumber(seed.settings.freeDeliveryThreshold),
    deliveryTargetMinutes: Math.max(1, nonNegativeNumber(seed.settings.deliveryTargetMinutes, 30)),
    activePromoBanner: clampString(seed.settings.activePromoBanner, 240),
    sandboxMode: seed.settings.sandboxMode,
    updatedAt: serverTimestamp(),
  });

  for (const m of seed.menu) {
    batch.set(
      doc(db, 'menu', m.id),
      removeUndefined({
        id: m.id,
        name: clampString(m.name, 120),
        category: m.category,
        description: clampString(m.description, 500),
        price: nonNegativeNumber(m.price),
        imageUrl: clampString(m.imageUrl, 500),
        available: Boolean(m.available),
        bestseller: Boolean(m.bestseller),
        featured: Boolean(m.featured),
        prepMinutes: nonNegativeNumber(m.prepMinutes, 10),
        comboUpgradePrice: m.comboUpgradePrice !== undefined ? nonNegativeNumber(m.comboUpgradePrice) : undefined,
        sizes: m.sizes ? clampArray(m.sizes, 10) : undefined,
        extras: m.extras ? clampArray(m.extras, 20) : undefined,
        recipe: clampArray(m.recipe, 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const pkg of seed.groupPackages) {
    batch.set(doc(db, 'groupPackages', pkg.id), {
      id: pkg.id,
      name: clampString(pkg.name, 120),
      audience: pkg.audience,
      headcount: Math.max(1, nonNegativeNumber(pkg.headcount, 10)),
      description: clampString(pkg.description, 500),
      pricePerPack: nonNegativeNumber(pkg.pricePerPack),
      itemsSummary: clampArray(pkg.itemsSummary, 15),
      imageUrl: clampString(pkg.imageUrl, 500),
      updatedAt: serverTimestamp(),
    });
  }

  for (const camp of seed.campaigns) {
    batch.set(doc(db, 'campaigns', camp.id), {
      id: camp.id,
      name: clampString(camp.name, 120),
      code: clampString(camp.code, 32),
      type: camp.type,
      value: nonNegativeNumber(camp.value),
      minOrderAmount: nonNegativeNumber(camp.minOrderAmount),
      scheduleLabel: clampString(camp.scheduleLabel, 80),
      active: Boolean(camp.active),
      ordersGenerated: 0,
      revenueGenerated: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const ing of seed.ingredients) {
    batch.set(doc(db, 'ingredients', ing.id), {
      id: ing.id,
      name: clampString(ing.name, 120),
      unit: clampString(ing.unit, 24),
      currentStock: nonNegativeNumber(ing.currentStock),
      reorderLevel: nonNegativeNumber(ing.reorderLevel),
      unitCost: nonNegativeNumber(ing.unitCost),
      supplierName: clampString(ing.supplierName, 120),
      lastRestockedAt: clampString(ing.lastRestockedAt, 64),
      updatedAt: serverTimestamp(),
    });
  }

  for (const rid of seed.riders) {
    batch.set(doc(db, 'riders', rid.id), {
      id: rid.id,
      name: clampString(rid.name, 100),
      phone: clampString(rid.phone, 30),
      vehicleType: rid.vehicleType,
      plateNumber: clampString(rid.plateNumber, 30),
      status: 'Available',
      completedDeliveries: 0,
      failedDeliveries: 0,
      avgDeliveryMinutes: Math.max(1, nonNegativeNumber(rid.avgDeliveryMinutes, 22)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const auto of seed.automations) {
    batch.set(
      doc(db, 'automations', auto.id),
      removeUndefined({
        id: auto.id,
        name: clampString(auto.name, 120),
        channel: auto.channel,
        trigger: clampString(auto.trigger, 120),
        enabled: Boolean(auto.enabled),
        sentCount: 0,
        conversionCount: 0,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const st of seed.staff) {
    batch.set(doc(db, 'staff', st.id), {
      id: st.id,
      name: clampString(st.name, 100),
      role: st.role,
      phone: clampString(st.phone, 30),
      active: Boolean(st.active),
      lastActiveAt: clampString(st.lastActiveAt, 64),
      permissions: clampArray(st.permissions, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const qr of seed.qrChannels) {
    batch.set(doc(db, 'qrChannels', qr.id), {
      id: qr.id,
      label: clampString(qr.label, 100),
      channelType: qr.channelType,
      sourceCode: sanitizeId(qr.sourceCode, 'qr'),
      scans: 0,
      ordersCount: 0,
      revenue: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_seed_live_catalog');
  }
}

async function appendStaffActivity(staffName: string, role: StaffRole, action: string) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'staffActivity', id), {
      id,
      staffName: clampString(staffName, 100, 'Operations Staff'),
      role,
      action: clampString(action, 240),
      timestamp: now,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `staffActivity/${id}`);
  }
}

export async function createLiveOrder(
  payload: Record<string, unknown>,
  existingOrdersCount: number,
): Promise<{ order: Order; customer: CustomerProfile }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in with Google to place a live order, or switch to Developer Demo Mode for instant guest testing.');
  }

  const name = clampString(payload.customerName, 120);
  const phone = clampString(payload.customerPhone, 30);
  if (!name || !phone || phone.length < 4) {
    throw new Error('Customer name and valid phone number are required.');
  }
  const rawItems = Array.isArray(payload.items) ? (payload.items as OrderItem[]) : [];
  if (rawItems.length === 0) {
    throw new Error('Order must contain at least one item.');
  }
  const fulfillmentType = payload.fulfillmentType === 'Pickup' ? 'Pickup' : 'Delivery';
  const deliveryAddress = clampString(payload.deliveryAddress, 240);
  if (fulfillmentType === 'Delivery' && !deliveryAddress) {
    throw new Error('Delivery address is required for delivery orders.');
  }

  const items = clampArray(rawItems, 40);
  const now = new Date().toISOString();
  const orderId = sanitizeId(`ord-${Date.now()}`);
  const orderNumber = sanitizeId(`KTB-${1050 + existingOrdersCount}-${Math.floor(10 + Math.random() * 89)}`);
  const orderTotal = nonNegativeNumber(payload.total);
  const burgerCount = items
    .filter((i) => i.category === 'Burgers' || i.category === 'Combos')
    .reduce((s, i) => s + i.quantity, 0);

  // Upsert customer profile keyed by uid
  const customerRef = doc(db, 'customers', user.uid);
  let customerSnap;
  try {
    customerSnap = await getDoc(customerRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `customers/${user.uid}`);
  }

  let customer: CustomerProfile;
  if (!customerSnap.exists()) {
    const loyalty = computeLoyaltyUpdate(
      { orderCount: 0, totalSpent: 0, burgerStamps: 0, loyaltyPoints: 0, rewardsAvailable: 0 },
      orderTotal,
      burgerCount,
    );
    customer = {
      id: user.uid,
      name,
      phone,
      email: clampString(payload.customerEmail ?? user.email ?? '', 160) || undefined,
      firstOrderAt: now,
      lastOrderAt: now,
      orderCount: loyalty.orderCount,
      totalSpent: loyalty.totalSpent,
      burgerStamps: loyalty.burgerStamps,
      loyaltyPoints: loyalty.loyaltyPoints,
      rewardsAvailable: loyalty.rewardsAvailable,
      favoriteItems: clampArray(
        items.slice(0, 2).map((i) => clampString(i.name, 80)),
        10,
      ),
      segment: loyalty.segment,
      notes: payload.isGroupOrder ? clampString(`Group organizer (${payload.groupOrgName || 'Group'})`, 500) : '',
      marketingOptIn: Boolean(payload.marketingOptIn),
      referralCode: clampString(`${name.split(' ')[0].toUpperCase().slice(0, 6)}-KTB`, 32, 'KTOWN-KTB'),
    };
    try {
      await setDoc(
        customerRef,
        removeUndefined({
          ...customer,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `customers/${user.uid}`);
    }
  } else {
    const existingCust = customerSnap.data() as CustomerProfile & { userId?: string };
    const loyalty = computeLoyaltyUpdate(existingCust, orderTotal, burgerCount);
    customer = {
      ...existingCust,
      name,
      phone,
      email: clampString(payload.customerEmail ?? existingCust.email ?? user.email ?? '', 160) || undefined,
      lastOrderAt: now,
      orderCount: loyalty.orderCount,
      totalSpent: loyalty.totalSpent,
      burgerStamps: loyalty.burgerStamps,
      loyaltyPoints: loyalty.loyaltyPoints,
      rewardsAvailable: loyalty.rewardsAvailable,
      segment: loyalty.segment,
      marketingOptIn: payload.marketingOptIn !== undefined ? Boolean(payload.marketingOptIn) : existingCust.marketingOptIn,
    };
    try {
      await updateDoc(
        customerRef,
        removeUndefined({
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          lastOrderAt: customer.lastOrderAt,
          orderCount: customer.orderCount,
          totalSpent: customer.totalSpent,
          burgerStamps: customer.burgerStamps,
          loyaltyPoints: customer.loyaltyPoints,
          rewardsAvailable: customer.rewardsAvailable,
          favoriteItems: clampArray(customer.favoriteItems, 10),
          segment: customer.segment,
          marketingOptIn: customer.marketingOptIn,
          updatedAt: serverTimestamp(),
        }),
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${user.uid}`);
    }
  }

  const paymentMethod = (payload.paymentMethod as PaymentMethod) || 'Pay on Delivery';
  const isDigitalSandbox = paymentMethod === 'MTN Mobile Money' || paymentMethod === 'Airtel Money';
  const prefix =
    paymentMethod === 'MTN Mobile Money'
      ? 'MOMO-SBX'
      : paymentMethod === 'Airtel Money'
        ? 'AIR-SBX'
        : paymentMethod === 'Pay on Delivery'
          ? 'COD'
          : 'COUNTER';

  const qrSource = clampString(payload.qrSource, 64) || undefined;
  const promoCode = clampString(payload.promoCode, 32).toUpperCase() || undefined;
  const isGroupOrder = payload.isGroupOrder !== undefined ? Boolean(payload.isGroupOrder) : undefined;
  const groupOrgName = clampString(payload.groupOrgName, 120) || undefined;

  const newOrder: Order = {
    id: orderId,
    orderNumber,
    createdAt: now,
    updatedAt: now,
    scheduledFor: clampString(payload.scheduledFor, 64) || undefined,
    isGroupOrder,
    groupOrgName,
    qrSource,
    customerId: user.uid,
    customerName: name,
    customerPhone: phone,
    customerEmail: clampString(payload.customerEmail ?? user.email ?? '', 160) || undefined,
    marketingOptIn: Boolean(payload.marketingOptIn),
    fulfillmentType,
    deliveryZone: fulfillmentType === 'Delivery' ? clampString(payload.deliveryZone, 80) || undefined : undefined,
    deliveryAddress: fulfillmentType === 'Delivery' ? deliveryAddress : undefined,
    locationPin: fulfillmentType === 'Delivery' ? clampString(payload.locationPin, 64) || undefined : undefined,
    items,
    subtotal: nonNegativeNumber(payload.subtotal),
    discount: nonNegativeNumber(payload.discount),
    promoCode,
    deliveryFee: nonNegativeNumber(payload.deliveryFee),
    total: orderTotal,
    paymentMethod,
    paymentStatus: isDigitalSandbox ? 'Confirmed' : 'Pending',
    paymentReference: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'New order received',
    statusHistory: [
      {
        status: 'New order received',
        timestamp: now,
        actor: qrSource ? `QR (${qrSource})` : 'Web Storefront',
        note: isGroupOrder ? `Group order for ${groupOrgName || 'Team'}` : '',
      },
    ],
    priority: isGroupOrder || orderTotal >= 80000 ? 'High' : 'Normal',
    estimatedMinutes: isGroupOrder ? 40 : 28,
    inventoryDeducted: false,
    whatsAppSent: true,
  };

  try {
    await setDoc(
      doc(db, 'orders', orderId),
      removeUndefined({
        ...newOrder,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAtIso: now,
        updatedAtIso: now,
      }),
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
  }

  return { order: newOrder, customer };
}

export async function updateLiveOrderStatus(
  order: Order,
  state: RestaurantState,
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
): Promise<void> {
  const now = new Date().toISOString();
  const actorName = clampString(payload.actorName, 100, 'Operations Staff');
  const actorRole: StaffRole = payload.actorRole || 'Admin';

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  };

  if (payload.paymentStatus && payload.paymentStatus !== order.paymentStatus) {
    updates.paymentStatus = payload.paymentStatus;
    if (payload.paymentStatus === 'Refunded') {
      updates.refundAmount = nonNegativeNumber(payload.refundAmount ?? order.total);
    }
    await appendStaffActivity(
      actorName,
      actorRole,
      `Marked ${order.orderNumber} payment as ${payload.paymentStatus}`,
    );
  }

  if (payload.kitchenAssignee !== undefined) {
    updates.kitchenAssignee = clampString(payload.kitchenAssignee, 100);
  }

  if (payload.riderId) {
    const rider = state.riders.find((r) => r.id === payload.riderId);
    if (rider) {
      updates.riderId = rider.id;
      updates.riderName = clampString(rider.name, 100);
      try {
        await updateDoc(doc(db, 'riders', rider.id), {
          status: 'On Delivery',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `riders/${rider.id}`);
      }
      await appendStaffActivity(actorName, actorRole, `Assigned rider ${rider.name} to ${order.orderNumber}`);
    }
  }

  if (payload.status && payload.status !== order.status) {
    if (
      !canTransitionOrderStatus(order.status, payload.status, order.fulfillmentType) &&
      payload.status !== 'Cancelled'
    ) {
      throw new Error(`Cannot transition order from "${order.status}" to "${payload.status}".`);
    }

    updates.status = payload.status;
    const nextHistory = clampArray(
      [
        ...order.statusHistory,
        removeUndefined({
          status: payload.status,
          timestamp: now,
          actor: actorName,
          note: payload.cancellationReason ? clampString(payload.cancellationReason, 240) : undefined,
        }),
      ],
      20,
    );
    updates.statusHistory = nextHistory;

    if (
      (payload.status === 'Order confirmed' || payload.status === 'Preparing food') &&
      !order.inventoryDeducted
    ) {
      const deductions = computeInventoryDeductions(order.items, state.menu, state.ingredients);
      for (const d of deductions) {
        try {
          await updateDoc(doc(db, 'ingredients', d.ingredientId), {
            currentStock: d.remainingStock,
            updatedAt: serverTimestamp(),
          });
          const smId = sanitizeId(`sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
          await setDoc(doc(db, 'stockMovements', smId), {
            id: smId,
            ingredientId: d.ingredientId,
            ingredientName: clampString(d.ingredientName, 120),
            delta: -d.deductQty,
            reason: 'Order Deduction',
            referenceId: order.orderNumber,
            timestamp: now,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `ingredients/${d.ingredientId}`);
        }
      }
      updates.inventoryDeducted = true;
    }

    if (payload.status === 'Delivered' || payload.status === 'Completed') {
      if (!order.deliveredAt) {
        updates.deliveredAt = now;
      }
      if (order.paymentMethod === 'Pay on Delivery' || order.paymentMethod === 'Pay at Restaurant') {
        updates.paymentStatus = 'Confirmed';
      }
      const targetRiderId = (updates.riderId as string) || order.riderId;
      if (targetRiderId) {
        const rider = state.riders.find((r) => r.id === targetRiderId);
        if (rider) {
          try {
            await updateDoc(doc(db, 'riders', rider.id), {
              status: 'Available',
              completedDeliveries:
                payload.status === 'Completed'
                  ? rider.completedDeliveries + 1
                  : rider.completedDeliveries,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `riders/${rider.id}`);
          }
        }
      }
    }

    if (payload.status === 'Cancelled') {
      updates.cancellationReason = clampString(payload.cancellationReason, 240, 'Cancelled by staff');
      if (order.riderId) {
        try {
          await updateDoc(doc(db, 'riders', order.riderId), {
            status: 'Available',
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `riders/${order.riderId}`);
        }
      }
    }

    await appendStaffActivity(actorName, actorRole, `Updated ${order.orderNumber} to "${payload.status}"`);
  }

  try {
    await updateDoc(doc(db, 'orders', order.id), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function submitLiveFeedback(
  order: Order,
  payload: { rating: number; foodRating: number; deliveryRating: number; comment: string },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in with Google to submit order feedback.');

  const fbId = sanitizeId(`fb-${Date.now()}`);
  const rating = Math.min(5, Math.max(1, Number(payload.rating ?? 5)));
  const foodRating = Math.min(5, Math.max(1, Number(payload.foodRating ?? rating)));
  const deliveryRating = Math.min(5, Math.max(1, Number(payload.deliveryRating ?? rating)));

  try {
    await setDoc(doc(db, 'feedback', fbId), {
      id: fbId,
      userId: user.uid,
      orderId: order.id,
      orderNumber: clampString(order.orderNumber, 32),
      customerName: clampString(order.customerName, 120),
      customerPhone: clampString(order.customerPhone, 30),
      rating,
      foodRating,
      deliveryRating,
      comment: clampString(payload.comment, 600, 'Great service!'),
      status: rating >= 4 ? 'Google Review Requested' : 'Open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `feedback/${fbId}`);
  }

  if (order.status === 'Delivered' || order.status === 'Completed') {
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        feedbackSubmitted: true,
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  }
}

export async function updateLiveFeedbackStatus(id: string, status: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'feedback', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `feedback/${id}`);
  }
}

export async function createLiveMenuItem(payload: Partial<MenuItem>): Promise<void> {
  const id = sanitizeId(`m-${Date.now()}`);
  try {
    await setDoc(
      doc(db, 'menu', id),
      removeUndefined({
        id,
        name: clampString(payload.name, 120),
        category: payload.category || 'Burgers',
        description: clampString(payload.description, 500, 'Freshly prepared K Town Burger specialty.'),
        price: nonNegativeNumber(payload.price),
        imageUrl: clampString(
          payload.imageUrl,
          500,
          '/src/assets/images/menu_signature_burger_1795540364460.jpg',
        ),
        available: payload.available ?? true,
        bestseller: payload.bestseller ?? false,
        featured: payload.featured ?? false,
        prepMinutes: nonNegativeNumber(payload.prepMinutes ?? 12, 12),
        comboUpgradePrice: payload.comboUpgradePrice ? nonNegativeNumber(payload.comboUpgradePrice) : undefined,
        recipe: clampArray(payload.recipe ?? [{ ingredientId: 'ing-patty', quantity: 1 }], 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await appendStaffActivity('Admin', 'Admin', `Created menu product "${clampString(payload.name, 100)}"`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `menu/${id}`);
  }
}

export async function updateLiveMenuItem(id: string, payload: Partial<MenuItem>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (payload.name !== undefined) patch.name = clampString(payload.name, 120);
  if (payload.price !== undefined) patch.price = nonNegativeNumber(payload.price);
  if (payload.available !== undefined) patch.available = Boolean(payload.available);
  if (payload.bestseller !== undefined) patch.bestseller = Boolean(payload.bestseller);
  if (payload.description !== undefined) patch.description = clampString(payload.description, 500);
  try {
    await updateDoc(doc(db, 'menu', id), patch);
    await appendStaffActivity('Admin', 'Admin', `Updated menu item ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `menu/${id}`);
  }
}

export async function createLiveRider(payload: {
  name: string;
  phone: string;
  vehicleType?: 'Motorbike' | 'Bicycle' | 'Van';
  plateNumber?: string;
}): Promise<void> {
  const id = sanitizeId(`rid-${Date.now()}`);
  try {
    await setDoc(doc(db, 'riders', id), {
      id,
      name: clampString(payload.name, 100),
      phone: clampString(payload.phone, 30),
      vehicleType: payload.vehicleType || 'Motorbike',
      plateNumber: clampString(payload.plateNumber, 30, 'UXX 001A'),
      status: 'Available',
      completedDeliveries: 0,
      failedDeliveries: 0,
      avgDeliveryMinutes: 22,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await appendStaffActivity('Delivery Manager', 'Delivery Manager', `Registered rider ${payload.name}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `riders/${id}`);
  }
}

export async function updateLiveRider(
  id: string,
  payload: { status?: 'Available' | 'On Delivery' | 'Offline'; failedDeliveries?: number },
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (payload.status) patch.status = payload.status;
  if (payload.failedDeliveries !== undefined) {
    patch.failedDeliveries = nonNegativeNumber(payload.failedDeliveries);
  }
  try {
    await updateDoc(doc(db, 'riders', id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `riders/${id}`);
  }
}

export async function adjustLiveInventory(
  ingredient: InventoryIngredient,
  delta: number,
  reason: 'Restock Purchase' | 'Manual Adjustment' | 'Waste',
): Promise<void> {
  const now = new Date().toISOString();
  const nextStock = Math.max(0, Number((ingredient.currentStock + delta).toFixed(2)));
  try {
    await updateDoc(doc(db, 'ingredients', ingredient.id), {
      currentStock: nextStock,
      lastRestockedAt: delta > 0 ? now : ingredient.lastRestockedAt,
      updatedAt: serverTimestamp(),
    });
    const smId = sanitizeId(`sm-${Date.now()}`);
    await setDoc(doc(db, 'stockMovements', smId), {
      id: smId,
      ingredientId: ingredient.id,
      ingredientName: clampString(ingredient.name, 120),
      delta,
      reason,
      timestamp: now,
      createdAt: serverTimestamp(),
    });

    if (reason === 'Restock Purchase' && delta > 0) {
      const totalCost = Math.round(delta * ingredient.unitCost);
      const purId = sanitizeId(`pur-${Date.now()}`);
      await setDoc(doc(db, 'purchases', purId), {
        id: purId,
        supplierName: clampString(ingredient.supplierName, 120),
        ingredientId: ingredient.id,
        ingredientName: clampString(ingredient.name, 120),
        quantity: delta,
        totalCost,
        purchasedAt: now,
        createdAt: serverTimestamp(),
      });

      if (totalCost > 0) {
        const expId = sanitizeId(`exp-${Date.now()}`);
        await setDoc(doc(db, 'expenses', expId), {
          id: expId,
          category: 'Ingredients',
          description: clampString(`Restock ${delta} ${ingredient.unit} ${ingredient.name}`, 240),
          amount: totalCost,
          recordedAt: now,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `ingredients/${ingredient.id}`);
  }
}

export async function createLiveExpense(payload: {
  category: string;
  description: string;
  amount: number;
}): Promise<void> {
  const id = sanitizeId(`exp-${Date.now()}`);
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'expenses', id), {
      id,
      category: payload.category || 'Other',
      description: clampString(payload.description, 240),
      amount: Math.max(1, Math.round(nonNegativeNumber(payload.amount, 1))),
      recordedAt: now,
      createdAt: serverTimestamp(),
    });
    await appendStaffActivity('Owner', 'Owner', `Recorded ${payload.category} expense`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `expenses/${id}`);
  }
}

export async function createLiveCampaign(payload: Partial<Campaign>): Promise<void> {
  const id = sanitizeId(`camp-${Date.now()}`);
  try {
    await setDoc(doc(db, 'campaigns', id), {
      id,
      name: clampString(payload.name, 120),
      code: clampString(payload.code, 32).toUpperCase(),
      type: payload.type || 'Percentage',
      value: nonNegativeNumber(payload.value ?? 10),
      minOrderAmount: nonNegativeNumber(payload.minOrderAmount ?? 20000),
      scheduleLabel: clampString(payload.scheduleLabel, 80, 'All Day'),
      active: true,
      ordersGenerated: 0,
      revenueGenerated: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `campaigns/${id}`);
  }
}

export async function toggleLiveCampaign(id: string, active: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'campaigns', id), {
      active: Boolean(active),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `campaigns/${id}`);
  }
}

export async function toggleLiveAutomation(id: string, enabled: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'automations', id), {
      enabled: Boolean(enabled),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `automations/${id}`);
  }
}

export async function triggerLiveAutomation(
  rule: AutomationRule,
  customers: CustomerProfile[],
): Promise<void> {
  const optedIn = customers.filter((c) => c.marketingOptIn);
  const target = optedIn[0] ?? customers[0];
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'automations', rule.id), {
      sentCount: rule.sentCount + Math.max(1, optedIn.length),
      lastTriggeredAt: now,
      updatedAt: serverTimestamp(),
    });
    if (target) {
      const logId = sanitizeId(`alog-${Date.now()}`);
      await setDoc(doc(db, 'automationLogs', logId), {
        id: logId,
        ruleName: clampString(rule.name, 120),
        channel: clampString(rule.channel, 60),
        recipientName: clampString(`${optedIn.length} opted-in customer(s) (${target.name})`, 120),
        recipientPhone: clampString(target.phone, 30),
        message: clampString(`Sandbox dispatch: "${rule.name}" executed for opted-in subscribers.`, 500),
        sentAt: now,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `automations/${rule.id}`);
  }
}

export async function updateLiveCustomer(
  id: string,
  payload: { notes?: string; marketingOptIn?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (payload.notes !== undefined) patch.notes = clampString(payload.notes, 500);
  if (payload.marketingOptIn !== undefined) patch.marketingOptIn = Boolean(payload.marketingOptIn);
  try {
    await updateDoc(doc(db, 'customers', id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `customers/${id}`);
  }
}

export async function createLiveStaff(payload: {
  name: string;
  role: StaffRole;
  phone: string;
}): Promise<void> {
  const rolePerms: Record<StaffRole, string[]> = {
    Owner: ['All Modules', 'Financial P&L', 'Staff & Pricing'],
    Admin: ['Menu & Products', 'Settings', 'Staff Accounts'],
    Cashier: ['Orders Queue', 'Payment Confirmation', 'Receipts'],
    Kitchen: ['Kitchen Display (KDS)', 'Menu Availability'],
    'Delivery Manager': ['Rider Dispatch', 'Delivery SLA'],
    Rider: ['Assigned Deliveries', 'Delivery Completion'],
  };
  const id = sanitizeId(`st-${Date.now()}`);
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'staff', id), {
      id,
      name: clampString(payload.name, 100),
      role: payload.role,
      phone: clampString(payload.phone, 30),
      active: true,
      lastActiveAt: now,
      permissions: rolePerms[payload.role] || ['Basic Access'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await appendStaffActivity('Admin', 'Admin', `Created ${payload.role} account for ${payload.name}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `staff/${id}`);
  }
}

export async function updateLiveStaff(
  id: string,
  payload: { active?: boolean; role?: StaffRole },
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (payload.active !== undefined) patch.active = Boolean(payload.active);
  if (payload.role) patch.role = payload.role;
  try {
    await updateDoc(doc(db, 'staff', id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `staff/${id}`);
  }
}

export async function createLiveQrChannel(payload: {
  label: string;
  channelType: 'Table' | 'Flyer' | 'Packaging' | 'Social';
  sourceCode: string;
}): Promise<void> {
  const id = sanitizeId(`qr-${Date.now()}`);
  try {
    await setDoc(doc(db, 'qrChannels', id), {
      id,
      label: clampString(payload.label, 100),
      channelType: payload.channelType || 'Table',
      sourceCode: sanitizeId(payload.sourceCode.toLowerCase(), 'qr').slice(0, 64),
      scans: 0,
      ordersCount: 0,
      revenue: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `qrChannels/${id}`);
  }
}

export async function trackLiveQrScan(qr: QRChannel): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'qrChannels', qr.id), {
      scans: qr.scans + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('QR scan log skipped:', err);
  }
}

export async function updateLiveSettings(
  current: StoreSettings,
  payload: Partial<StoreSettings>,
): Promise<void> {
  const merged = {
    restaurantName: clampString(payload.restaurantName ?? current.restaurantName, 100),
    tagline: clampString(payload.tagline ?? current.tagline, 240),
    address: clampString(payload.address ?? current.address, 200),
    locationPin: clampString(payload.locationPin ?? current.locationPin, 64),
    phone: clampString(payload.phone ?? current.phone, 30),
    whatsappNumber: clampString(payload.whatsappNumber ?? current.whatsappNumber, 30),
    openingHours: clampString(payload.openingHours ?? current.openingHours, 100),
    currency: clampString(payload.currency ?? current.currency, 10),
    deliveryFeeBase: nonNegativeNumber(payload.deliveryFeeBase ?? current.deliveryFeeBase),
    freeDeliveryThreshold: nonNegativeNumber(
      payload.freeDeliveryThreshold ?? current.freeDeliveryThreshold,
    ),
    deliveryTargetMinutes: Math.max(
      1,
      nonNegativeNumber(payload.deliveryTargetMinutes ?? current.deliveryTargetMinutes, 30),
    ),
    activePromoBanner: clampString(
      payload.activePromoBanner ?? current.activePromoBanner,
      240,
      '',
    ),
    sandboxMode: {
      ...current.sandboxMode,
      ...(payload.sandboxMode ?? {}),
    },
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'settings', 'public'), merged);
    await appendStaffActivity('Admin', 'Admin', 'Updated restaurant settings & sandbox flags');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/public');
  }
}

export async function requestLiveTakeover(customerPrompt: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google to alert live staff, or switch to Developer Demo Mode.');
  }
  const id = sanitizeId(`take-${Date.now()}`);
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'takeoverRequests', id), {
      id,
      userId: user.uid,
      customerPrompt: clampString(
        customerPrompt,
        500,
        'Customer requested human staff assistance',
      ),
      resolved: false,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `takeoverRequests/${id}`);
  }
}
