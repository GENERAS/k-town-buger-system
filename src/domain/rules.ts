import type {
  Campaign,
  CartItem,
  CustomerProfile,
  CustomerSegment,
  ExpenseRecord,
  FulfillmentType,
  InventoryIngredient,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  StoreSettings,
} from './types';

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'New order received',
  'Order confirmed',
  'Preparing food',
  'Ready for pickup',
  'Assigned to rider',
  'Out for delivery',
  'Delivered',
  'Completed',
];

export const DELIVERY_ZONES: Array<{ name: string; feeMultiplier: number }> = [
  { name: 'Kololo & Nakasero', feeMultiplier: 1.0 },
  { name: 'Kamwokya & Bukoto', feeMultiplier: 1.0 },
  { name: 'Bugolobi & Naguru', feeMultiplier: 1.2 },
  { name: 'Ntinda & Kiwatule', feeMultiplier: 1.4 },
  { name: 'Kampala Central / CBD', feeMultiplier: 1.0 },
];

export function formatCurrency(amount: number, currency = 'UGX'): string {
  const safe = Math.round(Number.isFinite(amount) ? amount : 0);
  return `${currency} ${safe.toLocaleString('en-US')}`;
}

export function computeCartItemUnitPrice(item: CartItem): number {
  const sizeDelta = item.selectedSize?.priceDelta ?? 0;
  const extrasTotal = item.selectedExtras.reduce((sum, ex) => sum + ex.price, 0);
  const comboDelta = item.isComboUpgrade ? item.comboUpgradePrice : 0;
  return Math.max(0, item.basePrice + sizeDelta + extrasTotal + comboDelta);
}

export function calculateCartTotals(params: {
  items: CartItem[];
  fulfillmentType: FulfillmentType;
  deliveryZone?: string;
  promoCode?: string;
  campaigns: Campaign[];
  deliveryFeeBase: number;
  freeDeliveryThreshold: number;
  isFirstOrder?: boolean;
}): {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  appliedCampaign?: Campaign;
  promoError?: string;
  amountToFreeDelivery: number;
} {
  const subtotal = params.items.reduce(
    (sum, item) => sum + computeCartItemUnitPrice(item) * item.quantity,
    0,
  );

  let discount = 0;
  let appliedCampaign: Campaign | undefined;
  let promoError: string | undefined;

  const zone = DELIVERY_ZONES.find((z) => z.name === params.deliveryZone);
  const baseDelivery =
    params.fulfillmentType === 'Delivery'
      ? Math.round(params.deliveryFeeBase * (zone?.feeMultiplier ?? 1))
      : 0;

  let deliveryFee =
    params.fulfillmentType === 'Delivery' && subtotal >= params.freeDeliveryThreshold
      ? 0
      : baseDelivery;

  const trimmedCode = params.promoCode?.trim().toUpperCase();
  if (trimmedCode) {
    const campaign = params.campaigns.find(
      (c) => c.code.toUpperCase() === trimmedCode && c.active,
    );
    if (!campaign) {
      promoError = `Promo code "${trimmedCode}" is invalid or inactive.`;
    } else if (subtotal < campaign.minOrderAmount) {
      promoError = `Minimum order of ${formatCurrency(campaign.minOrderAmount)} required for ${campaign.code}.`;
    } else if (campaign.type === 'First Order' && params.isFirstOrder === false) {
      promoError = `${campaign.code} is reserved for first-time customers.`;
    } else {
      appliedCampaign = campaign;
      if (campaign.type === 'Percentage' || campaign.type === 'First Order' || campaign.type === 'Birthday' || campaign.type === 'Group Offer') {
        discount = Math.round((subtotal * campaign.value) / 100);
      } else if (campaign.type === 'Fixed' || campaign.type === 'Referral') {
        discount = Math.min(subtotal, campaign.value);
      } else if (campaign.type === 'Free Delivery') {
        deliveryFee = 0;
      }
    }
  }

  const total = Math.max(0, subtotal - discount + deliveryFee);
  const amountToFreeDelivery =
    params.fulfillmentType === 'Delivery' && deliveryFee > 0
      ? Math.max(0, params.freeDeliveryThreshold - subtotal)
      : 0;

  return {
    subtotal,
    discount,
    deliveryFee,
    total,
    appliedCampaign,
    promoError,
    amountToFreeDelivery,
  };
}

