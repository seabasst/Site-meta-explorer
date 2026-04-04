'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ArrowLeft, Check, MessageSquare } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedFields {
  name: string | null;
  brandVoice: string | null;
  positioning: string | null;
  demographics: string[];
  interests: string[];
  painPoints: string[];
  missionStatement: string | null;
}

const EMPTY_FIELDS: ExtractedFields = {
  name: null,
  brandVoice: null,
  positioning: null,
  demographics: [],
  interests: [],
  painPoints: [],
  missionStatement: null,
};

const WELCOME_MESSAGE =
  "Hi! I'd love to help you set up your brand profile. Tell me about your brand \u2014 what's it called and what do you do?";

// ---------------------------------------------------------------------------
// Field config for review form
// ---------------------------------------------------------------------------

const FIELD_CONFIG: Array<{
  key: keyof ExtractedFields;
  label: string;
  type: 'text' | 'textarea' | 'tags';
}> = [
  { key: 'name', label: 'Brand Name', type: 'text' },
  { key: 'brandVoice', label: 'Brand Voice & Tone', type: 'textarea' },
  { key: 'positioning', label: 'Market Positioning', type: 'textarea' },
  { key: 'missionStatement', label: 'Mission Statement', type: 'textarea' },
  { key: 'demographics', label: 'Target Demographics', type: 'tags' },
  { key: 'interests', label: 'Audience Interests', type: 'tags' },
  { key: 'painPoints', label: 'Customer Pain Points', type: 'tags' },
];

// ---------------------------------------------------------------------------
// InterviewChat component
// ---------------------------------------------------------------------------

interface InterviewChatProps {
  darkMode: boolean;
  onComplete: (profileId: string) => void;
}

