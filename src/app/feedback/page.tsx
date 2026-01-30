'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Send, Check } from 'lucide-react';
import { toast } from 'sonner';

type FeedbackType = 'Feature Request' | 'Bug Report' | 'General Feedback' | 'Question';

export default function FeedbackPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Feature Request');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          message: message.trim(),
          email: email.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setIsSubmitted(true);
      toast.success('Thanks for your feedback!');
    } catch {
      toast.error('Failed to submit feedback', {
        description: 'Please try again or email us directly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-10"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Analyser
      </Link>

      <h1 className="font-serif text-4xl text-[var(--text-primary)] mb-3 tracking-tight">
        Send <span className="text-[var(--accent-green-light)] italic">Feedback</span>
      </h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Request features, report bugs, or share your thoughts. We read every submission.
      </p>

      {isSubmitted ? (
        <div className="glass rounded-2xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent-green)]/20 mb-4">
            <Check className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="font-serif text-2xl text-[var(--text-primary)] mb-2">
            Thank you!
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Your feedback helps us improve. We&apos;ll get back to you if you left your email.
          </p>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setMessage('');
              setEmail('');
              setFeedbackType('Feature Request');
            }}
            className="text-sm text-[var(--accent-green-light)] hover:underline"
          >
            Send more feedback
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5">
          {/* Feedback Type */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {(['Feature Request', 'Bug Report', 'General Feedback', 'Question'] as FeedbackType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFeedbackType(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    feedbackType === type
                      ? 'bg-[var(--accent-green)] border-[var(--accent-green)] text-white'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-green)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="feedback-message" className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Message
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={5}
              className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)] focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="feedback-email" className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Email <span className="font-normal">(optional, for follow-up)</span>
            </label>
            <input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)] focus:border-transparent"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium rounded-xl bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Feedback
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
