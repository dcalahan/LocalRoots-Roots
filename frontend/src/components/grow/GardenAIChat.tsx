'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGrowingProfileSafe } from '@/contexts/GrowingProfileContext';
import { useAccount } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { useSellerListings } from '@/hooks/useSellerListings';
import { useMyGarden } from '@/hooks/useMyGarden';
import { computeStatus } from '@/lib/gardenStatus';
import { useToast } from '@/hooks/use-toast';
import { getCropDisplayName } from '@/lib/gardenStatus';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string; // data URL for display only
  extraImageCount?: number; // additional images beyond the preview
}

interface PendingImage {
  base64: string;
  mediaType: string;
  preview: string; // data URL
  id: string; // unique key for React
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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const growingProfileContext = useGrowingProfileSafe();
  const growingProfile = growingProfileContext?.profile;
  const { preferences } = useUserPreferences();
  const { isSeller } = useSellerStatus();
  const { listings: sellerListings } = useSellerListings();
  const { user: privyUser } = usePrivy();
  const gardenUserId = privyUser?.id || null;
  const { activePlants: gardenPlants, beds: gardenBeds, applyActions: applyGardenActions } = useMyGarden(gardenUserId);
  const { toast } = useToast();

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [synthSupported, setSynthSupported] = useState(false);
  const [autoReadEnabled, setAutoReadEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoicePrompt, setShowVoicePrompt] = useState(false);
  const voicePromptShown = useRef(false);
  const lastMessageWasVoice = useRef(false);
  const recognitionRef = useRef<any>(null);
  const pendingVoiceResponse = useRef<string | null>(null);

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

  // ─── localStorage helpers ─────────────────────────────
  const localConvKey = userId ? `garden:conv:${userId}` : null;
  const localMemKey = userId ? `garden:memories:${userId}` : null;

  const saveConvToLocal = useCallback((msgs: Message[]) => {
    if (!localConvKey) return;
    try {
      // Only save text content (no image previews — too large for localStorage)
      const slim = msgs.map(m => ({ role: m.role, content: m.content }));
      localStorage.setItem(localConvKey, JSON.stringify(slim));
    } catch { /* quota exceeded — non-critical */ }
  }, [localConvKey]);

  const saveMemoriesToLocal = useCallback((memories: unknown[]) => {
    if (!localMemKey) return;
    try {
      localStorage.setItem(localMemKey, JSON.stringify(memories));
    } catch { /* quota exceeded — non-critical */ }
  }, [localMemKey]);

