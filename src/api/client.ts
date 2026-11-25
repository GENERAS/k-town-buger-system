import type { RestaurantState } from '../domain/types';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getState: () => requestJson<RestaurantState>('/api/state'),
  resetDemo: () => requestJson<RestaurantState>('/api/reset-demo', { method: 'POST' }),
  trackQrScan: (sourceCode: string) =>
    requestJson<{ ok: boolean }>('/api/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ sourceCode }),
    }),
  createOrder: (payload: Record<string, unknown>) =>
    requestJson<{ order: RestaurantState['orders'][number]; customer: RestaurantState['customers'][number] }>(
      '/api/orders',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  updateOrderStatus: (orderId: string, payload: Record<string, unknown>) =>
    requestJson<{ order: RestaurantState['orders'][number] }>(
      `/api/orders/${encodeURIComponent(orderId)}/status`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),
  submitFeedback: (orderId: string, payload: Record<string, unknown>) =>
    requestJson<{ entry: RestaurantState['feedback'][number] }>(
      `/api/orders/${encodeURIComponent(orderId)}/feedback`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  updateFeedbackStatus: (id: string, status: string) =>
    requestJson(`/api/feedback/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  createMenuItem: (payload: Record<string, unknown>) =>
    requestJson('/api/menu', { method: 'POST', body: JSON.stringify(payload) }),
  updateMenuItem: (id: string, payload: Record<string, unknown>) =>
    requestJson(`/api/menu/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createRider: (payload: Record<string, unknown>) =>
    requestJson('/api/riders', { method: 'POST', body: JSON.stringify(payload) }),
  updateRider: (id: string, payload: Record<string, unknown>) =>
    requestJson(`/api/riders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adjustInventory: (payload: { ingredientId: string; delta: number; reason: string }) =>
    requestJson('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(payload) }),
  createExpense: (payload: { category: string; description: string; amount: number }) =>
    requestJson('/api/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  createCampaign: (payload: Record<string, unknown>) =>
    requestJson('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  toggleCampaign: (id: string, active: boolean) =>
    requestJson(`/api/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  toggleAutomation: (id: string, enabled: boolean) =>
    requestJson(`/api/automations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  triggerAutomation: (id: string) =>
    requestJson(`/api/automations/${encodeURIComponent(id)}/trigger`, { method: 'POST' }),
  updateCustomer: (id: string, payload: { notes?: string; marketingOptIn?: boolean }) =>
    requestJson(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createStaff: (payload: { name: string; role: string; phone: string }) =>
    requestJson('/api/staff', { method: 'POST', body: JSON.stringify(payload) }),
  updateStaff: (id: string, payload: { active?: boolean; role?: string }) =>
    requestJson(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createQrChannel: (payload: { label: string; channelType: string; sourceCode: string }) =>
    requestJson('/api/qr', { method: 'POST', body: JSON.stringify(payload) }),
  updateSettings: (payload: Record<string, unknown>) =>
    requestJson('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  askAssistant: (
    message: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }>,
    liveContext?: {
      menu?: Array<{ name: string; category: string; price: number; available: boolean; description: string }>;
      campaigns?: Array<{ code: string; name: string; minOrderAmount: number; active: boolean }>;
      currency?: string;
    },
  ) =>
    requestJson<{ reply: string }>('/api/assistant', {
      method: 'POST',
      body: JSON.stringify({ message, history, liveContext }),
    }),
  requestAssistantTakeover: (customerPrompt: string) =>
    requestJson('/api/assistant/takeover', {
      method: 'POST',
      body: JSON.stringify({ customerPrompt }),
    }),
};
