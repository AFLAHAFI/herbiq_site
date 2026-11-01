import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { PLANTS, getPlantById, findPlantInQuestion } from '../data/plants';
import { Sparkles, Send, Bot, User, BookOpen, Search } from 'lucide-react';

interface AskHerbiQPageProps {
  initialQuestion?: string;
  onSelectPlant: (plantId: string) => void;
}

export const AskHerbiQPage: React.FC<AskHerbiQPageProps> = ({ initialQuestion, onSelectPlant }) => {
  const [inputQuery, setInputQuery] = useState('');
  const lastInitialQuestion = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'herbiq',
      text: 'Namaste! Ask about a plant by name, in English or Malayalam. This guide uses the local plant catalog. Live AI and voice input are not connected.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'What is Tulsi?',
    'How can I identify Neem?',
    'What is the traditional importance of Aloe Vera?',
    'What is the scientific name of Turmeric?',
    'Tell me about Shatavari benefits',
    'How does Brahmi help memory?'
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');

    // Generate educational botanical response from herbiq-plants.json
    {
      const lowerText = text.toLowerCase();
      let botResponse = '';
      let suggestedPlantId: string | undefined = undefined;

      // Find matching plant in database
      const matchedPlant = findPlantInQuestion(text);

      if (matchedPlant) {
        suggestedPlantId = matchedPlant.id;
        botResponse = `I can definitely tell you about ${matchedPlant.name} (${matchedPlant.malayalamName}).\n\n` +
          `• Scientific Name: ${matchedPlant.scientificName}\n` +
          `• Family: ${matchedPlant.family}\n\n` +
          `• Overview: ${matchedPlant.description}\n\n` +
          `• Traditional Uses: ${matchedPlant.traditionalUses}\n\n` +
          `Would you like to know more about its traditional benefits or how to identify it?`;
      } else if (lowerText.includes('identify') || lowerText.includes('recognize') || lowerText.includes('leaf') || lowerText.includes('feature')) {
        botResponse = 'To identify medicinal plants during a garden visit, inspect four primary morphological markers:\n' +
          '1. Leaf shape, venation, and arrangement (pinnate, palmate, simple, compound).\n' +
          '2. Flower color, petal arrangement, and inflorescence.\n' +
          '3. Stem texture, color, and sap type.\n' +
          '4. Aroma released when leaves are gently rubbed.\n\n' +
          'You can explore species in the HerbiQ Plants directory for detailed identification photos and markers!';
      } else if (lowerText.includes('ayurveda') || lowerText.includes('traditional') || lowerText.includes('history')) {
        botResponse = 'In traditional Ayurveda, plants are classified according to their Rasa (taste), Guna (qualities), Veerya (potency), and Vipaka (post-digestive effect) as documented in classical texts like Dravyaguna Shastra. HerbiQ preserves this traditional wisdom alongside botanical taxonomy for educational learning.';
      } else {
        botResponse = `Thank you for your question about "${text}". Medicinal plants play a vital role in biodiversity and traditional wellness. You can explore our catalog of ${PLANTS.length} garden species in the Plants directory or ask specifically about plants like Tulsi, Neem, Aloe Vera, Turmeric, or Shatavari.`;
      }

      const herbiqMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'herbiq',
        text: botResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPlantId
      };

      setMessages((prev) => [...prev, herbiqMsg]);
    }
  };


  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Intro Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-semibold border border-[#00E5FF]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plant Database Guide</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
          Ask HerbiQ
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8] max-w-lg mx-auto">
          Your personal botanical garden guide. Ask questions about plant species, Ayurvedic traditional uses, or identification tips.
        </p>
      </div>

      {/* Suggested Questions Chips */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#00E5FF] uppercase tracking-wider text-center sm:text-left">
          Suggested Questions
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
            const suggestedPlant = msg.suggestedPlantId ? getPlantById(msg.suggestedPlantId) : null;

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
                  className={`max-w-[85%] sm:max-w-[78%] p-4 rounded-2xl space-y-2 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    isHerbiQ
                      ? 'bg-[#060B18] text-[#F8FAFC] border border-[#00E5FF]/20 rounded-tl-none'
                      : 'bg-[#00E5FF] text-[#060B18] font-medium rounded-tr-none shadow-md'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Suggested Plant Link Card */}
                  {suggestedPlant && (
                    <div className="pt-2">
                      <button
                        onClick={() => onSelectPlant(suggestedPlant.id)}
                        className="w-full p-2.5 rounded-xl bg-[#0B142B] text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-bold hover:bg-[#00E5FF]/10 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>View Full Profile ({suggestedPlant.name})</span>
                        </div>
                        <span>→</span>
                      </button>
                    </div>
                  )}

                  <div
                    className={`text-[10px] text-right ${
                      isHerbiQ ? 'text-[#94A3B8]' : 'text-[#060B18]/70'
                    }`}
                  >
                    {msg.timestamp}
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
            {/* Input Field */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask HerbiQ about any medicinal plant..."
              aria-label="Your plant question" className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-[#0B142B] border border-[#00E5FF]/30 text-[#F8FAFC] placeholder-[#94A3B8]/60 text-xs sm:text-sm focus:outline-none focus:border-[#00E5FF]"
              id="chat-input-field"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              id="chat-send-btn"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-xs disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0 glow-cyan"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
