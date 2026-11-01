import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Plant } from '../types';
import { PLANTS, getPlantById, findPlantInQuestion } from '../data/plants';
import { useI18n } from '../i18n';
import {
  AVAILABLE_GEMINI_MODELS,
  getStoredApiKey,
  getStoredModel,
  isKeyRememberedOnDevice,
  removeApiKey,
  saveApiKey,
  saveStoredModel,
} from '../lib/ai/key-storage';
import { GeminiProvider } from '../lib/ai/gemini';
import { AIError, type ChatTurn } from '../lib/ai/provider';
import {
  buildCatalogSummary,
  buildChatSystemPrompt,
  cleanPlantTags,
  extractReferencedPlantIds,
} from '../lib/ai/prompts';
import { captureVideoFrameForScan, preparePlantImageForScan } from '../lib/ai/image-utils';
import { PlantImage } from './PlantImage';
import {
  Sparkles,
  Send,
  Bot,
  User,
  BookOpen,
  Settings,
  Trash2,
  Camera,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface AskHerbiQPageProps {
  initialQuestion?: string;
  initialOpenScanner?: boolean;
  onSelectPlant: (plantId: string) => void;
  onNavigateToARWithPlant?: (plantId: string) => void;
}

/** Safe, zero-HTML Markdown renderer returning React elements only. */
function renderInlineFormatting(line: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-[#00E5FF]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function renderSafeMarkdown(rawText: string): React.ReactNode {
  const cleaned = cleanPlantTags(rawText);
  const lines = cleaned.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`${keyPrefix}-list`} className="list-disc ps-5 space-y-1 my-1.5">
        {listItems.map((item, i) => (
          <li key={i}>{renderInlineFormatting(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`line-${idx}`);
      return;
    }
    const bulletMatch = /^([-*•]|\d+[.)])\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      listItems.push(bulletMatch[2]);
      return;
    }
    flushList(`line-${idx}`);
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="font-bold text-sm text-[#F8FAFC] pt-1">
          {renderInlineFormatting(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="font-bold text-base text-[#F8FAFC] pt-1">
          {renderInlineFormatting(trimmed.slice(3))}
        </h3>
      );
    } else {
      elements.push(
        <p key={idx} className="leading-relaxed">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    }
  });

  flushList('end');
  return <div className="space-y-1.5">{elements}</div>;
}

function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  ml: 'ml-IN',
  ar: 'ar-SA',
};

