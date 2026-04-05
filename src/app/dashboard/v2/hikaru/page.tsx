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
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Search,
  AlertCircle,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { V2Shell } from '../v2-shell';
import { useV2 } from '../v2-context';
import { HikaruChart, type ChartSpec } from './hikaru-charts';
import { BrandSelector } from '@/components/brand-selector';
import { OnboardingPrompt } from '@/components/onboarding-prompt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  manusTaskId?: string;
  manusStatus?: 'running' | 'completed' | 'failed';
}

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

// ---------------------------------------------------------------------------
// ThinkingSteps component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Content parsing & rendering
// ---------------------------------------------------------------------------

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
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    try {
      const spec = JSON.parse(match[1]) as ChartSpec;
      blocks.push({ type: 'chart', spec });
    } catch {
      blocks.push({ type: 'text', content: '```\n' + match[0] + '\n```' });
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining) {
    if (isStreaming && remaining.includes(':::chart') && !remaining.includes(':::chart\n')) {
      blocks.push({ type: 'text', content: remaining.replace(/:::chart.*$/, '') });
      blocks.push({ type: 'chart-placeholder' });
    } else if (isStreaming && remaining.match(/:::chart\n[\s\S]*$/)) {
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

function InlineFormat({ text }: { text: string }) {
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

// ---------------------------------------------------------------------------
// Follow-up suggestions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Manus polling hook
// ---------------------------------------------------------------------------

function useManusTask(taskId: string | null): {
  status: 'running' | 'completed' | 'failed' | null;
  resultText: string | null;
} {
  const [status, setStatus] = useState<'running' | 'completed' | 'failed' | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setStatus(null);
      setResultText(null);
      return;
    }

    setStatus('running');
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/manus/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (!active) return;

        if (data.status === 'completed') {
          setStatus('completed');
          setResultText(data.resultText || 'Research completed.');
          return; // stop polling
        }
        if (data.status === 'failed') {
          setStatus('failed');
          setResultText(data.error || 'Research failed.');
          return; // stop polling
        }

        // Still running -- schedule next poll
        setTimeout(() => { if (active) poll(); }, 5000);
      } catch {
        // Network error -- retry
        setTimeout(() => { if (active) poll(); }, 5000);
      }
    };

    poll();

    return () => { active = false; };
  }, [taskId]);

  return { status, resultText };
}

// ---------------------------------------------------------------------------
// Manus polling card (inline in chat)
// ---------------------------------------------------------------------------

