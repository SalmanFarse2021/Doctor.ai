'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, HelpCircle, ArrowRight, Loader2, Stethoscope, ArrowLeft } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { Suspense } from 'react';

const translations = {
    English: {
        loadingInitial: "Preparing verification questions...",
        loadingResult: "Finalizing your results...",
        errorTitle: "Something went wrong",
        errorBtn: "Start Over",
        title: "One Last Check",
        subtitle: "We found some potential matches. Please verify if you have any of these other symptoms.",
        possible: "Possible: ",
        experience: "Do you also experience:",
        yes: "Yes",
        no: "No",
        unsure: "Unsure",
        backBtn: "Back",
        processingBtn: "Finalizing...",
        analyzeBtn: "See Diagnosis"
    },
    Bengali: {
        loadingInitial: "যাচাইকরণ প্রশ্নাবলী প্রস্তুত করা হচ্ছে...",
        loadingResult: "ফলাফল প্রস্তুত করা হচ্ছে...",
        errorTitle: "কিছু একটা ভুল হয়েছে",
        errorBtn: "আবার শুরু করুন",
        title: "শেষবার যাচাই করুন",
        subtitle: "আমরা কিছু সম্ভাব্য মিল পেয়েছি। অনুগ্রহ করে নিশ্চিত করুন আপনার এই অন্যান্য লক্ষণগুলির কোনটি আছে কিনা।",
        possible: "সম্ভাব্য: ",
        experience: "আপনার কি এ বিষয়ে অভিজ্ঞতা আছে:",
        yes: "হ্যাঁ",
        no: "না",
        unsure: "নিশ্চিত নই",
        backBtn: "ফিরে যান",
        processingBtn: "প্রসেস করা হচ্ছে...",
        analyzeBtn: "রোগ নির্ণয় দেখুন"
    }
};

