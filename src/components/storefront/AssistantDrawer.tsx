import { useState } from 'react';
import { MessageCircle, Send, UserCheck, X } from 'lucide-react';
import { api } from '../../api/client';
import { usePlatform } from '../../context/PlatformContext';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const STARTER_QUESTIONS = [
  'What is your bestselling burger combo?',
  'Recommend a meal under UGX 30,000',
  'How does the Buy 5 Burgers reward work?',
];

export function AssistantDrawer() {
  const { state, actions } = usePlatform();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Welcome to K Town Burger! Ask me about our burgers, crispy chicken, wood-fired pizza, delivery times, or active promo codes.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [takeoverRequested, setTakeoverRequested] = useState(false);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setErrorMsg('');
    const nextMessages: Message[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const { reply } = await api.askAssistant(
        trimmed,
        nextMessages,
        state
          ? {
              menu: state.menu.map((m) => ({
                name: m.name,
                category: m.category,
                price: m.price,
                available: m.available,
                description: m.description,
              })),
              campaigns: state.campaigns.map((c) => ({
                code: c.code,
                name: c.name,
                minOrderAmount: c.minOrderAmount,
                active: c.active,
              })),
              currency: state.settings.currency,
            }
          : undefined,
      );
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Assistant is temporarily unavailable.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStaffTakeover = async () => {
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === 'user')?.text ||
      'Customer requested staff assistance from storefront';
    try {
      await actions.requestAssistantTakeover(lastUserMsg);
      setTakeoverRequested(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not notify staff right now.',
      );
    }
  };

  return (
    <div className="no-print">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open K Town Burger Assistant"
          className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-full bg-[#141413] text-white text-xs font-semibold shadow-lg hover:bg-[#C8231B] transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Menu Assistant</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="K Town Burger Restaurant Assistant"
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 bg-white border border-stone-200 rounded-xl shadow-xl flex flex-col max-h-[540px] overflow-hidden"
        >
          <div className="px-4 py-3 bg-[#141413] text-white flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">K Town Menu Assistant</div>
              <div className="text-[11px] text-stone-300">
                Meals, pairings & delivery help
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="p-1.5 rounded-lg text-stone-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#C8231B] text-white ml-8'
                    : 'bg-white border border-stone-200 text-stone-800 mr-6'
                }`}
              >
                {m.text}
              </div>
            ))}

            {loading && (
              <div className="p-3 rounded-lg bg-white border border-stone-200 text-xs text-stone-500 mr-6">
                Checking live menu & offers...
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            {takeoverRequested && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                Staff takeover requested! A K Town Burger cashier has been alerted in the Orders dashboard.
              </div>
            )}
          </div>

          <div className="px-3 py-2 bg-white border-t border-stone-100 flex flex-wrap gap-1.5">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="px-2.5 py-1 rounded-md bg-stone-100 text-[11px] text-stone-700 hover:bg-stone-200 text-left cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-stone-200 bg-white space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about burgers, combos, or promos..."
                aria-label="Ask restaurant assistant"
                className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#C8231B]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="px-3 py-2 rounded-lg bg-[#C8231B] text-white hover:bg-[#A91B14] disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <button
              type="button"
              onClick={handleStaffTakeover}
              disabled={takeoverRequested}
              className="w-full py-1.5 text-[11px] font-semibold text-stone-600 hover:text-[#141413] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {takeoverRequested ? 'Staff Notified' : 'Request Human Staff Takeover'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
