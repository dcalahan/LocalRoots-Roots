'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useGrowingProfileSafe } from '@/contexts/GrowingProfileContext';
import { useAccount } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string; // data URL for display only
}

interface PendingImage {
  base64: string;
  mediaType: string;
  preview: string; // data URL
}

interface GardenAIChatProps {
  className?: string;
}

// Resize image to max dimension and return base64 (no data URL prefix)
async function resizeAndEncode(file: File, maxDim = 1568): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for photos (smaller), PNG for screenshots
        const mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = mediaType === 'image/jpeg' ? 0.85 : undefined;
        const dataUrl = canvas.toDataURL(mediaType, quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mediaType });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function GardenAIChat({ className = '' }: GardenAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const growingProfileContext = useGrowingProfileSafe();
  const growingProfile = growingProfileContext?.profile;

  // Get user ID from wallet, or generate a stable anonymous UUID
  const { address: wagmiAddress } = useAccount();
  const { wallets } = useWallets();
  const privyAddress = wallets?.[0]?.address;
  const walletAddress = (wagmiAddress || privyAddress)?.toLowerCase() || null;
  const [anonId] = useState(() => {
    if (typeof window === 'undefined') return null;
    let id = localStorage.getItem('garden-ai-user-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('garden-ai-user-id', id);
    }
    return id;
  });
  const userId = walletAddress || anonId;

  // Hydrate conversation from server on first open
  const hydrateConversation = useCallback(async () => {
    if (!userId || hydrated) return;
    try {
      const res = await fetch(`/api/garden-ai?userId=${userId}`);
      const data = await res.json();
      if (data.messages?.length > 0) {
        setMessages(data.messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      }
    } catch {
      // Hydration is non-critical
    } finally {
      setHydrated(true);
    }
  }, [userId, hydrated]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input and hydrate when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      hydrateConversation();
    }
  }, [isOpen, hydrateConversation]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be re-selected
    e.target.value = '';

    // Check size (5MB max before resize)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Please use a photo under 10MB.');
      return;
    }

    try {
      const { base64, mediaType } = await resizeAndEncode(file);
      const preview = `data:${mediaType};base64,${base64}`;
      setPendingImage({ base64, mediaType, preview });
      inputRef.current?.focus();
    } catch {
      setError('Could not process image. Try a different photo.');
    }
  };

  const sendMessage = async () => {
    const hasText = input.trim().length > 0;
    const hasImage = !!pendingImage;
    if ((!hasText && !hasImage) || isLoading) return;

    const userMessage = input.trim() || (hasImage ? 'What is this plant? Any issues you can see?' : '');
    setInput('');
    setError(null);

    // Add user message to chat (with image preview if applicable)
    const newMsg: Message = { role: 'user', content: userMessage };
    if (pendingImage) newMsg.imagePreview = pendingImage.preview;
    const newMessages: Message[] = [...messages, newMsg];
    setMessages(newMessages);

    const imagePayload = pendingImage ? { base64: pendingImage.base64, mediaType: pendingImage.mediaType } : undefined;
    setPendingImage(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/garden-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          userId: userId || undefined,
          image: imagePayload,
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
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

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
            <span className="text-2xl" style={{ filter: 'brightness(0) invert(1)' }}>🌱</span>
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
                      className="block w-full text-left text-sm px-3 py-2 bg-roots-secondary/10 hover:bg-roots-secondary/20 rounded-lg text-roots-secondary transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                  {/* Photo upload suggestion */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="block w-full text-left text-sm px-3 py-2 bg-roots-primary/10 hover:bg-roots-primary/20 rounded-lg text-roots-primary transition-colors"
                  >
                    <svg className="w-4 h-4 inline-block mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Upload a photo of your plant
                  </button>
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
                        ? 'bg-roots-secondary text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    {message.imagePreview && (
                      <img
                        src={message.imagePreview}
                        alt="Uploaded plant photo"
                        className="rounded-lg mb-2 max-h-48 w-auto"
                      />
                    )}
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

          {/* Pending image preview */}
          {pendingImage && (
            <div className="border-t px-3 pt-2 flex items-center gap-2">
              <img
                src={pendingImage.preview}
                alt="Photo to send"
                className="h-12 w-12 rounded-lg object-cover"
              />
              <span className="text-xs text-gray-500 flex-1">Photo ready to send</span>
              <button
                onClick={() => setPendingImage(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="Remove photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              {/* Camera button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                aria-label="Upload photo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingImage ? "Describe what you see..." : "Ask about planting, pests, soil..."}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && !pendingImage) || isLoading}
                className="w-10 h-10 rounded-full bg-roots-secondary text-white flex items-center justify-center hover:bg-roots-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
