'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Activity, ArrowRight, Loader2, Info, Heart,
    Utensils, Moon, Droplets, Calendar, AlertTriangle, Pill, ChevronDown, Shield
} from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from 'next-auth/react';

import { Suspense } from 'react';

function HealthPlanContent() {
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const router = useRouter();
    const { data: session } = useSession();
    const { isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<any>(null);
    const [expandedMeds, setExpandedMeds] = useState<Record<number, boolean>>({});

    const toggleMed = (idx: number) => {
        setExpandedMeds(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                if (!visitId) return;

                // 1. Fetch Visit Data (Diagnosis + Labs)
                const visitRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}`);
                const visitData = await visitRes.json();

                // 2. Fetch Labs
                const labsRes = await fetch(`${API_BASE_URL}/api/visits/${visitId}/labs`);
                const labsData = await labsRes.json();
                const labs = labsData.flatMap((l: any) => l.entries);

                // 3. Fetch Profile Summary
                let profileSummary = null;
                if (visitData.user_id) {
                    const profileRes = await fetch(`${API_BASE_URL}/api/users/${visitData.user_id}/profile`);
                    const profileData = await profileRes.json();
                    if (profileData && profileData.status !== 'not_found') {
                        profileSummary = `Age: ${profileData.dob ? new Date().getFullYear() - new Date(profileData.dob).getFullYear() : 'Unknown'}, Gender: ${profileData.gender || 'Unknown'}, Conditions: ${profileData.conditions?.join(', ')}, Meds: ${profileData.medications?.join(', ')}`;
                    }
                }

                // 4. Generate Plan
                const uid = (session?.user as any)?.id || session?.user?.email;
                const planRes = await fetch(`${API_BASE_URL}/api/ai/generate-plan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visit_id: visitId,
                        user_id: uid,
                        diagnosis: visitData.diagnosis,
                        symptoms: visitData.extracted_data?.symptoms || visitData.symptoms,
                        labs: labs,
                        profile_summary: profileSummary
                    }),
                });
                const planData = await planRes.json();
                setPlan(planData);

            } catch (error) {
                console.error('Error generating plan:', error);
            } finally {
                setLoading(false);
            }
        };

        if (visitId && session) {
            fetchPlan();
        }
    }, [visitId, session]);

    if (loading) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className={isDark ? "text-slate-400" : "text-slate-600"}>Designing your personalized health plan...</p>
                </div>
            </div>
        );
    }

    if (!plan) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center p-8", isDark ? "bg-[#0B0F19]" : "bg-slate-50")}>
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Unable to Load Plan</h2>
                    <p className={cn("mb-6", isDark ? "text-slate-400" : "text-slate-600")}>
                        We couldn't generate your health plan at this time. Please try again.
                    </p>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Your Health Plan</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>A personalized roadmap to better health.</p>
                </header>

                {/* Warnings */}
                {plan.warnings && plan.warnings.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-8 flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-red-500 text-lg">Important Warnings</h3>
                            <ul className="list-disc list-inside text-red-400 text-sm mt-1">
                                {plan.warnings.map((w: string, i: number) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Diet */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                <Utensils className="w-5 h-5" />
                            </div>
                            <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Nutrition</h2>
                        </div>
                        <ul className="space-y-3">
                            {plan.diet?.map((item: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                    <span className={isDark ? "text-slate-300" : "text-slate-600"}>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.section>

                    {/* Lifestyle */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Moon className="w-5 h-5" />
                            </div>
                            <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Lifestyle</h2>
                        </div>
                        <ul className="space-y-3">
                            {plan.lifestyle?.map((item: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                    <span className={isDark ? "text-slate-300" : "text-slate-600"}>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.section>

                    {/* Hydration */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Droplets className="w-5 h-5" />
                            </div>
                            <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Hydration</h2>
                        </div>
                        <ul className="space-y-3">
                            {Array.isArray(plan.hydration) ? (
                                plan.hydration.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        <span className={isDark ? "text-slate-300" : "text-slate-600"}>{item}</span>
                                    </li>
                                ))
                            ) : (
                                <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
                                    {plan.hydration}
                                </p>
                            )}
                        </ul>
                    </motion.section>

                    {/* Daily Tracking */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Daily Tracking</h2>
                        </div>
                        <ul className="space-y-3">
                            {plan.daily_tracking?.map((item: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                                    <span className={isDark ? "text-slate-300" : "text-slate-600"}>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.section>
                    {/* Med Education */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className={cn("p-6 rounded-2xl border md:col-span-2", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500">
                                <Pill className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Medication Recommendations (OTC)</h2>
                                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>Educational guidance only. Consult a doctor before use.</p>
                            </div>
                        </div>

                        {/* Critical Test Warning */}
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl mb-6 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                            <p className={cn("text-sm font-medium", isDark ? "text-yellow-400" : "text-yellow-700")}>
                                This website is under Test. Please consult with a Doctor before using any Medicine.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {plan.med_education?.map((med: any, i: number) => (
                                <div key={i} className={cn("rounded-xl border overflow-hidden transition-all", isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                                    <div
                                        onClick={() => toggleMed(i)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <div>
                                            <h3 className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>{med.generic_name}</h3>
                                            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-600")}>{med.category}</p>
                                        </div>
                                        <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMeds[i] ? "rotate-180" : "")} />
                                    </div>

                                    {expandedMeds[i] && (
                                        <div className="p-4 pt-0 border-t border-dashed border-slate-200 dark:border-white/10 space-y-4">
                                            {/* Disclaimer */}
                                            {med.disclaimer && (
                                                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-600 dark:text-yellow-400 flex gap-2">
                                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                                    <span>This information is for educational purposes only and does not replace professional medical advice. Always consult a licensed healthcare provider before taking any medication.</span>
                                                </div>
                                            )}

                                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="block font-bold mb-1 opacity-70">Common Brand Names</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(med.brand_names || {}).map(([region, brands]: any) => (
                                                            <div key={region} className="text-xs">
                                                                <span className="font-semibold">{region}:</span> {(brands as string[]).join(", ")}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="block font-bold mb-1 opacity-70">Commonly Used For</span>
                                                    <ul className="list-disc list-inside">
                                                        {med.commonly_used_for?.map((use: string, idx: number) => (
                                                            <li key={idx}>{use}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="block font-bold mb-1 opacity-70">General Usage</span>
                                                    <p>{med.general_usage}</p>
                                                </div>
                                                <div>
                                                    <span className="block font-bold mb-1 opacity-70">How to Take</span>
                                                    <p>{med.how_to_take}</p>
                                                </div>
                                            </div>

                                            {/* Safety Section */}
                                            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 space-y-3">
                                                <h4 className="font-bold text-red-500 flex items-center gap-2">
                                                    <Shield className="w-4 h-4" /> Safety Information
                                                </h4>

                                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="block font-bold text-red-400 mb-1">Do NOT Take If:</span>
                                                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300">
                                                            {med.avoid_if?.map((item: string, idx: number) => (
                                                                <li key={idx}>{item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <span className="block font-bold text-red-400 mb-1">Emergency Signs (Stop & Call Doctor):</span>
                                                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300">
                                                            {med.emergency_signs?.map((item: string, idx: number) => (
                                                                <li key={idx}>{item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>

                                                {med.pregnancy_warning && (
                                                    <div className="text-xs font-bold text-red-500 mt-2">
                                                        ⚠️ Pregnancy/Chronic Disease Warning: Consult a doctor before use.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.section>
                </div>

                <div className="flex justify-center gap-4 pt-12 pb-20">
                    <button
                        onClick={() => router.back()}
                        className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 border",
                            isDark ? "bg-transparent border-white/10 hover:bg-white/5 text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        )}
                    >
                        <ArrowRight className="w-5 h-5 rotate-180" /> Back
                    </button>
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

export default function HealthPlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <HealthPlanContent />
        </Suspense>
    );
}
