'use client';

import { useState } from 'react';
import { X, MessageSquare, Send, Check } from 'lucide-react';
import { toast } from 'sonner';

type FeedbackType = 'Feature Request' | 'Bug Report' | 'General Feedback' | 'Question';

export function FeedbackPopup() {
  const [isOpen, setIsOpen] = useState(false);
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

      // Reset after delay
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setMessage('');
        setEmail('');
        setFeedbackType('Feature Request');
      }, 2000);
    } catch (error) {
      toast.error('Failed to submit feedback', {
        description: 'Please try again or email us directly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-lg hover:border-[var(--accent-green)] hover:shadow-xl transition-all group"
        aria-label="Send feedback"
      >
        <MessageSquare className="w-5 h-5 text-[var(--accent-green)]" />
        <span className="text-sm font-medium text-[var(--text-primary)] hidden sm:inline">Feedback</span>
      </button>
    );
  }

  // Popup form when open
  return (
    <div className="fixed right-4 bottom-4 z-50 animate-scale-in">
      <div className="relative w-80 sm:w-96 overflow-hidden rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl">
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-yellow)]" />

        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative p-5 pt-6">
          {isSubmitted ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-green)]/20 mb-3">
                <Check className="w-6 h-6 text-[var(--accent-green)]" />
              </div>
              <h3 className="font-serif text-xl text-[var(--text-primary)] mb-2">
                Thank you!
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Your feedback helps us improve.
              </p>
            </div>
          ) : (
            <>
              <h3 className="font-serif text-xl text-[var(--text-primary)] mb-1">
                Send <span className="italic text-[var(--accent-green)]">Feedback</span>
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Request features, report bugs, or share your thoughts.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)] focus:border-transparent resize-none"
                    required
                  />
                </div>

                {/* Email (optional) */}
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
