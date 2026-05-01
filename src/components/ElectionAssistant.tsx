import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, MapPin, Newspaper, MessageSquare, CheckCircle, XCircle } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  source: string;
  time: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VotingAtmosphere {
  percentage: string;
  atmosphere: string;
}

export default function ElectionAssistant() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! I am your Election Assistant powered by Gemini. Ask me anything about the upcoming election, candidates, or polling procedures!' }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [votingAtmosphere, setVotingAtmosphere] = useState<VotingAtmosphere | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Fetch News
  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => setNews(data))
      .catch(console.error);
  }, []);

  const handleChatSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.response || "Sorry, I couldn't process that." }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Error connecting to AI service." }]);
    }
  }, [chatInput]);

  const submitVoteStatus = useCallback(async (status: boolean) => {
    setHasVoted(status);
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasVoted: status, location: 'Precinct 42' })
      });
      const data = await response.json();
      setVotingAtmosphere(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Voice recording using Web Speech API
  const toggleRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Your browser does not support voice recording.');
      return;
    }

    if (!isRecording) {
      setIsRecording(true);
      // @ts-expect-error webkitSpeechRecognition is a vendor prefix
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    }
  }, [isRecording]);

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Smart Election Hub
        </h1>
        <p className="text-slate-600 text-lg">Powered by Google Cloud & Gemini</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: News */}
        <div className="lg:col-span-3 space-y-4">
          <section aria-labelledby="news-heading" className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h2 id="news-heading" className="text-xl font-bold flex items-center text-slate-800 mb-4 border-b pb-2">
              <Newspaper className="mr-2 text-blue-500" aria-hidden="true" /> Election News
            </h2>
            <div className="space-y-4" aria-live="polite">
              {news.map((item) => (
                <article key={item.id} className="hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer" tabIndex={0}>
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight">{item.title}</h3>
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>{item.source}</span>
                    <span>{item.time}</span>
                  </div>
                </article>
              ))}
              {news.length === 0 && <p className="text-sm text-slate-500">Loading news...</p>}
            </div>
          </section>

          <section aria-labelledby="voting-heading" className="bg-gradient-to-br from-blue-500 to-purple-600 p-5 rounded-2xl shadow-sm text-white">
            <h2 id="voting-heading" className="text-lg font-bold mb-2">Have you voted yet?</h2>
            {votingAtmosphere ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-sm font-medium mb-3">{votingAtmosphere.atmosphere}</p>
                <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wider opacity-80">Local Turnout</p>
                  <p className="text-3xl font-bold">{votingAtmosphere.percentage}%</p>
                </div>
              </motion.div>
            ) : (
              <div className="flex space-x-2 mt-4">
                <button onClick={() => submitVoteStatus(true)} className="flex-1 bg-white text-blue-600 font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center">
                  <CheckCircle size={16} className="mr-1" /> Yes
                </button>
                <button onClick={() => submitVoteStatus(false)} className="flex-1 bg-white/20 text-white font-bold py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center border border-white/30">
                  <XCircle size={16} className="mr-1" /> Not Yet
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Center: Google Map */}
        <section aria-labelledby="map-heading" className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <h2 id="map-heading" className="text-xl font-bold flex items-center text-slate-800 mb-4 border-b pb-2">
            <MapPin className="mr-2 text-red-500" aria-hidden="true" /> Nearest Booth (500m)
          </h2>
          <div className="relative w-full flex-grow min-h-[400px] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
            {/* Embedded Google Map - Hypothetical Location */}
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.8930777559194!2d77.58988771482215!3d12.978696890851167!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae16719b024467%3A0xc3f5c71d0d93cf02!2sVidhana%20Soudha!5e0!3m2!1sen!2sin!4v1684490000000!5m2!1sen!2sin" 
              className="absolute top-0 left-0 w-full h-full border-0"
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Nearest Election Booth Map"
            ></iframe>
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200">
              <h3 className="font-bold text-slate-800">Booth #142 - Vidhana Soudha</h3>
              <p className="text-sm text-slate-600 mt-1">Wait time: ~15 mins</p>
              <div className="mt-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded inline-block">
                0.5 km away (Walking distance)
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Gemini Chat */}
        <section aria-labelledby="chat-heading" className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px] lg:h-auto">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
            <h2 id="chat-heading" className="text-xl font-bold flex items-center text-slate-800">
              <MessageSquare className="mr-2 text-purple-500" aria-hidden="true" /> Gemini QA
            </h2>
            <p className="text-xs text-slate-500 mt-1">Ask questions using text or voice.</p>
          </div>
          
          <div className="flex-grow p-4 overflow-y-auto bg-slate-50 space-y-4" aria-live="polite" role="log">
            {chatHistory.map((chat, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx} 
                className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-2xl ${chat.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 shadow-sm border border-slate-200 rounded-bl-none'}`}>
                  <p className="text-sm leading-relaxed">{chat.content}</p>
                </div>
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-100 rounded-b-2xl">
            <div className="relative flex items-center">
              <button 
                type="button" 
                onClick={toggleRecording}
                aria-label="Toggle voice recording"
                className={`absolute left-2 p-2 rounded-full transition-colors ${isRecording ? 'bg-red-100 text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
              >
                <Mic size={20} />
              </button>
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isRecording ? "Listening..." : "Ask Gemini..."}
                aria-label="Chat input"
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                aria-label="Send message"
                className="absolute right-2 p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </section>

      </div>
    </main>
  );
}