function ManusPollingCard({
  status,
  darkMode,
  startTime,
}: {
  status: 'running' | 'completed' | 'failed';
  darkMode: boolean;
  startTime: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  if (status === 'failed') {
    return (
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
        darkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
      }`}>
        <AlertCircle className={`w-5 h-5 shrink-0 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
        <div>
          <p className={`text-sm font-medium ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
            Research failed
          </p>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-red-400/70' : 'text-red-500/70'}`}>
            Try again or use a simpler query.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
      darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/15' : 'bg-[#1235e2]/[0.03] border-[#1235e2]/10'
    }`}>
      <div className="relative">
        <Loader2 className="w-5 h-5 animate-spin text-[#1235e2]" />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
          Researching...
        </p>
        <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Deep research usually takes 2-5 minutes ({formatElapsed(elapsed)} elapsed)
        </p>
      </div>
      <Search className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#1235e2]/50' : 'text-[#1235e2]/40'}`} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Starter suggestions
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  { icon: BarChart3, label: 'Analyze ad performance', prompt: 'Analyze the top performing ad strategies across all brands in our library' },
  { icon: Target, label: 'Compare competitors', prompt: 'Compare the advertising strategies of the top 5 brands by ad count' },
  { icon: TrendingUp, label: 'Find trends', prompt: 'What are the current trends in ad creative formats and messaging angles?' },
  { icon: Lightbulb, label: 'Creative recommendations', prompt: 'Give me creative recommendations based on what\'s working in the ad library' },
];

// ---------------------------------------------------------------------------
// Chat History Sidebar
// ---------------------------------------------------------------------------

function ChatSidebar({
  darkMode,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  collapsed,
  onToggle,
}: {
  darkMode: boolean;
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <div className={`shrink-0 flex flex-col items-center py-3 px-1 border-r ${
        darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'
      }`}>
        <button
          onClick={onToggle}
          className={`p-2 rounded-lg transition-colors mb-2 ${
            darkMode ? 'hover:bg-[#1235e2]/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
          title="Show chat history"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNewChat}
          className={`p-2 rounded-lg transition-colors ${
            darkMode ? 'hover:bg-[#1235e2]/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`shrink-0 w-64 flex flex-col border-r ${
      darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-3 border-b ${
        darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'
      }`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${
          darkMode ? 'text-slate-500' : 'text-slate-400'
        }`}>History</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            className={`p-1.5 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-[#1235e2]/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-[#1235e2]/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Hide sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-2">
        {chats.length === 0 ? (
          <p className={`text-xs text-center py-8 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            No previous chats
          </p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                chat.id === activeChatId
                  ? darkMode ? 'bg-[#1235e2]/10 text-white' : 'bg-[#1235e2]/5 text-slate-900'
                  : darkMode ? 'text-slate-400 hover:bg-[#1235e2]/5 hover:text-slate-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
              <span className="flex-1 text-sm truncate">{chat.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                  darkMode ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-400'
                }`}
                title="Delete chat"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Hikaru Page
// ---------------------------------------------------------------------------

export default function HikaruPage() {
  const { darkMode } = useV2();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ThinkingStep[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Deep Research (Manus) toggle
  const [deepResearch, setDeepResearch] = useState(false);
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null);
  const [pollingStartTime, setPollingStartTime] = useState<number>(0);
  const manusResult = useManusTask(pollingTaskId);

  // Brand profile state
  const [activeBrandId, setActiveBrandId] = useState<string | null>(
    searchParams.get('brand')
  );

  // Chat history state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, activeSteps, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Load chat history on mount
  useEffect(() => {
    fetch('/api/chat/hikaru/history')
      .then((r) => r.json())
      .then((data) => setChats(data))
      .catch(() => {});
  }, []);

  // Refresh chat list
  const refreshChats = useCallback(async () => {
    const r = await fetch('/api/chat/hikaru/history');
    if (r.ok) setChats(await r.json());
  }, []);

  // Create a new chat
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setStreamingContent('');
    setActiveSteps([]);
    inputRef.current?.focus();
  }, []);

  // Load an existing chat
  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    setStreamingContent('');
    setActiveSteps([]);
    setLoading(false);

    try {
      const r = await fetch(`/api/chat/hikaru/history/${chatId}`);
      if (!r.ok) return;
      const data = await r.json();
      const loaded: Message[] = data.messages.map((m: { role: string; content: string; stepsJson?: ThinkingStep[] }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        steps: m.stepsJson || undefined,
      }));
      setMessages(loaded);
    } catch {
      // silently fail
    }
  }, []);

  // Delete a chat
  const handleDeleteChat = useCallback(async (chatId: string) => {
    await fetch(`/api/chat/hikaru/history/${chatId}`, { method: 'DELETE' });
    if (activeChatId === chatId) {
      handleNewChat();
    }
    refreshChats();
  }, [activeChatId, handleNewChat, refreshChats]);

  // Save messages to current chat (or create one)
  const saveMessages = useCallback(async (userMsg: Message, assistantMsg: Message, chatId: string | null) => {
    let id = chatId;

    // Create chat if needed
    if (!id) {
      const r = await fetch('/api/chat/hikaru/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New chat' }),
      });
      if (r.ok) {
        const chat = await r.json();
        id = chat.id;
        setActiveChatId(id);
      }
    }

    if (!id) return;

    // Save message pair
    await fetch(`/api/chat/hikaru/history/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: userMsg.role, content: userMsg.content },
          { role: assistantMsg.role, content: assistantMsg.content, steps: assistantMsg.steps },
        ],
      }),
    });

    refreshChats();
  }, [refreshChats]);

  // Handle Manus task completion: update the polling message with results
  useEffect(() => {
    if (!pollingTaskId || !manusResult.status) return;
    if (manusResult.status === 'completed' || manusResult.status === 'failed') {
      setMessages((prev) => {
        const updated = prev.map((msg) => {
          if (msg.manusTaskId === pollingTaskId) {
            return {
              ...msg,
              manusStatus: manusResult.status as 'completed' | 'failed',
              content: manusResult.resultText || msg.content,
            };
          }
          return msg;
        });

        // Save completed result to history
        if (manusResult.status === 'completed') {
          const userMsg = [...prev].reverse().find((m) => m.role === 'user');
          const assistantMsg = updated.find((m) => m.manusTaskId === pollingTaskId);
          if (userMsg && assistantMsg) {
            saveMessages(userMsg, assistantMsg, activeChatId);
          }
        }

        return updated;
      });
      setPollingTaskId(null);
      setLoading(false);
    }
  }, [manusResult.status, manusResult.resultText, pollingTaskId, activeChatId, saveMessages]);

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
          ...(activeBrandId ? { brandProfileId: activeBrandId } : {}),
          deepResearch,
        }),
      });

      // Check if response is JSON (Manus task) vs SSE stream (Claude)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();

        if (data.type === 'manus_task') {
          // Switch to polling mode
          const manusMessage: Message = {
            role: 'assistant',
            content: data.message || 'Deep research started...',
            manusTaskId: data.taskId,
            manusStatus: 'running',
          };
          setMessages([...newMessages, manusMessage]);
          setPollingTaskId(data.taskId);
          setPollingStartTime(Date.now());
          // Keep loading true -- the polling effect will clear it
          return;
        }

        if (data.type === 'manus_error') {
          throw new Error(data.error || 'Deep research failed');
        }

        if (data.error) {
          throw new Error(data.error);
        }
      }

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

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        steps: steps.length > 0 ? steps : undefined,
      };

      setMessages([...newMessages, assistantMessage]);
      setStreamingContent('');
      setActiveSteps([]);

      // Persist to DB
      saveMessages(userMessage, assistantMessage, activeChatId);
    } catch (err) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
      };
      setMessages([...newMessages, errorMessage]);
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
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Sidebar */}
        <ChatSidebar
          darkMode={darkMode}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Brand selector bar */}
          <div className={`shrink-0 flex items-center px-4 py-2 border-b ${
            darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'
          }`}>
            <BrandSelector darkMode={darkMode} onBrandChange={setActiveBrandId} />
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4">
              <div className="pt-4">
                <OnboardingPrompt darkMode={darkMode} />
              </div>
              {isEmpty ? (
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
                              {msg.manusTaskId && msg.manusStatus === 'running' ? (
                                <ManusPollingCard
                                  status="running"
                                  darkMode={darkMode}
                                  startTime={pollingStartTime}
                                />
                              ) : msg.manusTaskId && msg.manusStatus === 'failed' ? (
                                <ManusPollingCard
                                  status="failed"
                                  darkMode={darkMode}
                                  startTime={pollingStartTime}
                                />
                              ) : (
                                <MessageContent content={msg.content} darkMode={darkMode} isUser={false} />
                              )}
                            </div>
                          </div>
                          {i === messages.length - 1 && !loading && !msg.manusStatus && (
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

          {/* Input area */}
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
                  onClick={() => setDeepResearch(!deepResearch)}
                  title={deepResearch ? 'Deep Research ON (Manus)' : 'Deep Research OFF (Claude)'}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    deepResearch
                      ? 'bg-[#1235e2] text-white shadow-sm'
                      : darkMode
                        ? 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        : 'bg-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Search className="w-4 h-4" />
                </button>
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
                {deepResearch ? (
                  <span className="text-[#1235e2]">
                    Deep Research mode ON -- queries will use Manus for async analysis (2-5 min)
                  </span>
                ) : (
                  'Hikaru can analyze your ad library data to provide strategic insights'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
