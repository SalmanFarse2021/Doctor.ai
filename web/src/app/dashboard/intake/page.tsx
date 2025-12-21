'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, Clock, Activity, User, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

function IntakeContent() {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const [loading, setLoading] = useState(false);

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
                            language: userData.language || 'English'
                        }));
                    } else if (userData) {
                        setFormData(prev => ({ ...prev, language: userData.language || 'English' }));
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

            const res = await fetch(`${API_BASE_URL}/api/visits/draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: uid,
                    symptoms: formData.symptoms,
                    duration: formData.duration,
                    severity: formData.severity,
                    age: parseInt(formData.age) || null,
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

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-2xl mx-auto">
                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Symptom Intake</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Describe your symptoms to start a new checkup.</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Symptoms */}
                    <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <FileText className="w-5 h-5 text-blue-500" />
                            What are your symptoms?
                        </h2>
                        <textarea
                            name="symptoms"
                            value={formData.symptoms}
                            onChange={handleChange}
                            placeholder="E.g., I have a throbbing headache on the right side and nausea..."
                            className={cn("w-full h-40 p-4 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                            )}
                            required
                        />
                    </section>

                    {/* Details */}
                    <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <Clock className="w-5 h-5 text-purple-500" />
                            Details
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Duration</label>
                                <select
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    <option value="Less than 24 hours">Less than 24 hours</option>
                                    <option value="1-2 days">1-2 days</option>
                                    <option value="3-7 days">3-7 days</option>
                                    <option value="1-2 weeks">1-2 weeks</option>
                                    <option value="More than 2 weeks">More than 2 weeks</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Severity (1-10)</label>
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
                            About You
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Age</label>
                                <input
                                    type="number"
                                    name="age"
                                    value={formData.age}
                                    onChange={handleChange}
                                    placeholder="Age"
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Gender</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
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
                            Back
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
                                <>Saving...</>
                            ) : (
                                <>
                                    Continue
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
