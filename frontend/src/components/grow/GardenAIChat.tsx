'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGrowingProfileSafe } from '@/contexts/GrowingProfileContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GardenAIChatProps {
  className?: string;
}

export function GardenAIChat({ className = '' }: GardenAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const growingProfileContext = useGrowingProfileSafe();
  const growingProfile = growingProfileContext?.profile;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to chat
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Include user's growing profile for personalized advice
      const userContext = growingProfile ? {
        zone: growingProfile.zone,
        lastFrostDate: growingProfile.lastSpringFrost?.toISOString().split('T')[0],
        firstFrostDate: growingProfile.firstFallFrost?.toISOString().split('T')[0],
        growingSeasonDays: growingProfile.growingSeasonDays,
      } : undefined;

      const response = await fetch('/api/garden-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          userContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add assistant response
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('[GardenAIChat] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "When should I plant tomatoes?",
    "How do I deal with aphids naturally?",
    "What vegetables grow well together?",
    "How do I start seeds indoors?",
  ];

  return (
    <>
      {/* Floating button with tooltip */}
      <div className="fixed bottom-6 right-6 z-50 group">
        {/* Tooltip - shows on hover when chat is closed */}
        {!isOpen && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span>Ask the Garden Assistant</span>
            </div>
            <div className="absolute bottom-0 right-6 translate-y-full">
              <div className="border-8 border-transparent border-t-gray-900" />
            </div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
            isOpen
              ? 'bg-roots-gray hover:bg-roots-gray/80'
              : 'bg-roots-secondary hover:bg-roots-secondary/90'
          } ${className}`}
          aria-label={isOpen ? 'Close garden assistant' : 'Open garden assistant'}
        >
          {isOpen ? (
            <svg className="w-6 h-6 text-roots-cream" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5-3 2-6 2-10 0-3-1-6-2-10z"
                fill="#F5F0EE"
                stroke="#F5F0EE"
                strokeWidth="0.5"
              />
              <path
                d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10"
                fill="none"
                stroke="rgba(245,240,238,0.4)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
             style={{ height: 'min(600px, calc(100vh - 8rem))' }}>
          {/* Header */}
          <div className="bg-roots-secondary text-white px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div className="flex-1">
              <h3 className="font-semibold">Garden Assistant</h3>
              <p className="text-xs text-roots-cream/80">Ask me anything about growing!</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">👋</div>
                <p className="text-gray-600 mb-4">
                  Hi! I'm your garden assistant. Ask me about planting times, pest control, or any gardening questions!
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Try asking:</p>
                  {suggestedQuestions.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(question);
                        inputRef.current?.focus();
                      }}
                      className="block w-full text-left text-sm px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg text-green-800 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-green-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about planting, pests, soil..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Powered by Claude AI
            </p>
          </div>
        </div>
      )}
    </>
  );
}
