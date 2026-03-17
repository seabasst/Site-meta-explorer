'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  Sparkles,
  BarChart3,
  Target,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import { V2Shell } from '../v2-shell';
import { useV2 } from '../v2-context';
import { HikaruChart, type ChartSpec } from './hikaru-charts';

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
      className={`rounded-xl mb-3 overflow-hidden ${
        darkMode ? 'bg-[#1235e2]/5 border border-[#1235e2]/10' : 'bg-slate-50 border border-slate-100'
      }`}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${
            darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span>{doneCount} steps completed</span>
        </button>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {steps.length > 3 && allDone && (
            <button
              onClick={() => setCollapsed(true)}
              className={`flex items-center gap-1 text-xs mb-1 ${
                darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-500'
              }`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </button>
          )}
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm">
              {step.status === 'thinking' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#1235e2]" />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              )}
              <span
                className={
                  step.status === 'thinking'
                    ? darkMode ? 'text-slate-300' : 'text-slate-600'
                    : darkMode ? 'text-slate-500' : 'text-slate-400'
                }
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

type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'chart'; spec: ChartSpec }
  | { type: 'chart-placeholder' };

function parseContentBlocks(content: string, isStreaming: boolean): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const chartRegex = /:::chart\n([\s\S]*?)\n:::/g;
  let lastIndex = 0;
  let match;

  while ((match = chartRegex.exec(content)) !== null) {
    // Text before chart
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // Chart block — parse JSON
    try {
      const spec = JSON.parse(match[1]) as ChartSpec;
      blocks.push({ type: 'chart', spec });
    } catch {
      // Graceful degradation: show raw as code block
      blocks.push({ type: 'text', content: '```\n' + match[0] + '\n```' });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last chart
  const remaining = content.slice(lastIndex);
  if (remaining) {
    // Check if there's an unclosed :::chart (still streaming)
    if (isStreaming && remaining.includes(':::chart') && !remaining.includes(':::chart\n')) {
      // Opening tag just started, not enough yet
      blocks.push({ type: 'text', content: remaining.replace(/:::chart.*$/, '') });
      blocks.push({ type: 'chart-placeholder' });
    } else if (isStreaming && remaining.match(/:::chart\n[\s\S]*$/)) {
      // Chart block started but not closed — show placeholder
      const chartStart = remaining.indexOf(':::chart');
      if (chartStart > 0) {
        blocks.push({ type: 'text', content: remaining.slice(0, chartStart) });
      }
      blocks.push({ type: 'chart-placeholder' });
    } else {
      blocks.push({ type: 'text', content: remaining });
    }
  }

  return blocks;
}

function renderTextBlock(text: string, darkMode: boolean) {
  const lines = text.split('\n');
  const lineBlocks: { type: 'line' | 'table'; lines: string[] }[] = [];
  let currentTable: string[] | null = null;

  for (const line of lines) {
    if (line.startsWith('|')) {
      if (!currentTable) currentTable = [];
      currentTable.push(line);
    } else {
      if (currentTable) {
        lineBlocks.push({ type: 'table', lines: currentTable });
        currentTable = null;
      }
      lineBlocks.push({ type: 'line', lines: [line] });
    }
  }
  if (currentTable) lineBlocks.push({ type: 'table', lines: currentTable });

  return (
    <div className="space-y-2">
      {lineBlocks.map((block, blockIdx) => {
        if (block.type === 'table') {
          const parsedRows = block.lines
            .map((row) => row.split('|').slice(1, -1).map((c) => c.trim()))
            .filter((cells) => !cells.every((c) => /^[-:]+$/.test(c)));
          if (parsedRows.length === 0) return null;
          const headerRow = parsedRows[0];
          const dataRows = parsedRows.slice(1);
          return (
            <div key={blockIdx} className={`rounded-lg overflow-hidden border my-3 ${darkMode ? 'border-[#1235e2]/15' : 'border-slate-200'}`}>
              <div className={`grid font-semibold text-sm ${darkMode ? 'bg-[#1235e2]/10 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                style={{ gridTemplateColumns: `repeat(${headerRow.length}, minmax(0, 1fr))` }}>
                {headerRow.map((cell, j) => <div key={j} className="px-3 py-2.5 truncate"><InlineFormat text={cell} /></div>)}
              </div>
              {dataRows.map((cells, i) => (
                <div key={i} className={`grid text-sm ${i % 2 === 0 ? (darkMode ? 'bg-transparent' : 'bg-white') : (darkMode ? 'bg-[#1235e2]/5' : 'bg-slate-50')}`}
                  style={{ gridTemplateColumns: `repeat(${headerRow.length}, minmax(0, 1fr))` }}>
                  {cells.map((cell, j) => <div key={j} className={`px-3 py-2 truncate ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}><InlineFormat text={cell} /></div>)}
                </div>
              ))}
            </div>
          );
        }

        const line = block.lines[0];
        const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2];
          const styles: Record<number, string> = {
            1: 'font-bold text-lg mt-3',
            2: 'font-bold text-base mt-3',
            3: 'font-bold text-sm uppercase tracking-wide mt-3',
            4: 'font-semibold text-sm mt-2',
            5: 'font-semibold text-xs mt-2',
            6: 'font-medium text-xs mt-2 opacity-80',
          };
          return <p key={blockIdx} className={styles[level]}><InlineFormat text={headingText} /></p>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) return (
          <p key={blockIdx} className="pl-4">
            <span className="text-[#1235e2] mr-1.5">-</span>
            <InlineFormat text={line.slice(2)} />
          </p>
        );
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) return (
          <p key={blockIdx} className="pl-4">
            <span className="text-[#1235e2] mr-1.5 font-semibold">{numberedMatch[1]}.</span>
            <InlineFormat text={numberedMatch[2]} />
          </p>
        );
        if (!line.trim()) return <div key={blockIdx} className="h-1.5" />;
        return <p key={blockIdx}><InlineFormat text={line} /></p>;
      })}
    </div>
  );
}

