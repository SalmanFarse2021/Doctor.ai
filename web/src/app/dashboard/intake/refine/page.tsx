'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, HelpCircle, ArrowRight, Activity, Loader2, ArrowLeft } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { Suspense } from 'react';

const translations = {
    English: {
        loading: "Analyzing your symptoms...",
        title: "Refine Symptoms",
        subtitle: "Do you have any of these related symptoms? This helps improve accuracy.",
        yes: "Yes",
        no: "No",
        unsure: "Unsure",
        backBtn: "Back",
        processingBtn: "Processing...",
        analyzeBtn: "Analyze Results"
    },
    Bengali: {
        loading: "আপনার লক্ষণগুলি বিশ্লেষণ করা হচ্ছে...",
        title: "লক্ষণগুলি যাচাই করুন",
        subtitle: "আপনার কি নিচের সম্পর্কিত লক্ষণগুলি আছে? এটি আমাদের সঠিক রোগ নির্ণয়ে সাহায্য করবে।",
        yes: "হ্যাঁ",
        no: "না",
        unsure: "নিশ্চিত নই",
        backBtn: "ফিরে যান",
        processingBtn: "প্রসেস করা হচ্ছে...",
        analyzeBtn: "ফলাফল বিশ্লেষণ করুন"
    }
};

function RefineContent() {
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const router = useRouter();
    const { isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [groups, setGroups] = useState<any[]>([]);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [language, setLanguage] = useState('English');

    useEffect(() => {
        if (visitId) {
            const fetchRefinements = async () => {
                try {
                    // 1. Fetch Draft to get extracted symptoms
                    const visitRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}`);
                    const visitData = await visitRes.json();

                    if (visitData && visitData.extracted_data && visitData.extracted_data.symptoms) {
                        // Pre-fill selections if they exist
                        if (visitData.refinements && Array.isArray(visitData.refinements)) {
                            const savedSelections: Record<string, string> = {};
                            visitData.refinements.forEach((r: any) => {
                                savedSelections[r.symptom] = r.status;
                            });
                            setSelections(savedSelections);
                        }

                        // Fetch Language from local storage
                        let currentLang = 'English';
                        const savedLang = localStorage.getItem('checkup-language');
                        if (savedLang && (savedLang === 'English' || savedLang === 'Bengali')) {
                            currentLang = savedLang;
                        }
                        setLanguage(currentLang);

                        // 2. Ask AI for refinements
                        const refineRes = await fetch(`${API_BASE_URL}/api/ai/refine-symptoms`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                symptoms: visitData.extracted_data.symptoms,
                                language: currentLang
                            }),
                        });
                        const refineData = await refineRes.json();
                        if (refineData.groups) {
                            setGroups(refineData.groups);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching refinements:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchRefinements();
        }
    }, [visitId]);

    const handleSelect = (symptom: string, value: string) => {
        setSelections(prev => ({ ...prev, [symptom]: value }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // Format selections for backend
            const refinementsList = Object.entries(selections).map(([symptom, status]) => ({
                symptom,
                status
            }));

            await fetch(`${API_BASE_URL}/api/visits/${visitId}/refinements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(refinementsList),
            });

            // Navigate to Confirmation
            router.push(`/dashboard/intake/confirm?visitId=${visitId}`);
        } catch (error) {
            console.error("Error saving refinements", error);
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
                    <p className={isDark ? "text-slate-400" : "text-slate-600"}>{t.loading}</p>
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
                    {groups.map((group, idx) => (
                        <section key={idx} className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <Activity className="w-5 h-5 text-blue-500" />
                                {group.name}
                            </h2>
                            <div className="space-y-4">
                                {group.symptoms.map((symptom: string) => (
                                    <div key={symptom} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <span className="font-medium">{symptom}</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSelect(symptom, 'Yes')}
                                                className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                                                    selections[symptom] === 'Yes'
                                                        ? "bg-green-500/20 text-green-500 ring-1 ring-green-500"
                                                        : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> {t.yes}
                                            </button>
                                            <button
                                                onClick={() => handleSelect(symptom, 'No')}
                                                className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                                                    selections[symptom] === 'No'
                                                        ? "bg-red-500/20 text-red-500 ring-1 ring-red-500"
                                                        : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <XCircle className="w-4 h-4" /> {t.no}
                                            </button>
                                            <button
                                                onClick={() => handleSelect(symptom, 'Unsure')}
                                                className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                                                    selections[symptom] === 'Unsure'
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
                        onClick={() => router.push(`/dashboard/intake?visitId=${visitId}`)}
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

export default function RefinePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RefineContent />
        </Suspense>
    );
}
