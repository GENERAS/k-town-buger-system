import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  canTransitionOrderStatus,
  computeCustomerSegment,
  computeInventoryDeductions,
  computeLoyaltyUpdate,
  computeOwnerAnalytics,
  formatWhatsAppOrderMessage,
  getNextOrderStatus,
  getUpsellRecommendations,
} from './rules';
import type {
  Campaign,
  CartItem,
  CustomerProfile,
  ExpenseRecord,
  InventoryIngredient,
  MenuItem,
  Order,
} from './types';

const sampleMenu: MenuItem[] = [
  {
    id: 'm-burger',
    name: 'K Town Double Smash',
    category: 'Burgers',
    description: 'Double beef smash',
    price: 24000,
    imageUrl: '/img.jpg',
    available: true,
    bestseller: true,
    prepMinutes: 12,
    comboUpgradePrice: 9000,
    recipe: [
      { ingredientId: 'ing-patty', quantity: 2 },
      { ingredientId: 'ing-bun', quantity: 1 },
    ],
  },
  {
    id: 'm-fries',
    name: 'Seasoned Fries',
    category: 'Fries',
    description: 'Crispy fries',
    price: 8000,
    imageUrl: '/img.jpg',
    available: true,
    prepMinutes: 6,
    recipe: [{ ingredientId: 'ing-fries', quantity: 1 }],
  },
  {
    id: 'm-cola',
    name: 'Chilled Craft Cola',
    category: 'Drinks',
    description: 'Cold soda',
    price: 5000,
    imageUrl: '/img.jpg',
    available: true,
    prepMinutes: 1,
    recipe: [{ ingredientId: 'ing-soda', quantity: 1 }],
  },
];

const sampleCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Launch 10% Off',
    code: 'KTOWN10',
    type: 'Percentage',
    value: 10,
    minOrderAmount: 20000,
    scheduleLabel: 'All Day',
    active: true,
    ordersGenerated: 0,
    revenueGenerated: 0,
  },
  {
    id: 'c2',
    name: 'Free Delivery Promo',
    code: 'FREEDEL',
    type: 'Free Delivery',
    value: 0,
    minOrderAmount: 15000,
    scheduleLabel: 'Lunch',
    active: true,
    ordersGenerated: 0,
    revenueGenerated: 0,
  },
];

test('calculateCartTotals computes subtotal, extras, promo discount, and free delivery threshold', () => {
  const cart: CartItem[] = [
    {
      cartItemId: 'ci-1',
      menuItemId: 'm-burger',
      name: 'K Town Double Smash',
      category: 'Burgers',
      basePrice: 24000,
      quantity: 2,
      selectedSize: { id: 'lg', label: 'Triple', priceDelta: 4000 },
      selectedExtras: [{ id: 'ex-1', label: 'Extra Cheese', price: 2000 }],
      isComboUpgrade: false,
      comboUpgradePrice: 9000,
    },
  ];

  // Unit price = 24000 + 4000 + 2000 = 30000. Qty 2 = 60000 -> meets free delivery threshold
  const freeResult = calculateCartTotals({
    items: cart,
    fulfillmentType: 'Delivery',
    deliveryZone: 'Kololo & Nakasero',
    promoCode: 'KTOWN10',
    campaigns: sampleCampaigns,
    deliveryFeeBase: 5000,
    freeDeliveryThreshold: 60000,
  });

  assert.equal(freeResult.subtotal, 60000);
  assert.equal(freeResult.discount, 6000);
  assert.equal(freeResult.deliveryFee, 0);
  assert.equal(freeResult.total, 54000);

  // Under threshold includes delivery fee unless FREEDEL applied
  const singleCart: CartItem[] = [{ ...cart[0], quantity: 1 }];
  const paidDelivery = calculateCartTotals({
    items: singleCart,
    fulfillmentType: 'Delivery',
    deliveryZone: 'Ntinda & Kiwatule', // 1.4x -> 7000
    campaigns: sampleCampaigns,
    deliveryFeeBase: 5000,
    freeDeliveryThreshold: 60000,
  });
  assert.equal(paidDelivery.deliveryFee, 7000);
  assert.equal(paidDelivery.total, 37000);
  assert.equal(paidDelivery.amountToFreeDelivery, 30000);
});

test('getUpsellRecommendations suggests drinks and fries when burger is in cart', () => {
  const cart: CartItem[] = [
    {
      cartItemId: 'ci-1',
      menuItemId: 'm-burger',
      name: 'K Town Double Smash',
      category: 'Burgers',
      basePrice: 24000,
      quantity: 1,
      selectedExtras: [],
      isComboUpgrade: false,
      comboUpgradePrice: 9000,
    },
  ];

  const recs = getUpsellRecommendations(cart, sampleMenu);
  assert.ok(recs.some((r) => r.item.category === 'Drinks'));
  assert.ok(recs.some((r) => r.item.category === 'Fries'));
});

test('order status state machine supports 8-step delivery flow and pickup shortcut', () => {
  assert.equal(canTransitionOrderStatus('New order received', 'Order confirmed', 'Delivery'), true);
  assert.equal(canTransitionOrderStatus('Completed', 'Order confirmed', 'Delivery'), false);
  assert.equal(getNextOrderStatus('Ready for pickup', 'Delivery'), 'Assigned to rider');
  assert.equal(getNextOrderStatus('Ready for pickup', 'Pickup'), 'Completed');
});

