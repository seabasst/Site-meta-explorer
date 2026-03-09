'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useV2 } from './v2-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatToggle({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  const { darkMode } = useV2();

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-xl z-50 transition-all hover:scale-105 ${
        isOpen
          ? darkMode
            ? 'bg-slate-700 text-slate-300'
            : 'bg-slate-200 text-slate-600'
          : 'bg-[#1235e2] text-white'
      }`}
    >
      {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
    </button>
  );
}

export function ChatPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { darkMode } = useV2();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  const suggestions = [
    'Compare Norwegian vs SAS airlines',
    'Which airline has the most active ads?',
    'Show me top car rental ads by reach',
    'What formats do fast food brands use?',
  ];

  return (
    <div
      className={`fixed top-0 right-0 w-[420px] h-full z-40 flex flex-col border-l shadow-2xl ${
        darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
          darkMode ? 'border-[#1235e2]/20' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1235e2] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Ad Intelligence</h3>
            <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Ask about your ad data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                darkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
              }`}
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-[#1235e2]/10 flex items-center justify-center mb-4">
              <Sparkles className={`w-6 h-6 ${darkMode ? 'text-[#1235e2]' : 'text-[#1235e2]'}`} />
            </div>
            <p className={`text-sm font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Ask me anything about your ads
            </p>
            <p className={`text-xs mb-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              I can search ads, compare brands, and analyze trends
            </p>
            <div className="space-y-2 w-full">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                    darkMode
                      ? 'bg-[#1235e2]/5 text-slate-400 hover:bg-[#1235e2]/10 hover:text-slate-300'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#1235e2] text-white rounded-br-md'
                    : darkMode
                      ? 'bg-[#1235e2]/10 text-slate-200 rounded-bl-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
              >
                <MessageContent content={msg.content} darkMode={darkMode} isUser={msg.role === 'user'} />
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div
              className={`rounded-2xl rounded-bl-md px-4 py-3 ${
                darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Loader2 className={`w-4 h-4 animate-spin ${darkMode ? 'text-[#1235e2]' : 'text-[#1235e2]'}`} />
                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className={`px-4 py-3 border-t shrink-0 ${
          darkMode ? 'border-[#1235e2]/20' : 'border-slate-200'
        }`}
      >
        <div
          className={`flex items-end gap-2 rounded-xl border px-3 py-2 ${
            darkMode
              ? 'bg-[#1235e2]/5 border-[#1235e2]/20 focus-within:border-[#1235e2]/40'
              : 'bg-slate-50 border-slate-200 focus-within:border-[#1235e2]/40'
          }`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your ads..."
            rows={1}
            className={`flex-1 resize-none bg-transparent text-sm focus:outline-none py-1 max-h-24 ${
              darkMode
                ? 'text-white placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              input.trim() && !loading
                ? 'bg-[#1235e2] text-white hover:bg-[#0f2bc4]'
                : darkMode
                  ? 'bg-slate-800 text-slate-600'
                  : 'bg-slate-200 text-slate-400'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className={`text-[10px] mt-1.5 text-center ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Powered by Claude
        </p>
      </div>
    </div>
  );
}

// Simple markdown-like rendering for assistant messages
function MessageContent({
  content,
  darkMode,
  isUser,
}: {
  content: string;
  darkMode: boolean;
  isUser: boolean;
}) {
  if (isUser) return <>{content}</>;

  return (
    <div className="space-y-2">
      {content.split('\n').map((line, i) => {
        // Headers
        if (line.startsWith('### '))
          return (
            <p key={i} className="font-bold text-xs uppercase tracking-wide mt-2">
              {line.slice(4)}
            </p>
          );
        if (line.startsWith('## '))
          return (
            <p key={i} className="font-bold text-sm mt-2">
              {line.slice(3)}
            </p>
          );
        if (line.startsWith('# '))
          return (
            <p key={i} className="font-bold text-base mt-2">
              {line.slice(2)}
            </p>
          );

        // Table rows
        if (line.startsWith('|')) {
          const cells = line
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          if (cells.every((c) => /^[-:]+$/.test(c))) return null; // separator
          return (
            <div key={i} className="flex gap-2 text-xs font-mono">
              {cells.map((cell, j) => (
                <span key={j} className="flex-1 truncate">
                  {cell}
                </span>
              ))}
            </div>
          );
        }

        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <p key={i} className="pl-3">
              <span className="text-[#1235e2] mr-1">-</span>
              <InlineFormat text={line.slice(2)} />
            </p>
          );

        // Empty lines
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Regular text
        return (
          <p key={i}>
            <InlineFormat text={line} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormat({ text }: { text: string }) {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
