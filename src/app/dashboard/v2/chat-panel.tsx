'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useV2 } from './v2-context';

interface ThinkingStep {
  tool: string;
  step: string;
  summary?: string;
  status: 'thinking' | 'done';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  steps?: ThinkingStep[];
}

// Legacy exports kept for backwards compat
export function ChatToggle({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return null;
}

function ThinkingSteps({ steps, darkMode }: { steps: ThinkingStep[]; darkMode: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const allDone = steps.every((s) => s.status === 'done');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const shouldAutoCollapse = allDone && steps.length > 3;

  useEffect(() => {
    if (shouldAutoCollapse) setCollapsed(true);
  }, [shouldAutoCollapse]);

  if (steps.length === 0) return null;

  return (
    <div
      className={`rounded-xl mb-2 overflow-hidden ${
        darkMode ? 'bg-[#1235e2]/5 border border-[#1235e2]/10' : 'bg-slate-50 border border-slate-100'
      }`}
    >
      {(collapsed || shouldAutoCollapse) && collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
            darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ChevronRight className="w-3 h-3" />
          <span>{doneCount} steps completed</span>
        </button>
      ) : (
        <div className="px-3 py-2 space-y-1.5">
          {steps.length > 3 && allDone && (
            <button
              onClick={() => setCollapsed(true)}
              className={`flex items-center gap-1 text-[10px] mb-1 ${
                darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-500'
              }`}
            >
              <ChevronDown className="w-3 h-3" />
              <span>Collapse</span>
            </button>
          )}
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {step.status === 'thinking' ? (
                <Loader2
                  className={`w-3 h-3 animate-spin shrink-0 ${
                    darkMode ? 'text-[#1235e2]' : 'text-[#1235e2]'
                  }`}
                />
              ) : (
                <Check className="w-3 h-3 shrink-0 text-emerald-500" />
              )}
              <span
                className={`truncate ${
                  step.status === 'thinking'
                    ? darkMode
                      ? 'text-slate-300'
                      : 'text-slate-600'
                    : darkMode
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              >
                {step.summary || step.step}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Legacy export kept for backwards compat
export function ChatPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return null;
}

// Sidebar-embedded chat component
export function SidebarChat() {
  const { darkMode } = useV2();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ThinkingStep[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, activeSteps, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setActiveSteps([]);
    setStreamingContent('');

    try {
      const res = await fetch('/api/chat/hikaru', {
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

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let steps: ThinkingStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'thinking': {
                const newStep: ThinkingStep = {
                  tool: event.tool || 'thinking',
                  step: event.step,
                  status: 'thinking',
                };
                steps = [...steps, newStep];
                setActiveSteps([...steps]);
                break;
              }
              case 'tool_result': {
                steps = steps.map((s) =>
                  s.tool === event.tool && s.status === 'thinking'
                    ? { ...s, status: 'done' as const, summary: event.summary }
                    : s
                );
                if (!steps.some((s) => s.tool === event.tool)) {
                  steps = [
                    ...steps,
                    {
                      tool: event.tool,
                      step: event.summary,
                      summary: event.summary,
                      status: 'done' as const,
                    },
                  ];
                }
                setActiveSteps([...steps]);
                break;
              }
              case 'text': {
                assistantContent += event.content;
                setStreamingContent(assistantContent);
                break;
              }
              case 'done': {
                steps = steps.map((s) => ({ ...s, status: 'done' as const }));
                setActiveSteps([...steps]);
                break;
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      setMessages([
        ...newMessages,
        { role: 'assistant', content: assistantContent, steps: steps.length > 0 ? steps : undefined },
      ]);
      setStreamingContent('');
      setActiveSteps([]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        },
      ]);
      setStreamingContent('');
      setActiveSteps([]);
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

  const suggestions = [
    'Analyze airline ad strategies',
    'What messaging angles work?',
  ];

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !loading ? (
          <div className="text-center px-2 pt-2">
            <p className={`text-[11px] mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Ask about ad strategies & insights
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-colors ${
                    darkMode
                      ? 'bg-[#1235e2]/5 text-slate-400 hover:bg-[#1235e2]/10 border border-[#1235e2]/10'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                  <ThinkingSteps steps={msg.steps} darkMode={darkMode} />
                )}
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#1235e2] text-white rounded-br-sm'
                        : darkMode
                          ? 'bg-[#1235e2]/10 text-slate-200 rounded-bl-sm'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}
                  >
                    <MessageContent content={msg.content} darkMode={darkMode} isUser={msg.role === 'user'} />
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div>
                {activeSteps.length > 0 && <ThinkingSteps steps={activeSteps} darkMode={darkMode} />}
                {streamingContent ? (
                  <div className="flex justify-start">
                    <div
                      className={`max-w-[90%] rounded-xl rounded-bl-sm px-3 py-2 text-[11px] leading-relaxed ${
                        darkMode ? 'bg-[#1235e2]/10 text-slate-200' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      <MessageContent content={streamingContent} darkMode={darkMode} isUser={false} />
                      <span className="inline-block w-1 h-3 bg-[#1235e2] animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                    </div>
                  </div>
                ) : (
                  activeSteps.length === 0 && (
                    <div className="flex justify-start">
                      <div className={`rounded-xl rounded-bl-sm px-3 py-2 ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-[#1235e2]" />
                          <span className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`px-3 py-2 border-t shrink-0 ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'}`}>
        <div
          className={`flex items-end gap-1.5 rounded-lg border px-2 py-1.5 ${
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
            placeholder="Ask Hikaru..."
            rows={1}
            className={`flex-1 resize-none bg-transparent text-[11px] focus:outline-none py-0.5 max-h-16 ${
              darkMode
                ? 'text-white placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
            style={{ minHeight: '20px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
              input.trim() && !loading
                ? 'bg-[#1235e2] text-white hover:bg-[#0f2bc4]'
                : darkMode
                  ? 'bg-slate-800 text-slate-600'
                  : 'bg-slate-200 text-slate-400'
            }`}
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}

// Markdown-like rendering for assistant messages with improved table support
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

  // Parse content into blocks, grouping consecutive table rows together
  const lines = content.split('\n');
  const blocks: { type: 'line' | 'table'; lines: string[] }[] = [];
  let currentTable: string[] | null = null;

  for (const line of lines) {
    if (line.startsWith('|')) {
      if (!currentTable) currentTable = [];
      currentTable.push(line);
    } else {
      if (currentTable) {
        blocks.push({ type: 'table', lines: currentTable });
        currentTable = null;
      }
      blocks.push({ type: 'line', lines: [line] });
    }
  }
  if (currentTable) {
    blocks.push({ type: 'table', lines: currentTable });
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIdx) => {
        if (block.type === 'table') {
          return <TableBlock key={blockIdx} rows={block.lines} darkMode={darkMode} />;
        }

        const line = block.lines[0];

        // Headers
        if (line.startsWith('### '))
          return (
            <p key={blockIdx} className="font-bold text-xs uppercase tracking-wide mt-2">
              {line.slice(4)}
            </p>
          );
        if (line.startsWith('## '))
          return (
            <p key={blockIdx} className="font-bold text-sm mt-2">
              {line.slice(3)}
            </p>
          );
        if (line.startsWith('# '))
          return (
            <p key={blockIdx} className="font-bold text-base mt-2">
              {line.slice(2)}
            </p>
          );

        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <p key={blockIdx} className="pl-3">
              <span className="text-[#1235e2] mr-1">-</span>
              <InlineFormat text={line.slice(2)} />
            </p>
          );

        // Empty lines
        if (!line.trim()) return <div key={blockIdx} className="h-1" />;

        // Regular text
        return (
          <p key={blockIdx}>
            <InlineFormat text={line} />
          </p>
        );
      })}
    </div>
  );
}

function TableBlock({ rows, darkMode }: { rows: string[]; darkMode: boolean }) {
  const parsedRows = rows
    .map((row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
    )
    .filter((cells) => !cells.every((c) => /^[-:]+$/.test(c)));

  if (parsedRows.length === 0) return null;

  const headerRow = parsedRows[0];
  const dataRows = parsedRows.slice(1);

  return (
    <div
      className={`rounded-lg overflow-hidden border text-xs my-2 ${
        darkMode ? 'border-[#1235e2]/15' : 'border-slate-200'
      }`}
    >
      <div
        className={`grid font-semibold ${
          darkMode ? 'bg-[#1235e2]/10 text-slate-300' : 'bg-slate-100 text-slate-700'
        }`}
        style={{ gridTemplateColumns: `repeat(${headerRow.length}, minmax(0, 1fr))` }}
      >
        {headerRow.map((cell, j) => (
          <div key={j} className="px-2.5 py-2 truncate">
            {cell}
          </div>
        ))}
      </div>
      {dataRows.map((cells, i) => (
        <div
          key={i}
          className={`grid ${
            i % 2 === 0
              ? darkMode
                ? 'bg-transparent'
                : 'bg-white'
              : darkMode
                ? 'bg-[#1235e2]/5'
                : 'bg-slate-50'
          }`}
          style={{ gridTemplateColumns: `repeat(${headerRow.length}, minmax(0, 1fr))` }}
        >
          {cells.map((cell, j) => (
            <div
              key={j}
              className={`px-2.5 py-1.5 truncate ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
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