export function getUpsellRecommendations(
  cartItems: CartItem[],
  menuItems: MenuItem[],
): Array<{ item: MenuItem; reason: string }> {
  const inCartIds = new Set(cartItems.map((c) => c.menuItemId));
  const categoriesInCart = new Set(cartItems.map((c) => c.category));
  const available = menuItems.filter((m) => m.available && !inCartIds.has(m.id));
  const recs: Array<{ item: MenuItem; reason: string }> = [];

  if (
    (categoriesInCart.has('Burgers') || categoriesInCart.has('Pizza')) &&
    !categoriesInCart.has('Drinks')
  ) {
    const drink = available.find((m) => m.category === 'Drinks');
    if (drink) {
      recs.push({ item: drink, reason: 'Pairs cleanly with flame-grilled burgers' });
    }
  }

  if (
    (categoriesInCart.has('Chicken') || categoriesInCart.has('Burgers')) &&
    !categoriesInCart.has('Fries')
  ) {
    const fries = available.find((m) => m.category === 'Fries');
    if (fries) {
      recs.push({ item: fries, reason: 'Add crispy seasoned fries to complete your meal' });
    }
  }

  if (cartItems.length > 0 && !categoriesInCart.has('Combos')) {
    const combo = available.find((m) => m.category === 'Combos');
    if (combo) {
      recs.push({ item: combo, reason: 'Upgrade or share a value combo bundle' });
    }
  }

  if (recs.length < 2) {
    for (const m of available) {
      if (!recs.some((r) => r.item.id === m.id) && (m.bestseller || m.category === 'Drinks' || m.category === 'Fries')) {
        recs.push({ item: m, reason: 'Popular kitchen favorite' });
      }
      if (recs.length >= 3) break;
    }
  }

  return recs.slice(0, 3);
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): boolean {
  if (from === 'Cancelled' || from === 'Completed') return false;
  if (to === 'Cancelled') return true;
  if (from === to) return false;

  const fromIdx = ORDER_STATUS_SEQUENCE.indexOf(from);
  const toIdx = ORDER_STATUS_SEQUENCE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;

  // Pickup orders can jump from Ready for pickup -> Completed directly
  if (
    fulfillmentType === 'Pickup' &&
    from === 'Ready for pickup' &&
    to === 'Completed'
  ) {
    return true;
  }

  return toIdx === fromIdx + 1 || (toIdx > fromIdx && toIdx <= fromIdx + 2);
}

export function getNextOrderStatus(
  current: OrderStatus,
  fulfillmentType: FulfillmentType,
): OrderStatus | null {
  if (current === 'Cancelled' || current === 'Completed') return null;
  if (fulfillmentType === 'Pickup' && current === 'Ready for pickup') {
    return 'Completed';
  }
  const idx = ORDER_STATUS_SEQUENCE.indexOf(current);
  if (idx === -1 || idx >= ORDER_STATUS_SEQUENCE.length - 1) return null;
  return ORDER_STATUS_SEQUENCE[idx + 1];
}

export function computeInventoryDeductions(
  orderItems: OrderItem[],
  menuItems: MenuItem[],
  ingredients: InventoryIngredient[],
): Array<{
  ingredientId: string;
  ingredientName: string;
  deductQty: number;
  remainingStock: number;
  lowStock: boolean;
}> {
  const usageMap = new Map<string, number>();

  for (const orderItem of orderItems) {
    const menu = menuItems.find((m) => m.id === orderItem.menuItemId);
    if (!menu) continue;
    for (const ing of menu.recipe) {
      usageMap.set(
        ing.ingredientId,
        (usageMap.get(ing.ingredientId) ?? 0) + ing.quantity * orderItem.quantity,
      );
    }
    if (orderItem.isComboUpgrade) {
      // Combo upgrade uses 1 portion fries & 1 beverage cup/can if present in inventory
      usageMap.set('ing-fries', (usageMap.get('ing-fries') ?? 0) + 1 * orderItem.quantity);
      usageMap.set('ing-soda', (usageMap.get('ing-soda') ?? 0) + 1 * orderItem.quantity);
    }
  }

  const results: Array<{
    ingredientId: string;
    ingredientName: string;
    deductQty: number;
    remainingStock: number;
    lowStock: boolean;
  }> = [];

  for (const [ingredientId, deductQty] of usageMap.entries()) {
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing) continue;
    const remainingStock = Math.max(0, Number((ing.currentStock - deductQty).toFixed(2)));
    results.push({
      ingredientId,
      ingredientName: ing.name,
      deductQty,
      remainingStock,
      lowStock: remainingStock <= ing.reorderLevel,
    });
  }

  return results;
}

