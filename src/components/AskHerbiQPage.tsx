import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { PLANTS, getPlantById, findPlantInQuestion } from '../data/plants';
import { useI18n } from '../i18n';
import { Sparkles, Send, Bot, User, BookOpen, ArrowRight } from 'lucide-react';

interface AskHerbiQPageProps {
  initialQuestion?: string;
  initialOpenScanner?: boolean;
  onSelectPlant: (plantId: string) => void;
  onNavigateToARWithPlant?: (plantId: string) => void;
}

export const AskHerbiQPage: React.FC<AskHerbiQPageProps> = ({ initialQuestion, onSelectPlant }) => {
  const { t, lang, localizePlant } = useI18n();
  const [inputQuery, setInputQuery] = useState('');
  const lastInitialQuestion = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'herbiq',
      text: t('ask.welcomeLocal'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === 'welcome' ? { ...m, text: t('ask.welcomeLocal') } : m))
    );
  }, [lang, t]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    t('ask.q1'),
    t('ask.q2'),
    t('ask.q3'),
    t('ask.q4'),
    t('ask.q5'),
    t('ask.q6'),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialQuestion && lastInitialQuestion.current !== initialQuestion) {
      lastInitialQuestion.current = initialQuestion;
      handleSendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputQuery;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');

    const lowerText = text.toLowerCase();
    let botResponse = '';
    let suggestedPlantId: string | undefined = undefined;

    const rawMatchedPlant = findPlantInQuestion(text);

    if (rawMatchedPlant) {
      const matchedPlant = localizePlant(rawMatchedPlant);
      suggestedPlantId = matchedPlant.id;
      botResponse = t('ask.localPlantReply', {
        name: matchedPlant.name,
        secondaryName: rawMatchedPlant.malayalamName,
        scientificName: matchedPlant.scientificName,
        family: matchedPlant.family,
        description: matchedPlant.description,
        traditionalUses: matchedPlant.traditionalUses,
      });
    } else if (
      lowerText.includes('identify') ||
      lowerText.includes('recognize') ||
      lowerText.includes('leaf') ||
      lowerText.includes('feature') ||
      text.includes('തിരിച്ചറിയ') ||
      text.includes('التعرف') ||
      text.includes('أتعرف')
    ) {
      botResponse = t('ask.localIdentifyReply');
    } else if (
      lowerText.includes('ayurveda') ||
      lowerText.includes('traditional') ||
      lowerText.includes('history') ||
      text.includes('ആയുർവേദ') ||
      text.includes('الأيورفيدا')
    ) {
      botResponse = t('ask.localAyurvedaReply');
    } else {
      botResponse = t('ask.localFallbackReply', {
        query: text,
        count: PLANTS.length,
      });
    }

    const herbiqMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'herbiq',
      text: botResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedPlantId,
    };

    setMessages((prev) => [...prev, herbiqMsg]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-start">
      {/* Intro Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-semibold border border-[#00E5FF]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('ask.badge')}</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
          {t('ask.heading')}
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8] max-w-lg mx-auto">
          {t('ask.subtitle')}
        </p>
      </div>

      {/* Suggested Questions Chips */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#00E5FF] uppercase tracking-wider text-center sm:text-start">
          {t('ask.suggestedTitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              id={`suggested-question-btn-${idx}`}
              className="px-3 py-1.5 rounded-xl bg-[#0B142B] hover:bg-[#00E5FF]/10 text-[#94A3B8] hover:text-[#00E5FF] border border-[#00E5FF]/20 text-xs font-medium transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Container */}
      <div className="glass-panel rounded-3xl border border-[#00E5FF]/30 h-[520px] flex flex-col justify-between overflow-hidden shadow-2xl bg-[#0B142B]">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isHerbiQ = msg.sender === 'herbiq';
            const rawSuggested = msg.suggestedPlantId ? getPlantById(msg.suggestedPlantId) : null;
            const suggestedPlant = rawSuggested ? localizePlant(rawSuggested) : null;

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
                  className={`max-w-[85%] sm:max-w-[78%] p-4 rounded-2xl space-y-2 text-xs sm:text-sm leading-relaxed whitespace-pre-line text-start ${
                    isHerbiQ
                      ? 'bg-[#060B18] text-[#F8FAFC] border border-[#00E5FF]/20 rounded-ss-none'
                      : 'bg-[#00E5FF] text-[#060B18] font-medium rounded-se-none shadow-md'
                  }`}
                >
                  <p>{msg.text}</p>

                  {suggestedPlant && (
                    <div className="pt-2">
                      <button
                        onClick={() => onSelectPlant(suggestedPlant.id)}
                        className="w-full p-2.5 rounded-xl bg-[#0B142B] text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-bold hover:bg-[#00E5FF]/10 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{t('ask.viewFullProfile', { name: suggestedPlant.name })}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </button>
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
        <div className="p-4 bg-[#060B18]/90 border-t border-[#00E5FF]/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={t('ask.inputPlaceholder')}
              aria-label={t('ask.inputAria')}
              className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-[#0B142B] border border-[#00E5FF]/30 text-[#F8FAFC] placeholder-[#94A3B8]/60 text-xs sm:text-sm focus:outline-none focus:border-[#00E5FF]"
              id="chat-input-field"
            />

            <button
              type="submit"
              disabled={!inputQuery.trim()}
              id="chat-send-btn"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-xs disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0 glow-cyan"
            >
              <span>{t('ask.send')}</span>
              <Send className="w-3.5 h-3.5 rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
