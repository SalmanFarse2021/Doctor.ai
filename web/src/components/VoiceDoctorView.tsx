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
    const [language, setLanguage] = useState<'English' | 'Bengali'>('English');
    const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'nova'>('alloy');
    const [audioQueue, setAudioQueue] = useState<{ id: string, url: string, text: string }[]>([]);
    const [currentAudioIndex, setCurrentAudioIndex] = useState(-1);
    const [caption, setCaption] = useState(''); // Full text for display
    const [isResetting, setIsResetting] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Collapsible settings
    const [showCaption, setShowCaption] = useState(true); // Toggle captions
    const [shouldStartNewSession, setShouldStartNewSession] = useState(false); // Flag for new session


    const recognitionRef = useRef<any>(null);
    const synthesisRef = useRef<any>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Refs to access latest state in closures (speech recognition callback)
    const selectedProfileIdRef = useRef(selectedProfileId);
    const shouldStartNewSessionRef = useRef(shouldStartNewSession);

    // Sync refs with state
    useEffect(() => {
        selectedProfileIdRef.current = selectedProfileId;
    }, [selectedProfileId]);

    useEffect(() => {
        shouldStartNewSessionRef.current = shouldStartNewSession;
    }, [shouldStartNewSession]);

    useEffect(() => {
        const savedLang = localStorage.getItem('voice-doctor-language');
        if (savedLang === 'Bengali' || savedLang === 'English') {
            setLanguage(savedLang);
        }

        const savedVoice = localStorage.getItem('voice-doctor-voice');
        if (savedVoice === 'alloy' || savedVoice === 'nova') {
            setSelectedVoice(savedVoice);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Initialize Speech Recognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = language === 'Bengali' ? 'bn-BD' : 'en-US';

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

            // Initialize Speech Synthesis (only once, as it doesn't depend on language for initialization)
            if ('speechSynthesis' in window && !synthesisRef.current) {
                synthesisRef.current = window.speechSynthesis;
            }
        }
    }, [language]); // Re-initialize recognition when language changes

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
        // Don't allow toggling during reset
        if (isResetting) return;

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
                    message: text,
                    profile_id: selectedProfileIdRef.current, // Use ref for latest val
                    language: language,
                    new_session: shouldStartNewSessionRef.current // Use ref for latest val
                })
            });

            // Reset the flag after sending
            if (shouldStartNewSessionRef.current) {
                setShouldStartNewSession(false);
            }

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

    const speak = async (text: string) => {
        console.log('[PREMIUM-TTS] Starting speech for:', text.substring(0, 50));

        try {
            setStatus('processing');

            // Call premium TTS API
            const response = await fetch(`${API_BASE_URL}/api/voice/speak-chunks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice: selectedVoice,
                    lang: language
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('[PREMIUM-TTS] Error:', data.error);
                setStatus('idle');
                return;
            }

            console.log(`[PREMIUM-TTS] Received ${data.chunks?.length || 0} chunks`);

            if (data.chunks && data.chunks.length > 0) {
                setCaption(data.caption || text);
                setAudioQueue(data.chunks);
                setCurrentAudioIndex(0);
            } else {
                setTranscript('');
                setResponse('');
                setCaption('');
                setStatus('idle');
                setAudioQueue([]);
                setCurrentAudioIndex(-1);

                // Stop any current audio
                if (audioPlayerRef.current) {
                    audioPlayerRef.current.pause();
                    audioPlayerRef.current.src = '';
                }

                // Flag next request as new session
                setShouldStartNewSession(true);

                setIsResetting(false);
                setCurrentAudioIndex(-1);
                setIsSpeaking(false);
                setStatus('idle');
            }

        } catch (error) {
            console.error('[PREMIUM-TTS] Error:', error);
            setStatus('idle');
        }
    };

    const stopSpeaking = () => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
        }
        setAudioQueue([]);
        setCurrentAudioIndex(-1);
        setIsSpeaking(false);
        setStatus('idle');
    };

    // Audio queue player
    useEffect(() => {
        if (currentAudioIndex >= 0 && currentAudioIndex < audioQueue.length) {
            playChunk(audioQueue[currentAudioIndex]);
        } else if (currentAudioIndex >= audioQueue.length && audioQueue.length > 0) {
            // Finished all chunks
            console.log('[AUDIO-PLAYER] Finished all chunks');
            setStatus('idle');
            setIsSpeaking(false);
            setAudioQueue([]);
            setCurrentAudioIndex(-1);

            // Auto-resume listening after AI finishes speaking
            setTimeout(() => {
                if (recognitionRef.current && !isResetting) {
                    console.log('[AUTO-LISTEN] Resuming microphone after AI response');
                    try {
                        recognitionRef.current.start();
                        setIsListening(true);
                        setStatus('listening');
                    } catch (error) {
                        console.error('[AUTO-LISTEN] Error starting recognition:', error);
                    }
                }
            }, 500); // Small delay for smooth transition
        }
    }, [currentAudioIndex, audioQueue, isResetting]);

    const playChunk = (chunk: { id: string, url: string, text: string }) => {
        console.log(`[AUDIO-PLAYER] Playing chunk: ${chunk.id}`);

        if (!audioPlayerRef.current) {
            audioPlayerRef.current = new Audio();
        }

        const audio = audioPlayerRef.current;
        audio.src = `${API_BASE_URL}${chunk.url}`;

        setStatus('speaking');
        setIsSpeaking(true);

        audio.oncanplaythrough = () => {
            audio.play().catch(e => console.error('[AUDIO-PLAYER] Play error:', e));
        };

        audio.onended = () => {
            console.log(`[AUDIO-PLAYER] Chunk ${chunk.id} ended`);
            // Pause before next chunk for natural feel
            setTimeout(() => {
                setCurrentAudioIndex(prev => prev + 1);
            }, 250);
        };

        audio.onerror = (e) => {
            console.error('[AUDIO-PLAYER] Error:', e);
            setCurrentAudioIndex(prev => prev + 1); // Skip to next
        };

        audio.load();
    };

    const handleReset = async () => {
        // Prevent multiple resets
        if (isResetting) return;

        setIsResetting(true);

        // Stop all ongoing activities
        stopSpeaking();
        if (recognitionRef.current) recognitionRef.current.stop();

        setTranscript('');
        setResponse('');
        setCaption('');
        setStatus('idle');
        setAudioQueue([]);
        setCurrentAudioIndex(-1);

        // Stop any current audio
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
        }

        // Flag next request as new session
        setShouldStartNewSession(true);

        setIsResetting(false);
        setStatus('idle');
        setIsSpeaking(false);

        // Clear conversation history on backend - WAIT for this to complete
        try {
            const uid = (session?.user as any).id || session?.user?.email;
            const params = new URLSearchParams({ user_id: uid });
            if (selectedProfileId) {
                params.append('profile_id', selectedProfileId);
            }

            console.log('[NEW CHECKUP] Clearing conversation history...');

            const response = await fetch(`${API_BASE_URL}/api/voice-chat/reset?${params.toString()}`, {
                method: 'DELETE',
            });

            const result = await response.json();
            console.log('[NEW CHECKUP] Reset result:', result);

            // Show confirmation to user
            if (result.success) {
                console.log('✓ New checkup started - conversation history cleared');
                // Wait a moment to ensure database consistency
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                console.error('Failed to reset conversation:', result);
            }
        } catch (error) {
            console.error('[NEW CHECKUP] Error clearing conversation:', error);
        } finally {
            setIsResetting(false);
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

                {/* Modern Control Panel - Top Right */}
                <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
                    {/* Collapsible Settings */}
                    <div className="relative">
                        {/* Settings Toggle Button */}
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={cn(
                                "p-3 rounded-xl transition-all duration-300 shadow-lg backdrop-blur-md border",
                                "hover:scale-105 active:scale-95 group",
                                isDark
                                    ? "bg-white/10 border-white/20 hover:bg-white/15 text-white"
                                    : "bg-white/90 border-slate-200 hover:bg-slate-50 text-slate-700"
                            )}
                        >
                            <svg
                                className={cn("w-5 h-5 transition-transform duration-300", isSettingsOpen && "rotate-90")}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>

                        {/* Dropdown Settings Panel */}
                        {isSettingsOpen && (
                            <div
                                className={cn(
                                    "absolute top-14 right-0 w-72 p-4 rounded-xl shadow-2xl backdrop-blur-md border",
                                    "animate-in slide-in-from-top-2 fade-in duration-200",
                                    isDark
                                        ? "bg-slate-900/95 border-white/10"
                                        : "bg-white/95 border-slate-200"
                                )}
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
                                            Settings
                                        </p>
                                    </div>

                                    {/* New Checkup Button */}
                                    <button
                                        onClick={(e) => {
                                            handleReset();
                                            setIsSettingsOpen(false);
                                        }}
                                        disabled={isResetting}
                                        className={cn(
                                            "w-full px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-sm border mb-4",
                                            "flex items-center justify-center gap-2 group",
                                            isResetting
                                                ? "opacity-50 cursor-not-allowed"
                                                : "hover:scale-[1.02] active:scale-[0.98]",
                                            isDark
                                                ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400 hover:from-blue-500/30 hover:to-cyan-500/30"
                                                : "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 text-blue-600 hover:from-blue-100 hover:to-cyan-100"
                                        )}
                                        title="New Checkup"
                                    >
                                        <svg className={cn("w-4 h-4 transition-transform", isResetting ? "animate-spin" : "group-hover:rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span className="truncate">{isResetting ? 'Resetting...' : 'New Checkup'}</span>
                                    </button>

                                    {/* Profile Selector */}
                                    <div className="space-y-1.5">
                                        <label className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-700")}>
                                            👤 Patient Profile
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedProfileId || ''}
                                                onChange={(e) => setSelectedProfileId(e.target.value)}
                                                className={cn(
                                                    "w-full appearance-none px-4 py-2.5 pr-10 rounded-lg text-sm font-medium cursor-pointer",
                                                    "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                    isDark
                                                        ? "bg-white/10 hover:bg-white/15 border border-white/20 text-white"
                                                        : "bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900"
                                                )}
                                            >
                                                {Array.isArray(profiles) && profiles.map(p => (
                                                    <option key={p._id} value={p._id}>{p.name} ({p.relation})</option>
                                                ))}
                                            </select>
                                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Language Selector */}
                                    <div className="space-y-1.5">
                                        <label className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-700")}>
                                            🌐 Language
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={language}
                                                onChange={(e) => {
                                                    const newLang = e.target.value as 'English' | 'Bengali';
                                                    setLanguage(newLang);
                                                    localStorage.setItem('voice-doctor-language', newLang);
                                                    if (recognitionRef.current) {
                                                        recognitionRef.current.lang = newLang === 'Bengali' ? 'bn-BD' : 'en-US';
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full appearance-none px-4 py-2.5 pr-10 rounded-lg text-sm font-medium cursor-pointer",
                                                    "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                    isDark
                                                        ? "bg-white/10 hover:bg-white/15 border border-white/20 text-white"
                                                        : "bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900"
                                                )}
                                            >
                                                <option value="English">English</option>
                                                <option value="Bengali">বাংলা (Bengali)</option>
                                            </select>
                                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Voice Selector */}
                                    <div className="space-y-1.5">
                                        <label className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-700")}>
                                            🎙️ AI Voice
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedVoice}
                                                onChange={(e) => {
                                                    const voice = e.target.value as 'alloy' | 'nova';
                                                    setSelectedVoice(voice);
                                                    localStorage.setItem('voice-doctor-voice', voice);
                                                }}
                                                className={cn(
                                                    "w-full appearance-none px-4 py-2.5 pr-10 rounded-lg text-sm font-medium cursor-pointer",
                                                    "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                    isDark
                                                        ? "bg-white/10 hover:bg-white/15 border border-white/20 text-white"
                                                        : "bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900"
                                                )}
                                            >
                                                <option value="alloy">Alloy (Neutral)</option>
                                                <option value="nova">Nova (Female)</option>
                                            </select>
                                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Separator */}
                                    <div className={cn("h-px w-full my-1", isDark ? "bg-white/10" : "bg-slate-100")} />

                                    {/* Caption Toggle Button (Bottom) */}
                                    <button
                                        onClick={() => setShowCaption(!showCaption)}
                                        className={cn(
                                            "w-full px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-sm border",
                                            "flex items-center justify-center gap-2 group",
                                            "hover:scale-[1.02] active:scale-[0.98]",
                                            showCaption
                                                ? isDark
                                                    ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                                                    : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                                : isDark
                                                    ? "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                                                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                                        )}
                                        title={showCaption ? "Hide Captions" : "Show Captions"}
                                    >
                                        {showCaption ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        )}
                                        <span>{showCaption ? 'Captions On' : 'Captions Off'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
                    {transcript && showCaption && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">You said</p>
                            <p className={cn("text-lg font-medium", isDark ? "text-white" : "text-slate-900")}>{transcript}</p>
                        </div>
                    )}

                    {(caption || response) && showCaption && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 delay-100">
                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Doctor.ai</p>
                            <p className={cn("text-lg font-medium leading-relaxed", isDark ? "text-blue-400" : "text-blue-600")}>
                                {caption || response}
                            </p>
                        </div>
                    )}

                    {!transcript && !response && (
                        <p className="text-slate-400">Tap the microphone to start speaking</p>
                    )}
                </div>
            </div>
        </div >
    );
}
