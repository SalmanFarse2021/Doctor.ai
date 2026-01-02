/* eslint-disable react/no-unescaped-entities */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Mic, MicOff, Volume2, VolumeX, Square, Play, ArrowRight, Activity, AlertTriangle, Stethoscope } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';

export default function VoiceDoctorPage() {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const router = useRouter();

    // State/* eslint-disable react/no-unescaped-entities */

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isConversationMode, setIsConversationMode] = useState(false); // New state for continuous loop
    const [isProcessing, setIsProcessing] = useState(false); // Transcribing or Analyzing
    const [isPlaying, setIsPlaying] = useState(false);

    // Conversation State
    const [transcript, setTranscript] = useState('');
    const [lastReply, setLastReply] = useState('Hello, I am Doctor.ai. Describe your symptoms to start.');
    const [suggestedSymptoms, setSuggestedSymptoms] = useState<any[]>([]); // {label, key}
    const [redFlags, setRedFlags] = useState<string[]>([]);
    const [stage, setStage] = useState('INTAKE');

    // Audio Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const recognitionRef = useRef<any>(null); // For interruption detection
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Initialize Session
    useEffect(() => {
        if (session?.user && !sessionId) {
            createSession();
        }
    }, [session]);

    const createSession = async () => {
        try {
            const uid = (session?.user as any).id || session?.user?.email;
            const res = await fetch(`${API_BASE_URL}/api/voice/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid })
            });
            const data = await res.json();
            if (data.session_id) {
                setSessionId(data.session_id);
                // Speak welcome message
                // speak(lastReply); // Auto-start? Maybe not to avoid noise
            }
        } catch (e) {
            console.error("Failed to create session", e);
        }
    };

    const handleNewCheckup = async () => {
        // 1. Stop everything
        setIsConversationMode(false);
        stopRecording();
        setIsPlaying(false);

        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
        }

        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch (e) { }
            audioContextRef.current = null;
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // 2. Reset State
        setTranscript('');
        setLastReply('Hello, I am Doctor.ai. Describe your symptoms to start.');
        setSuggestedSymptoms([]);
        setRedFlags([]);
        setStage('INTAKE');
        setSessionId(null);

        // 3. Create New Session
        await createSession();
    };

    // --- Recording Logic ---

    // Safely stop all tracks
    const stopAudioContext = () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try { audioContextRef.current.close(); } catch (e) { }
            audioContextRef.current = null;
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    const stopMediaTracks = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        stopAudioContext();
    };

    const startRecording = async () => {
        try {
            stopMediaTracks(); // Ensure cleanup

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); // Fallback checked by browser usually
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };


            // --- Silence Detection Setup ---
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceRef.current = source;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            let hasSpoken = false;
            let silenceStart = Date.now();
            const silenceThreshold = 15; // Low volume threshold
            const silenceDuration = 2000; // 2 seconds of silence to stop

            const checkSilence = () => {
                if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;

                if (average > silenceThreshold) {
                    hasSpoken = true;
                    silenceStart = Date.now(); // Reset silence calculation
                } else if (hasSpoken) {
                    // Check if silence duration exceeded
                    if (Date.now() - silenceStart > silenceDuration) {
                        console.log("Silence detected, stopping recording...");
                        stopRecording();
                        return;
                    }
                }
                requestAnimationFrame(checkSilence);
            }


            mediaRecorder.onstop = async () => {
                stopAudioContext();
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                // If we are in conversation mode and just stopped to process, we upload.
                // If user manually stopped, we might still upload? 
                // Let's assume onstop always uploads for now.
                if (chunksRef.current.length > 0) {
                    await handleAudioUpload(audioBlob);
                }
                stopMediaTracks(); // Ensures stream actually stops
            };

            mediaRecorder.start();
            setIsRecording(true);
            setTranscript('');
            checkSilence();
        } catch (err) {
            console.error("Mic permission denied", err);
            alert("Microphone permission is required.");
            setIsConversationMode(false); // Cancel mode if error
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop(); // This triggers onstop -> upload
            setIsRecording(false);
        }
    };

    const toggleRecording = () => {
        if (isConversationMode) {
            // User wants to STOP the whole conversation
            setIsConversationMode(false);
            stopRecording();
            setIsPlaying(false);
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current.currentTime = 0;
            }
        } else {
            // Start conversation
            setIsConversationMode(true);
            startRecording();
        }
    };

    // --- Processing Logic ---

    const handleAudioUpload = async (audioBlob: Blob) => {
        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'voice.webm');

            // 1. Transcribe
            const transRes = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
                method: 'POST',
                body: formData
            });
            const transData = await transRes.json();

            if (transData.text) {
                setTranscript(transData.text);
                await analyzeText(transData.text);
            }
        } catch (e) {
            console.error("Error processing audio", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const analyzeText = async (text: string) => {
        if (!sessionId) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/voice/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, text })
            });
            const data = await res.json();

            if (data.reply) {
                setLastReply(data.reply);
                setSuggestedSymptoms(data.suggestedSymptoms || []);
                setRedFlags(data.redFlags || []);
                setStage(data.stage);

                // Speak the reply
                await speak(data.reply);
            }
        } catch (e) {
            console.error("Analysis failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSymptomClick = async (symptom: string, answer: 'Yes' | 'No' | 'Not Sure') => {
        let text = "";
        if (answer === 'Yes') text = `Yes, I have ${symptom}.`;
        else if (answer === 'No') text = `No, I don't have ${symptom}.`;
        else text = `I am not sure if I have ${symptom}.`;

        setTranscript(text); // Show what was "said"
        await analyzeText(text);
    };

    // --- TTS Logic ---

    const speak = async (text: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/voice/speak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                if (audioPlayerRef.current) {
                    audioPlayerRef.current.src = url;
                    audioPlayerRef.current.play();
                    setIsPlaying(true);

                    audioPlayerRef.current.onended = () => {
                        setIsPlaying(false);
                        URL.revokeObjectURL(url);

                        // Explicitly trigger next turn
                        if (isConversationMode) {
                            setTimeout(() => {
                                if (!isRecording && !isProcessing) {
                                    startRecording();
                                }
                            }, 500);
                        }
                    };
                }
            }
        } catch (e) {
            console.error("TTS failed", e);
            // Fallback to browser TTS?
            const u = new SpeechSynthesisUtterance(text);
            u.onend = () => {
                // Trigger loop same way
                setIsPlaying(false);
                if (isConversationMode) {
                    startRecording();
                }
            };
            window.speechSynthesis.speak(u);
            setIsPlaying(true);
        }
    };

    // --- Interruption Logic ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;

                recognition.onstart = () => {
                    console.log("VAD Active");
                };

                recognition.onresult = (event: any) => {
                    // If we detect speech while playing, STOP playing and START recording for real
                    if (isPlaying) {
                        console.log("Interruption detected!");
                        if (audioPlayerRef.current) {
                            audioPlayerRef.current.pause();
                            audioPlayerRef.current.currentTime = 0;
                        }
                        setIsPlaying(false);
                        // The loop effect will catch !isPlaying and startRecording, 
                        // but to be faster we can trigger it here or let the effect handle it.
                        // Let's rely on the effect for consistency, but we need to ensure isConversationMode is true.
                    }
                };

                recognitionRef.current = recognition;
            }
        }
    }, [isPlaying]); // Re-bind if needed, or just one off? simpler to bind once but enable/disable

    // Monitor Playback for Interruption
    useEffect(() => {
        if (isPlaying && isConversationMode && recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) { /* ignore already started */ }
        } else {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        }
    }, [isPlaying, isConversationMode]);

    // Auto-restart recording loop (Wait for TTS to finish OR Interruption)
    useEffect(() => {
        if (!isPlaying && !isRecording && !isProcessing && isConversationMode) {
            // Delay slightly to avoid picking up echo?
            // If interrupted, we want 0 delay? 
            const delay = 500;
            const timer = setTimeout(() => {
                startRecording();
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isPlaying, isRecording, isProcessing, isConversationMode]);

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500 flex flex-col items-center", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>

            {/* Header */}
            <div className="w-full max-w-3xl flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Stethoscope className="w-6 h-6 text-blue-500" />
                    </div>
                </div>
                <h1 className="text-xl font-bold">Voice Doctor</h1>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleNewCheckup}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                        isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
                    )}
                >
                    New Checkup
                </button>
                {redFlags.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-full animate-pulse border border-red-500/20">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-semibold">Risk Signal Detected</span>
                    </div>
                )}
            </div>


            {/* Main Interface */}
            <div className="flex-1 w-full max-w-2xl flex flex-col justify-center items-center gap-12 min-h-[60vh]">

                {/* Visualizer Circle */}
                <div className="relative">
                    {/* Ripple Effects */}
                    {(isRecording || isPlaying || isProcessing) && (
                        <>
                            <div className={cn("absolute inset-0 rounded-full opacity-20 animate-ping",
                                isRecording ? "bg-red-500" : isPlaying ? "bg-blue-500" : "bg-yellow-500"
                            )} />
                            <div className={cn("absolute -inset-4 rounded-full opacity-10 animate-pulse",
                                isRecording ? "bg-red-500" : isPlaying ? "bg-blue-500" : "bg-yellow-500"
                            )} />
                        </>
                    )}

                    <button
                        onClick={toggleRecording}
                        className={cn("relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl",
                            isConversationMode ? (
                                isRecording ? "bg-red-500 scale-110 shadow-red-500/50" :
                                    isProcessing ? "bg-yellow-500 animate-pulse shadow-yellow-500/50" :
                                        isPlaying ? "bg-blue-500 animate-pulse shadow-blue-500/50" : "bg-green-500"
                            ) : "bg-white dark:bg-slate-800 hover:scale-105"
                        )}
                    >
                        {isConversationMode ? (
                            isRecording ? <Square className="w-12 h-12 text-white fill-current" /> :
                                <Activity className="w-12 h-12 text-white animate-spin" />
                        ) : (
                            <Mic className={cn("w-12 h-12", isDark ? "text-slate-200" : "text-slate-700")} />
                        )}
                    </button>
                </div>
                {/* Reset Button */}
                {isConversationMode && (
                    <button
                        onClick={handleNewCheckup}
                        className="mt-4 px-6 py-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-red-100 hover:text-red-500 hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <VolumeX className="w-4 h-4" />
                        Stop & Start New Checkup
                    </button>
                )}

                {/* Status Text */}
                <div className="text-center space-y-2 h-24">
                    <p className="text-sm font-medium uppercase tracking-widest opacity-50">
                        {isConversationMode ? (
                            isRecording ? "Listening..." : isProcessing ? "Thinking..." : isPlaying ? "Speaking..." : "Active"
                        ) : "Tap to Start Conversation"}
                    </p>

                    {transcript && (
                        <p className={cn("text-lg font-medium max-w-lg mx-auto transition-all", isRecording ? "opacity-100" : "opacity-60")}>
                            {`"${transcript}"`}
                        </p>
                    )}
                </div>

                {/* Assistant Bubble */}
                {lastReply && (
                    <div className={cn("w-full p-6 rounded-3xl backdrop-blur-sm border shadow-sm transition-all animate-in slide-in-from-bottom-4",
                        isDark ? "bg-slate-900/50 border-white/10" : "bg-white/80 border-slate-200"
                    )}>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <p className="text-lg leading-relaxed">{lastReply}</p>

                                {/* Follow-up Suggestions */}
                                {suggestedSymptoms.length > 0 && (
                                    <div className="pt-4 space-y-3">
                                        <p className="text-sm font-medium opacity-50 uppercase tracking-wider">Related checks</p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestedSymptoms.map((sym, idx) => (
                                                <div key={idx} className={cn("flex items-center gap-1 p-1 pr-3 rounded-full border transition-colors",
                                                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                                                )}>
                                                    <span className="px-3 py-1 font-medium">{sym.label}</span>
                                                    <div className="flex gap-1 ml-2 border-l pl-2 dark:border-slate-700">
                                                        <button onClick={() => handleSymptomClick(sym.label, 'Yes')} className="p-1 hover:text-green-500 hover:bg-green-500/10 rounded"><span className="text-xs font-bold">YES</span></button>
                                                        <button onClick={() => handleSymptomClick(sym.label, 'No')} className="p-1 hover:text-red-500 hover:bg-red-500/10 rounded"><span className="text-xs font-bold">NO</span></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <audio ref={audioPlayerRef} className="hidden" />
        </div >
    );
}
