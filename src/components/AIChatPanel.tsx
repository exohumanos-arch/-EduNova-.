import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import type { ChatMessage } from '../types';
import { api } from '../services/api';

interface AIChatPanelProps {
  examId: number;
  compact?: boolean;
}

const SUGGESTED_PROMPTS = [
  'Which students are currently failing or at academic risk?',
  'Compare class averages across all five subjects.',
  'Draft constructive mentor feedback for our lowest-scoring students.',
  'Who are the top 3 performers and what is their score margin?',
];

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ examId, compact = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello. I am the EduNova AI Academic Advisor, connected directly to your live student, subject, and examination records. Ask me to identify at-risk students, compare subject averages, or draft feedback reports.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'>(
    'gemini-4-hydrogen'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || loading) return;

    setError(null);
    if (!textOverride) setInput('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.aiChat({
        history: historyPayload,
        message: content,
        model,
        examId,
      });

      const assistantMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: res.reply,
        model: res.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err?.message || 'Unable to reach Gemini AI service.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setError(null);
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: 'Conversation reset. Ask any question about student marks, grades, or subject pass rates.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div
      className={`flex flex-col edunova-card overflow-hidden ${
        compact ? 'h-full' : 'h-[calc(100vh-9.5rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#ECEBF3] bg-[#F7F7FC]/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7357E8] to-[#4935A8] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-[#24243A]">
              EduNova AI Academic Advisor
            </h3>
            <p className="text-xs text-[#85859B]">
              Multi-turn analysis grounded in live SQL &amp; Python results
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Select Gemini model"
            value={model}
            onChange={(e) =>
              setModel(e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite')
            }
            className="rounded-xl border border-[#ECEBF3] bg-white px-2.5 py-1.5 text-xs font-medium text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
          >
            <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Balanced)</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
          </select>
          <button
            type="button"
            onClick={handleClear}
            title="Clear chat history"
            className="inline-flex items-center gap-1 rounded-xl border border-[#ECEBF3] bg-white px-2.5 py-1.5 text-xs font-medium text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F7F7FC]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 text-xs text-[#85859B]">
              <span className="font-semibold text-[#24243A]">
                {msg.role === 'user' ? 'You' : 'Academic Advisor'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{msg.timestamp}</span>
              {msg.model && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[#85859B]">{msg.model}</span>
                </>
              )}
            </div>
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#7357E8] to-[#4935A8] text-white'
                  : 'bg-white border border-[#ECEBF3] text-[#24243A]'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="rounded-2xl border border-[#ECEBF3] bg-white px-4 py-3 text-sm text-[#85859B]">
              Analyzing academic records and preparing response...
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-[#EF6262]/30 bg-[#FDECEC] px-4 py-3 text-xs text-[#C23E3E]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Request Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div className="px-5 py-2.5 border-t border-[#ECEBF3] bg-white flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            disabled={loading}
            className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-2.5 py-1 text-xs text-[#24243A] hover:border-[#7357E8] hover:text-[#7357E8] hover:bg-[#EEE9FF]/50 transition-colors disabled:opacity-50 text-left"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex items-center gap-2.5 px-5 py-3.5 border-t border-[#ECEBF3] bg-white"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about student grades, failed subjects, cohort trends, or mentoring plans..."
          className="flex-1 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm text-[#24243A] placeholder:text-[#85859B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4935A8] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </form>
    </div>
  );
};
