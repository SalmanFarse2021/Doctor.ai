'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, Clock, Activity, User, ArrowRight, AlertCircle, ArrowLeft, Globe, Mic, Square } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const convertBengaliToEnglishNumbers = (str: string) => {
    const bengaliNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return str?.replace(/[০-৯]/g, (match) => bengaliNumbers.indexOf(match).toString()) || '';
};

const translations = {
    English: {
        title: "Symptom Intake",
        subtitle: "Describe your symptoms and start a new checkup.",
        symptomsTitle: "What are your symptoms?",
        symptomsPlaceholder: "e.g. I have a severe headache on my right side and feel nauseous...",
        detailsTitle: "Details",
        durationLabel: "Duration (How long?)",
        durationOptions: {
            "Less than 24 hours": "Less than 24 hours",
            "1-2 days": "1-2 days",
            "3-7 days": "3-7 days",
            "1-2 weeks": "1-2 weeks",
            "More than 2 weeks": "More than 2 weeks"
        },
        severityLabel: "Severity (1-10)",
        aboutYouTitle: "About You",
        ageLabel: "Age",
        agePlaceholder: "Age",
        genderLabel: "Gender",
        genderOptions: {
            "": "Select",
            "Male": "Male",
            "Female": "Female",
            "Other": "Other"
        },
        backBtn: "Back",
        savingBtn: "Saving...",
        continueBtn: "Continue"
    },
    Bengali: {
        title: "লক্ষণ ইনটেক (নতুন চেকআপ)",
        subtitle: "আপনার লক্ষণগুলি বর্ণনা করুন এবং একটি নতুন চেকআপ শুরু করুন।",
        symptomsTitle: "আপনার লক্ষণগুলি কী কী?",
        symptomsPlaceholder: "যেমন: আমার ডান দিকে প্রচণ্ড মাথাব্যথা এবং বমি বমি ভাব আছে...",
        detailsTitle: "বিস্তারিত",
        durationLabel: "সময়কাল (কত দিন ধরে?)",
        durationOptions: {
            "Less than 24 hours": "২৪ ঘণ্টারও কম",
            "1-2 days": "১-২ দিন",
            "3-7 days": "৩-৭ দিন",
            "1-2 weeks": "১-২ সপ্তাহ",
            "More than 2 weeks": "২ সপ্তাহের বেশি"
        },
        severityLabel: "তীব্রতা (১-১০)",
        aboutYouTitle: "আপনার সম্পর্কে",
        ageLabel: "বয়স",
        agePlaceholder: "বয়স",
        genderLabel: "লিঙ্গ",
        genderOptions: {
            "": "নির্বাচন করুন",
            "Male": "পুরুষ",
            "Female": "নারী",
            "Other": "অন্যান্য"
        },
        backBtn: "ফিরে যান",
        savingBtn: "সেভ হচ্ছে...",
        continueBtn: "চালিয়ে যান"
    }
};

