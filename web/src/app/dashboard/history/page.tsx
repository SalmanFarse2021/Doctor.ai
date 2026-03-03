'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
    Calendar, FileText, ChevronRight, Clock, Activity,
    Download, Eye, FlaskConical, Stethoscope, Search, Filter, CheckCircle2, Trash2
} from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState<any[]>([]);
    const [labs, setLabs] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'checkups' | 'labs'>('checkups');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            if (!session) return;
            try {
                const uid = (session.user as any).id || session.user?.email;

                // Fetch Visits
                const visitsRes = await fetch(`${API_BASE_URL}/api/users/${uid}/visits`);
                const visitsData = await visitsRes.json();
                setVisits(visitsData);

                // Fetch Labs
                const labsRes = await fetch(`${API_BASE_URL}/api/users/${uid}/labs`);
                const labsData = await labsRes.json();
                setLabs(labsData);

            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [session]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const filteredVisits = visits.filter(visit =>
        visit.diagnosis?.conditions?.[0]?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.symptoms?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredLabs = labs.filter(lab =>
        lab.test_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lab.summary?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDeleteVisit = async (id: string) => {
        if (!confirm('Are you sure you want to delete this checkup record?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/visits/${id}`, { method: 'DELETE' });
            setVisits(prev => prev.filter(v => v._id !== id));
        } catch (error) {
            console.error('Error deleting visit:', error);
        }
    };

    const handleDeleteLab = async (id: string) => {
        if (!confirm('Are you sure you want to delete this lab report?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/labs/${id}`, { method: 'DELETE' });
            setLabs(prev => prev.filter(l => l._id !== id));
        } catch (error) {
            console.error('Error deleting lab:', error);
        }
    };

    return (
        <div className={cn("min-h-screen p-4 md:p-8 pb-24 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className={cn("mb-6 flex items-center gap-2 md:hidden text-sm font-medium transition-colors", isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
                >
                    <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>

                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Health Record</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>A timeline of your visits, diagnoses, and reports.</p>
                </header>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className={cn("flex p-1 rounded-xl border", isDark ? "bg-white/5 border-white/5" : "bg-white border-slate-200")}>
                        <button
                            onClick={() => setActiveTab('checkups')}
                            className={cn("px-6 py-2 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none",
                                activeTab === 'checkups'
                                    ? (isDark ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-blue-600 text-white shadow-lg shadow-blue-600/20")
                                    : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                            )}
                        >
                            Checkups
                        </button>
                        <button
                            onClick={() => setActiveTab('labs')}
                            className={cn("px-6 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'labs'
                                    ? (isDark ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-blue-600 text-white shadow-lg shadow-blue-600/20")
                                    : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                            )}
                        >
                            Lab Reports
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'checkups' ? "Search diagnoses, symptoms..." : "Search tests, results..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn("w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Checkups Tab */}
                    {activeTab === 'checkups' && (
                        <>
                            {filteredVisits.length === 0 && !loading && (
                                <div className={cn("p-12 text-center rounded-2xl border border-dashed", isDark ? "border-white/10" : "border-slate-300")}>
                                    <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <h3 className={cn("text-lg font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>No Checkups Found</h3>
                                    <p className={cn("text-sm mb-6", isDark ? "text-slate-400" : "text-slate-500")}>Start a new checkup to build your health record.</p>
                                    <button
                                        onClick={() => router.push('/dashboard/intake')}
                                        className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                                    >
                                        Start Checkup
                                    </button>
                                </div>
                            )}

                            {filteredVisits.map((visit, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    key={visit._id}
                                    className={cn("p-4 md:p-6 rounded-2xl border transition-all hover:shadow-lg group", isDark ? "bg-[#0F1420] border-white/5 hover:border-blue-500/30" : "bg-white border-slate-200 shadow-sm hover:border-blue-200")}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                visit.status === 'COMPLETED' ? "bg-green-500/10 text-green-500" : "bg-slate-500/10 text-slate-500"
                                            )}>
                                                {visit.status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-500" : "text-slate-400")}>
                                                        {formatDate(visit.created_at)}
                                                    </span>
                                                    {visit.status === 'DRAFT' && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-500">DRAFT</span>
                                                    )}
                                                </div>
                                                <h3 className={cn("text-lg font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>
                                                    {visit.diagnosis?.conditions?.[0]?.name || "Symptom Checkup"}
                                                </h3>
                                                <p className={cn("text-sm line-clamp-1", isDark ? "text-slate-400" : "text-slate-600")}>
                                                    {visit.symptoms}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end md:self-center">
                                            {visit.status === 'COMPLETED' && (
                                                <>
                                                    <button
                                                        onClick={() => router.push(`/dashboard/results?visitId=${visit._id}`)}
                                                        className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900")}
                                                        title="View Results"
                                                    >
                                                        <FileText className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/dashboard/plan?visitId=${visit._id}`)}
                                                        className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900")}
                                                        title="View Plan"
                                                    >
                                                        <Activity className="w-5 h-5" />
                                                    </button>
                                                </>
                                            )}
                                            {visit.status === 'DRAFT' && (
                                                <button
                                                    onClick={() => router.push(`/dashboard/intake?visitId=${visit._id}`)}
                                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
                                                >
                                                    Resume
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteVisit(visit._id)}
                                                className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-red-500/10 text-slate-400 hover:text-red-500" : "hover:bg-red-50 text-slate-500 hover:text-red-600")}
                                                title="Delete Record"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Stats / Tags */}
                                    {visit.diagnosis && (
                                        <div className="mt-4 pt-4 border-t border-dashed flex flex-wrap gap-2">
                                            {visit.diagnosis.urgencyLevel === 'High' && (
                                                <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-500">High Urgency</span>
                                            )}
                                            {visit.recommended_tests && (
                                                <span className="px-2 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-500 flex items-center gap-1">
                                                    <FlaskConical className="w-3 h-3" /> Tests Recommended
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </>
                    )}

                    {/* Labs Tab */}
                    {activeTab === 'labs' && (
                        <>
                            {filteredLabs.length === 0 && !loading && (
                                <div className={cn("p-12 text-center rounded-2xl border border-dashed", isDark ? "border-white/10" : "border-slate-300")}>
                                    <FlaskConical className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <h3 className={cn("text-lg font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>No Lab Reports</h3>
                                    <p className={cn("text-sm mb-6", isDark ? "text-slate-400" : "text-slate-500")}>Upload your lab reports to get AI analysis.</p>
                                    <button
                                        onClick={() => router.push('/dashboard/labs')}
                                        className="px-6 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                                    >
                                        Upload Report
                                    </button>
                                </div>
                            )}

                            {filteredLabs.map((lab, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    key={lab._id}
                                    className={cn("p-4 md:p-6 rounded-2xl border transition-all hover:shadow-lg group", isDark ? "bg-[#0F1420] border-white/5 hover:border-purple-500/30" : "bg-white border-slate-200 shadow-sm hover:border-purple-200")}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                                                <FlaskConical className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-500" : "text-slate-400")}>
                                                        {formatDate(lab.date)}
                                                    </span>
                                                </div>
                                                <h3 className={cn("text-lg font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>
                                                    {lab.test_type || "Lab Report"}
                                                </h3>
                                                <p className={cn("text-sm line-clamp-1", isDark ? "text-slate-400" : "text-slate-600")}>
                                                    {lab.summary || "No summary available."}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end md:self-center">
                                            <button
                                                onClick={() => router.push(`/dashboard/labs?id=${lab._id}`)} // Assuming labs page can show details
                                                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900")}
                                            >
                                                View Details
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLab(lab._id)}
                                                className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-red-500/10 text-slate-400 hover:text-red-500" : "hover:bg-red-50 text-slate-500 hover:text-red-600")}
                                                title="Delete Report"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Abnormal Values Preview */}
                                    {lab.entries && lab.entries.some((e: any) => e.is_abnormal) && (
                                        <div className="mt-4 pt-4 border-t border-dashed">
                                            <span className="text-xs font-bold text-red-500 mb-2 block">Abnormal Values:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {lab.entries.filter((e: any) => e.is_abnormal).slice(0, 3).map((entry: any, i: number) => (
                                                    <span key={i} className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-500 border border-red-500/20">
                                                        {entry.test_name}: {entry.value} {entry.unit}
                                                    </span>
                                                ))}
                                                {lab.entries.filter((e: any) => e.is_abnormal).length > 3 && (
                                                    <span className="px-2 py-1 rounded text-xs text-slate-500">
                                                        +{lab.entries.filter((e: any) => e.is_abnormal).length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}
