'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Activity, ArrowRight, Loader2, Info, Phone, X } from 'lucide-react';
import LabUploadForm from '@/components/LabUploadForm';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

import { Suspense } from 'react';

function ResultsContent() {
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const router = useRouter();
    const { isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<any>(null);
    const [tests, setTests] = useState<any>(null);
    const [visitLabs, setVisitLabs] = useState<any[]>([]);

    const [error, setError] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);

    useEffect(() => {
        if (visitId) {
            const fetchResults = async () => {
                try {
                    // 1. Fetch Draft to get all data
                    const visitRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}`);
                    if (!visitRes.ok) throw new Error("Visit not found");
                    const visitData = await visitRes.json();

                    if (visitData && visitData.extracted_data && visitData.refinements) {
                        // 1.5 Fetch Labs for this visit
                        try {
                            const labsRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}/labs`);
                            if (labsRes.ok) {
                                const labsData = await labsRes.json();
                                setVisitLabs(labsData);
                            }
                        } catch (e) {
                            console.warn("Labs fetch failed", e);
                        }

                        // 2. Fetch Profile Summary & Language
                        let profileSummary = null;
                        let language = 'English';

                        if (visitData.user_id) {
                            try {
                                const profileRes = await fetch(`${API_BASE_URL}/api/users/${visitData.user_id}/profile`);
                                const profileData = await profileRes.json();
                                if (profileData && profileData.status !== 'not_found') {
                                    profileSummary = `Age: ${profileData.dob ? new Date().getFullYear() - new Date(profileData.dob).getFullYear() : 'Unknown'}, Gender: ${profileData.gender || 'Unknown'}, Conditions: ${profileData.conditions?.join(', ')}, Meds: ${profileData.medications?.join(', ')}`;
                                }

                                const userRes = await fetch(`${API_BASE_URL}/api/users/${visitData.user_id}`);
                                const userData = await userRes.json();
                                if (userData && userData.language) {
                                    language = userData.language;
                                }
                            } catch (e) {
                                console.warn("Profile fetch failed", e);
                            }
                        }

                        // 3. Predict Conditions
                        const predictRes = await fetch(`${API_BASE_URL}/api/ai/predict-conditions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                visit_id: visitId,
                                symptoms: visitData.extracted_data.symptoms,
                                refinements: visitData.refinements,
                                confirmations: visitData.confirmations,
                                profile_summary: profileSummary,
                                language: language
                            }),
                        });
                        if (!predictRes.ok) throw new Error("Prediction failed");
                        const data = await predictRes.json();
                        setResults(data);

                        // 4. Get Test Recommendations
                        try {
                            const testRes = await fetch(`${API_BASE_URL}/api/ai/recommend-tests`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    visit_id: visitId,
                                    diagnosis: data,
                                    profile_summary: profileSummary,
                                    language: language
                                }),
                            });
                            if (testRes.ok) {
                                const testData = await testRes.json();
                                setTests(testData);
                            }
                        } catch (e) {
                            console.warn("Test recommendation failed", e);
                        }
                    } else {
                        setError("Incomplete visit data. Please start over.");
                    }
                } catch (error) {
                    console.error('Error fetching results:', error);
                    setError("Failed to generate diagnosis. Please try again.");
                } finally {
                    setLoading(false);
                }
            };
            fetchResults();
        }
    }, [visitId]);

    if (loading) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className={isDark ? "text-slate-400" : "text-slate-600"}>Analyzing symptoms and clinical data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center p-8", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Analysis Failed</h2>
                    <p className={cn("mb-6", isDark ? "text-slate-400" : "text-slate-600")}>{error}</p>
                    <button onClick={() => router.push('/dashboard/intake')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
                        Start New Checkup
                    </button>
                </div>
            </div>
        );
    }

    if (!results) return null;

    // Debugging: If results exist but no conditions, show what we got
    if (results.error || !results.conditions) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center p-8", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center max-w-2xl break-words">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Unexpected Result</h2>
                    <pre className={cn("text-left p-4 rounded-lg overflow-auto max-h-96 text-xs mb-6", isDark ? "bg-black/50 text-slate-300" : "bg-slate-100 text-slate-700")}>
                        {JSON.stringify(results, null, 2)}
                    </pre>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Analysis Results</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                        Based on your symptoms{visitLabs.length > 0 ? ', profile, and lab results.' : ' and profile.'}
                    </p>
                </header>

                {/* Urgency Alert */}
                {results.urgencyLevel === 'High' && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-8 flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-red-500 text-lg">High Urgency Detected</h3>
                            <p className="text-red-400 text-sm mt-1">Please seek immediate medical attention. {results.redFlags?.join(', ')}</p>
                        </div>
                    </div>
                )}

                {/* Emergency Banner */}
                {(results?.urgencyLevel === 'High' || (results?.redFlags && results.redFlags.length > 0)) && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 p-6 rounded-2xl bg-red-600 text-white shadow-xl shadow-red-600/20 border border-red-500"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/20 rounded-full animate-pulse">
                                <AlertTriangle className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold mb-2">Emergency Warning Detected</h2>
                                <p className="text-red-100 mb-4 text-lg">
                                    Your symptoms indicate a potentially serious condition that requires immediate medical attention.
                                </p>
                                <div className="bg-black/20 p-4 rounded-xl mb-4">
                                    <h3 className="font-bold mb-2 uppercase text-xs tracking-wider opacity-80">Red Flags Identified:</h3>
                                    <ul className="list-disc list-inside space-y-1">
                                        {results.redFlags?.map((flag: string, i: number) => (
                                            <li key={i} className="font-medium">{flag}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <a href="tel:911" className="px-6 py-3 bg-white text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center gap-2">
                                        <Phone className="w-5 h-5" /> Call Emergency Services (911)
                                    </a>
                                    <button className="px-6 py-3 bg-red-700 text-white rounded-xl font-bold hover:bg-red-800 transition-colors">
                                        Find Nearest Hospital
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Diagnosis Header */}
                {/* Disclaimer */}
                <div className={cn("p-4 rounded-xl mb-8 text-sm flex items-start gap-3", isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-700")}>
                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{results.disclaimer}</p>
                </div>

                {/* Conditions */}
                <div className="space-y-6">
                    {results.conditions?.map((condition: any, idx: number) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx}
                            className={cn("p-6 rounded-2xl border overflow-hidden relative", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>{condition.name}</h3>
                                    <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2",
                                        (() => {
                                            const prob = condition.probability;
                                            if (prob === 'High') return "bg-red-500/20 text-red-500";
                                            if (prob === 'Medium') return "bg-yellow-500/20 text-yellow-500";
                                            if (prob === 'Low') return "bg-green-500/20 text-green-500";

                                            const val = parseInt(prob);
                                            if (!isNaN(val)) {
                                                if (val >= 80) return "bg-red-500/20 text-red-500";
                                                if (val >= 50) return "bg-yellow-500/20 text-yellow-500";
                                                return "bg-green-500/20 text-green-500";
                                            }
                                            return "bg-slate-500/20 text-slate-500";
                                        })()
                                    )}>
                                        {condition.probability} Match
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <Activity className="w-6 h-6 text-blue-500" />
                                </div>
                            </div>

                            <p className={cn("text-sm mb-4 leading-relaxed", isDark ? "text-slate-400" : "text-slate-600")}>
                                {condition.rationale}
                            </p>

                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs font-bold uppercase tracking-wider mb-2 text-green-500">Matching Symptoms</span>
                                    <ul className="space-y-1">
                                        {condition.matchingSymptoms?.map((s: string, i: number) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                <span className={isDark ? "text-slate-300" : "text-slate-700"}>{s}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                {condition.nonMatchingSymptoms?.length > 0 && (
                                    <div>
                                        <span className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500">Not Reported</span>
                                        <ul className="space-y-1">
                                            {condition.nonMatchingSymptoms?.map((s: string, i: number) => (
                                                <li key={i} className="flex items-center gap-2 opacity-60">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                                    <span className={isDark ? "text-slate-400" : "text-slate-600"}>{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Analyzed Lab Results */}
                {visitLabs && visitLabs.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={cn("mt-8 p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Activity className="w-5 h-5" />
                            </div>
                            <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Analyzed Clinical Data</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visitLabs.flatMap((l: any) => l.entries).map((entry: any, i: number) => (
                                <div key={i} className={cn("p-3 rounded-lg flex justify-between items-center", isDark ? "bg-white/5" : "bg-slate-50")}>
                                    <div>
                                        <span className={cn("block text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>{entry.name}</span>
                                        <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>Range: {entry.reference_range || 'N/A'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn("block font-bold", isDark ? "text-white" : "text-slate-900")}>{entry.value} <span className="text-xs font-normal opacity-70">{entry.unit}</span></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Refine Diagnosis Call-to-Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={cn("mt-8 p-6 rounded-2xl border border-dashed flex flex-col md:flex-row items-center justify-between gap-6",
                        isDark ? "bg-blue-500/5 border-blue-500/20" : "bg-blue-50 border-blue-200")}
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className={cn("text-lg font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>
                                Want a more accurate diagnosis?
                            </h3>
                            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-600")}>
                                Uploading your recent lab reports allows our AI to cross-reference your symptoms with clinical data for higher precision.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 whitespace-nowrap"
                    >
                        Upload Lab Report
                    </button>
                </motion.div>

                {/* Recommended Tests */}
                {tests && tests.tests && (
                    <div className="mt-12">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>Recommended Tests</h2>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                            >
                                Upload Results
                            </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {tests.tests.map((test: any, idx: number) => (
                                <div key={idx} className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{test.name}</h3>
                                        {test.urgency === 'High' && (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-500">Urgent</span>
                                        )}
                                    </div>
                                    <p className={cn("text-sm mb-4", isDark ? "text-slate-400" : "text-slate-600")}>{test.purpose}</p>

                                    <div className="space-y-2 text-xs">
                                        <div className={cn("p-3 rounded-lg", isDark ? "bg-white/5" : "bg-slate-50")}>
                                            <span className="font-bold block mb-1">What it measures:</span>
                                            <span className={isDark ? "text-slate-300" : "text-slate-700"}>{test.whatItMeasures}</span>
                                        </div>
                                        {test.prepInstructions && (
                                            <div className={cn("p-3 rounded-lg", isDark ? "bg-white/5" : "bg-slate-50")}>
                                                <span className="font-bold block mb-1">Preparation:</span>
                                                <span className={isDark ? "text-slate-300" : "text-slate-700"}>{test.prepInstructions}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className={cn("text-xs mt-4 italic opacity-70", isDark ? "text-slate-500" : "text-slate-400")}>{tests.disclaimer}</p>
                    </div>
                )}

                <div className="flex justify-center pt-12 pb-20 gap-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                            isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                        )}
                    >
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => router.push(`/dashboard/plan?visitId=${visitId}`)}
                        className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                            isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                        )}
                    >
                        View Health Plan <ArrowRight className="w-5 h-5" />
                    </button>
                </div>

            </div>

            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={cn("relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl", isDark ? "bg-[#0B0F19]" : "bg-white")}>
                        <button
                            onClick={() => setShowUploadModal(false)}
                            className={cn("absolute top-4 right-4 p-2 rounded-full transition-colors z-10", isDark ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 text-slate-900")}
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="p-8">
                            <h2 className={cn("text-2xl font-bold mb-6", isDark ? "text-white" : "text-slate-900")}>Upload Lab Results</h2>
                            <LabUploadForm
                                visitId={visitId!}
                                onSuccess={() => {
                                    setShowUploadModal(false);
                                    window.location.reload();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ResultsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResultsContent />
        </Suspense>
    );
}