export const AskHerbiQPage: React.FC<AskHerbiQPageProps> = ({
  initialQuestion,
  initialOpenScanner,
  onSelectPlant,
  onNavigateToARWithPlant,
}) => {
  const { t, lang, dir, localizePlant } = useI18n();
  const [inputQuery, setInputQuery] = useState('');
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [modelName, setModelName] = useState<string>(() => getStoredModel());
  const [isGenerating, setIsGenerating] = useState(false);

  // Settings Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState<string>(() => getStoredApiKey());
  const [showKeyText, setShowKeyText] = useState(false);
  const [rememberDevice, setRememberDevice] = useState<boolean>(() => isKeyRememberedOnDevice());
  const [testingKey, setTestingKey] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Camera Plant Scanner Modal state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Recognition & Speech Synthesis state
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const lastInitialQuestion = useRef<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const buildWelcomeMessage = useCallback(
    (hasKey: boolean): ChatMessage => ({
      id: 'welcome',
      sender: 'herbiq',
      text: hasKey ? t('ask.welcomeAI') : t('ask.welcomeLocal'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAI: hasKey,
    }),
    [t]
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildWelcomeMessage(Boolean(getStoredApiKey())),
  ]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === 'welcome' ? buildWelcomeMessage(Boolean(apiKey)) : m))
    );
  }, [lang, apiKey, buildWelcomeMessage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(Boolean(SR));
      setTtsSupported(Boolean('speechSynthesis' in window));
    }
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    if (initialOpenScanner) {
      setScannerOpen(true);
    }
  }, [initialOpenScanner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const mapAIErrorMessage = useCallback(
    (err: unknown): string => {
      if (err instanceof AIError) {
        if (err.code === 'INVALID_KEY') return t('ask.errInvalidKey');
        if (err.code === 'QUOTA_EXCEEDED') return t('ask.errQuota');
        if (err.code === 'NETWORK_ERROR') return t('ask.errNetwork');
        if (err.code === 'PARSE_ERROR') return t('ask.errParse');
      }
      return t('ask.errGeneric');
    },
    [t]
  );

  const generateLocalReply = useCallback(
    (text: string): { botResponse: string; suggestedPlantId?: string } => {
      const lowerText = text.toLowerCase();
      const rawMatchedPlant = findPlantInQuestion(text);
      if (rawMatchedPlant) {
        const matchedPlant = localizePlant(rawMatchedPlant);
        return {
          suggestedPlantId: matchedPlant.id,
          botResponse: t('ask.localPlantReply', {
            name: matchedPlant.name,
            secondaryName: rawMatchedPlant.malayalamName,
            scientificName: matchedPlant.scientificName,
            family: matchedPlant.family,
            description: matchedPlant.description,
            traditionalUses: matchedPlant.traditionalUses,
          }),
        };
      }
      if (
        lowerText.includes('identify') ||
        lowerText.includes('recognize') ||
        lowerText.includes('leaf') ||
        lowerText.includes('feature') ||
        text.includes('തിരിച്ചറിയ') ||
        text.includes('التعرف') ||
        text.includes('أتعرف')
      ) {
        return { botResponse: t('ask.localIdentifyReply') };
      }
      if (
        lowerText.includes('ayurveda') ||
        lowerText.includes('traditional') ||
        lowerText.includes('history') ||
        text.includes('ആയുർവേദ') ||
        text.includes('الأيورفيدا')
      ) {
        return { botResponse: t('ask.localAyurvedaReply') };
      }
      return {
        botResponse: t('ask.localFallbackReply', {
          query: text,
          count: PLANTS.length,
        }),
      };
    },
    [localizePlant, t]
  );

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? inputQuery).trim();
      if (!text || isGenerating) return;

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: nowStr,
      };

      if (!textToSend) setInputQuery('');

      const activeKey = getStoredApiKey() || apiKey;
      if (!activeKey) {
        const { botResponse, suggestedPlantId } = generateLocalReply(text);
        const herbiqMsg: ChatMessage = {
          id: `bot-${Date.now() + 1}`,
          sender: 'herbiq',
          text: botResponse,
          timestamp: nowStr,
          suggestedPlantId,
          suggestedPlantIds: suggestedPlantId ? [suggestedPlantId] : undefined,
          isAI: false,
        };
        setMessages((prev) => [...prev, userMsg, herbiqMsg]);
        return;
      }

      // Gemini AI Streaming Mode
      const replyId = `ai-${Date.now() + 1}`;
      const placeholderMsg: ChatMessage = {
        id: replyId,
        sender: 'herbiq',
        text: '…',
        timestamp: nowStr,
        isAI: true,
        isStreaming: true,
      };

      const historyTurns: ChatTurn[] = messages
        .filter((m) => m.id !== 'welcome' && !m.isStreaming && m.text.trim())
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: cleanPlantTags(m.text),
        }));
      historyTurns.push({ role: 'user', content: text });

      setMessages((prev) => [...prev, userMsg, placeholderMsg]);
      setIsGenerating(true);

      try {
        const provider = new GeminiProvider({ apiKey: activeKey, model: modelName });
        const systemInstruction = buildChatSystemPrompt(lang, PLANTS);
        let accumulated = '';

        for await (const chunk of provider.chat(historyTurns, { systemInstruction, lang })) {
          accumulated += chunk;
          const currentText = accumulated;
          const refIds = extractReferencedPlantIds(currentText, PLANTS);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === replyId
                ? {
                    ...m,
                    text: currentText,
                    suggestedPlantId: refIds[0],
                    suggestedPlantIds: refIds,
                    isStreaming: true,
                  }
                : m
            )
          );
        }

        const finalText = accumulated.trim() || t('ask.errGeneric');
        const finalRefIds = extractReferencedPlantIds(finalText, PLANTS);
        const fallbackMatch = finalRefIds.length === 0 ? findPlantInQuestion(text) : undefined;
        const resolvedIds =
          finalRefIds.length > 0 ? finalRefIds : fallbackMatch ? [fallbackMatch.id] : [];

        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId
              ? {
                  ...m,
                  text: finalText,
                  suggestedPlantId: resolvedIds[0],
                  suggestedPlantIds: resolvedIds,
                  isStreaming: false,
                }
              : m
          )
        );
      } catch (err) {
        const friendlyErr = mapAIErrorMessage(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId
              ? {
                  ...m,
                  text: friendlyErr,
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [inputQuery, isGenerating, apiKey, generateLocalReply, messages, modelName, lang, t, mapAIErrorMessage]
  );

  useEffect(() => {
    if (initialQuestion && lastInitialQuestion.current !== initialQuestion) {
      lastInitialQuestion.current = initialQuestion;
      void handleSendMessage(initialQuestion);
    }
  }, [initialQuestion, handleSendMessage]);

  const handleClearChat = () => {
    try {
      window.speechSynthesis?.cancel();
      setSpeakingMsgId(null);
    } catch {
      // ignore
    }
    setMessages([buildWelcomeMessage(Boolean(apiKey))]);
  };

  // Voice Input handler
  const toggleVoiceInput = () => {
    if (!speechSupported) return;
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const recognition = new SR();
      recognition.lang = SPEECH_LANG_MAP[lang] || 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  // Speech Synthesis handler
  const toggleSpeakMessage = (msg: ChatMessage) => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speakingMsgId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = cleanPlantTags(msg.text).replace(/[*#•]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = hasArabicScript(clean)
      ? 'ar-SA'
      : /[\u0D00-\u0D7F]/.test(clean)
        ? 'ml-IN'
        : SPEECH_LANG_MAP[lang] || 'en-IN';
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  // Key Settings Modal handlers
  const openSettingsModal = () => {
    setKeyDraft(getStoredApiKey() || apiKey);
    setRememberDevice(isKeyRememberedOnDevice());
    setSettingsStatus(null);
    setSettingsOpen(true);
  };

  const handleTestKey = async () => {
    const candidate = keyDraft.trim();
    if (!candidate || testingKey) return;
    setTestingKey(true);
    setSettingsStatus(null);
    try {
      const provider = new GeminiProvider({ apiKey: candidate, model: modelName });
      const ok = await provider.testKey();
      setSettingsStatus({
        type: ok ? 'ok' : 'err',
        text: ok ? t('ask.testSuccess') : t('ask.testFailed'),
      });
    } catch {
      setSettingsStatus({ type: 'err', text: t('ask.testFailed') });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveKey = () => {
    const clean = keyDraft.trim();
    saveApiKey(clean, rememberDevice);
    saveStoredModel(modelName);
    setApiKey(clean);
    setSettingsStatus({
      type: 'ok',
      text: clean ? t('ask.keySavedNotice') : t('ask.keyRemovedNotice'),
    });
  };

  const handleRemoveKey = () => {
    removeApiKey();
    setKeyDraft('');
    setApiKey('');
    setRememberDevice(false);
    setSettingsStatus({ type: 'ok', text: t('ask.keyRemovedNotice') });
  };

  // Camera Plant Scanner handlers
  const openScannerModal = () => {
    setScannerError('');
    setScannerOpen(true);
  };

  const closeScannerModal = () => {
    stopCameraStream();
    setScannerOpen(false);
    setScannerError('');
  };

  const startScannerCamera = async () => {
    setScannerError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setScannerError(t('ask.cameraPermissionDenied'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setCameraRunning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setScannerError(t('ask.cameraPermissionDenied'));
      setCameraRunning(false);
    }
  };

  const runPlantIdentification = async (imageDataUrl: string) => {
    const activeKey = getStoredApiKey() || apiKey;
    if (!activeKey) {
      setScannerError(t('ask.scannerNeedKey'));
      return;
    }

    setScannerBusy(true);
    setScannerError('');
    stopCameraStream();
    setScannerOpen(false);

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userPhotoMsg: ChatMessage = {
      id: `scan-user-${Date.now()}`,
      sender: 'user',
      text: t('ask.scanUserMessage'),
      timestamp: nowStr,
      photoDataUrl: imageDataUrl,
    };

    const replyId = `scan-bot-${Date.now() + 1}`;
    const analyzingMsg: ChatMessage = {
      id: replyId,
      sender: 'herbiq',
      text: t('ask.analyzingPhoto'),
      timestamp: nowStr,
      isAI: true,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userPhotoMsg, analyzingMsg]);

    try {
      const provider = new GeminiProvider({ apiKey: activeKey, model: modelName });
      const catalogSummary = buildCatalogSummary(PLANTS);
      const scanResult = await provider.identifyPlant(imageDataUrl, lang, catalogSummary);

      const matchedId =
        scanResult.matched_catalog_id && getPlantById(scanResult.matched_catalog_id)
          ? scanResult.matched_catalog_id
          : undefined;

      const summaryText = scanResult.is_plant
        ? `${scanResult.common_name} (${scanResult.scientific_name}) — ${scanResult.short_info}`
        : t('ask.notAPlant');

      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId
            ? {
                ...m,
                text: summaryText,
                scanResult,
                suggestedPlantId: matchedId,
                suggestedPlantIds: matchedId ? [matchedId] : undefined,
                isStreaming: false,
              }
            : m
        )
      );
    } catch (err) {
      const friendly = mapAIErrorMessage(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId
            ? {
                ...m,
                text: friendly,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setScannerBusy(false);
    }
  };

  const handleCaptureFromVideo = async () => {
    if (!videoRef.current || scannerBusy) return;
    try {
      const dataUrl = captureVideoFrameForScan(videoRef.current, 1024, 0.8);
      await runPlantIdentification(dataUrl);
    } catch {
      setScannerError(t('ask.errGeneric'));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setScannerBusy(true);
      const dataUrl = await preparePlantImageForScan(file, 1024, 0.8);
      await runPlantIdentification(dataUrl);
    } catch (err: any) {
      setScannerError(err instanceof Error ? err.message : t('ask.errGeneric'));
      setScannerBusy(false);
    }
  };

  const suggestedQuestions = [
    t('ask.q1'),
    t('ask.q2'),
    t('ask.q3'),
    t('ask.q4'),
    t('ask.q5'),
    t('ask.q6'),
  ];

  const renderPlantCard = (plantId: string) => {
    const rawPlant: Plant | undefined = getPlantById(plantId);
    if (!rawPlant) return null;
    const plant = localizePlant(rawPlant);

    return (
      <div
        key={plant.id}
        className="mt-2 p-3 rounded-2xl bg-[#0B142B] border border-[#00E5FF]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#00E5FF]/20 bg-[#060B18]">
            <PlantImage src={plant.image} alt={plant.name} plantName={plant.name} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-[#F8FAFC] truncate">{plant.name}</div>
            <div className="text-[11px] italic text-[#00E5FF] truncate">
              <bdi dir="ltr">{plant.scientificName}</bdi>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onSelectPlant(plant.id)}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#00E5FF]/15 hover:bg-[#00E5FF]/25 text-[#00E5FF] border border-[#00E5FF]/40 text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('ask.viewPlant')}</span>
            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
          </button>
          {plant.arAvailable && plant.model3D && onNavigateToARWithPlant && (
            <button
              type="button"
              onClick={() => onNavigateToARWithPlant(plant.id)}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/40 text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t('ask.view3D')}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 text-start">
      {/* Intro Header + Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-start space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-semibold border border-[#00E5FF]/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{apiKey ? t('ask.keyConnectedBadge') : t('ask.badge')}</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
            {t('ask.heading')}
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] max-w-lg">
            {t('ask.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="clear-chat-btn"
            onClick={handleClearChat}
            className="px-3 py-2 rounded-xl bg-[#0B142B] hover:bg-[#0B142B]/80 text-[#94A3B8] hover:text-[#F8FAFC] border border-[#00E5FF]/25 text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('ask.clearChat')}</span>
          </button>

          <button
            type="button"
            id="ai-settings-btn"
            onClick={openSettingsModal}
            aria-label={t('ask.settingsBtn')}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
              apiKey
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40'
                : 'bg-[#0B142B] text-[#00E5FF] border-[#00E5FF]/35 hover:bg-[#00E5FF]/10'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{t('ask.settingsBtn')}</span>
          </button>
        </div>
      </div>

      {/* No-Key Banner */}
      {!apiKey && (
        <div
          id="byok-banner"
          className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0B142B] to-[#060B18] border border-[#00E5FF]/35 flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#F8FAFC]">
            <Sparkles className="w-4 h-4 text-[#00E5FF] shrink-0" />
            <span>{t('ask.keyBanner')}</span>
          </div>
          <button
            type="button"
            id="open-key-settings-banner-btn"
            onClick={openSettingsModal}
            className="px-3.5 py-1.5 rounded-xl bg-[#00E5FF] text-[#060B18] text-xs font-bold hover:brightness-110 transition-all shrink-0"
          >
            {t('ask.keyBannerBtn')}
          </button>
        </div>
      )}

      {/* Suggested Questions Chips */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#00E5FF] uppercase tracking-wider text-center sm:text-start">
          {t('ask.suggestedTitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => void handleSendMessage(q)}
              id={`suggested-question-btn-${idx}`}
              className="px-3 py-1.5 rounded-xl bg-[#0B142B] hover:bg-[#00E5FF]/10 text-[#94A3B8] hover:text-[#00E5FF] border border-[#00E5FF]/20 text-xs font-medium transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Container */}
      <div className="glass-panel rounded-3xl border border-[#00E5FF]/30 h-[540px] flex flex-col justify-between overflow-hidden shadow-2xl bg-[#0B142B]">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isHerbiQ = msg.sender === 'herbiq';
            const bubbleRtl = dir === 'rtl' || hasArabicScript(msg.text);
            const plantIds =
              msg.suggestedPlantIds && msg.suggestedPlantIds.length > 0
                ? msg.suggestedPlantIds
                : msg.suggestedPlantId
                  ? [msg.suggestedPlantId]
                  : [];

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isHerbiQ ? 'justify-start' : 'justify-end'}`}
              >
                {isHerbiQ && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#10B981] text-[#060B18] flex items-center justify-center shrink-0 shadow-md glow-cyan">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  dir={bubbleRtl ? 'rtl' : 'ltr'}
                  className={`max-w-[88%] sm:max-w-[78%] p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm leading-relaxed text-start ${
                    isHerbiQ
                      ? 'bg-[#060B18] text-[#F8FAFC] border border-[#00E5FF]/20 rounded-ss-none'
                      : 'bg-[#00E5FF] text-[#060B18] font-medium rounded-se-none shadow-md'
                  }`}
                >
                  {/* User uploaded/captured photo thumbnail */}
                  {msg.photoDataUrl && (
                    <img
                      src={msg.photoDataUrl}
                      alt={t('ask.scanUserMessage')}
                      className="w-40 h-40 object-cover rounded-xl border border-[#060B18]/20 mb-2"
                    />
                  )}

                  {/* Structured Camera Scan Result Card */}
                  {msg.scanResult ? (
                    <div className="space-y-3">
                      {!msg.scanResult.is_plant ? (
                        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">{t('ask.notAPlant')}</p>
                            {msg.scanResult.short_info && (
                              <p className="text-xs mt-1 text-amber-200/80">{msg.scanResult.short_info}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0B142B] pb-2">
                            <div>
                              <h3 className="font-serif text-lg font-bold text-[#F8FAFC]">
                                {msg.scanResult.common_name}
                              </h3>
                              <p className="text-xs italic text-[#00E5FF]">
                                <bdi dir="ltr">{msg.scanResult.scientific_name}</bdi>
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                msg.scanResult.confidence === 'high'
                                  ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                                  : msg.scanResult.confidence === 'medium'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                              }`}
                            >
                              {msg.scanResult.confidence === 'high'
                                ? t('ask.confidenceHigh')
                                : msg.scanResult.confidence === 'medium'
                                  ? t('ask.confidenceMedium')
                                  : t('ask.confidenceLow')}
                            </span>
                          </div>

                          {msg.scanResult.confidence === 'low' && (
                            <p className="text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30">
                              {t('ask.lowConfidenceTip')}
                            </p>
                          )}

                          <p className="text-slate-200">{msg.scanResult.short_info}</p>

                          {msg.scanResult.uses.length > 0 && (
                            <div className="space-y-1">
                              <strong className="text-xs text-[#10B981] block">
                                {t('ask.traditionalUsesLabel')}
                              </strong>
                              <ul className="list-disc ps-5 space-y-0.5 text-slate-300">
                                {msg.scanResult.uses.map((u, i) => (
                                  <li key={i}>{u}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {msg.scanResult.caution && (
                            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-amber-300">{t('ask.cautionLabel')} </strong>
                                {msg.scanResult.caution}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : isHerbiQ ? (
                    renderSafeMarkdown(msg.text)
                  ) : (
                    <p className="whitespace-pre-line">{msg.text}</p>
                  )}

                  {/* Catalog Plant Cards */}
                  {plantIds.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {plantIds.map((pid) => renderPlantCard(pid))}
                    </div>
                  )}

                  {/* Fixed Educational Disclaimer under AI messages */}
                  {isHerbiQ && msg.isAI && !msg.isStreaming && (
                    <div className="pt-2 border-t border-[#0B142B] flex items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
                      <span className="flex items-center gap-1 text-amber-300/90">
                        <ShieldAlert className="w-3 h-3 shrink-0" />
                        <span>{t('ask.aiDisclaimer')}</span>
                      </span>
                      {ttsSupported && (
                        <button
                          type="button"
                          onClick={() => toggleSpeakMessage(msg)}
                          aria-label={
                            speakingMsgId === msg.id ? t('ask.stopSpeaking') : t('ask.speakReply')
                          }
                          className="p-1 rounded-lg hover:bg-[#0B142B] text-[#00E5FF]"
                        >
                          {speakingMsgId === msg.id ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  <div
                    className={`text-[10px] text-end ${
                      isHerbiQ ? 'text-[#94A3B8]' : 'text-[#060B18]/70'
                    }`}
                  >
                    <bdi dir="ltr">{msg.timestamp}</bdi>
                  </div>
                </div>

                {!isHerbiQ && (
                  <div className="w-8 h-8 rounded-xl bg-[#0B142B] border border-[#00E5FF]/30 text-[#00E5FF] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-[#060B18]/90 border-t border-[#00E5FF]/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Camera Scan Plant Button */}
            <button
              type="button"
              id="chat-scan-plant-btn"
              onClick={openScannerModal}
              title={t('ask.scanPlantBtn')}
              aria-label={t('ask.scanPlantBtn')}
              className="px-3 py-3 rounded-xl bg-[#0B142B] hover:bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/35 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">{t('ask.scanPlantBtn')}</span>
            </button>

            {/* Optional Voice Mic Button (only rendered if browser supports SpeechRecognition) */}
            {speechSupported && (
              <button
                type="button"
                id="voice-input-btn"
                onClick={toggleVoiceInput}
                title={listening ? t('ask.voiceStop') : t('ask.voiceStart')}
                aria-label={listening ? t('ask.voiceStop') : t('ask.voiceStart')}
                className={`p-3 rounded-xl border transition-all shrink-0 ${
                  listening
                    ? 'bg-red-500/20 text-red-300 border-red-400 animate-pulse'
                    : 'bg-[#0B142B] text-[#94A3B8] hover:text-[#00E5FF] border-[#00E5FF]/30'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Input Field */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={t('ask.inputPlaceholder')}
              aria-label={t('ask.inputAria')}
              className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-[#0B142B] border border-[#00E5FF]/30 text-[#F8FAFC] placeholder-[#94A3B8]/60 text-xs sm:text-sm focus:outline-none focus:border-[#00E5FF]"
              id="chat-input-field"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputQuery.trim() || isGenerating}
              id="chat-send-btn"
              className="px-4 sm:px-5 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-xs disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0 glow-cyan"
            >
              <span>{t('ask.send')}</span>
              <Send className="w-3.5 h-3.5 rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      </div>

      {/* GEMINI BYOK SETTINGS MODAL */}
      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('ask.settingsTitle')}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#0B142B] border border-[#00E5FF]/40 p-6 space-y-5 shadow-2xl text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold text-[#F8FAFC]">
                {t('ask.settingsTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label={t('ask.closeBtn')}
                className="p-2 rounded-xl bg-[#060B18] text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="gemini-key-input" className="text-xs font-semibold text-[#F8FAFC]">
                  {t('ask.settingsKeyLabel')}
                </label>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#00E5FF] hover:underline inline-flex items-center gap-1"
                >
                  <span>{t('ask.getFreeKey')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  id="gemini-key-input"
                  type={showKeyText ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder={t('ask.settingsKeyPlaceholder')}
                  className="w-full ps-4 pe-20 py-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/30 text-[#F8FAFC] text-xs sm:text-sm focus:outline-none focus:border-[#00E5FF]"
                />
                <button
                  type="button"
                  id="toggle-key-visibility-btn"
                  onClick={() => setShowKeyText((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[#00E5FF] hover:underline inline-flex items-center gap-1"
                >
                  {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showKeyText ? t('ask.hideKey') : t('ask.showKey')}</span>
                </button>
              </div>
            </div>

            {/* Storage Option: Session Only vs Remember on Device */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-[#F8FAFC]">
                {t('ask.storageModeLabel')}
              </legend>
              <label className="flex items-center gap-2.5 text-xs text-[#94A3B8] cursor-pointer">
                <input
                  type="radio"
                  name="gemini-key-storage"
                  checked={!rememberDevice}
                  onChange={() => setRememberDevice(false)}
                  className="accent-[#00E5FF]"
                />
                <span>{t('ask.sessionOnly')}</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-[#94A3B8] cursor-pointer">
                <input
                  type="radio"
                  name="gemini-key-storage"
                  checked={rememberDevice}
                  onChange={() => setRememberDevice(true)}
                  className="accent-[#00E5FF]"
                />
                <span>{t('ask.rememberDevice')}</span>
              </label>
            </fieldset>

            {/* Model selector */}
            <div className="space-y-1">
              <label htmlFor="gemini-model-select" className="text-xs font-semibold text-[#F8FAFC] block">
                {t('ask.modelLabel')}
              </label>
              <select
                id="gemini-model-select"
                dir="ltr"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#060B18] border border-[#00E5FF]/30 text-xs text-[#F8FAFC]"
              >
                {AVAILABLE_GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notice */}
            <div className="p-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/20 text-xs text-[#94A3B8] leading-relaxed">
              {t('ask.privacyNotice')}
            </div>

            {settingsStatus && (
              <div
                role="status"
                className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  settingsStatus.type === 'ok'
                    ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-500/40'
                    : 'bg-red-950/70 text-red-200 border border-red-500/40'
                }`}
              >
                {settingsStatus.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{settingsStatus.text}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="test-gemini-key-btn"
                  disabled={!keyDraft.trim() || testingKey}
                  onClick={() => void handleTestKey()}
                  className="px-4 py-2 rounded-xl bg-[#060B18] hover:bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40 text-xs font-bold transition-all"
                >
                  {testingKey ? t('ask.testingKey') : t('ask.testKeyBtn')}
                </button>
                <button
                  type="button"
                  id="save-gemini-key-btn"
                  onClick={handleSaveKey}
                  className="px-4 py-2 rounded-xl bg-[#00E5FF] text-[#060B18] text-xs font-bold hover:brightness-110 transition-all"
                >
                  {t('ask.saveKeyBtn')}
                </button>
                {(apiKey || keyDraft) && (
                  <button
                    type="button"
                    id="remove-gemini-key-btn"
                    onClick={handleRemoveKey}
                    className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/70 text-red-200 border border-red-500/40 text-xs font-semibold transition-all"
                  >
                    {t('ask.removeKeyBtn')}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#060B18] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold"
              >
                {t('ask.closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA PLANT SCANNER MODAL */}
      {scannerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('ask.scannerTitle')}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#0B142B] border border-[#00E5FF]/40 p-6 space-y-4 shadow-2xl text-start">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#00E5FF]" />
                <h2 className="font-serif text-2xl font-bold text-[#F8FAFC]">
                  {t('ask.scannerTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeScannerModal}
                aria-label={t('ask.closeBtn')}
                className="p-2 rounded-xl bg-[#060B18] text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#94A3B8]">
              {t('ask.scannerSubtitle')}
            </p>

            {!apiKey && (
              <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                <p>{t('ask.scannerNeedKey')}</p>
                <button
                  type="button"
                  onClick={() => {
                    closeScannerModal();
                    openSettingsModal();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#00E5FF] text-[#060B18] font-bold text-xs"
                >
                  {t('ask.keyBannerBtn')}
                </button>
              </div>
            )}

            {scannerError && (
              <div role="alert" className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-xs text-red-200">
                {scannerError}
              </div>
            )}

            {/* Video Viewfinder */}
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[#060B18] border border-[#00E5FF]/25 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraRunning ? 'block' : 'hidden'}`}
              />
              {!cameraRunning && (
                <div className="text-center p-6 space-y-2 text-[#94A3B8]">
                  <Camera className="w-10 h-10 text-[#00E5FF]/60 mx-auto" />
                  <p className="text-xs">{t('ask.scannerSubtitle')}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!cameraRunning ? (
                <button
                  type="button"
                  id="scanner-start-camera-btn"
                  disabled={!apiKey || scannerBusy}
                  onClick={() => void startScannerCamera()}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#00E5FF] text-[#060B18] font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t('ask.startCamera')}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    id="scanner-capture-btn"
                    disabled={scannerBusy}
                    onClick={() => void handleCaptureFromVideo()}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t('ask.capturePhoto')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="py-3 px-4 rounded-xl bg-[#060B18] text-[#94A3B8] border border-slate-700 text-xs font-semibold"
                  >
                    {t('ask.stopCamera')}
                  </button>
                </>
              )}

              {/* Upload Photo Fallback */}
              <input
                ref={fileInputRef}
                id="scanner-upload-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleFileUpload(e)}
                className="hidden"
              />
              <button
                type="button"
                id="scanner-upload-btn"
                disabled={!apiKey || scannerBusy}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#060B18] hover:bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>{t('ask.uploadPhoto')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
