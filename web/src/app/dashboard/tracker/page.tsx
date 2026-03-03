'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Activity, Calendar, Moon, Droplets, Thermometer, Zap,
    TrendingUp, TrendingDown, Minus, Save, CheckCircle2, Heart, Stethoscope, ArrowLeft
} from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function TrackerPage() {
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);
    const [score, setScore] = useState<any>({ score: 0, trend: 'Stable' });
    const [todayLog, setTodayLog] = useState<any>({
        fever: '',
        pain: 0,
        sleep_hours: '',
        hydration_liters: '',
        energy: 5,
        appetite: 'Fair',
        heart_rate_avg: '',
        blood_pressure_systolic: '',
        blood_pressure_diastolic: '',
        notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!session) return;
            try {
                const uid = (session.user as any).id || session.user?.email;

                // Fetch Logs
                const logsRes = await fetch(`${API_BASE_URL}/api/tracking/logs?user_id=${uid}&days=7`);
                const logsData = await logsRes.json();
                setLogs(logsData);

                // Fetch Score
                const scoreRes = await fetch(`${API_BASE_URL}/api/tracking/score?user_id=${uid}`);
                const scoreData = await scoreRes.json();
                setScore(scoreData);

                // Check if today has a log
                const today = new Date().toISOString().split('T')[0];
                const todayEntry = logsData.find((l: any) => l.date === today);
                if (todayEntry) {
                    setTodayLog({
                        fever: todayEntry.fever ? (todayEntry.fever * 9 / 5 + 32).toFixed(1) : '',
                        pain: todayEntry.pain || 0,
                        sleep_hours: todayEntry.sleep_hours || '',
                        hydration_liters: todayEntry.hydration_liters || '',
                        energy: todayEntry.energy || 5,
                        appetite: todayEntry.appetite || 'Fair',
                        heart_rate_avg: todayEntry.heart_rate_avg || '',
                        blood_pressure_systolic: todayEntry.blood_pressure_systolic || '',
                        blood_pressure_diastolic: todayEntry.blood_pressure_diastolic || '',
                        notes: todayEntry.notes || ''
                    });
                }

            } catch (error) {
                console.error('Error fetching tracker data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [session]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const uid = (session?.user as any).id || session?.user?.email;
            const today = new Date().toISOString().split('T')[0];

            await fetch(`${API_BASE_URL}/api/tracking/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: uid,
                    date: today,
                    fever: todayLog.fever ? (parseFloat(todayLog.fever) - 32) * 5 / 9 : null,
                    pain: parseInt(todayLog.pain),
                    sleep_hours: todayLog.sleep_hours ? parseFloat(todayLog.sleep_hours) : null,
                    hydration_liters: todayLog.hydration_liters ? parseFloat(todayLog.hydration_liters) : null,
                    energy: parseInt(todayLog.energy),
                    appetite: todayLog.appetite,
                    heart_rate_avg: todayLog.heart_rate_avg ? parseInt(todayLog.heart_rate_avg) : null,
                    blood_pressure_systolic: todayLog.blood_pressure_systolic ? parseInt(todayLog.blood_pressure_systolic) : null,
                    blood_pressure_diastolic: todayLog.blood_pressure_diastolic ? parseInt(todayLog.blood_pressure_diastolic) : null,
                    notes: todayLog.notes
                }),
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);

            // Refresh data
            const logsRes = await fetch(`${API_BASE_URL}/api/tracking/logs?user_id=${uid}&days=7`);
            const logsData = await logsRes.json();
            setLogs(logsData);

            const scoreRes = await fetch(`${API_BASE_URL}/api/tracking/score?user_id=${uid}`);
            const scoreData = await scoreRes.json();
            setScore(scoreData);

        } catch (error) {
            console.error('Error saving log:', error);
        } finally {
            setSaving(false);
        }
    };

    const chartData = {
        labels: logs.map(l => new Date(l.date).toLocaleDateString('en-US', { weekday: 'short' })),
        datasets: [
            {
                label: 'Energy Level',
                data: logs.map(l => l.energy || 0),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Pain Level',
                data: logs.map(l => l.pain || 0),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: isDark ? '#94a3b8' : '#475569' }
            },
            title: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 10,
                grid: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: isDark ? '#94a3b8' : '#475569' }
            },
            x: {
                grid: { display: false },
                ticks: { color: isDark ? '#94a3b8' : '#475569' }
            }
        }
    };

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-5xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/dashboard')}
                    className={cn(
                        "mb-6 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        isDark
                            ? "text-slate-400 hover:text-white hover:bg-white/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="font-medium">Back to Dashboard</span>
                </button>

                <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Daily Tracker</h1>
                        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Monitor your vitals and symptoms daily.</p>
                    </div>

                    <div className={cn("px-6 py-3 rounded-2xl border flex items-center gap-4 w-fit", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <div>
                            <span className={cn("text-xs font-bold uppercase tracking-wider block mb-1", isDark ? "text-slate-500" : "text-slate-400")}>Health Score</span>
                            <span className={cn("text-3xl font-bold",
                                score.score >= 80 ? "text-green-500" :
                                    score.score >= 50 ? "text-yellow-500" : "text-red-500"
                            )}>{score.score}</span>
                        </div>
                        <div className={cn("h-8 w-px", isDark ? "bg-white/10" : "bg-slate-200")} />
                        <div className="flex items-center gap-2">
                            {score.trend === 'Improving' && <TrendingUp className="w-5 h-5 text-green-500" />}
                            {score.trend === 'Declining' && <TrendingDown className="w-5 h-5 text-red-500" />}
                            {score.trend === 'Stable' && <Minus className="w-5 h-5 text-slate-400" />}
                            <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{score.trend}</span>
                        </div>
                    </div>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Input Form */}
                    <div className={cn("lg:col-span-1 p-6 rounded-2xl border h-fit", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <Calendar className="w-5 h-5 text-blue-500" /> Today&apos;s Log
                        </h2>

                        <div className="space-y-4">
                            {/* Symptoms Section */}
                            <div className="space-y-4 pt-2">
                                <h3 className={cn("text-sm font-bold opacity-50 uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>Symptoms</h3>
                                <div>
                                    <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Energy (1-10)</label>
                                    <input
                                        type="range" min="1" max="10"
                                        value={todayLog.energy}
                                        onChange={(e) => setTodayLog({ ...todayLog, energy: parseInt(e.target.value) })}
                                        className="w-full accent-blue-500"
                                    />
                                    <div className="flex justify-between text-xs opacity-50 mt-1">
                                        <span>Low</span>
                                        <span>High</span>
                                    </div>
                                </div>

                                <div>
                                    <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Pain Level (1-10)</label>
                                    <input
                                        type="range" min="0" max="10"
                                        value={todayLog.pain}
                                        onChange={(e) => setTodayLog({ ...todayLog, pain: parseInt(e.target.value) })}
                                        className="w-full accent-red-500"
                                    />
                                    <div className="flex justify-between text-xs opacity-50 mt-1">
                                        <span>None</span>
                                        <span>Severe</span>
                                    </div>
                                </div>
                            </div>

                            <div className={cn("h-px w-full my-4", isDark ? "bg-white/10" : "bg-slate-200")} />

                            {/* Vitals Section */}
                            <div className="space-y-4">
                                <h3 className={cn("text-sm font-bold opacity-50 uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>Vitals</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Heart Rate (bpm)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 72"
                                            value={todayLog.heart_rate_avg}
                                            onChange={(e) => setTodayLog({ ...todayLog, heart_rate_avg: e.target.value })}
                                            className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Temperature (°F)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={todayLog.fever}
                                            onChange={(e) => setTodayLog({ ...todayLog, fever: e.target.value })}
                                            placeholder="e.g. 98.6"
                                            className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Blood Pressure</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="e.g. 120"
                                            value={todayLog.blood_pressure_systolic}
                                            onChange={(e) => setTodayLog({ ...todayLog, blood_pressure_systolic: e.target.value })}
                                            className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                        <input
                                            type="number"
                                            placeholder="e.g. 80"
                                            value={todayLog.blood_pressure_diastolic}
                                            onChange={(e) => setTodayLog({ ...todayLog, blood_pressure_diastolic: e.target.value })}
                                            className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Sleep (Hrs)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 8"
                                            value={todayLog.sleep_hours}
                                            onChange={(e) => setTodayLog({ ...todayLog, sleep_hours: e.target.value })}
                                            className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Water (L)</label>
                                        <input
                                            type="number" step="0.1"
                                            placeholder="e.g. 2.5"
                                            value={todayLog.hydration_liters}
                                            onChange={(e) => setTodayLog({ ...todayLog, hydration_liters: e.target.value })}
                                            className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className={cn("text-xs font-bold uppercase tracking-wider mb-2 block", isDark ? "text-slate-500" : "text-slate-400")}>Notes</label>
                                <textarea
                                    value={todayLog.notes || ''}
                                    onChange={(e) => setTodayLog({ ...todayLog, notes: e.target.value })}
                                    placeholder="Any other symptoms or notes..."
                                    className={cn("w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px]",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={cn("w-full py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4",
                                    isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
                                    saving && "opacity-50 cursor-not-allowed",
                                    saved && "bg-green-500 hover:bg-green-600 shadow-green-500/20"
                                )}
                            >
                                {saving ? 'Saving...' : saved ? <><CheckCircle2 className="w-5 h-5" /> Saved</> : <><Save className="w-5 h-5" /> Save Log</>}
                            </button>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className={cn("lg:col-span-2 p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                        <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                            <Activity className="w-5 h-5 text-purple-500" /> Weekly Trends
                        </h2>
                        <div className="h-[300px] w-full">
                            {logs.length > 0 ? (
                                <Line data={chartData} options={chartOptions} />
                            ) : (
                                <div className="h-full flex items-center justify-center opacity-50">
                                    <p>No data available yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
