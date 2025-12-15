'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Activity, ArrowRight, Loader2, Info, FlaskConical } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

import { Suspense } from 'react';

function LabAnalysisContent() {
    const searchParams = useSearchParams();
    const labId = searchParams.get('labId');
    const visitId = searchParams.get('visitId');
    const router = useRouter();
    const { isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState<any>(null);
    const [labData, setLabData] = useState<any>(null);

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                let labsToAnalyze = [];
                let profileSummary = null;

                // Fetch user profile for context (assuming we have a way to get current user ID or it's in the lab/visit)
                // For now, we'll skip profile fetch unless we have a user ID from the lab/visit data

                if (visitId) {
                    const visitRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}/labs`);
                    const labs = await visitRes.json();
                    labsToAnalyze = labs.flatMap((l: any) => l.entries);
                    setLabData(labs);
                } else if (labId) {
                    const labRes = await fetch(`${API_BASE_URL}/api/labs/${labId}`);
                    const lab = await labRes.json();
                    if (lab && lab.entries) {
                        labsToAnalyze = lab.entries;
                        setLabData([lab]);
                    }
                }

                // Fetch Language
                let language = 'English';
                // Try to find user_id from visit or lab data
                let userId = null;
                if (visitId) {
                    const visitRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}`);
                    const visitData = await visitRes.json();
                    userId = visitData.user_id;
                } else if (labData && labData[0]) {
                    userId = labData[0].user_id;
                }

                if (userId) {
                    const userRes = await fetch(`${API_BASE_URL}/api/users/${userId}`);
                    const userData = await userRes.json();
                    if (userData && userData.language) {
                        language = userData.language;
                    }
                }
                if (labsToAnalyze.length > 0) {
                    const interpretRes = await fetch(`${API_BASE_URL}/api/ai/interpret-labs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            lab_results: labsToAnalyze,
                            profile_summary: profileSummary, // Add if available
                            language: language
                        }),
                    });
                    const data = await interpretRes.json();
                    setAnalysis(data);
                }
            } catch (error) {
                console.error('Error analyzing labs:', error);
            } finally {
                setLoading(false);
            }
        };

        if (visitId || labId) {
            fetchAnalysis();
        }
    }, [visitId, labId]);

    if (loading) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className={isDark ? "text-slate-400" : "text-slate-600"}>Analyzing lab results...</p>
                </div>
            </div>
        );
    }

    if (!analysis) return (
        <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
            <p className={isDark ? "text-slate-400" : "text-slate-600"}>No lab data found to analyze.</p>
        </div>
    );

    return (
        <div className={cn("min-h-screen p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Lab Analysis</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>AI interpretation of your recent test results.</p>
                </header>

                {/* Summary */}
                <div className={cn("p-6 rounded-2xl border mb-8", isDark ? "bg-blue-900/10 border-blue-500/20" : "bg-blue-50 border-blue-200")}>
                    <div className="flex items-start gap-3">
                        <FlaskConical className="w-6 h-6 text-blue-500 shrink-0 mt-1" />
                        <div>
                            <h3 className={cn("text-lg font-bold mb-2", isDark ? "text-blue-400" : "text-blue-700")}>Summary</h3>
                            <p className={cn("leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>{analysis.summary}</p>
                        </div>
                    </div>
                </div>

                {/* Risk Signals */}
                {analysis.riskSignals && analysis.riskSignals.length > 0 && (
                    <div className="mb-8">
                        <h3 className={cn("text-lg font-bold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            Risk Signals
                        </h3>
                        <div className="grid gap-4">
                            {analysis.riskSignals.map((signal: string, idx: number) => (
                                <div key={idx} className={cn("p-4 rounded-xl border flex items-center gap-3", isDark ? "bg-yellow-500/5 border-yellow-500/20" : "bg-yellow-50 border-yellow-200")}>
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <span className={isDark ? "text-slate-300" : "text-slate-700"}>{signal}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Abnormal Results */}
                <h3 className={cn("text-xl font-bold mb-6", isDark ? "text-white" : "text-slate-900")}>Detailed Findings</h3>
                <div className="space-y-6">
                    {analysis.abnormal?.map((item: any, idx: number) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx}
                            className={cn("p-6 rounded-2xl border overflow-hidden", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{item.test}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn("text-2xl font-bold",
                                            item.flag === 'Critical' ? "text-red-500" :
                                                item.flag === 'High' ? "text-orange-500" : "text-blue-500"
                                        )}>
                                            {item.value}
                                        </span>
                                        <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase",
                                            item.flag === 'Critical' ? "bg-red-500/20 text-red-500" :
                                                item.flag === 'High' ? "bg-orange-500/20 text-orange-500" : "bg-blue-500/20 text-blue-500"
                                        )}>
                                            {item.flag}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <p className={cn("text-sm mb-4 leading-relaxed", isDark ? "text-slate-400" : "text-slate-600")}>
                                {item.meaning}
                            </p>

                            {item.questionsToAskDoctor && (
                                <div className={cn("p-4 rounded-xl text-sm", isDark ? "bg-white/5" : "bg-slate-50")}>
                                    <span className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Ask your doctor:</span>
                                    <ul className="space-y-1 list-disc list-inside">
                                        {item.questionsToAskDoctor.map((q: string, i: number) => (
                                            <li key={i} className={isDark ? "text-slate-300" : "text-slate-700"}>{q}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </motion.div>
                    ))}
                    {(!analysis.abnormal || analysis.abnormal.length === 0) && (
                        <div className={cn("p-8 text-center rounded-2xl border border-dashed", isDark ? "border-white/10" : "border-slate-300")}>
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <h3 className={cn("text-lg font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>All Normal</h3>
                            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>No abnormal results were detected in this panel.</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-center pt-12 pb-20">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                            isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                        )}
                    >
                        Back to Dashboard
                    </button>
                </div>

            </div>
        </div>
    );
}

export default function LabAnalysisPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LabAnalysisContent />
        </Suspense>
    );
}