  // Hydrate conversation: localStorage first (instant), then cloud backup
  const hydrateConversation = useCallback(async () => {
    if (!userId || hydrated) return;

    // 1. Try localStorage first (instant)
    let loaded = false;
    if (localConvKey) {
      try {
        const local = localStorage.getItem(localConvKey);
        if (local) {
          const parsed = JSON.parse(local) as { role: string; content: string }[];
          if (parsed.length > 0) {
            setMessages(parsed.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })));
            loaded = true;
          }
        }
      } catch { /* corrupted localStorage — fall through to cloud */ }
    }

    // 2. Fall back to cloud (async, best-effort)
    if (!loaded) {
      try {
        const res = await fetch(`/api/garden-ai?userId=${userId}`);
        const data = await res.json();
        if (data.messages?.length > 0) {
          const cloudMsgs = data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
          setMessages(cloudMsgs);
          // Cache to localStorage for next time
          saveConvToLocal(cloudMsgs);
          // Also cache memories if returned
          if (data.memories?.length > 0) {
            saveMemoriesToLocal(data.memories);
          }
        }
      } catch {
        // Cloud is down — that's fine, we have localStorage or empty state
      }
    }

    setHydrated(true);
  }, [userId, hydrated, localConvKey, saveConvToLocal]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check speech support on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
    setSynthSupported('speechSynthesis' in window);
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, []);

  // Focus input and hydrate when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      hydrateConversation();
    }
  }, [isOpen, hydrateConversation]);

  const speakText = useCallback((text: string) => {
    if (!synthSupported) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google'));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
  }, [synthSupported]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    stopSpeaking();
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        lastMessageWasVoice.current = true;
        setInput(transcript);
        setTimeout(() => {
          const sendBtn = document.querySelector('[data-sage-send]') as HTMLButtonElement;
          if (sendBtn) sendBtn.click();
        }, 100);
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    setIsListening(false);
  }, []);

  const handleVoicePromptYes = useCallback(() => {
    voicePromptShown.current = true;
    setAutoReadEnabled(true);
    setShowVoicePrompt(false);
    if (pendingVoiceResponse.current) {
      speakText(pendingVoiceResponse.current);
      pendingVoiceResponse.current = null;
    }
  }, [speakText]);

  const handleVoicePromptNo = useCallback(() => {
    voicePromptShown.current = true;
    setShowVoicePrompt(false);
    pendingVoiceResponse.current = null;
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Reset file input so same file can be re-selected
    e.target.value = '';

    const newImages: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image too large. Please use photos under 10MB.');
        continue;
      }
      try {
        const { base64, mediaType } = await resizeAndEncode(file);
        const preview = `data:${mediaType};base64,${base64}`;
        newImages.push({ base64, mediaType, preview, id: crypto.randomUUID() });
      } catch {
        setError('Could not process an image. Try a different photo.');
      }
    }

    if (newImages.length > 0) {
      setPendingImages(prev => [...prev, ...newImages].slice(0, 5)); // max 5 images
      inputRef.current?.focus();
    }
  };

  const sendMessage = async () => {
    const hasText = input.trim().length > 0;
    const hasImages = pendingImages.length > 0;
    if ((!hasText && !hasImages) || isLoading) return;

    const userMessage = input.trim() || (hasImages ? 'What is this plant? Any issues you can see?' : '');
    setInput('');
    setError(null);
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Add user message to chat (with image previews if applicable)
    const newMsg: Message = { role: 'user', content: userMessage };
    if (hasImages) newMsg.imagePreview = pendingImages[0].preview;
    if (pendingImages.length > 1) newMsg.extraImageCount = pendingImages.length - 1;
    const newMessages: Message[] = [...messages, newMsg];
    setMessages(newMessages);

    const imagesPayload = hasImages
      ? pendingImages.map(img => ({ base64: img.base64, mediaType: img.mediaType }))
      : undefined;
    setPendingImages([]);
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
          images: imagesPayload,
          geohash: preferences.preferredLocation?.geohash || undefined,
          clientMemories: localMemKey ? (() => { try { const m = localStorage.getItem(localMemKey); return m ? JSON.parse(m) : undefined; } catch { return undefined; } })() : undefined,
          userContext: {
            // Growing profile (from GPS, geohash, or manual override)
            ...(growingProfile ? {
              zone: growingProfile.zone,
              lastFrostDate: growingProfile.lastSpringFrost?.toISOString().split('T')[0],
              firstFrostDate: growingProfile.firstFallFrost?.toISOString().split('T')[0],
              growingSeasonDays: growingProfile.growingSeasonDays,
              isTropical: growingProfile.isTropical || undefined,
              isSouthernHemisphere: growingProfile.isSouthernHemisphere || undefined,
              wetSeasonStart: growingProfile.wetSeasonStart || undefined,
              wetSeasonEnd: growingProfile.wetSeasonEnd || undefined,
              confidence: growingProfile.confidence,
              latitude: growingProfile.latitude,
              longitude: growingProfile.longitude,
            } : {}),
            // Location name from user preferences
            locationName: preferences.preferredLocation?.displayName || undefined,
            // User role
            primaryRole: preferences.primaryRole || undefined,
            // Seller's active listings
            sellerListings: isSeller && sellerListings.length > 0
              ? sellerListings.filter(l => l.active && l.metadata).map(l => ({ produceName: l.metadata!.produceName, category: l.metadata!.category }))
              : undefined,
            // My Garden data for AI context
            myGarden: gardenPlants.length > 0
              ? gardenPlants.map(p => ({
                  cropId: p.cropId,
                  customVarietyName: p.customVarietyName,
                  plantingDate: p.plantingDate,
                  quantity: p.quantity,
                  plantingMethod: p.plantingMethod,
                  location: p.location,
                  bedId: p.bedId,
                }))
              : undefined,
            // Garden beds for AI context
            gardenBeds: gardenBeds.length > 0
              ? gardenBeds.map(b => ({
                  id: b.id,
                  name: b.name,
                  type: b.type,
                  widthInches: b.widthInches,
                  lengthInches: b.lengthInches,
                  notes: b.notes,
                }))
              : undefined,
          },
        }),
      });

      if (!response.ok) {
        // Try to read JSON error
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Server error: ${response.status}`);
      }

      // Check if streaming (SSE) or JSON fallback
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        // Stream response — render text progressively
        const assistantMsg: Message = { role: 'assistant', content: '' };
        const streamMessages = [...newMessages, assistantMsg];
        setMessages(streamMessages);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const event = JSON.parse(data);
                if (event.memories) {
                  // Server sent extracted memories — save locally
                  saveMemoriesToLocal(event.memories);
                } else if (event.gardenActions) {
                  // Server extracted garden actions — apply to My Garden
                  try {
                    applyGardenActions(event.gardenActions);
                    for (const action of event.gardenActions) {
                      const name = getCropDisplayName(action.cropId);
                      if (action.action === 'add_plant') {
                        toast({ title: `Added ${action.quantity || 1} ${name} to your garden 🌱` });
                      } else if (action.action === 'mark_harvested') {
                        toast({ title: `Marked ${name} as harvested 🎉` });
                      } else if (action.action === 'remove_plant') {
                        toast({ title: `Removed ${name} from your garden` });
                      }
                    }
                  } catch { /* non-critical */ }
                } else if (event.text) {
                  fullText += event.text;
                  // Update the assistant message in-place
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, content: fullText };
                    }
                    return updated;
                  });
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        }
        // Stream done — save conversation to localStorage
        const finalMessages = [...newMessages, { role: 'assistant' as const, content: fullText }];
        saveConvToLocal(finalMessages);

        // Voice output after stream
        if (lastMessageWasVoice.current && synthSupported && fullText) {
          if (autoReadEnabled) {
            speakText(fullText);
          } else if (!voicePromptShown.current) {
            pendingVoiceResponse.current = fullText;
            setShowVoicePrompt(true);
          }
        }
      } else {
        // JSON fallback
        const data = await response.json();
        const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.reply }];
        setMessages(finalMessages);
        saveConvToLocal(finalMessages);

        // Voice output after JSON response
        if (lastMessageWasVoice.current && synthSupported && data.reply) {
          if (autoReadEnabled) {
            speakText(data.reply);
          } else if (!voicePromptShown.current) {
            pendingVoiceResponse.current = data.reply;
            setShowVoicePrompt(true);
          }
        }
      }
      lastMessageWasVoice.current = false;
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
    "What should I plant right now?",
    "I just started a garden — help me plan it",
    "What's wrong with my plant? 📸",
    "How do I grow more than I can eat?",
  ];

  return (
    <>
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Floating button with tooltip */}
      <div className="fixed right-4 z-50 group" style={{ bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
        {/* Tooltip - shows on hover when chat is closed */}
        {!isOpen && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span>Ask Sage</span>
            </div>
            <div className="absolute bottom-0 right-6 translate-y-full">
              <div className="border-8 border-transparent border-t-gray-900" />
            </div>
          </div>
        )}

        <button
          data-garden-chat-toggle
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
            isOpen
              ? 'bg-roots-gray hover:bg-roots-gray/80'
              : 'bg-roots-secondary hover:bg-roots-secondary/90'
          } ${className}`}
          aria-label={isOpen ? 'Close Sage' : 'Ask Sage'}
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
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
             style={{ height: 'min(600px, calc(100vh - 7rem))' }}>
          {/* Header */}
          <div className="bg-roots-secondary text-white px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div className="flex-1">
              <h3 className="font-semibold">Sage</h3>
              <p className="text-xs text-roots-cream/80">Your gardening companion</p>
            </div>
            <div className="flex items-center gap-1">
              {autoReadEnabled && (
                <button
                  onClick={() => { stopSpeaking(); setAutoReadEnabled(false); }}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Turn off voice responses"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🌱</div>
                <p className="text-gray-600 mb-4">
                  Hi! I&apos;m Sage, your gardening companion — I know your local climate and can help you grow anything. What are you working on?
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
                  {speechSupported && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                      <span>🎤</span> Tip: Tap the mic to talk to Sage
                    </p>
                  )}
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
                      <div className="mb-2">
                        <img
                          src={message.imagePreview}
                          alt="Uploaded plant photo"
                          className="rounded-lg max-h-48 w-auto"
                        />
                        {message.extraImageCount && message.extraImageCount > 0 && (
                          <p className="text-xs opacity-70 mt-1">+{message.extraImageCount} more photo{message.extraImageCount > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))
            )}

            {/* Voice opt-in prompt */}
            {showVoicePrompt && (
              <div className="bg-roots-secondary/10 border border-roots-secondary/30 rounded-xl px-4 py-3 text-center">
                <p className="text-sm text-gray-700 mb-2">Would you like me to read my responses aloud? 🔊</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleVoicePromptYes}
                    className="px-4 py-1.5 bg-roots-secondary text-white text-sm rounded-full hover:bg-roots-secondary/90 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={handleVoicePromptNo}
                    className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-full hover:bg-gray-300 transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </div>
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

          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="border-t px-3 pt-2 flex items-center gap-2 overflow-x-auto">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative flex-shrink-0">
                  <img
                    src={img.preview}
                    alt="Photo to send"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setPendingImages(prev => prev.filter(p => p.id !== img.id))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-900"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="text-xs text-gray-500 flex-shrink-0">
                {pendingImages.length} photo{pendingImages.length > 1 ? 's' : ''} ready
              </span>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              {/* Camera button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 mb-0.5"
                aria-label="Upload photo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  stopSpeaking();
                  // Auto-resize textarea
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder={pendingImages.length > 0 ? "Describe what you see..." : "Ask Sage anything..."}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-2xl text-sm sm:text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary resize-none leading-5"
                style={{ minHeight: '40px', maxHeight: '120px', fontSize: 'max(16px, 0.875rem)' }}
                rows={1}
                disabled={isLoading}
              />
              {/* Mic button */}
              {speechSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5 ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-roots-gray hover:bg-gray-200'
                  }`}
                  title={isListening ? 'Stop listening' : 'Talk to Sage'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                  </svg>
                </button>
              )}
              {/* Send button */}
              <button
                onClick={sendMessage}
                data-sage-send
                disabled={(!input.trim() && pendingImages.length === 0) || isLoading}
                className="w-10 h-10 rounded-full bg-roots-secondary text-white flex items-center justify-center hover:bg-roots-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 mb-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Sage is powered by Claude AI
            </p>
          </div>
        </div>
      )}
    </>
  );
}