function ConfirmContent() {
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const router = useRouter();
    const { isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [conditions, setConditions] = useState<any[]>([]);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [visitData, setVisitData] = useState<any>(null);
    const [profileSummary, setProfileSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState('English');

    useEffect(() => {
        if (visitId) {
            const fetchInitialPrediction = async () => {
                try {
                    // 1. Fetch Draft to get all data
                    const visitRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}`);
                    if (!visitRes.ok) throw new Error("Visit not found");
                    const data = await visitRes.json();
                    setVisitData(data);

                    if (data && data.extracted_data && data.refinements) {
                        // 2. Fetch Profile Summary
                        let summary = null;
                        if (data.user_id) {
                            try {
                                const profileRes = await fetch(`${API_BASE_URL}/api/users/${data.user_id}/profile`);
                                const profileData = await profileRes.json();
                                if (profileData && profileData.status !== 'not_found') {
                                    summary = `Age: ${profileData.dob ? new Date().getFullYear() - new Date(profileData.dob).getFullYear() : 'Unknown'}, Gender: ${profileData.gender || 'Unknown'}, Conditions: ${profileData.conditions?.join(', ')}, Meds: ${profileData.medications?.join(', ')}`;
                                    setProfileSummary(summary);
                                }
                            } catch (e) {
                                console.warn("Profile fetch failed", e);
                            }
                        }
                        // Fetch Language from local storage
                        let currentLang = 'English';
                        const savedLang = localStorage.getItem('checkup-language');
                        if (savedLang && (savedLang === 'English' || savedLang === 'Bengali')) {
                            currentLang = savedLang;
                        }
                        setLanguage(currentLang);

                        // 3. Get Initial Prediction (to find missing symptoms)
                        const predictRes = await fetch(`${API_BASE_URL}/api/ai/predict-conditions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                visit_id: visitId,
                                symptoms: data.extracted_data.symptoms,
                                refinements: data.refinements,
                                profile_summary: summary,
                                language: currentLang
                            }),
                        });
                        if (!predictRes.ok) throw new Error("Prediction failed");
                        const prediction = await predictRes.json();

                        if (prediction.conditions) {
                            // Filter conditions that have non-matching symptoms to ask about
                            const relevantConditions = prediction.conditions.filter((c: any) => c.nonMatchingSymptoms && c.nonMatchingSymptoms.length > 0).slice(0, 3);
                            setConditions(relevantConditions);

                            // If no additional questions, skip to results
                            if (relevantConditions.length === 0) {
                                console.log("No questions, redirecting...");
                                router.push(`/dashboard/results?visitId=${visitId}`);
                            }
                        } else {
                            // No conditions returned? Redirect to results anyway (maybe it shows general info)
                            router.push(`/dashboard/results?visitId=${visitId}`);
                        }
                    } else {
                        setError("Incomplete visit data. Please start over.");
                    }
                } catch (error) {
                    console.error('Error fetching confirmation data:', error);
                    setError("Failed to load checkup data.");
                } finally {
                    setLoading(false);
                }
            };
            fetchInitialPrediction();
        }
    }, [visitId]);

    const handleSelect = (conditionName: string, symptom: string, value: string) => {
        setSelections(prev => ({ ...prev, [`${conditionName}|${symptom}`]: value }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // Format confirmations
            const confirmationsList = Object.entries(selections).map(([key, status]) => {
                const [condition, symptom] = key.split('|');
                return { condition, symptom, status };
            });

            // Call predict-conditions to finalize and save
            const res = await fetch(`${API_BASE_URL}/api/ai/predict-conditions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visit_id: visitId,
                    symptoms: visitData.extracted_data.symptoms,
                    refinements: visitData.refinements,
                    confirmations: confirmationsList,
                    profile_summary: profileSummary,
                    language: language
                }),
            });

            if (!res.ok) throw new Error("Prediction failed");

            // Navigate to results
            router.push(`/dashboard/results?visitId=${visitId}`);
        } catch (error) {
            console.error("Error submitting confirmations:", error);
            setError("Failed to submit. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const t = translations[language as keyof typeof translations] || translations.English;

    if (loading) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className={isDark ? "text-slate-400" : "text-slate-600"}>{t.loadingInitial}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center p-8", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center max-w-md">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>{t.errorTitle}</h2>
                    <p className={cn("mb-6", isDark ? "text-slate-400" : "text-slate-600")}>{error}</p>
                    <button onClick={() => router.push('/dashboard/intake')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
                        {t.errorBtn}
                    </button>
                </div>
            </div>
        );
    }

    if (conditions.length === 0) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className={isDark ? "text-slate-400" : "text-slate-600"}>{t.loadingResult}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-3xl mx-auto">
                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>{t.title}</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{t.subtitle}</p>
                </header>

                <div className="space-y-8">
                    {conditions.map((condition, idx) => (
                        <section key={idx} className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-2 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <Stethoscope className="w-5 h-5 text-purple-500" />
                                {t.possible} {condition.name}
                            </h2>
                            <p className={cn("text-sm mb-4", isDark ? "text-slate-400" : "text-slate-500")}>
                                {t.experience}
                            </p>
                            <div className="space-y-4">
                                {condition.nonMatchingSymptoms.map((symptom: string) => (
                                    <div key={symptom} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <span className="font-medium">{symptom}</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSelect(condition.name, symptom, 'Yes')}
                                                className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                                                    selections[`${condition.name}|${symptom}`] === 'Yes'
                                                        ? "bg-green-500/20 text-green-500 ring-1 ring-green-500"
                                                        : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> {t.yes}
                                            </button>
                                            <button
                                                onClick={() => handleSelect(condition.name, symptom, 'No')}
                                                className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                                                    selections[`${condition.name}|${symptom}`] === 'No'
                                                        ? "bg-red-500/20 text-red-500 ring-1 ring-red-500"
                                                        : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <XCircle className="w-4 h-4" /> {t.no}
                                            </button>
                                            <button
                                                onClick={() => handleSelect(condition.name, symptom, 'Unsure')}
                                                className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                                                    selections[`${condition.name}|${symptom}`] === 'Unsure'
                                                        ? "bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500"
                                                        : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <HelpCircle className="w-4 h-4" /> {t.unsure}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="flex justify-between pt-8 pb-20">
                    <button
                        onClick={() => router.push(`/dashboard/intake/refine?visitId=${visitId}`)}
                        className={cn("px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2",
                            isDark ? "bg-white/5 hover:bg-white/10 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        )}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        {t.backBtn}
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={cn("px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center gap-2",
                            isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
                            submitting && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {submitting ? (
                            <>{t.processingBtn}</>
                        ) : (
                            <>
                                {t.analyzeBtn}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default function ConfirmPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ConfirmContent />
        </Suspense>
    );
}