test('computeInventoryDeductions deducts recipe ingredients and combo items accurately', () => {
  const ingredients: InventoryIngredient[] = [
    {
      id: 'ing-patty',
      name: 'Beef Patty',
      unit: 'pcs',
      currentStock: 10,
      reorderLevel: 8,
      unitCost: 3500,
      supplierName: 'Kampala Prime Meats',
      lastRestockedAt: '2026-11-24T08:00:00Z',
    },
    {
      id: 'ing-bun',
      name: 'Brioche Bun',
      unit: 'pcs',
      currentStock: 20,
      reorderLevel: 10,
      unitCost: 1200,
      supplierName: 'Bakery Co',
      lastRestockedAt: '2026-11-24T08:00:00Z',
    },
    {
      id: 'ing-fries',
      name: 'Fries Portion',
      unit: 'portions',
      currentStock: 15,
      reorderLevel: 5,
      unitCost: 1500,
      supplierName: 'Farm Fresh',
      lastRestockedAt: '2026-11-24T08:00:00Z',
    },
    {
      id: 'ing-soda',
      name: 'Cola Can',
      unit: 'cans',
      currentStock: 12,
      reorderLevel: 6,
      unitCost: 1800,
      supplierName: 'Beverage Dist',
      lastRestockedAt: '2026-11-24T08:00:00Z',
    },
  ];

  const deductions = computeInventoryDeductions(
    [
      {
        menuItemId: 'm-burger',
        name: 'K Town Double Smash',
        category: 'Burgers',
        quantity: 2,
        unitPrice: 33000,
        lineTotal: 66000,
        extrasLabels: [],
        isComboUpgrade: true,
      },
    ],
    sampleMenu,
    ingredients,
  );

  const patty = deductions.find((d) => d.ingredientId === 'ing-patty');
  assert.equal(patty?.deductQty, 4);
  assert.equal(patty?.remainingStock, 6);
  assert.equal(patty?.lowStock, true);

  const soda = deductions.find((d) => d.ingredientId === 'ing-soda');
  assert.equal(soda?.deductQty, 2);
  assert.equal(soda?.remainingStock, 10);
});

test('computeLoyaltyUpdate unlocks Buy 5 Burgers reward and promotes segment', () => {
  const updated = computeLoyaltyUpdate(
    {
      orderCount: 1,
      totalSpent: 30000,
      burgerStamps: 3,
      loyaltyPoints: 30,
      rewardsAvailable: 0,
    },
    50000,
    3, // 3 + 3 = 6 stamps -> 1 reward unlocked, 1 stamp remaining
  );

  assert.equal(updated.rewardsAvailable, 1);
  assert.equal(updated.burgerStamps, 1);
  assert.equal(updated.earnedRewardNow, true);
  assert.equal(updated.segment, 'Returning');
  assert.equal(computeCustomerSegment(5, 250000, 2), 'VIP');
  assert.equal(computeCustomerSegment(2, 40000, 35), 'At-Risk');
});

test('computeOwnerAnalytics and formatWhatsAppOrderMessage produce consistent metrics', () => {
  const now = new Date('2026-11-24T12:00:00Z').getTime();
  const sampleOrder: Order = {
    id: 'o1',
    orderNumber: 'KTB-1050',
    createdAt: '2026-11-24T11:30:00Z',
    updatedAt: '2026-11-24T11:50:00Z',
    deliveredAt: '2026-11-24T11:52:00Z',
    customerId: 'cust-1',
    customerName: 'Amina Namukasa',
    customerPhone: '+256772112233',
    marketingOptIn: true,
    fulfillmentType: 'Delivery',
    deliveryZone: 'Kololo & Nakasero',
    deliveryAddress: 'Plot 14 Acacia Ave',
    items: [
      {
        menuItemId: 'm-burger',
        name: 'K Town Double Smash',
        category: 'Burgers',
        quantity: 2,
        unitPrice: 24000,
        lineTotal: 48000,
        extrasLabels: [],
        isComboUpgrade: false,
      },
    ],
    subtotal: 48000,
    discount: 0,
    deliveryFee: 5000,
    total: 53000,
    paymentMethod: 'MTN Mobile Money',
    paymentStatus: 'Confirmed',
    paymentReference: 'MOMO-9812',
    status: 'Completed',
    statusHistory: [],
    priority: 'Normal',
    estimatedMinutes: 25,
    inventoryDeducted: true,
    whatsAppSent: true,
  };

  const customers: CustomerProfile[] = [
    {
      id: 'cust-1',
      name: 'Amina Namukasa',
      phone: '+256772112233',
      firstOrderAt: '2026-10-01T10:00:00Z',
      lastOrderAt: '2026-11-24T11:30:00Z',
      orderCount: 3,
      totalSpent: 150000,
      burgerStamps: 2,
      loyaltyPoints: 150,
      rewardsAvailable: 0,
      favoriteItems: ['K Town Double Smash'],
      segment: 'Returning',
      notes: '',
      marketingOptIn: true,
      referralCode: 'AMINA5',
    },
  ];

  const expenses: ExpenseRecord[] = [
    {
      id: 'exp-1',
      category: 'Utilities',
      description: 'Kitchen gas refill',
      amount: 10000,
      recordedAt: '2026-11-24T09:00:00Z',
    },
  ];

  const analytics = computeOwnerAnalytics({
    orders: [sampleOrder],
    customers,
    expenses,
    menuItems: sampleMenu,
    ingredients: [],
    nowMs: now,
  });

  assert.equal(analytics.totalRevenue, 53000);
  assert.equal(analytics.averageOrderValue, 53000);
  assert.equal(analytics.onTimeRate, 100);
  assert.equal(analytics.avgDeliveryMinutes, 22);
  assert.equal(analytics.paymentBreakdown['MTN Mobile Money'].amount, 53000);

  const waText = formatWhatsAppOrderMessage(sampleOrder, {
    restaurantName: 'K Town Burger',
    currency: 'UGX',
  });
  assert.match(waText, /KTB-1050/);
  assert.match(waText, /Amina Namukasa/);
  assert.match(waText, /UGX 53,000/);
});
