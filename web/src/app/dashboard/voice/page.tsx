'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Mic, MicOff, Volume2, VolumeX, User, Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

export default function VoiceDoctorPage() {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const synthesisRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Initialize Speech Recognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onstart = () => {
                    setIsListening(true);
                    setStatus('listening');
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                    // If we stopped but haven't processed (e.g. silence), we might want to reset or just stay idle
                    if (status === 'listening') {
                        setStatus('idle');
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                    setStatus('idle');
                };

                recognitionRef.current.onresult = (event: any) => {
                    const current = event.resultIndex;
                    const transcriptText = event.results[current][0].transcript;
                    setTranscript(transcriptText);
                    if (event.results[current].isFinal) {
                        handleSend(transcriptText);
                    }
                };
            } else {
                console.warn("Speech Recognition API not supported in this browser.");
            }

            // Initialize Speech Synthesis
            if ('speechSynthesis' in window) {
                synthesisRef.current = window.speechSynthesis;
            }
        }
    }, []);

    // Fetch profiles
    useEffect(() => {
        if (session?.user) {
            const fetchProfiles = async () => {
                const uid = (session?.user as any).id || session?.user?.email;
                try {
                    const res = await fetch(`http://127.0.0.1:8000/api/users/${uid}/profiles`);
                    const data = await res.json();
                    setProfiles(data);
                    if (data.length > 0) setSelectedProfileId(data[0]._id);
                } catch (e) {
                    console.error(e);
                }
            };
            fetchProfiles();
        }
    }, [session]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setTranscript('');
            setResponse('');
            recognitionRef.current?.start();
        }
    };

    const handleSend = async (text: string) => {
        setStatus('processing');
        recognitionRef.current?.stop();

        try {
            const uid = (session?.user as any).id || session?.user?.email;
            const res = await fetch('http://127.0.0.1:8000/api/voice-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: uid,
                    profile_id: selectedProfileId,
                    message: text,
                    language: 'English' // Could be dynamic
                })
            });
            const data = await res.json();
            setResponse(data.response);
            speak(data.response);
        } catch (error) {
            console.error(error);
            setStatus('idle');
        }
    };

    const speak = (text: string) => {
        if (synthesisRef.current) {
            // Cancel any current speech
            synthesisRef.current.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onstart = () => {
                setIsSpeaking(true);
                setStatus('speaking');
            };
            utterance.onend = () => {
                setIsSpeaking(false);
                setStatus('idle');
            };
            synthesisRef.current.speak(utterance);
        }
    };

    const stopSpeaking = () => {
        if (synthesisRef.current) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
            setStatus('idle');
        }
    };

    return (
        <div className={cn("min-h-screen p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">

                {/* Profile Selector */}
                <div className="mb-8">
                    <select
                        value={selectedProfileId || ''}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className={cn("p-2 rounded-lg border", isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}
                    >
                        {Array.isArray(profiles) && profiles.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.relation})</option>
                        ))}
                    </select>
                </div>

                {/* Visualizer / Status */}
                <div className="relative mb-12">
                    <div className={cn("w-64 h-64 rounded-full flex items-center justify-center transition-all duration-500",
                        status === 'listening' ? "bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.2)]" :
                            status === 'processing' ? "bg-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.2)]" :
                                status === 'speaking' ? "bg-green-500/10 shadow-[0_0_50px_rgba(34,197,94,0.2)]" :
                                    "bg-slate-500/5"
                    )}>
                        {status === 'processing' ? (
                            <Loader2 className="w-24 h-24 text-blue-500 animate-spin" />
                        ) : (
                            <div className={cn("w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300",
                                status === 'listening' ? "scale-110 bg-red-500/20" :
                                    status === 'speaking' ? "scale-110 bg-green-500/20 animate-pulse" :
                                        "bg-slate-500/10"
                            )}>
                                <Mic className={cn("w-20 h-20 transition-colors",
                                    status === 'listening' ? "text-red-500" :
                                        status === 'speaking' ? "text-green-500" :
                                            "text-slate-400"
                                )} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-6 mb-12">
                    <button
                        onClick={toggleListening}
                        className={cn("p-6 rounded-full transition-all transform hover:scale-105",
                            isListening ? "bg-red-500 text-white shadow-lg shadow-red-500/30" :
                                isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white hover:bg-slate-50 text-slate-900 shadow-lg"
                        )}
                    >
                        {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    </button>

                    {isSpeaking && (
                        <button
                            onClick={stopSpeaking}
                            className={cn("p-6 rounded-full bg-slate-200 text-slate-900 hover:bg-slate-300 transition-all")}
                        >
                            <VolumeX className="w-8 h-8" />
                        </button>
                    )}
                </div>

                {/* Conversation Display */}
                <div className="w-full space-y-6 text-center">
                    {transcript && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <p className="text-sm uppercase tracking-wider text-slate-500 mb-2">You said</p>
                            <p className="text-xl font-medium">{transcript}</p>
                        </div>
                    )}

                    {response && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 delay-100">
                            <p className="text-sm uppercase tracking-wider text-slate-500 mb-2">Doctor.ai</p>
                            <p className={cn("text-xl font-medium leading-relaxed", isDark ? "text-blue-400" : "text-blue-600")}>
                                {response}
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
