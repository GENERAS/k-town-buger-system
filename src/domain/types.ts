export type MenuCategory =
  | 'Burgers'
  | 'Chicken'
  | 'Pizza'
  | 'Fries'
  | 'Drinks'
  | 'Combos';

export type OrderStatus =
  | 'New order received'
  | 'Order confirmed'
  | 'Preparing food'
  | 'Ready for pickup'
  | 'Assigned to rider'
  | 'Out for delivery'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled';

export type PaymentMethod =
  | 'MTN Mobile Money'
  | 'Airtel Money'
  | 'Pay on Delivery'
  | 'Pay at Restaurant';

export type PaymentStatus = 'Pending' | 'Confirmed' | 'Failed' | 'Refunded';

export type FulfillmentType = 'Delivery' | 'Pickup';

export type StaffRole =
  | 'Owner'
  | 'Admin'
  | 'Cashier'
  | 'Kitchen'
  | 'Delivery Manager'
  | 'Rider';

export type CustomerSegment = 'First-Time' | 'Returning' | 'VIP' | 'At-Risk';

export interface ProductSize {
  id: string;
  label: string;
  priceDelta: number;
}

export interface ProductExtra {
  id: string;
  label: string;
  price: number;
}

export interface RecipeIngredientUsage {
  ingredientId: string;
  quantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  price: number;
  imageUrl: string;
  available: boolean;
  bestseller?: boolean;
  featured?: boolean;
  prepMinutes: number;
  sizes?: ProductSize[];
  extras?: ProductExtra[];
  comboUpgradePrice?: number;
  recipe: RecipeIngredientUsage[];
}

export interface CartItem {
  cartItemId: string;
  menuItemId: string;
  name: string;
  category: MenuCategory;
  basePrice: number;
  quantity: number;
  selectedSize?: ProductSize;
  selectedExtras: ProductExtra[];
  isComboUpgrade: boolean;
  comboUpgradePrice: number;
  specialInstructions?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  category: MenuCategory;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sizeLabel?: string;
  extrasLabels: string[];
  isComboUpgrade: boolean;
  specialInstructions?: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string;
  isGroupOrder?: boolean;
  groupOrgName?: string;
  qrSource?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  marketingOptIn: boolean;
  fulfillmentType: FulfillmentType;
  deliveryZone?: string;
  deliveryAddress?: string;
  locationPin?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  priority: 'Normal' | 'High';
  kitchenAssignee?: string;
  riderId?: string;
  riderName?: string;
  estimatedMinutes: number;
  deliveredAt?: string;
  cancellationReason?: string;
  refundAmount?: number;
  inventoryDeducted: boolean;
  whatsAppSent: boolean;
  feedbackSubmitted?: boolean;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicleType: 'Motorbike' | 'Bicycle' | 'Van';
  plateNumber: string;
  status: 'Available' | 'On Delivery' | 'Offline';
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryMinutes: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  firstOrderAt: string;
  lastOrderAt: string;
  orderCount: number;
  totalSpent: number;
  burgerStamps: number; // Buy 5 burgers -> 1 reward
  loyaltyPoints: number;
  rewardsAvailable: number;
  favoriteItems: string[];
  segment: CustomerSegment;
  notes: string;
  marketingOptIn: boolean;
  referralCode: string;
}

export interface Campaign {
  id: string;
  name: string;
  code: string;
  type:
    | 'Percentage'
    | 'Fixed'
    | 'Free Delivery'
    | 'First Order'
    | 'Birthday'
    | 'Group Offer'
    | 'Referral';
  value: number;
  minOrderAmount: number;
  scheduleLabel: string;
  active: boolean;
  ordersGenerated: number;
  revenueGenerated: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  channel: 'WhatsApp Sandbox' | 'SMS Sandbox';
  trigger: string;
  enabled: boolean;
  sentCount: number;
  conversionCount: number;
  lastTriggeredAt?: string;
}

export interface AutomationLog {
  id: string;
  ruleName: string;
  channel: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  sentAt: string;
}

export interface InventoryIngredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  unitCost: number;
  supplierName: string;
  lastRestockedAt: string;
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  delta: number;
  reason: 'Order Deduction' | 'Restock Purchase' | 'Manual Adjustment' | 'Waste';
  referenceId?: string;
  timestamp: string;
}

export interface PurchaseRecord {
  id: string;
  supplierName: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  totalCost: number;
  purchasedAt: string;
}

export interface ExpenseRecord {
  id: string;
  category: 'Ingredients' | 'Delivery' | 'Utilities' | 'Marketing' | 'Staff' | 'Other';
  description: string;
  amount: number;
  recordedAt: string;
}

export interface FeedbackEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  rating: number;
  foodRating: number;
  deliveryRating: number;
  comment: string;
  status: 'Open' | 'Resolved' | 'Google Review Requested';
  createdAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
  active: boolean;
  lastActiveAt: string;
  permissions: string[];
}

export interface StaffActivity {
  id: string;
  staffName: string;
  role: StaffRole;
  action: string;
  timestamp: string;
}

export interface GroupPackage {
  id: string;
  name: string;
  audience: 'Office' | 'School' | 'Party';
  headcount: number;
  description: string;
  pricePerPack: number;
  itemsSummary: string[];
  imageUrl: string;
}

export interface QRChannel {
  id: string;
  label: string;
  channelType: 'Table' | 'Flyer' | 'Packaging' | 'Social';
  sourceCode: string;
  scans: number;
  ordersCount: number;
  revenue: number;
}

export interface StoreSettings {
  restaurantName: string;
  tagline: string;
  address: string;
  locationPin: string;
  phone: string;
  whatsappNumber: string;
  openingHours: string;
  currency: string;
  deliveryFeeBase: number;
  freeDeliveryThreshold: number;
  deliveryTargetMinutes: number;
  activePromoBanner: string;
  sandboxMode: {
    mtnMomoEnabled: boolean;
    airtelMoneyEnabled: boolean;
    whatsappApiSandbox: boolean;
    smsGatewaySandbox: boolean;
  };
}

export interface AssistantTakeoverRequest {
  id: string;
  customerPrompt: string;
  createdAt: string;
  resolved: boolean;
}

export interface RestaurantState {
  menu: MenuItem[];
  orders: Order[];
  riders: Rider[];
  customers: CustomerProfile[];
  campaigns: Campaign[];
  automations: AutomationRule[];
  automationLogs: AutomationLog[];
  ingredients: InventoryIngredient[];
  stockMovements: StockMovement[];
  purchases: PurchaseRecord[];
  expenses: ExpenseRecord[];
  feedback: FeedbackEntry[];
  staff: StaffMember[];
  staffActivity: StaffActivity[];
  groupPackages: GroupPackage[];
  qrChannels: QRChannel[];
  settings: StoreSettings;
  takeoverRequests: AssistantTakeoverRequest[];
}
