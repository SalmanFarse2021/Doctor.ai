import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

export default function VoiceDoctorView() {
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
                    const res = await fetch(`${API_BASE_URL}/api/users/${uid}/profiles`);
                    if (res.ok) {
                        const data = await res.json();
                        setProfiles(data);
                        if (data.length > 0) setSelectedProfileId(data[0]._id);
                    } else {
                        // Fallback/Mock data if API fails
                        setProfiles([
                            { _id: '1', name: session.user?.name || 'User', relation: 'Self' }
                        ]);
                        setSelectedProfileId('1');
                    }
                } catch (e) {
                    console.error(e);
                    // Fallback
                    setProfiles([
                        { _id: '1', name: session.user?.name || 'User', relation: 'Self' }
                    ]);
                    setSelectedProfileId('1');
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
        console.log('handleSend called with text:', text);
        setStatus('processing');
        recognitionRef.current?.stop();

        try {
            const uid = (session?.user as any).id || session?.user?.email;
            console.log('Sending request to voice-chat API with uid:', uid);
            const res = await fetch(`${API_BASE_URL}/api/voice-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: uid,
                    profile_id: selectedProfileId,
                    message: text,
                    language: 'English' // Could be dynamic
                })
            });

            console.log('Response status:', res.status);
            const data = await res.json();
            console.log('Response data:', data);

            if (res.ok && data.response) {
                console.log('Got valid response, setting response and speaking');
                setResponse(data.response);
                speak(data.response);
            } else if (data.error) {
                console.error('Server returned error:', data.error);
                // Show specific error from server
                const errorMsg = `Error: ${data.error}`;
                setResponse(errorMsg);
                speak(errorMsg);
                setStatus('idle');
            } else {
                console.log('No valid response, using mock');
                // Mock response for demo if backend not ready
                const mockResponse = "I understand you're feeling unwell. Could you describe your symptoms in more detail?";
                setResponse(mockResponse);
                speak(mockResponse);
            }
        } catch (error) {
            console.error('Voice chat error:', error);
            const errorMsg = error instanceof Error ? error.message : "Connection error. Please check if the server is running.";
            const mockResponse = `I'm having trouble connecting to the server: ${errorMsg}. Please try again.`;
            setResponse(mockResponse);
            speak(mockResponse);
            setStatus('idle');
        }
    };

    const speak = (text: string) => {
        console.log('speak function called with text:', text);
        if (synthesisRef.current) {
            // Cancel any current speech
            synthesisRef.current.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onstart = () => {
                console.log('Speech started');
                setIsSpeaking(true);
                setStatus('speaking');
            };
            utterance.onend = () => {
                console.log('Speech ended');
                setIsSpeaking(false);
                setStatus('idle');
            };
            utterance.onerror = (event: any) => {
                console.error('Speech synthesis error:', event);
                setIsSpeaking(false);
                setStatus('idle');
            };
            console.log('Starting speech synthesis');
            synthesisRef.current.speak(utterance);
        } else {
            console.error('Speech synthesis not available');
            setStatus('idle');
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
        <div className="max-w-4xl mx-auto space-y-8">
            <header className="text-center">
                <h2 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Voice Doctor</h2>
                <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Speak with our AI assistant for instant medical advice.</p>
            </header>

            <div className={cn("rounded-3xl border p-12 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden",
                isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm"
            )}>
                {/* Background Effects */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] transition-opacity duration-1000",
                        status === 'listening' ? "bg-red-500/10 opacity-100" :
                            status === 'speaking' ? "bg-green-500/10 opacity-100" :
                                status === 'processing' ? "bg-blue-500/10 opacity-100" :
                                    "opacity-0"
                    )} />
                </div>

                {/* Profile Selector */}
                <div className="absolute top-6 right-6 z-10">
                    <select
                        value={selectedProfileId || ''}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className={cn("px-3 py-1.5 rounded-lg border text-sm focus:outline-none",
                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                    >
                        {Array.isArray(profiles) && profiles.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.relation})</option>
                        ))}
                    </select>
                </div>

                {/* Visualizer / Status */}
                <div className="relative mb-12 z-10">
                    <div className={cn("w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500",
                        status === 'listening' ? "bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.2)]" :
                            status === 'processing' ? "bg-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.2)]" :
                                status === 'speaking' ? "bg-green-500/10 shadow-[0_0_50px_rgba(34,197,94,0.2)]" :
                                    "bg-slate-500/5"
                    )}>
                        {status === 'processing' ? (
                            <Loader2 className="w-20 h-20 text-blue-500 animate-spin" />
                        ) : (
                            <div className={cn("w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300",
                                status === 'listening' ? "scale-110 bg-red-500/20" :
                                    status === 'speaking' ? "scale-110 bg-green-500/20 animate-pulse" :
                                        "bg-slate-500/10"
                            )}>
                                <Mic className={cn("w-16 h-16 transition-colors",
                                    status === 'listening' ? "text-red-500" :
                                        status === 'speaking' ? "text-green-500" :
                                            "text-slate-400"
                                )} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-6 mb-12 z-10">
                    <button
                        onClick={toggleListening}
                        className={cn("p-6 rounded-full transition-all transform hover:scale-105",
                            isListening ? "bg-red-500 text-white shadow-lg shadow-red-500/30" :
                                isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900 shadow-lg"
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
                <div className="w-full max-w-lg space-y-6 text-center z-10 min-h-[100px]">
                    {transcript && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">You said</p>
                            <p className={cn("text-lg font-medium", isDark ? "text-white" : "text-slate-900")}>{transcript}</p>
                        </div>
                    )}

                    {response && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 delay-100">
                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Doctor.ai</p>
                            <p className={cn("text-lg font-medium leading-relaxed", isDark ? "text-blue-400" : "text-blue-600")}>
                                {response}
                            </p>
                        </div>
                    )}

                    {!transcript && !response && (
                        <p className="text-slate-400">Tap the microphone to start speaking</p>
                    )}
                </div>
            </div>
        </div>
    );
}
