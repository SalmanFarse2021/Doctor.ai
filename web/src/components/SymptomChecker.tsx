'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Activity, AlertCircle, CheckCircle2, HelpCircle, Mic, Volume2, StopCircle } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from 'next-auth/react';

interface SymptomCheckerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SymptomChecker({ isOpen, onClose }: SymptomCheckerProps) {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const [symptoms, setSymptoms] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setSymptoms((prev) => prev + (prev ? ' ' : '') + transcript);
                    setIsListening(false);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    setIsListening(false);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setSymptoms('');
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const speakText = (text: string) => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const handleSubmit = async () => {
        if (!symptoms.trim()) return;
        setLoading(true);
        try {
            const uid = (session?.user as any)?.id || session?.user?.email;
            const response = await fetch(`${API_BASE_URL}/api/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symptoms,
                    user_id: uid,
                    language: 'English' // Default for now
                }),
            });
            const data = await response.json();
            setResult(data);

            // Auto-speak summary if available
            if (data.summary) {
                // speakText(data.summary); // Optional: Auto-speak
            }
        } catch (error) {
            console.error('Error analyzing symptoms:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "fixed inset-0 m-auto max-w-2xl h-[85vh] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col",
                            isDark ? "bg-[#0F1420] border border-white/10" : "bg-white"
                        )}
                    >
                        {/* Header */}
                        <div className={cn("p-6 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-slate-100")}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                                    <Activity className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>AI Symptom Checker</h2>
                                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>Powered by Gemini 2.5 Flash</p>
                                </div>
                            </div>
                            <button onClick={onClose} className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {!result ? (
                                <div className="space-y-6">
                                    <div className={cn("p-4 rounded-xl border", isDark ? "bg-blue-500/10 border-blue-500/20 text-blue-200" : "bg-blue-50 border-blue-100 text-blue-800")}>
                                        <p className="text-sm">
                                            Please describe your symptoms in detail. You can type or use voice input.
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={symptoms}
                                            onChange={(e) => setSymptoms(e.target.value)}
                                            placeholder="E.g., I have a severe headache on the left side..."
                                            className={cn(
                                                "w-full h-48 p-4 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                                isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                            )}
                                        />
                                        <button
                                            onClick={toggleListening}
                                            className={cn("absolute bottom-4 right-4 p-3 rounded-full transition-all shadow-lg",
                                                isListening
                                                    ? "bg-red-500 text-white animate-pulse"
                                                    : (isDark ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-blue-600 text-white hover:bg-blue-700")
                                            )}
                                        >
                                            {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Emergency Warning */}
                                    {result.is_emergency && (
                                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-start gap-3 animate-pulse">
                                            <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                            <div>
                                                <h3 className="font-bold uppercase tracking-wider text-sm mb-1">Emergency Detected</h3>
                                                <p className="text-sm font-medium">{result.emergency_warning || "Please seek immediate medical attention."}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary */}
                                    <div className={cn("p-4 rounded-xl border relative", isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>Summary</h3>
                                            <button onClick={() => speakText(result.summary)} className={cn("p-1.5 rounded-lg transition-colors", isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-200 text-slate-500")}>
                                                {isSpeaking ? <StopCircle className="w-4 h-4 text-blue-500" /> : <Volume2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>{result.summary}</p>
                                    </div>

                                    {/* HPO Terms */}
                                    {result.hpo_terms && result.hpo_terms.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {result.hpo_terms.map((term: any, idx: number) => (
                                                <span key={idx} className={cn("px-2 py-1 rounded-md text-[10px] font-mono border",
                                                    isDark ? "bg-purple-500/10 text-purple-300 border-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200"
                                                )}>
                                                    {term.term} ({term.id})
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Potential Conditions */}
                                    <div>
                                        <h3 className={cn("text-sm font-bold uppercase tracking-wider mb-3", isDark ? "text-slate-400" : "text-slate-500")}>Potential Conditions</h3>
                                        <div className="space-y-3">
                                            {result.potential_conditions?.map((condition: any, idx: number) => (
                                                <div key={idx} className={cn("p-4 rounded-xl border flex items-start gap-4", isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
                                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                                        condition.probability === 'High' ? "bg-red-500/10 text-red-500" :
                                                            condition.probability === 'Medium' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                                                    )}>
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>{condition.name}</h4>
                                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                                                condition.probability === 'High' ? "bg-red-500/10 text-red-500" :
                                                                    condition.probability === 'Medium' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                                                            )}>{condition.probability} Probability</span>
                                                        </div>
                                                        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-600")}>{condition.reasoning}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recommended Actions */}
                                    <div>
                                        <h3 className={cn("text-sm font-bold uppercase tracking-wider mb-3", isDark ? "text-slate-400" : "text-slate-500")}>Recommended Actions</h3>
                                        <div className="grid gap-3">
                                            {result.recommended_actions?.map((action: string, idx: number) => (
                                                <div key={idx} className={cn("p-3 rounded-lg flex items-center gap-3", isDark ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-700")}>
                                                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                                    <span className="text-sm font-medium">{action}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Clarifying Questions */}
                                    {result.clarifying_questions && result.clarifying_questions.length > 0 && (
                                        <div className={cn("p-4 rounded-xl border", isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-100")}>
                                            <h3 className={cn("text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2", isDark ? "text-blue-400" : "text-blue-700")}>
                                                <HelpCircle className="w-4 h-4" />
                                                Refinement Questions
                                            </h3>
                                            <ul className="space-y-2">
                                                {result.clarifying_questions.map((q: string, idx: number) => (
                                                    <li key={idx} className={cn("text-sm flex items-start gap-2", isDark ? "text-blue-200" : "text-blue-800")}>
                                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                                                        {q}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={cn("p-6 border-t", isDark ? "border-white/10" : "border-slate-100")}>
                            {!result ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !symptoms.trim()}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg hover:shadow-lg hover:shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            Analyze Symptoms
                                            <Send className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setResult(null); setSymptoms(''); }}
                                    className={cn("w-full py-4 rounded-xl font-bold text-lg transition-all border",
                                        isDark ? "border-white/10 hover:bg-white/5 text-white" : "border-slate-200 hover:bg-slate-50 text-slate-900"
                                    )}
                                >
                                    Start New Checkup
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
