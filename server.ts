import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createInitialSeedState } from './src/server/seed';
import {
  canTransitionOrderStatus,
  computeInventoryDeductions,
  computeLoyaltyUpdate,
  formatCurrency,
} from './src/domain/rules';
import type {
  Campaign,
  CustomerProfile,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  RestaurantState,
  StaffRole,
} from './src/domain/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'ktown-state.json');

function loadState(): RestaurantState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as RestaurantState;
      if (parsed && Array.isArray(parsed.menu) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read persisted state file, seeding fresh state:', err);
  }
  const fresh = createInitialSeedState();
  saveState(fresh);
  return fresh;
}

function saveState(state: RestaurantState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist state file:', err);
  }
}

let state: RestaurantState = loadState();

function logStaffAction(staffName: string, role: StaffRole, action: string) {
  state.staffActivity.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    staffName,
    role,
    action,
    timestamp: new Date().toISOString(),
  });
  state.staffActivity = state.staffActivity.slice(0, 60);
}

function applyInventoryDeductionForOrder(order: Order) {
  if (order.inventoryDeducted) return;
  const deductions = computeInventoryDeductions(
    order.items,
    state.menu,
    state.ingredients,
  );
  const now = new Date().toISOString();
  for (const d of deductions) {
    const ing = state.ingredients.find((i) => i.id === d.ingredientId);
    if (ing) {
      ing.currentStock = d.remainingStock;
      state.stockMovements.unshift({
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ingredientId: ing.id,
        ingredientName: ing.name,
        delta: -d.deductQty,
        reason: 'Order Deduction',
        referenceId: order.orderNumber,
        timestamp: now,
      });
    }
  }
  order.inventoryDeducted = true;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Read full synchronized restaurant state
  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  // Reset demo data if needed
  app.post('/api/reset-demo', (_req, res) => {
    state = createInitialSeedState();
    saveState(state);
    res.json(state);
  });

  // Track QR scan attribution
  app.post('/api/qr/scan', (req, res) => {
    const { sourceCode } = req.body as { sourceCode?: string };
    if (sourceCode) {
      const ch = state.qrChannels.find((c) => c.sourceCode === sourceCode);
      if (ch) {
        ch.scans += 1;
        saveState(state);
      }
    }
    res.json({ ok: true });
  });

  // Create new customer or group order
  app.post('/api/orders', (req, res) => {
    const body = req.body as {
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      marketingOptIn?: boolean;
      fulfillmentType?: 'Delivery' | 'Pickup';
      deliveryZone?: string;
      deliveryAddress?: string;
      locationPin?: string;
      paymentMethod?: PaymentMethod;
      promoCode?: string;
      items?: OrderItem[];
      subtotal?: number;
      discount?: number;
      deliveryFee?: number;
      total?: number;
      scheduledFor?: string;
      isGroupOrder?: boolean;
      groupOrgName?: string;
      qrSource?: string;
    };

    const name = body.customerName?.trim();
    const phone = body.customerPhone?.trim();
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }
    if (body.fulfillmentType === 'Delivery' && !body.deliveryAddress?.trim()) {
      return res.status(400).json({ error: 'Delivery address is required for delivery orders.' });
    }

    const now = new Date().toISOString();
    const nextNum = 1049 + state.orders.length;
    const orderNumber = `KTB-${nextNum}`;

    // Upsert Customer CRM profile
    let customer = state.customers.find(
      (c) => c.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, ''),
    );
    const burgerCount = body.items
      .filter((i) => i.category === 'Burgers' || i.category === 'Combos')
      .reduce((s, i) => s + i.quantity, 0);

    const orderTotal = Number(body.total ?? 0);
    if (!customer) {
      const loyalty = computeLoyaltyUpdate(
        {
          orderCount: 0,
          totalSpent: 0,
          burgerStamps: 0,
          loyaltyPoints: 0,
          rewardsAvailable: 0,
        },
        orderTotal,
        burgerCount,
      );
      customer = {
        id: `cust-${Date.now()}`,
        name,
        phone,
        email: body.customerEmail?.trim() || undefined,
        firstOrderAt: now,
        lastOrderAt: now,
        orderCount: loyalty.orderCount,
        totalSpent: loyalty.totalSpent,
        burgerStamps: loyalty.burgerStamps,
        loyaltyPoints: loyalty.loyaltyPoints,
        rewardsAvailable: loyalty.rewardsAvailable,
        favoriteItems: body.items.slice(0, 2).map((i) => i.name),
        segment: loyalty.segment,
        notes: body.isGroupOrder ? `Group organizer (${body.groupOrgName || 'Group'})` : '',
        marketingOptIn: Boolean(body.marketingOptIn),
        referralCode: `${name.split(' ')[0].toUpperCase().slice(0, 6)}-KTB`,
      };
      state.customers.unshift(customer);
    } else {
      const loyalty = computeLoyaltyUpdate(customer, orderTotal, burgerCount);
      customer.name = name;
      customer.lastOrderAt = now;
      customer.orderCount = loyalty.orderCount;
      customer.totalSpent = loyalty.totalSpent;
      customer.burgerStamps = loyalty.burgerStamps;
      customer.loyaltyPoints = loyalty.loyaltyPoints;
      customer.rewardsAvailable = loyalty.rewardsAvailable;
      customer.segment = loyalty.segment;
      if (body.marketingOptIn !== undefined) {
        customer.marketingOptIn = Boolean(body.marketingOptIn);
      }
    }

    const paymentMethod: PaymentMethod = body.paymentMethod ?? 'Pay on Delivery';
    const isDigitalSandbox =
      paymentMethod === 'MTN Mobile Money' || paymentMethod === 'Airtel Money';
    const prefix =
      paymentMethod === 'MTN Mobile Money'
        ? 'MOMO-SBX'
        : paymentMethod === 'Airtel Money'
          ? 'AIR-SBX'
          : paymentMethod === 'Pay on Delivery'
            ? 'COD'
            : 'COUNTER';

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: now,
      updatedAt: now,
      scheduledFor: body.scheduledFor,
      isGroupOrder: body.isGroupOrder,
      groupOrgName: body.groupOrgName,
      qrSource: body.qrSource,
      customerId: customer.id,
      customerName: name,
      customerPhone: phone,
      customerEmail: body.customerEmail?.trim() || undefined,
      marketingOptIn: Boolean(body.marketingOptIn),
      fulfillmentType: body.fulfillmentType ?? 'Delivery',
      deliveryZone: body.deliveryZone,
      deliveryAddress: body.deliveryAddress?.trim(),
      locationPin: body.locationPin?.trim(),
      items: body.items,
      subtotal: Number(body.subtotal ?? 0),
      discount: Number(body.discount ?? 0),
      promoCode: body.promoCode?.trim().toUpperCase() || undefined,
      deliveryFee: Number(body.deliveryFee ?? 0),
      total: orderTotal,
      paymentMethod,
      paymentStatus: isDigitalSandbox ? 'Confirmed' : 'Pending',
      paymentReference: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'New order received',
      statusHistory: [
        {
          status: 'New order received',
          timestamp: now,
          actor: body.qrSource ? `QR (${body.qrSource})` : 'Web Storefront',
          note: body.isGroupOrder
            ? `Group order for ${body.groupOrgName || 'Team'}`
            : undefined,
        },
      ],
      priority: body.isGroupOrder || orderTotal >= 80000 ? 'High' : 'Normal',
      estimatedMinutes: body.isGroupOrder ? 40 : 28,
      inventoryDeducted: false,
      whatsAppSent: true,
    };

    state.orders.unshift(newOrder);

    // Campaign attribution
    if (newOrder.promoCode) {
      const camp = state.campaigns.find(
        (c) => c.code.toUpperCase() === newOrder.promoCode,
      );
      if (camp) {
        camp.ordersGenerated += 1;
        camp.revenueGenerated += newOrder.total;
      }
    }

    // QR attribution
    if (newOrder.qrSource) {
      const qr = state.qrChannels.find((q) => q.sourceCode === newOrder.qrSource);
      if (qr) {
        qr.ordersCount += 1;
        qr.revenue += newOrder.total;
      }
    }

    // Log sandbox WhatsApp confirmation
    state.automationLogs.unshift({
      id: `alog-${Date.now()}`,
      ruleName: 'Instant WhatsApp Order Confirmation',
      channel: 'WhatsApp Sandbox',
      recipientName: name,
      recipientPhone: phone,
      message: `Order ${orderNumber} (${formatCurrency(orderTotal)}) received! Payment: ${paymentMethod} (${newOrder.paymentStatus}).`,
      sentAt: now,
    });

    saveState(state);
    res.status(201).json({ order: newOrder, customer });
  });

  // Update order status, payment confirmation, kitchen assignee, rider, cancel/refund
  app.patch('/api/orders/:id/status', (req, res) => {
    const order = state.orders.find(
      (o) => o.id === req.params.id || o.orderNumber === req.params.id,
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const body = req.body as {
      status?: OrderStatus;
      paymentStatus?: 'Pending' | 'Confirmed' | 'Failed' | 'Refunded';
      kitchenAssignee?: string;
      riderId?: string;
      cancellationReason?: string;
      refundAmount?: number;
      actorName?: string;
      actorRole?: StaffRole;
    };

    const now = new Date().toISOString();
    const actorName = body.actorName || 'Operations Staff';
    const actorRole = body.actorRole || 'Admin';

    if (body.paymentStatus && body.paymentStatus !== order.paymentStatus) {
      order.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === 'Refunded') {
        order.refundAmount = body.refundAmount ?? order.total;
      }
      logStaffAction(
        actorName,
        actorRole,
        `Marked ${order.orderNumber} payment as ${body.paymentStatus}`,
      );
    }

    if (body.kitchenAssignee !== undefined) {
      order.kitchenAssignee = body.kitchenAssignee;
    }

    if (body.riderId) {
      const rider = state.riders.find((r) => r.id === body.riderId);
      if (rider) {
        order.riderId = rider.id;
        order.riderName = rider.name;
        rider.status = 'On Delivery';
        logStaffAction(
          actorName,
          actorRole,
          `Assigned rider ${rider.name} to ${order.orderNumber}`,
        );
      }
    }

    if (body.status && body.status !== order.status) {
      if (
        !canTransitionOrderStatus(order.status, body.status, order.fulfillmentType) &&
        body.status !== 'Cancelled'
      ) {
        return res.status(400).json({
          error: `Cannot transition order from "${order.status}" to "${body.status}".`,
        });
      }

      order.status = body.status;
      order.statusHistory.push({
        status: body.status,
        timestamp: now,
        actor: actorName,
        note: body.cancellationReason,
      });

      if (body.status === 'Order confirmed' || body.status === 'Preparing food') {
        applyInventoryDeductionForOrder(order);
      }

      if (body.status === 'Delivered' || body.status === 'Completed') {
        if (!order.deliveredAt) {
          order.deliveredAt = now;
        }
        if (order.paymentMethod === 'Pay on Delivery' || order.paymentMethod === 'Pay at Restaurant') {
          order.paymentStatus = 'Confirmed';
        }
        if (order.riderId) {
          const rider = state.riders.find((r) => r.id === order.riderId);
          if (rider) {
            rider.status = 'Available';
            if (body.status === 'Completed') {
              rider.completedDeliveries += 1;
            }
          }
        }
      }

      if (body.status === 'Cancelled') {
        order.cancellationReason = body.cancellationReason || 'Cancelled by staff';
        if (order.riderId) {
          const rider = state.riders.find((r) => r.id === order.riderId);
          if (rider) rider.status = 'Available';
        }
      }

      logStaffAction(
        actorName,
        actorRole,
        `Updated ${order.orderNumber} to "${body.status}"`,
      );
    }

    order.updatedAt = now;
    saveState(state);
    res.json({ order, state });
  });

  // Submit customer order feedback
  app.post('/api/orders/:id/feedback', (req, res) => {
    const order = state.orders.find(
      (o) => o.id === req.params.id || o.orderNumber === req.params.id,
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const body = req.body as {
      rating?: number;
      foodRating?: number;
      deliveryRating?: number;
      comment?: string;
    };
    const rating = Math.min(5, Math.max(1, Number(body.rating ?? 5)));
    const foodRating = Math.min(5, Math.max(1, Number(body.foodRating ?? rating)));
    const deliveryRating = Math.min(5, Math.max(1, Number(body.deliveryRating ?? rating)));

    const entry = {
      id: `fb-${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      rating,
      foodRating,
      deliveryRating,
      comment: body.comment?.trim() || 'Great service!',
      status: rating >= 4 ? ('Google Review Requested' as const) : ('Open' as const),
      createdAt: new Date().toISOString(),
    };
    state.feedback.unshift(entry);
    order.feedbackSubmitted = true;
    saveState(state);
    res.status(201).json({ entry });
  });

  // Update feedback resolution status
  app.patch('/api/feedback/:id', (req, res) => {
    const fb = state.feedback.find((f) => f.id === req.params.id);
    if (!fb) return res.status(404).json({ error: 'Feedback not found' });
    const { status } = req.body as { status?: 'Open' | 'Resolved' | 'Google Review Requested' };
    if (status) fb.status = status;
    saveState(state);
    res.json({ fb });
  });

  // Menu management (create & update)
  app.post('/api/menu', (req, res) => {
    const body = req.body as Partial<MenuItem>;
    if (!body.name?.trim() || !body.category || !body.price) {
      return res.status(400).json({ error: 'Name, category, and price are required.' });
    }
    const newItem: MenuItem = {
      id: `m-${Date.now()}`,
      name: body.name.trim(),
      category: body.category,
      description: body.description?.trim() || 'Freshly prepared K Town Burger specialty.',
      price: Number(body.price),
      imageUrl: body.imageUrl || '/src/assets/images/menu_signature_burger_1795540364460.jpg',
      available: body.available ?? true,
      bestseller: body.bestseller ?? false,
      featured: body.featured ?? false,
      prepMinutes: Number(body.prepMinutes ?? 12),
      comboUpgradePrice: body.comboUpgradePrice ? Number(body.comboUpgradePrice) : undefined,
      recipe: body.recipe ?? [{ ingredientId: 'ing-patty', quantity: 1 }],
    };
    state.menu.unshift(newItem);
    logStaffAction('Admin', 'Admin', `Created menu product "${newItem.name}"`);
    saveState(state);
    res.status(201).json({ item: newItem });
  });

  app.patch('/api/menu/:id', (req, res) => {
    const item = state.menu.find((m) => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    const body = req.body as Partial<MenuItem>;
    if (body.name !== undefined) item.name = body.name;
    if (body.price !== undefined) item.price = Number(body.price);
    if (body.available !== undefined) item.available = Boolean(body.available);
    if (body.bestseller !== undefined) item.bestseller = Boolean(body.bestseller);
    if (body.description !== undefined) item.description = body.description;
    logStaffAction('Admin', 'Admin', `Updated menu item "${item.name}"`);
    saveState(state);
    res.json({ item });
  });

  // Rider management
  app.post('/api/riders', (req, res) => {
    const body = req.body as {
      name?: string;
      phone?: string;
      vehicleType?: 'Motorbike' | 'Bicycle' | 'Van';
      plateNumber?: string;
    };
    if (!body.name?.trim() || !body.phone?.trim()) {
      return res.status(400).json({ error: 'Rider name and phone are required.' });
    }
    const rider = {
      id: `rid-${Date.now()}`,
      name: body.name.trim(),
      phone: body.phone.trim(),
      vehicleType: body.vehicleType || 'Motorbike',
      plateNumber: body.plateNumber?.trim() || 'UXX 001A',
      status: 'Available' as const,
      completedDeliveries: 0,
      failedDeliveries: 0,
      avgDeliveryMinutes: 22,
    };
    state.riders.push(rider);
    logStaffAction('Delivery Manager', 'Delivery Manager', `Registered rider ${rider.name}`);
    saveState(state);
    res.status(201).json({ rider });
  });

  app.patch('/api/riders/:id', (req, res) => {
    const rider = state.riders.find((r) => r.id === req.params.id);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const { status, failedDeliveries } = req.body as {
      status?: 'Available' | 'On Delivery' | 'Offline';
      failedDeliveries?: number;
    };
    if (status) rider.status = status;
    if (failedDeliveries !== undefined) rider.failedDeliveries = failedDeliveries;
    saveState(state);
    res.json({ rider });
  });

  // Inventory adjustment & supplier purchase
  app.post('/api/inventory/adjust', (req, res) => {
    const { ingredientId, delta, reason } = req.body as {
      ingredientId?: string;
      delta?: number;
      reason?: 'Restock Purchase' | 'Manual Adjustment' | 'Waste';
    };
    const ing = state.ingredients.find((i) => i.id === ingredientId);
    if (!ing || typeof delta !== 'number') {
      return res.status(400).json({ error: 'Valid ingredient and quantity delta required.' });
    }
    ing.currentStock = Math.max(0, Number((ing.currentStock + delta).toFixed(2)));
    const now = new Date().toISOString();
    if (delta > 0) ing.lastRestockedAt = now;
    state.stockMovements.unshift({
      id: `sm-${Date.now()}`,
      ingredientId: ing.id,
      ingredientName: ing.name,
      delta,
      reason: reason || 'Manual Adjustment',
      timestamp: now,
    });
    if (reason === 'Restock Purchase' && delta > 0) {
      const totalCost = Math.round(delta * ing.unitCost);
      state.purchases.unshift({
        id: `pur-${Date.now()}`,
        supplierName: ing.supplierName,
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: delta,
        totalCost,
        purchasedAt: now,
      });
      state.expenses.unshift({
        id: `exp-${Date.now()}`,
        category: 'Ingredients',
        description: `Restock ${delta} ${ing.unit} ${ing.name} (${ing.supplierName})`,
        amount: totalCost,
        recordedAt: now,
      });
    }
    saveState(state);
    res.json({ ingredient: ing, state });
  });

  // Record operational expense
  app.post('/api/expenses', (req, res) => {
    const { category, description, amount } = req.body as {
      category?: 'Ingredients' | 'Delivery' | 'Utilities' | 'Marketing' | 'Staff' | 'Other';
      description?: string;
      amount?: number;
    };
    if (!description?.trim() || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Description and positive amount are required.' });
    }
    const exp = {
      id: `exp-${Date.now()}`,
      category: category || 'Other',
      description: description.trim(),
      amount: Math.round(amount),
      recordedAt: new Date().toISOString(),
    };
    state.expenses.unshift(exp);
    logStaffAction('Owner', 'Owner', `Recorded ${exp.category} expense (${formatCurrency(exp.amount)})`);
    saveState(state);
    res.status(201).json({ expense: exp });
  });

  // Campaigns & Promotions
  app.post('/api/campaigns', (req, res) => {
    const body = req.body as Partial<Campaign>;
    if (!body.name?.trim() || !body.code?.trim()) {
      return res.status(400).json({ error: 'Campaign name and promo code are required.' });
    }
    const camp: Campaign = {
      id: `camp-${Date.now()}`,
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      type: body.type || 'Percentage',
      value: Number(body.value ?? 10),
      minOrderAmount: Number(body.minOrderAmount ?? 20000),
      scheduleLabel: body.scheduleLabel?.trim() || 'All Day',
      active: true,
      ordersGenerated: 0,
      revenueGenerated: 0,
    };
    state.campaigns.unshift(camp);
    saveState(state);
    res.status(201).json({ campaign: camp });
  });

  app.patch('/api/campaigns/:id', (req, res) => {
    const camp = state.campaigns.find((c) => c.id === req.params.id);
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    const { active } = req.body as { active?: boolean };
    if (active !== undefined) camp.active = Boolean(active);
    saveState(state);
    res.json({ campaign: camp });
  });

  // Marketing automation sandbox triggers
  app.patch('/api/automations/:id', (req, res) => {
    const rule = state.automations.find((a) => a.id === req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    const { enabled } = req.body as { enabled?: boolean };
    if (enabled !== undefined) rule.enabled = Boolean(enabled);
    saveState(state);
    res.json({ rule });
  });

  app.post('/api/automations/:id/trigger', (req, res) => {
    const rule = state.automations.find((a) => a.id === req.params.id);
    if (!rule) return res.status(404).json({ error: 'Automation rule not found' });
    const optedIn = state.customers.filter((c) => c.marketingOptIn);
    const target = optedIn[0] ?? state.customers[0];
    const now = new Date().toISOString();
    rule.sentCount += Math.max(1, optedIn.length);
    rule.lastTriggeredAt = now;
    if (target) {
      state.automationLogs.unshift({
        id: `alog-${Date.now()}`,
        ruleName: rule.name,
        channel: rule.channel,
        recipientName: `${optedIn.length} opted-in customer(s) (incl. ${target.name})`,
        recipientPhone: target.phone,
        message: `Sandbox dispatch: "${rule.name}" executed for opted-in subscribers.`,
        sentAt: now,
      });
    }
    saveState(state);
    res.json({ rule, logs: state.automationLogs.slice(0, 20) });
  });

  // CRM customer notes & consent updates
  app.patch('/api/customers/:id', (req, res) => {
    const cust = state.customers.find((c) => c.id === req.params.id);
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    const { notes, marketingOptIn } = req.body as {
      notes?: string;
      marketingOptIn?: boolean;
    };
    if (notes !== undefined) cust.notes = notes;
    if (marketingOptIn !== undefined) cust.marketingOptIn = Boolean(marketingOptIn);
    saveState(state);
    res.json({ customer: cust });
  });

  // Staff management
  app.post('/api/staff', (req, res) => {
    const { name, role, phone } = req.body as {
      name?: string;
      role?: StaffRole;
      phone?: string;
    };
    if (!name?.trim() || !role || !phone?.trim()) {
      return res.status(400).json({ error: 'Name, role, and phone are required.' });
    }
    const rolePerms: Record<StaffRole, string[]> = {
      Owner: ['All Modules', 'Financial P&L', 'Staff & Pricing'],
      Admin: ['Menu & Products', 'Settings', 'Staff Accounts'],
      Cashier: ['Orders Queue', 'Payment Confirmation', 'Receipts'],
      Kitchen: ['Kitchen Display (KDS)', 'Menu Availability'],
      'Delivery Manager': ['Rider Dispatch', 'Delivery SLA'],
      Rider: ['Assigned Deliveries', 'Delivery Completion'],
    };
    const member = {
      id: `st-${Date.now()}`,
      name: name.trim(),
      role,
      phone: phone.trim(),
      active: true,
      lastActiveAt: new Date().toISOString(),
      permissions: rolePerms[role] || ['Basic Access'],
    };
    state.staff.push(member);
    logStaffAction('Admin', 'Admin', `Created ${role} account for ${member.name}`);
    saveState(state);
    res.status(201).json({ member });
  });

  app.patch('/api/staff/:id', (req, res) => {
    const member = state.staff.find((s) => s.id === req.params.id);
    if (!member) return res.status(404).json({ error: 'Staff member not found' });
    const { active, role } = req.body as { active?: boolean; role?: StaffRole };
    if (active !== undefined) member.active = Boolean(active);
    if (role) member.role = role;
    saveState(state);
    res.json({ member });
  });

  // QR Channel creation
  app.post('/api/qr', (req, res) => {
    const { label, channelType, sourceCode } = req.body as {
      label?: string;
      channelType?: 'Table' | 'Flyer' | 'Packaging' | 'Social';
      sourceCode?: string;
    };
    if (!label?.trim() || !sourceCode?.trim()) {
      return res.status(400).json({ error: 'Label and source code are required.' });
    }
    const qr = {
      id: `qr-${Date.now()}`,
      label: label.trim(),
      channelType: channelType || 'Table',
      sourceCode: sourceCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      scans: 0,
      ordersCount: 0,
      revenue: 0,
    };
    state.qrChannels.unshift(qr);
    saveState(state);
    res.status(201).json({ qr });
  });

  // Store settings
  app.patch('/api/settings', (req, res) => {
    const body = req.body as Partial<RestaurantState['settings']>;
    state.settings = {
      ...state.settings,
      ...body,
      sandboxMode: {
        ...state.settings.sandboxMode,
        ...(body.sandboxMode ?? {}),
      },
    };
    logStaffAction('Admin', 'Admin', 'Updated restaurant settings & sandbox flags');
    saveState(state);
    res.json({ settings: state.settings });
  });

  // AI Restaurant Assistant takeover request
  app.post('/api/assistant/takeover', (req, res) => {
    const { customerPrompt } = req.body as { customerPrompt?: string };
    const reqEntry = {
      id: `take-${Date.now()}`,
      customerPrompt: customerPrompt?.trim() || 'Customer requested human staff assistance',
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    state.takeoverRequests.unshift(reqEntry);
    saveState(state);
    res.status(201).json({ takeover: reqEntry });
  });

  // AI Restaurant Assistant endpoint powered by @google/genai (gemini-4-hydrogen)
  app.post('/api/assistant', async (req, res) => {
    const { message, history, liveContext } = req.body as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      liveContext?: {
        menu?: Array<{ name: string; category: string; price: number; available: boolean; description: string }>;
        campaigns?: Array<{ code: string; name: string; minOrderAmount: number; active: boolean }>;
        currency?: string;
      };
    };
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error:
          'AI Assistant requires a Gemini API key in Settings > Secrets. You can still browse the menu or request human staff takeover.',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const activeMenu = liveContext?.menu?.length ? liveContext.menu : state.menu;
      const activeCampaigns = liveContext?.campaigns ?? state.campaigns;
      const currency = liveContext?.currency || state.settings.currency;

      const availableMenuSummary = activeMenu
        .map(
          (m) =>
            `- ${m.name} [${m.category}] (${formatCurrency(m.price, currency)}) — ${m.available ? 'Available' : 'Sold Out'}: ${m.description}`,
        )
        .join('\n');

      const activePromosSummary = activeCampaigns
        .filter((c) => c.active)
        .map((c) => `- Code ${c.code}: ${c.name} (Min order ${formatCurrency(c.minOrderAmount, currency)})`)
        .join('\n');

      const systemInstruction = `You are the helpful K Town Burger Restaurant Assistant for ${state.settings.restaurantName} (${state.settings.address}, ${state.settings.openingHours}).
Currency is ${state.settings.currency}. Delivery fee starts at ${formatCurrency(state.settings.deliveryFeeBase)} and is FREE on orders over ${formatCurrency(state.settings.freeDeliveryThreshold)}. Target delivery time is ${state.settings.deliveryTargetMinutes} minutes.
Loyalty Program: Buy 5 burgers, get 1 free burger reward automatically!
Payment Methods: MTN Mobile Money (Sandbox), Airtel Money (Sandbox), Pay on Delivery, Pay at Restaurant.

Live Menu:
${availableMenuSummary}

Active Offers:
${activePromosSummary}

Be concise, appetizing, and accurate. Recommend specific menu items with exact prices, suggest a drink or fries pairing when helpful, and never invent menu items or prices that are not listed above. Keep responses under 110 words.`;

      const conversationText = (history ?? [])
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.text}`)
        .join('\n');

      const prompt = conversationText
        ? `${conversationText}\nCustomer: ${message.trim()}`
        : message.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        return res.status(502).json({ error: 'Empty response from AI model.' });
      }
      res.json({ reply });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assistant request failed.';
      res.status(500).json({ error: msg });
    }
  });

  // Vite middleware in dev, static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`K Town Burger platform running on http://localhost:${PORT}`);
  });
}

startServer();