export function computeCustomerSegment(
  orderCount: number,
  totalSpent: number,
  daysSinceLastOrder: number,
): CustomerSegment {
  if (daysSinceLastOrder >= 30 && orderCount >= 1) return 'At-Risk';
  if (totalSpent >= 200000 || orderCount >= 5) return 'VIP';
  if (orderCount >= 2) return 'Returning';
  return 'First-Time';
}

export function computeLoyaltyUpdate(
  existing: Pick<
    CustomerProfile,
    'orderCount' | 'totalSpent' | 'burgerStamps' | 'loyaltyPoints' | 'rewardsAvailable'
  >,
  orderTotal: number,
  burgerCount: number,
): {
  orderCount: number;
  totalSpent: number;
  burgerStamps: number;
  loyaltyPoints: number;
  rewardsAvailable: number;
  earnedRewardNow: boolean;
  segment: CustomerSegment;
} {
  const newOrderCount = existing.orderCount + 1;
  const newTotalSpent = existing.totalSpent + orderTotal;
  const pointsEarned = Math.floor(orderTotal / 1000);
  const newPoints = existing.loyaltyPoints + pointsEarned;

  const totalStamps = existing.burgerStamps + burgerCount;
  const newlyUnlockedRewards = Math.floor(totalStamps / 5);
  const remainingStamps = totalStamps % 5;

  return {
    orderCount: newOrderCount,
    totalSpent: newTotalSpent,
    burgerStamps: remainingStamps,
    loyaltyPoints: newPoints,
    rewardsAvailable: existing.rewardsAvailable + newlyUnlockedRewards,
    earnedRewardNow: newlyUnlockedRewards > 0,
    segment: computeCustomerSegment(newOrderCount, newTotalSpent, 0),
  };
}