export function InterviewChat({ darkMode, onComplete }: InterviewChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [extractedFields, setExtractedFields] = useState<ExtractedFields>(EMPTY_FIELDS);
  const [completeness, setCompleteness] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewFields, setReviewFields] = useState<ExtractedFields>(EMPTY_FIELDS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Count user exchanges
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const canReview = completeness >= 0.8 || userMessageCount >= 5;

  // Send message to interview API
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Send only user/assistant messages (skip the initial welcome which is local)
      const apiMessages = newMessages
        .filter((_, i) => i > 0 || newMessages[0].role === 'user')
        .map((m) => ({ role: m.role, content: m.content }));

      // Ensure first message is from user for the API
      const messagesToSend = apiMessages[0]?.role === 'assistant'
        ? apiMessages.slice(1)
        : apiMessages;

      // If only the welcome + user's first message, just send the user message
      const finalMessages = messagesToSend.length === 0
        ? [{ role: 'user' as const, content: text }]
        : messagesToSend;

      const res = await fetch('/api/brand-profiles/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finalMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Interview request failed');
      }

      const data = await res.json();

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message },
      ]);

      // Merge extracted fields (keep non-null values)
      if (data.extractedFields) {
        setExtractedFields((prev) => mergeFields(prev, data.extractedFields));
      }
      if (typeof data.completeness === 'number') {
        setCompleteness(data.completeness);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
      console.error('[interview-chat]', err);
    } finally {
      setLoading(false);
      // Re-focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages]);

  // Handle Enter key
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Open review with current extracted fields
  function openReview() {
    setReviewFields({ ...extractedFields });
    setShowReview(true);
  }

  // Save profile
  async function handleSave() {
    if (!reviewFields.name?.trim()) {
      setSaveError('Brand name is required.');
      return;
    }

    setSaving(true);
    setSaveError('');

    const payload: Record<string, unknown> = {
      name: reviewFields.name.trim(),
    };
    if (reviewFields.brandVoice?.trim()) payload.brandVoice = reviewFields.brandVoice.trim();
    if (reviewFields.positioning?.trim()) payload.positioning = reviewFields.positioning.trim();
    if (reviewFields.missionStatement?.trim())
      payload.missionStatement = reviewFields.missionStatement.trim();
    if (reviewFields.demographics.length > 0) payload.demographics = reviewFields.demographics;
    if (reviewFields.interests.length > 0) payload.interests = reviewFields.interests;
    if (reviewFields.painPoints.length > 0) payload.painPoints = reviewFields.painPoints;

    try {
      const res = await fetch('/api/brand-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.details?.fieldErrors
            ? Object.values(err.details.fieldErrors as Record<string, string[]>)
                .flat()
                .join(', ')
            : err.error || 'Failed to create profile'
        );
      }

      const result = await res.json();
      const profileId = result.profile?.id;
      if (profileId) {
        onComplete(profileId);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Review screen
  // -------------------------------------------------------------------------

  if (showReview) {
    const cardBg = darkMode
      ? 'bg-[#1a1d2e] border-[#1235e2]/10'
      : 'bg-white border-slate-200';
    const inputBg = darkMode
      ? 'bg-[#101322] border-slate-700 text-slate-200 placeholder-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400';

    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setShowReview(false)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold">Review Your Profile</h2>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Review and edit the information extracted from your conversation.
            </p>
          </div>
        </div>

        {/* Fields */}
        <div className={`flex-1 overflow-y-auto rounded-xl border p-5 space-y-5 ${cardBg}`}>
          {FIELD_CONFIG.map(({ key, label, type }) => (
            <div key={key}>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {label}
                {key === 'name' && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {type === 'text' && (
                <input
                  type="text"
                  value={(reviewFields[key] as string) || ''}
                  onChange={(e) =>
                    setReviewFields((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1235e2]/30 ${inputBg}`}
                />
              )}
              {type === 'textarea' && (
                <textarea
                  value={(reviewFields[key] as string) || ''}
                  onChange={(e) =>
                    setReviewFields((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1235e2]/30 resize-none ${inputBg}`}
                />
              )}
              {type === 'tags' && (
                <TagEditor
                  darkMode={darkMode}
                  values={reviewFields[key] as string[]}
                  onChange={(vals) =>
                    setReviewFields((prev) => ({ ...prev, [key]: vals }))
                  }
                />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {saveError && (
          <div
            className={`rounded-lg border px-4 py-3 mt-4 text-sm ${
              darkMode
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-red-50 border-red-100 text-red-600'
            }`}
          >
            {saveError}
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving || !reviewFields.name?.trim()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              saving || !reviewFields.name?.trim()
                ? 'bg-[#1235e2]/40 text-white/60 cursor-not-allowed'
                : 'bg-[#1235e2] text-white hover:bg-[#0f2dc4]'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Chat screen
  // -------------------------------------------------------------------------

  const bubbleBg = darkMode
    ? { user: 'bg-[#1235e2] text-white', assistant: 'bg-[#1a1d2e] text-slate-200' }
    : { user: 'bg-[#1235e2] text-white', assistant: 'bg-slate-100 text-slate-900' };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] max-w-2xl mx-auto">
      {/* Completeness bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Profile completeness
          </span>
          <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {Math.round(completeness * 100)}%
          </span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div
            className="h-full rounded-full bg-[#1235e2] transition-all duration-500"
            style={{ width: `${Math.round(completeness * 100)}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto space-y-3 pr-1 mb-4 ${
        darkMode ? 'scrollbar-thin scrollbar-thumb-slate-700' : ''
      }`}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                bubbleBg[msg.role]
              } ${
                msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className={`px-4 py-2.5 rounded-2xl rounded-bl-md ${bubbleBg.assistant}`}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1235e2] animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#1235e2] animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#1235e2] animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Review button */}
      {canReview && (
        <div className="mb-3 text-center">
          <button
            onClick={openReview}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Review Profile
          </button>
        </div>
      )}

      {/* Input bar */}
      <div
        className={`flex items-end gap-2 rounded-xl border p-2 ${
          darkMode
            ? 'bg-[#1a1d2e] border-[#1235e2]/10'
            : 'bg-white border-slate-200'
        }`}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about your brand..."
          rows={1}
          className={`flex-1 resize-none px-3 py-2 text-sm bg-transparent outline-none ${
            darkMode
              ? 'text-slate-200 placeholder-slate-500'
              : 'text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className={`p-2 rounded-lg transition-colors ${
            input.trim() && !loading
              ? 'bg-[#1235e2] text-white hover:bg-[#0f2dc4]'
              : darkMode
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag editor for array fields in review
// ---------------------------------------------------------------------------

function TagEditor({
  darkMode,
  values,
  onChange,
}: {
  darkMode: boolean;
  values: string[];
  onChange: (vals: string[]) => void;
}) {
  const [input, setInput] = useState('');

  function addTag() {
    const text = input.trim();
    if (text && !values.includes(text)) {
      onChange([...values, text]);
      setInput('');
    }
  }

  function removeTag(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }

  const inputBg = darkMode
    ? 'bg-[#101322] border-slate-700 text-slate-200 placeholder-slate-500'
    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400';

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((val, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
              darkMode
                ? 'bg-[#1235e2]/15 text-[#1235e2]'
                : 'bg-[#1235e2]/10 text-[#1235e2]'
            }`}
          >
            {val}
            <button
              onClick={() => removeTag(i)}
              className="hover:text-red-400 transition-colors"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder="Type and press Enter to add..."
        className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1235e2]/30 ${inputBg}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeFields(prev: ExtractedFields, next: Partial<ExtractedFields>): ExtractedFields {
  return {
    name: next.name || prev.name,
    brandVoice: next.brandVoice || prev.brandVoice,
    positioning: next.positioning || prev.positioning,
    missionStatement: next.missionStatement || prev.missionStatement,
    demographics:
      next.demographics && next.demographics.length > 0
        ? next.demographics
        : prev.demographics,
    interests:
      next.interests && next.interests.length > 0
        ? next.interests
        : prev.interests,
    painPoints:
      next.painPoints && next.painPoints.length > 0
        ? next.painPoints
        : prev.painPoints,
  };
}