function MessageContent({ content, darkMode, isUser, isStreaming = false }: {
  content: string; darkMode: boolean; isUser: boolean; isStreaming?: boolean
}) {
  if (isUser) return <>{content}</>;

  const contentBlocks = parseContentBlocks(content, isStreaming);

  return (
    <div className="space-y-2">
      {contentBlocks.map((block, idx) => {
        if (block.type === 'text') {
          return <div key={idx}>{renderTextBlock(block.content, darkMode)}</div>;
        }
        if (block.type === 'chart') {
          return <HikaruChart key={idx} spec={block.spec} darkMode={darkMode} />;
        }
        if (block.type === 'chart-placeholder') {
          return (
            <div key={idx} className={`rounded-xl border p-4 my-3 flex items-center gap-2 ${
              darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin text-[#1235e2]" />
              <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Generating chart...
              </span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function InlineFormat({ text }: { text: string }) {
  // Handle **bold**, *italic*, and `code` inline formatting
  const parts = text.split(/(\*\*.+?\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={i} className="px-1.5 py-0.5 rounded bg-black/10 text-[0.9em] font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const FOLLOW_UPS: Record<string, { label: string; prompt: string }[]> = {
  default: [
    { label: 'Break it down by format', prompt: 'Can you break that down by ad format (image vs video vs carousel)?' },
    { label: 'Show me the top brands', prompt: 'Which brands are performing best in this area? Show me a comparison.' },
    { label: 'What trends stand out?', prompt: 'What trends or patterns stand out from this data?' },
  ],
};

function FollowUpSuggestions({ darkMode, onSelect, lastMessage }: {
  darkMode: boolean; onSelect: (prompt: string) => void; lastMessage: string;
}) {
  const suggestions = FOLLOW_UPS.default;
  // Generate contextual follow-ups based on last AI response
  const contextual = lastMessage.toLowerCase();
  const dynamicSuggestions = [
    contextual.includes('brand') || contextual.includes('competitor')
      ? { label: 'Deep dive on top brand', prompt: 'Tell me more about the top brand\'s strategy — what makes their ads effective?' }
      : suggestions[0],
    contextual.includes('chart') || contextual.includes('data') || contextual.includes('trend')
      ? { label: 'Compare time periods', prompt: 'How does this compare to the previous period? Show me the trend over time.' }
      : suggestions[1],
    contextual.includes('format') || contextual.includes('video') || contextual.includes('image')
      ? { label: 'Best creative angles', prompt: 'What creative angles and messaging are working best for these formats?' }
      : suggestions[2],
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-3 ml-11">
      {dynamicSuggestions.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.prompt)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
            darkMode
              ? 'border-[#1235e2]/20 text-slate-400 hover:bg-[#1235e2]/10 hover:text-slate-300 hover:border-[#1235e2]/30'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

const SUGGESTIONS = [
  { icon: BarChart3, label: 'Analyze ad performance', prompt: 'Analyze the top performing ad strategies across all brands in our library' },
  { icon: Target, label: 'Compare competitors', prompt: 'Compare the advertising strategies of the top 5 brands by ad count' },
  { icon: TrendingUp, label: 'Find trends', prompt: 'What are the current trends in ad creative formats and messaging angles?' },
  { icon: Lightbulb, label: 'Creative recommendations', prompt: 'Give me creative recommendations based on what\'s working in the ad library' },
];

export default function HikaruPage() {
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

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, activeSteps, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
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
                const newStep: ThinkingStep = { tool: event.tool || 'thinking', step: event.step, status: 'thinking' };
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
                  steps = [...steps, { tool: event.tool, step: event.summary, summary: event.summary, status: 'done' as const }];
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
          } catch { /* skip malformed */ }
        }
      }

      setMessages([...newMessages, { role: 'assistant', content: assistantContent, steps: steps.length > 0 ? steps : undefined }]);
      setStreamingContent('');
      setActiveSteps([]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}` }]);
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

  const isEmpty = messages.length === 0 && !loading;

  return (
    <V2Shell title="Hikaru AI">
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4">
            {isEmpty ? (
              /* Empty state — centered welcome */
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1235e2] to-[#0a1f8f] flex items-center justify-center mb-6 shadow-lg shadow-[#1235e2]/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Hikaru AI Strategy</h2>
                <p className={`text-sm mb-8 max-w-md text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Your AI-powered ad strategy assistant. Analyze competitors, discover trends, and get creative recommendations.
                </p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.prompt)}
                      className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all ${
                        darkMode
                          ? 'bg-[#1235e2]/5 border border-[#1235e2]/10 hover:bg-[#1235e2]/10 hover:border-[#1235e2]/20'
                          : 'bg-white border border-slate-200 hover:border-[#1235e2]/30 hover:shadow-sm'
                      }`}
                    >
                      <s.icon className={`w-5 h-5 shrink-0 mt-0.5 ${darkMode ? 'text-[#1235e2]' : 'text-[#1235e2]'}`} />
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className={`text-xs mt-0.5 line-clamp-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {s.prompt}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation */
              <div className="py-6 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'user' ? (
                      <div className="flex justify-end mb-6">
                        <div className="max-w-[80%] bg-[#1235e2] text-white rounded-2xl rounded-br-md px-5 py-3 text-sm leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6">
                        {msg.steps && msg.steps.length > 0 && (
                          <ThinkingSteps steps={msg.steps} darkMode={darkMode} />
                        )}
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1235e2] to-[#0a1f8f] flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                          <div className={`flex-1 text-sm leading-relaxed ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            <MessageContent content={msg.content} darkMode={darkMode} isUser={false} />
                          </div>
                        </div>
                        {/* Follow-up suggestions after last assistant message */}
                        {i === messages.length - 1 && !loading && (
                          <FollowUpSuggestions darkMode={darkMode} onSelect={sendMessage} lastMessage={msg.content} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="mb-6">
                    {activeSteps.length > 0 && <ThinkingSteps steps={activeSteps} darkMode={darkMode} />}
                    {streamingContent ? (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1235e2] to-[#0a1f8f] flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className={`flex-1 text-sm leading-relaxed ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          <MessageContent content={streamingContent} darkMode={darkMode} isUser={false} isStreaming={true} />
                          <span className="inline-block w-1.5 h-4 bg-[#1235e2] animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                        </div>
                      </div>
                    ) : activeSteps.length === 0 ? (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1235e2] to-[#0a1f8f] flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#1235e2]" />
                            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Thinking...</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input area — pinned to bottom */}
        <div className={`shrink-0 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'}`}>
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div
              className={`flex items-end gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                darkMode
                  ? 'bg-[#1235e2]/5 border-[#1235e2]/20 focus-within:border-[#1235e2]/40'
                  : 'bg-white border-slate-200 focus-within:border-[#1235e2]/40 shadow-sm'
              }`}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-expand
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Hikaru about ad strategies, competitor analysis, creative insights..."
                rows={1}
                className={`flex-1 resize-none bg-transparent text-sm focus:outline-none py-1 ${
                  darkMode
                    ? 'text-white placeholder:text-slate-500'
                    : 'text-slate-900 placeholder:text-slate-400'
                }`}
                style={{ minHeight: '24px', maxHeight: '160px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  input.trim() && !loading
                    ? 'bg-[#1235e2] text-white hover:bg-[#0f2bc4] shadow-sm'
                    : darkMode
                      ? 'bg-slate-800 text-slate-600'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className={`text-xs text-center mt-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Hikaru can analyze your ad library data to provide strategic insights
            </p>
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