export function formatWhatsAppOrderMessage(
  order: Order,
  settings: Pick<StoreSettings, 'restaurantName' | 'currency'>,
): string {
  const itemLines = order.items
    .map((item) => {
      const details = [
        item.sizeLabel,
        item.isComboUpgrade ? 'Combo Meal' : null,
        ...item.extrasLabels,
      ]
        .filter(Boolean)
        .join(', ');
      return `• ${item.quantity}x ${item.name}${details ? ` (${details})` : ''} — ${formatCurrency(item.lineTotal, settings.currency)}`;
    })
    .join('\n');

  const locationText =
    order.fulfillmentType === 'Delivery'
      ? `Delivery: ${order.deliveryAddress || 'Address pending'} (${order.deliveryZone || 'Kampala'})${order.locationPin ? `\nLocation Pin: ${order.locationPin}` : ''}`
      : 'Pickup at Restaurant Counter';

  return [
    `*${settings.restaurantName} — Order ${order.orderNumber}*`,
    `Status: ${order.status}`,
    `Customer: ${order.customerName} (${order.customerPhone})`,
    locationText,
    '',
    '*Items:*',
    itemLines,
    '',
    `Subtotal: ${formatCurrency(order.subtotal, settings.currency)}`,
    order.discount > 0
      ? `Discount (${order.promoCode ?? 'Promo'}): -${formatCurrency(order.discount, settings.currency)}`
      : null,
    `Delivery Fee: ${formatCurrency(order.deliveryFee, settings.currency)}`,
    `*Total: ${formatCurrency(order.total, settings.currency)}*`,
    `Payment: ${order.paymentMethod} (${order.paymentStatus} · Ref ${order.paymentReference})`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function computeOwnerAnalytics(params: {
  orders: Order[];
  customers: CustomerProfile[];
  expenses: ExpenseRecord[];
  menuItems: MenuItem[];
  ingredients: InventoryIngredient[];
  nowMs?: number;
}) {
  const now = params.nowMs ?? Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;
  const thirtyDaysMs = 30 * oneDayMs;

  const validOrders = params.orders.filter((o) => o.status !== 'Cancelled');
  const cancelledOrders = params.orders.filter((o) => o.status === 'Cancelled');

  const sumRevenue = (list: Order[]) => list.reduce((s, o) => s + o.total, 0);

  const dailyOrders = validOrders.filter((o) => now - new Date(o.createdAt).getTime() <= oneDayMs);
  const weeklyOrders = validOrders.filter((o) => now - new Date(o.createdAt).getTime() <= sevenDaysMs);
  const monthlyOrders = validOrders.filter((o) => now - new Date(o.createdAt).getTime() <= thirtyDaysMs);

  const totalRevenue = sumRevenue(validOrders);
  const totalOrders = validOrders.length;
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Product sales ranking
  const productMap = new Map<string, { id: string; name: string; qty: number; revenue: number }>();
  for (const m of params.menuItems) {
    productMap.set(m.id, { id: m.id, name: m.name, qty: 0, revenue: 0 });
  }
  for (const order of validOrders) {
    for (const item of order.items) {
      const cur = productMap.get(item.menuItemId) ?? {
        id: item.menuItemId,
        name: item.name,
        qty: 0,
        revenue: 0,
      };
      cur.qty += item.quantity;
      cur.revenue += item.lineTotal;
      productMap.set(item.menuItemId, cur);
    }
  }
  const rankedProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty);
  const bestSellers = rankedProducts.slice(0, 5);
  const leastSellers = [...rankedProducts].sort((a, b) => a.qty - b.qty).slice(0, 4);

  // Peak ordering hours (0-23)
  const hourCounts = new Array<number>(24).fill(0);
  for (const o of validOrders) {
    const hr = new Date(o.createdAt).getHours();
    hourCounts[hr] += 1;
  }

  // Payment breakdown
  const paymentBreakdown: Record<PaymentMethod, { count: number; amount: number }> = {
    'MTN Mobile Money': { count: 0, amount: 0 },
    'Airtel Money': { count: 0, amount: 0 },
    'Pay on Delivery': { count: 0, amount: 0 },
    'Pay at Restaurant': { count: 0, amount: 0 },
  };
  for (const o of validOrders) {
    paymentBreakdown[o.paymentMethod].count += 1;
    paymentBreakdown[o.paymentMethod].amount += o.total;
  }

  // Delivery performance (< 30 min SLA)
  const deliveredOrders = validOrders.filter(
    (o) => o.fulfillmentType === 'Delivery' && o.deliveredAt,
  );
  let onTimeCount = 0;
  let totalDeliveryMinutes = 0;
  for (const o of deliveredOrders) {
    const mins = Math.max(
      5,
      Math.round(
        (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60000,
      ),
    );
    totalDeliveryMinutes += mins;
    if (mins <= 30) onTimeCount += 1;
  }
  const avgDeliveryMinutes =
    deliveredOrders.length > 0 ? Math.round(totalDeliveryMinutes / deliveredOrders.length) : 24;
  const onTimeRate =
    deliveredOrders.length > 0
      ? Math.round((onTimeCount / deliveredOrders.length) * 100)
      : 92;

  // Customer acquisition vs returning
  const returningCustomers = params.customers.filter((c) => c.orderCount >= 2).length;
  const newCustomers = params.customers.filter((c) => c.orderCount <= 1).length;

  // Financials
  const totalDiscounts = validOrders.reduce((s, o) => s + o.discount, 0);
  const totalRefunds = params.orders.reduce((s, o) => s + (o.refundAmount ?? 0), 0);
  const totalExpenses = params.expenses.reduce((s, e) => s + e.amount, 0);
  const estimatedCogs = Math.round(totalRevenue * 0.36);
  const grossProfit = totalRevenue - estimatedCogs - totalRefunds;
  const netProfit = grossProfit - totalExpenses;

  // Demand & Stock Forecasting (next 7 days projection based on current average + 15% weekend lift)
  const dailyAvgOrders = Math.max(totalOrders / 7, 4);
  const forecastedIngredients = params.ingredients.map((ing) => {
    const estimatedDailyUse = Math.max(2, Math.round(ing.reorderLevel * 0.35 * (dailyAvgOrders / 4)));
    const sevenDayNeed = estimatedDailyUse * 7;
    const deficit = Math.max(0, sevenDayNeed - ing.currentStock);
    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      currentStock: ing.currentStock,
      projected7DayNeed: sevenDayNeed,
      suggestedOrderQty: deficit,
      daysRemaining: Number((ing.currentStock / Math.max(1, estimatedDailyUse)).toFixed(1)),
    };
  });

  return {
    dailyRevenue: sumRevenue(dailyOrders),
    weeklyRevenue: sumRevenue(weeklyOrders),
    monthlyRevenue: sumRevenue(monthlyOrders),
    totalRevenue,
    totalOrders,
    cancelledCount: cancelledOrders.length,
    averageOrderValue,
    bestSellers,
    leastSellers,
    hourCounts,
    paymentBreakdown,
    avgDeliveryMinutes,
    onTimeRate,
    deliveredCount: deliveredOrders.length,
    returningCustomers,
    newCustomers,
    totalDiscounts,
    totalRefunds,
    totalExpenses,
    estimatedCogs,
    grossProfit,
    netProfit,
    forecastedIngredients,
  };
}