function IntakeContent() {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    const [formData, setFormData] = useState({
        symptoms: '',
        duration: '1-2 days',
        severity: 5,
        age: '',
        gender: '',
        language: 'English'
    });

    // Pre-fill from existing visit if available
    useEffect(() => {
        if (visitId) {
            const fetchVisit = async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/visits/${visitId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setFormData(prev => ({
                            ...prev,
                            symptoms: data.symptoms || '',
                            duration: data.duration || '1-2 days',
                            severity: data.severity || 5,
                            age: data.age ? data.age.toString() : '',
                            gender: data.gender || '',
                            // language might not be in visit root, but usually in user profile
                        }));
                    }
                } catch (error) {
                    console.error("Error fetching visit:", error);
                }
            };
            fetchVisit();
        }
    }, [visitId]);

    // Load language from local storage on mount
    useEffect(() => {
        const savedLang = localStorage.getItem('checkup-language');
        if (savedLang && (savedLang === 'English' || savedLang === 'Bengali')) {
            setFormData(prev => ({ ...prev, language: savedLang }));
        }
    }, []);

    // Pre-fill age/gender from profile if available (only if not loaded from visit)
    useEffect(() => {
        if (session?.user && !visitId) {
            const fetchProfile = async () => {
                try {
                    const uid = (session?.user as any).id || session?.user?.email;
                    const res = await fetch(`${API_BASE_URL}/api/users/${uid}/profile`);
                    const data = await res.json();

                    const userRes = await fetch(`${API_BASE_URL}/api/users/${uid}`);
                    const userData = await userRes.json();

                    if (data && data.status !== 'not_found') {
                        // Calculate age from DOB if possible
                        let age = '';
                        if (data.dob) {
                            const dob = new Date(data.dob);
                            const diff_ms = Date.now() - dob.getTime();
                            const age_dt = new Date(diff_ms);
                            age = Math.abs(age_dt.getUTCFullYear() - 1970).toString();
                        }

                        setFormData(prev => ({
                            ...prev,
                            gender: data.gender || '',
                            age: age || '',
                        }));
                    } else if (userData) {
                        // User has no extended profile, just basic DB user
                        // Defaults are fine
                    }
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            };
            fetchProfile();
        }
    }, [session, visitId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.symptoms.trim()) return;

        if (!session?.user) {
            alert("You must be logged in to submit a checkup.");
            return;
        }

        setLoading(true);
        let extractionData = null;

        try {
            // 1. Extract structured symptoms using AI (Non-blocking for draft creation)
            try {
                const extractRes = await fetch(`${API_BASE_URL}/api/ai/extract-symptoms`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: formData.symptoms,
                        language: formData.language
                    }),
                });
                if (extractRes.ok) {
                    extractionData = await extractRes.json();
                    console.log('Extracted Symptoms:', extractionData);
                } else {
                    console.warn('Extraction failed with status:', extractRes.status);
                }
            } catch (extractError) {
                console.error('Symptom extraction failed, proceeding with raw text:', extractError);
            }

            // 2. Create or Update Draft Visit
            const uid = (session?.user as any).id || session?.user?.email;

            // If visitId exists, we might want to update it, but the API is /visits/draft (POST). 
            // Usually draft creation makes a new one. 
            // If we want to update, we need a PUT endpoint or logic.
            // For now, we'll create a new one to ensure fresh state, OR we can try to reuse if the backend supports it.
            // But the user wants "previous page informations must be saved".
            // If they edit symptoms, it's effectively a new analysis.
            // So creating a new draft (or overwriting) is fine, as long as the INPUTS were preserved.

            const parsedAge = parseInt(convertBengaliToEnglishNumbers(formData.age));
            const res = await fetch(`${API_BASE_URL}/api/visits/draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: uid,
                    symptoms: formData.symptoms,
                    duration: formData.duration,
                    severity: formData.severity,
                    age: isNaN(parsedAge) ? null : parsedAge,
                    gender: formData.gender,
                    extracted_data: extractionData
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("Draft creation failed:", res.status, errorText);
                throw new Error(`Failed to create draft: ${res.status} ${errorText}`);
            }

            const data = await res.json();
            console.log("Draft creation response:", data);

            if (data.visit_id) {
                console.log('Draft created, redirecting to:', `/dashboard/intake/refine?visitId=${data.visit_id}`);
                router.push(`/dashboard/intake/refine?visitId=${data.visit_id}`);
            } else {
                console.error("No visit_id returned from backend", data);
                alert("Failed to create checkup. Please try again.");
            }
        } catch (error) {
            console.error('Error processing intake:', error);
            alert("An error occurred. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;
        setFormData(prev => ({ ...prev, language: newLang }));
        localStorage.setItem('checkup-language', newLang);
        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const toggleRecording = () => {
        if (isRecording) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert(formData.language === 'Bengali' ? 'আপনার ব্রাউজার ভয়েস টাইপিং সমর্থন করে না।' : 'Your browser does not support voice typing.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = formData.language === 'Bengali' ? 'bn-BD' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        let currentTranscript = formData.symptoms;

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const newText = currentTranscript + (currentTranscript && finalTranscript ? ' ' : '') + finalTranscript;
            setFormData(prev => ({ ...prev, symptoms: newText + (interimTranscript ? ' ' + interimTranscript : '') }));

            if (finalTranscript) {
                currentTranscript = newText;
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsRecording(true);
        } catch (e) {
            console.error(e);
            setIsRecording(false);
        }
    };

    const t = translations[formData.language as keyof typeof translations] || translations.English;

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-start mb-8">
                    <header>
                        <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>{t.title}</h1>
                        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{t.subtitle}</p>
                    </header>
                    <div className="flex items-center gap-2">
                        <Globe className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-500")} />
                        <select
                            value={formData.language}
                            onChange={handleLanguageChange}
                            className={cn("text-sm p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                isDark ? "bg-[#0F1420] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                            )}
                        >
                            <option value="English">English</option>
                            <option value="Bengali">বাংলা</option>
                        </select>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Symptoms */}
                    <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <FileText className="w-5 h-5 text-blue-500" />
                            {t.symptomsTitle}
                        </h2>
                        <div className="relative">
                            <textarea
                                name="symptoms"
                                value={formData.symptoms}
                                onChange={handleChange}
                                placeholder={t.symptomsPlaceholder}
                                className={cn("w-full h-40 p-4 pb-16 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                )}
                                required
                            />
                            <button
                                type="button"
                                onClick={toggleRecording}
                                className={cn("absolute bottom-4 right-4 p-3 rounded-full flex items-center justify-center transition-all shadow-lg",
                                    isRecording
                                        ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
                                        : (isDark ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")
                                )}
                                title={isRecording ? (formData.language === 'Bengali' ? 'বলা বন্ধ করুন' : 'Stop Recording') : (formData.language === 'Bengali' ? 'কথায় টাইপ করুন' : 'Start Voice Typing')}
                            >
                                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                            </button>
                        </div>
                    </section>

                    {/* Details */}
                    <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <Clock className="w-5 h-5 text-purple-500" />
                            {t.detailsTitle}
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">{t.durationLabel}</label>
                                <select
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    {Object.entries(t.durationOptions).map(([key, value]) => (
                                        <option key={key} value={key}>{value}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">{t.severityLabel}</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        name="severity"
                                        min="1"
                                        max="10"
                                        value={formData.severity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <span className={cn("font-bold text-lg w-8 text-center", isDark ? "text-white" : "text-slate-900")}>{formData.severity}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Demographics (if not pre-filled) */}
                    <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <User className="w-5 h-5 text-green-500" />
                            {t.aboutYouTitle}
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">{t.ageLabel}</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    name="age"
                                    value={formData.age}
                                    onChange={handleChange}
                                    placeholder={t.agePlaceholder}
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">{t.genderLabel}</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    {Object.entries(t.genderOptions).map(([key, value]) => (
                                        <option key={key} value={key}>{value}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-between pt-4">
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard')}
                            className={cn("px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2",
                                isDark ? "bg-white/5 hover:bg-white/10 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                            )}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            {t.backBtn}
                        </button>

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn("px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center gap-2",
                                isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
                                loading && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {loading ? (
                                <>{t.savingBtn}</>
                            ) : (
                                <>
                                    {t.continueBtn}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default function IntakePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <IntakeContent />
        </Suspense>
    );
}
