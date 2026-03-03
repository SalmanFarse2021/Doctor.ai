'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Brain, FileText, Heart, Shield, Smartphone,
    Menu, X, Bell, Search, User, ChevronRight, Plus,
    Thermometer, Droplets, Moon, Sun, Calendar, ArrowUpRight,
    Stethoscope, Pill, AlertCircle, CheckCircle2, Mic,
    FlaskConical, Clock, LogOut, MoreVertical
} from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

import { useTheme } from '@/context/ThemeContext';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, isDark }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
            active
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : (isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")
        )}
    >
        <Icon className={cn("w-5 h-5", active ? "text-white" : (isDark ? "text-slate-500 group-hover:text-white" : "text-slate-400 group-hover:text-slate-900"))} />
        <span className="font-medium text-sm">{label}</span>
        {active && <motion.div layoutId="active-pill" className={cn("ml-auto w-1.5 h-1.5 rounded-full", isDark ? "bg-white" : "bg-blue-200")} />}
    </button>
);

const StatCard = ({ title, value, unit, trend, icon: Icon, color, isDark, onClick, active }: any) => (
    <div
        onClick={onClick}
        className={cn("border p-4 md:p-5 rounded-2xl relative overflow-hidden group transition-all cursor-pointer min-h-[120px] md:min-h-[140px]",
            isDark ? "bg-[#0F1420] border-white/5 hover:border-white/10" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm",
            active && (isDark ? "ring-1 ring-blue-500 bg-white/5" : "ring-2 ring-blue-500 bg-blue-50")
        )}>
        <div className={cn("absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity", color)}>
            <Icon className="w-16 h-16 md:w-24 md:h-24 -mr-4 -mt-4" />
        </div>
        <div className="flex justify-between items-start mb-3 md:mb-4">
            <div className={cn("p-2 md:p-2.5 rounded-xl", isDark ? "bg-white/5" : "bg-slate-100", color.replace('text-', 'text-').replace('500', '600'))}>
                <Icon className={cn("w-4 h-4 md:w-5 md:h-5", color)} />
            </div>
            {trend && (
                <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
                    trend > 0 ? (isDark ? "text-green-400 bg-white/5" : "text-green-600 bg-green-50") : (isDark ? "text-red-400 bg-white/5" : "text-red-600 bg-red-50")
                )}>
                    {trend > 0 ? "+" : ""}{trend}%
                    <ArrowUpRight className={cn("w-3 h-3", trend < 0 && "rotate-180")} />
                </div>
            )}
        </div>
        <div>
            <h3 className={cn("text-[10px] md:text-xs font-medium uppercase tracking-wider mb-1", isDark ? "text-slate-400" : "text-slate-500")}>{title}</h3>
            <div className="flex items-baseline gap-1">
                <span className={cn("text-xl md:text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>{value}</span>
                <span className={cn("text-xs md:text-sm font-medium", isDark ? "text-slate-500" : "text-slate-400")}>{unit}</span>
            </div>
        </div>
    </div>
);

const ActivityItem = ({ title, time, type, status, isDark }: any) => (
    <div className={cn("flex items-center gap-4 p-3 rounded-xl transition-colors cursor-pointer group",
        isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
    )}>
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border",
            type === 'checkup' ? (isDark ? "bg-blue-500/10 text-blue-400 border-white/5" : "bg-blue-50 text-blue-600 border-blue-100") :
                type === 'lab' ? (isDark ? "bg-purple-500/10 text-purple-400 border-white/5" : "bg-purple-50 text-purple-600 border-purple-100") :
                    (isDark ? "bg-green-500/10 text-green-400 border-white/5" : "bg-green-50 text-green-600 border-green-100")
        )}>
            {type === 'checkup' ? <Stethoscope className="w-5 h-5" /> :
                type === 'lab' ? <FileText className="w-5 h-5" /> :
                    <Activity className="w-5 h-5" />}
        </div>
        <div className="flex-1">
            <h4 className={cn("text-sm font-medium transition-colors", isDark ? "text-white group-hover:text-blue-400" : "text-slate-900 group-hover:text-blue-600")}>{title}</h4>
            <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>{time}</p>
        </div>
        <div className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border",
            status === 'completed' ? (isDark ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-600 border-green-200") :
                status === 'pending' ? (isDark ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-600 border-orange-200") :
                    (isDark ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200")
        )}>
            {status}
        </div>
    </div>
);

import SymptomChecker from '@/components/SymptomChecker';
import SettingsView from '@/components/SettingsView';
import MedicationsView from '@/components/MedicationsView';
import LabReportsView from '@/components/LabReportsView';
import VoiceDoctorView from '@/components/VoiceDoctorView';
import ProfileView from './profile/page';

// ... (imports remain)

export default function Dashboard() {
    const { data: session } = useSession();
    const { isDark, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSymptomCheckerOpen, setIsSymptomCheckerOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState('Health Score');
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [trackerLogs, setTrackerLogs] = useState<any[]>([]);
    const [healthScore, setHealthScore] = useState<any>({ score: 0, trend: 'Stable' });
    const [uploadingReport, setUploadingReport] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Handle initial responsive sidebar state
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true);
            } else {
                setIsSidebarOpen(false);
            }
        };

        // Set initial state
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load read notifications from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('readNotifications');
        if (stored) {
            setReadNotifications(new Set(JSON.parse(stored)));
        }
    }, []);

    // Generate notifications from real data
    useEffect(() => {
        if (!session) return;

        const generateNotifications = () => {
            const notifs: any[] = [];

            // Lab report notifications
            recentActivities.filter(a => a.type === 'lab').forEach(lab => {
                const notifId = `lab-${lab.id}`;
                notifs.push({
                    id: notifId,
                    title: 'Lab Results Ready',
                    message: `Your ${lab.title} results are now available`,
                    time: formatTime(lab.time),
                    read: readNotifications.has(notifId),
                    type: 'lab',
                    timestamp: lab.time.getTime()
                });
            });

            // Checkup notifications
            recentActivities.filter(a => a.type === 'checkup' && a.status === 'completed').forEach(checkup => {
                const notifId = `checkup-${checkup.id}`;
                notifs.push({
                    id: notifId,
                    title: 'Checkup Completed',
                    message: `Your checkup for ${checkup.title} has been completed`,
                    time: formatTime(checkup.time),
                    read: readNotifications.has(notifId),
                    type: 'appointment',
                    timestamp: checkup.time.getTime()
                });
            });

            // Health score notification (if improved)
            if (healthScore.trend === 'Improving' && healthScore.score > 0) {
                const notifId = `health-score-${new Date().toDateString()}`;
                notifs.push({
                    id: notifId,
                    title: 'Health Score Improved',
                    message: `Your health score is now ${healthScore.score}/100 and improving!`,
                    time: 'Today',
                    read: readNotifications.has(notifId),
                    type: 'health',
                    timestamp: Date.now()
                });
            }

            // Daily tracker reminder (if no log today)
            const today = new Date().toISOString().split('T')[0];
            const hasLoggedToday = trackerLogs.some(log => log.date === today);
            if (!hasLoggedToday) {
                const notifId = `tracker-reminder-${today}`;
                notifs.push({
                    id: notifId,
                    title: 'Daily Tracker Reminder',
                    message: "Don't forget to log your vitals and symptoms for today",
                    time: 'Today',
                    read: readNotifications.has(notifId),
                    type: 'medication',
                    timestamp: Date.now()
                });
            }

            // Sort by timestamp (newest first)
            notifs.sort((a, b) => b.timestamp - a.timestamp);
            setNotifications(notifs);
        };

        generateNotifications();
    }, [recentActivities, healthScore, trackerLogs, readNotifications, session]);

    const handleReportUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingReport(true);
        try {
            const uid = (session?.user as any).id || session?.user?.email;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('user_id', uid);

            const response = await fetch(`${API_BASE_URL}/api/labs/upload`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                alert('Lab report uploaded successfully!');
                // Refresh the page or update state
                window.location.reload();
            } else {
                alert('Failed to upload report. Please try again.');
            }
        } catch (error) {
            console.error('Error uploading report:', error);
            alert('Error uploading report. Please try again.');
        } finally {
            setUploadingReport(false);
        }
    };

    const markAsRead = (id: string) => {
        const newReadSet = new Set(readNotifications);
        newReadSet.add(id);
        setReadNotifications(newReadSet);
        localStorage.setItem('readNotifications', JSON.stringify(Array.from(newReadSet)));
    };

    const markAllAsRead = () => {
        const allIds = notifications.map(n => n.id);
        const newReadSet = new Set([...readNotifications, ...allIds]);
        setReadNotifications(newReadSet);
        localStorage.setItem('readNotifications', JSON.stringify(Array.from(newReadSet)));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // Search functionality
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearchOpen(false);
            return;
        }

        const query = searchQuery.toLowerCase();
        const results: any[] = [];

        // Search in recent activities
        recentActivities.forEach(activity => {
            if (activity.title.toLowerCase().includes(query)) {
                results.push({
                    type: 'activity',
                    title: activity.title,
                    subtitle: `${activity.type === 'lab' ? 'Lab Report' : 'Checkup'} - ${formatTime(activity.time)}`,
                    icon: activity.type,
                    data: activity
                });
            }
        });

        // Search in tracker logs
        trackerLogs.forEach(log => {
            const logDate = new Date(log.date).toLocaleDateString();
            if (logDate.includes(query) || 'tracker'.includes(query) || 'vitals'.includes(query)) {
                results.push({
                    type: 'tracker',
                    title: `Daily Log - ${logDate}`,
                    subtitle: `Health Score: ${log.sleep_hours ? 'Logged' : 'Incomplete'}`,
                    icon: 'tracker',
                    data: log
                });
            }
        });

        // Common symptoms search
        const symptoms = ['headache', 'fever', 'pain', 'fatigue', 'nausea', 'cough', 'cold'];
        symptoms.forEach(symptom => {
            if (symptom.includes(query)) {
                results.push({
                    type: 'symptom',
                    title: `Search for ${symptom}`,
                    subtitle: 'Start a new symptom checkup',
                    icon: 'symptom',
                    data: { symptom }
                });
            }
        });

        setSearchResults(results.slice(0, 8)); // Limit to 8 results
        setIsSearchOpen(results.length > 0);
    }, [searchQuery, recentActivities, trackerLogs]);

    const handleSearchSelect = (result: any) => {
        if (result.type === 'activity') {
            if (result.data.type === 'lab') {
                window.location.href = '/dashboard/history';
            } else {
                window.location.href = '/dashboard/history';
            }
        } else if (result.type === 'tracker') {
            window.location.href = '/dashboard/tracker';
        } else if (result.type === 'symptom') {
            setIsSymptomCheckerOpen(true);
        }
        setSearchQuery('');
        setIsSearchOpen(false);
    };

    // Sync user and fetch data
    useEffect(() => {
        if (session?.user) {
            const syncAndFetch = async () => {
                try {
                    const uid = (session.user as any).id || session.user?.email;

                    // Sync User
                    await fetch(`${API_BASE_URL}/api/users/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            uid: uid,
                            name: session.user?.name,
                            email: session.user?.email,
                            photo_url: session.user?.image,
                            locale: navigator.language,
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        }),
                    });

                    // Fetch Visits
                    const visitsRes = await fetch(`${API_BASE_URL}/api/users/${uid}/visits`);
                    const visitsData = await visitsRes.json();
                    const visits = Array.isArray(visitsData) ? visitsData : [];

                    // Fetch Labs
                    const labsRes = await fetch(`${API_BASE_URL}/api/users/${uid}/labs`);
                    const labsData = await labsRes.json();
                    const labs = Array.isArray(labsData) ? labsData : [];

                    // Fetch Tracker Logs
                    const logsRes = await fetch(`${API_BASE_URL}/api/tracking/logs?user_id=${uid}&days=7`);
                    const logsData = await logsRes.json();
                    setTrackerLogs(Array.isArray(logsData) ? logsData : []);

                    // Fetch Health Score
                    const scoreRes = await fetch(`${API_BASE_URL}/api/tracking/score?user_id=${uid}`);
                    const scoreData = await scoreRes.json();
                    setHealthScore(scoreData);

                    // Combine and Sort
                    const combined = [
                        ...visits.map((v: any) => ({
                            id: v._id,
                            title: v.diagnosis?.conditions?.[0]?.name || "Symptom Checkup",
                            time: new Date(v.created_at),
                            type: 'checkup',
                            status: v.status === 'COMPLETED' ? 'completed' : 'pending'
                        })),
                        ...labs.map((l: any) => ({
                            id: l._id,
                            title: l.test_type || "Lab Report",
                            time: new Date(l.date),
                            type: 'lab',
                            status: 'reviewed'
                        }))
                    ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 3);

                    setRecentActivities(combined);

                } catch (error) {
                    console.error('Error syncing/fetching:', error);
                }
            };
            syncAndFetch();
        }
    }, [session]);

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (days === 1) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Prepare chart labels and data from tracker logs
    const chartLabels = trackerLogs.length > 0
        ? trackerLogs.map(l => new Date(l.date).toLocaleDateString('en-US', { weekday: 'short' }))
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Calculate health scores for each day
    const healthScores = trackerLogs.map(log => {
        let score = 70;
        const sleep = log.sleep_hours || 0;
        const water = log.hydration_liters || 0;
        const pain = log.pain || 0;
        const energy = log.energy || 5;
        const fever = log.fever;
        const hr = log.heart_rate_avg;
        const sys = log.blood_pressure_systolic;
        const dia = log.blood_pressure_diastolic;

        if (sleep >= 7 && sleep <= 9) score += 10;
        else if (sleep >= 5) score += 5;
        else score -= 10;

        if (water >= 2) score += 5;
        else if (water < 1) score -= 5;

        if (pain == 0) score += 10;
        else if (pain <= 3) score += 5;
        else if (pain <= 6) score -= 5;
        else score -= 15;

        if (energy >= 8) score += 5;
        else if (energy <= 3) score -= 5;

        if (fever) {
            if (36.1 <= fever && fever <= 37.2) score += 5;
            else if (fever > 37.5) score -= 10;
        }

        if (hr) {
            if (60 <= hr && hr <= 100) score += 5;
            else score -= 5;
        }

        if (sys && dia) {
            if (90 <= sys && sys <= 120 && 60 <= dia && dia <= 80) score += 10;
            else if (sys > 140 || dia > 90) score -= 10;
        }

        return Math.min(100, Math.max(0, score));
    });

    // Chart Data
    const chartDataMap: any = {
        'Health Score': {
            label: 'Health Score',
            data: healthScores.length > 0 ? healthScores : [82, 84, 83, 85, 88, 87, 89],
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.1)'
        },
        'Heart Rate': {
            label: 'Heart Rate (bpm)',
            data: trackerLogs.length > 0 ? trackerLogs.map(l => l.heart_rate_avg || 0) : [70, 72, 71, 74, 73, 72, 72],
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)'
        },
        'Blood Pressure': {
            label: 'Systolic BP (mmHg)',
            data: trackerLogs.length > 0 ? trackerLogs.map(l => l.blood_pressure_systolic || 0) : [118, 120, 119, 121, 120, 122, 120],
            color: '#06b6d4',
            bgColor: 'rgba(6, 182, 212, 0.1)'
        },
        'Sleep': {
            label: 'Sleep (hours)',
            data: trackerLogs.length > 0 ? trackerLogs.map(l => l.sleep_hours || 0) : [7.5, 7.2, 6.8, 7.8, 8.0, 7.5, 7.7],
            color: '#a855f7',
            bgColor: 'rgba(168, 85, 247, 0.1)'
        }
    };

    const currentChartData = chartDataMap[selectedMetric];

    const healthScoreData = {
        labels: chartLabels,
        datasets: [{
            label: currentChartData.label,
            data: currentChartData.data,
            borderColor: currentChartData.color,
            backgroundColor: currentChartData.bgColor,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: currentChartData.color,
        }]
    };

    const vitalsData = {
        labels: ['BP', 'HR', 'O2', 'Temp'],
        datasets: [{
            data: [120, 72, 98, 98.6],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(245, 158, 11, 0.8)',
            ],
            borderWidth: 0,
        }]
    };

    return (
        <div className={cn("min-h-screen font-sans flex overflow-hidden selection:bg-blue-500/30 transition-colors duration-500",
            isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900"
        )}>

            <SymptomChecker isOpen={isSymptomCheckerOpen} onClose={() => setIsSymptomCheckerOpen(false)} />

            {/* Mobile Sidebar Backdrop */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: isSidebarOpen ? 0 : -280,
                    width: 280
                }}
                className={cn(
                    "h-screen border-r flex flex-col z-40 transition-colors duration-500",
                    "fixed md:relative md:translate-x-0",
                    isDark ? "bg-[#0B0F19] border-white/5" : "bg-white border-slate-200"
                )}
            >
                <div className={cn("h-20 flex items-center px-6 border-b", isDark ? "border-white/5" : "border-slate-100")}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        {isSidebarOpen && (
                            <span className={cn("text-xl font-bold whitespace-nowrap hidden md:block", isDark ? "text-white" : "text-slate-900")}>
                                Doctor<span className="text-blue-500">.ai</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
                    <SidebarItem icon={Activity} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} isDark={isDark} />
                    <SidebarItem icon={Stethoscope} label="New Checkup" active={activeTab === 'checkup'} onClick={() => window.location.href = '/dashboard/intake'} isDark={isDark} />
                    <SidebarItem icon={Mic} label="Voice Doctor" active={activeTab === 'voice'} onClick={() => setActiveTab('voice')} isDark={isDark} />
                    <SidebarItem icon={FileText} label="Lab Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} isDark={isDark} />
                    <SidebarItem icon={Pill} label="Medications" active={activeTab === 'meds'} onClick={() => setActiveTab('meds')} isDark={isDark} />

                    <div className={cn("my-4 border-t mx-2", isDark ? "border-white/5" : "border-slate-100")} />
                    <SidebarItem icon={User} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} isDark={isDark} />
                    <SidebarItem icon={Shield} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isDark={isDark} />

                </div>

                <div className={cn("p-4 border-t relative", isDark ? "border-white/5" : "border-slate-100")}>
                    <AnimatePresence>
                        {isUserMenuOpen && isSidebarOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className={cn("absolute bottom-full left-4 right-4 mb-2 rounded-xl border shadow-xl overflow-hidden z-50",
                                    isDark ? "bg-[#0F1420] border-white/10" : "bg-white border-slate-200"
                                )}
                            >
                                <button
                                    onClick={() => window.location.href = '/api/auth/signout'}
                                    className={cn("w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                                        isDark ? "text-red-400 hover:bg-white/5" : "text-red-600 hover:bg-red-50"
                                    )}
                                >
                                    <LogOut className="w-4 h-4" />
                                    Log Out
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className={cn("flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-colors",
                        !isSidebarOpen && "justify-center",
                        isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                            {session?.user?.name?.[0] || 'U'}
                        </div>
                        {isSidebarOpen && (
                            <>
                                <div className="flex-1 overflow-hidden">
                                    <p className={cn("text-sm font-medium truncate", isDark ? "text-white" : "text-slate-900")}>{session?.user?.name || 'User'}</p>
                                    <p className="text-xs text-slate-500 truncate">{session?.user?.email || 'user@example.com'}</p>
                                </div>
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className={cn("p-1 rounded-lg transition-colors", isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-200 text-slate-500")}
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto custom-scrollbar relative w-full">
                {/* Header */}
                <header className={cn(
                    "h-16 md:h-20 border-b backdrop-blur-xl sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between transition-colors duration-500",
                    isDark ? "border-white/5 bg-[#0B0F19]/80" : "border-slate-200/60 bg-white/80"
                )}>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                isDark ? "hover:bg-white/5 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            )}
                        >
                            {isSidebarOpen ? <X className="w-5 h-5 md:hidden" /> : (
                                <>
                                    <Menu className="w-5 h-5 md:hidden" />
                                    <Menu className="w-5 h-5 hidden md:block" />
                                </>
                            )}
                        </button>
                        <div>
                            <h1 className={cn("text-lg md:text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Dashboard</h1>
                            <p className="text-xs text-slate-500 hidden sm:block">Welcome back, {session?.user?.name?.split(' ')[0]}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="relative hidden lg:block">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery && setIsSearchOpen(true)}
                                placeholder="Search reports, symptoms..."
                                className={cn("border rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 w-64 transition-all",
                                    isDark ? "bg-white/5 border-white/10 text-slate-300 focus:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                )}
                            />

                            <AnimatePresence>
                                {isSearchOpen && searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className={cn("absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl overflow-hidden z-50",
                                            isDark ? "bg-[#0F1420] border-white/10" : "bg-white border-slate-200"
                                        )}
                                    >
                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {searchResults.map((result, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => handleSearchSelect(result)}
                                                    className={cn("p-3 border-b cursor-pointer transition-colors flex items-center gap-3",
                                                        isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                                        result.icon === 'lab' ? (isDark ? "bg-purple-500/10 text-purple-400" : "bg-purple-100 text-purple-600") :
                                                            result.icon === 'checkup' ? (isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-100 text-blue-600") :
                                                                result.icon === 'tracker' ? (isDark ? "bg-green-500/10 text-green-400" : "bg-green-100 text-green-600") :
                                                                    (isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-100 text-orange-600")
                                                    )}>
                                                        {result.icon === 'lab' && <FileText className="w-5 h-5" />}
                                                        {result.icon === 'checkup' && <Stethoscope className="w-5 h-5" />}
                                                        {result.icon === 'tracker' && <Activity className="w-5 h-5" />}
                                                        {result.icon === 'symptom' && <Brain className="w-5 h-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={cn("text-sm font-semibold truncate", isDark ? "text-white" : "text-slate-900")}>
                                                            {result.title}
                                                        </h4>
                                                        <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-600")}>
                                                            {result.subtitle}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className={cn("w-4 h-4 flex-shrink-0", isDark ? "text-slate-600" : "text-slate-400")} />
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={cn("p-2 rounded-full transition-colors", isDark ? "hover:bg-white/5 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900")}
                        >
                            {isDark ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className={cn("p-2 rounded-full relative transition-colors", isDark ? "hover:bg-white/5 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900")}
                            >
                                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-red-500 text-white text-[9px] md:text-[10px] font-bold flex items-center justify-center">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            <AnimatePresence>
                                {isNotificationOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className={cn(
                                            "absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-md rounded-2xl border shadow-2xl overflow-hidden z-50",
                                            isDark ? "bg-[#0F1420] border-white/10" : "bg-white border-slate-200"
                                        )}
                                    >
                                        <div className={cn("p-4 border-b flex items-center justify-between",
                                            isDark ? "border-white/10" : "border-slate-200"
                                        )}>
                                            <h3 className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>Notifications</h3>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={markAllAsRead}
                                                    className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                                                >
                                                    Mark all as read
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center">
                                                    <Bell className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-slate-600" : "text-slate-300")} />
                                                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>No notifications</p>
                                                </div>
                                            ) : (
                                                notifications.map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        onClick={() => markAsRead(notification.id)}
                                                        className={cn("p-4 border-b cursor-pointer transition-colors",
                                                            isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50",
                                                            !notification.read && (isDark ? "bg-blue-500/5" : "bg-blue-50")
                                                        )}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                                                notification.type === 'lab' ? (isDark ? "bg-purple-500/10 text-purple-400" : "bg-purple-100 text-purple-600") :
                                                                    notification.type === 'medication' ? (isDark ? "bg-green-500/10 text-green-400" : "bg-green-100 text-green-600") :
                                                                        notification.type === 'appointment' ? (isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-100 text-blue-600") :
                                                                            (isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-100 text-orange-600")
                                                            )}>
                                                                {notification.type === 'lab' && <FileText className="w-5 h-5" />}
                                                                {notification.type === 'medication' && <Pill className="w-5 h-5" />}
                                                                {notification.type === 'appointment' && <Calendar className="w-5 h-5" />}
                                                                {notification.type === 'health' && <Activity className="w-5 h-5" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                                    <h4 className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                                                                        {notification.title}
                                                                    </h4>
                                                                    {!notification.read && (
                                                                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                                                                    )}
                                                                </div>
                                                                <p className={cn("text-xs mb-1", isDark ? "text-slate-400" : "text-slate-600")}>
                                                                    {notification.message}
                                                                </p>
                                                                <p className="text-[10px] text-slate-500">{notification.time}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={() => window.location.href = '/dashboard/labs'}
                            className="px-3 md:px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs md:text-sm font-medium transition-colors flex items-center gap-1.5 md:gap-2 shadow-lg shadow-purple-600/20"
                        >
                            <FlaskConical className="w-4 h-4" />
                            <span className="hidden sm:inline">Enter Labs</span>
                        </button>
                        <button
                            onClick={() => window.location.href = '/dashboard/tracker'}
                            className="px-3 md:px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white text-xs md:text-sm font-medium transition-colors flex items-center gap-1.5 md:gap-2 shadow-lg shadow-green-600/20"
                        >
                            <Activity className="w-4 h-4" />
                            <span className="hidden sm:inline">Daily Tracker</span>
                        </button>
                        <button
                            onClick={() => window.location.href = '/dashboard/history'}
                            className="hidden md:flex px-4 py-2 rounded-full bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium transition-colors items-center gap-2 shadow-lg shadow-slate-600/20"
                        >
                            <Clock className="w-4 h-4" />
                            <span>History</span>
                        </button>
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">

                    {activeTab === 'settings' ? (
                        <SettingsView />
                    ) : activeTab === 'profile' ? (
                        <ProfileView />
                    ) : activeTab === 'meds' ? (
                        <MedicationsView />
                    ) : activeTab === 'reports' ? (
                        <LabReportsView />
                    ) : activeTab === 'voice' ? (
                        <VoiceDoctorView />
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                <StatCard
                                    title="Health Score"
                                    value={healthScore.score || 0}
                                    unit="/100"
                                    trend={null}
                                    icon={Activity}
                                    color="text-blue-500"
                                    isDark={isDark}
                                    active={selectedMetric === 'Health Score'}
                                    onClick={() => setSelectedMetric('Health Score')}
                                />
                                <StatCard
                                    title="Heart Rate"
                                    value={trackerLogs.length > 0 ? (trackerLogs[trackerLogs.length - 1].heart_rate_avg || 0) : 0}
                                    unit="bpm"
                                    trend={null}
                                    icon={Heart}
                                    color="text-red-500"
                                    isDark={isDark}
                                    active={selectedMetric === 'Heart Rate'}
                                    onClick={() => setSelectedMetric('Heart Rate')}
                                />
                                <StatCard
                                    title="Blood Pressure"
                                    value={trackerLogs.length > 0 ? (trackerLogs[trackerLogs.length - 1].blood_pressure_systolic || 0) : 0}
                                    unit="mmHg"
                                    trend={null}
                                    icon={Stethoscope}
                                    color="text-cyan-500"
                                    isDark={isDark}
                                    active={selectedMetric === 'Blood Pressure'}
                                    onClick={() => setSelectedMetric('Blood Pressure')}
                                />
                                <StatCard
                                    title="Sleep"
                                    value={trackerLogs.length > 0 ? (trackerLogs[trackerLogs.length - 1].sleep_hours || 0) : 0}
                                    unit="hrs"
                                    trend={null}
                                    icon={Moon}
                                    color="text-purple-500"
                                    isDark={isDark}
                                    active={selectedMetric === 'Sleep'}
                                    onClick={() => setSelectedMetric('Sleep')}
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                                {/* Main Chart */}
                                <div className={cn("lg:col-span-2 border rounded-2xl p-4 md:p-6 transition-colors", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 md:mb-6">
                                        <h2 className={cn("text-base md:text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{selectedMetric} Trends</h2>
                                        <select className={cn("border rounded-lg px-3 py-1.5 text-xs focus:outline-none w-full sm:w-auto", isDark ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600")}>
                                            <option>Last 7 Days</option>
                                            <option>Last 30 Days</option>
                                            <option>Last Year</option>
                                        </select>
                                    </div>
                                    <div className="h-[200px] md:h-[300px] w-full">
                                        <Line
                                            data={healthScoreData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                scales: {
                                                    y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, ticks: { color: '#94a3b8' } },
                                                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                                                },
                                                plugins: { legend: { display: false } }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div className={cn("border rounded-2xl p-4 md:p-6 transition-colors", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                    <h2 className={cn("text-base md:text-lg font-bold mb-4 md:mb-6", isDark ? "text-white" : "text-slate-900")}>Recent Activity</h2>
                                    <div className="space-y-2">
                                        {recentActivities.length > 0 ? (
                                            recentActivities.map((activity, idx) => (
                                                <ActivityItem
                                                    key={idx}
                                                    title={activity.title}
                                                    time={formatTime(activity.time)}
                                                    type={activity.type}
                                                    status={activity.status}
                                                    isDark={isDark}
                                                />
                                            ))
                                        ) : (
                                            <p className={cn("text-sm text-center py-4", isDark ? "text-slate-500" : "text-slate-400")}>No recent activity.</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => window.location.href = '/dashboard/history'}
                                        className={cn("w-full mt-6 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                                            isDark ? "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}>
                                        View All History
                                    </button>
                                </div>
                            </div>

                            {/* Quick Actions & Vitals */}
                            <div className="grid lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
                                    {/* Action Card 1 */}
                                    <div
                                        onClick={() => setActiveTab('voice')}
                                        className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 relative overflow-hidden group cursor-pointer shadow-lg shadow-blue-600/20"
                                    >
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <Mic className="w-32 h-32 text-white" />
                                        </div>

                                        {/* New Checkup Button (Top-Left) */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveTab('voice');
                                            }}
                                            className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 text-white text-xs font-bold backdrop-blur-md transition-all shadow-sm"
                                        >
                                            <Plus className="w-3 h-3" />
                                            New Checkup
                                        </button>

                                        <div className="relative z-10 pt-8">

                                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4">
                                                <Mic className="w-6 h-6 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Describe Symptoms</h3>
                                            <p className="text-blue-100 text-sm mb-6 max-w-[80%]">Talk to our AI assistant to get an instant preliminary diagnosis.</p>
                                            <button className="px-4 py-2 rounded-lg bg-white text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors">
                                                Start Conversation
                                            </button>

                                        </div>
                                    </div>

                                    {/* Action Card 2 */}
                                    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 relative overflow-hidden group cursor-pointer shadow-lg shadow-purple-600/20">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <FileText className="w-32 h-32 text-white" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4">
                                                <FileText className="w-6 h-6 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Upload Reports</h3>
                                            <p className="text-purple-100 text-sm mb-6 max-w-[80%]">Get instant AI analysis of your lab reports and prescriptions.</p>
                                            <input
                                                type="file"
                                                id="report-upload"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleReportUpload}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => document.getElementById('report-upload')?.click()}
                                                disabled={uploadingReport}
                                                className="px-4 py-2 rounded-lg bg-white text-purple-600 text-sm font-bold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {uploadingReport ? 'Uploading...' : 'Upload PDF/Image'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Vitals Summary */}
                                <div className={cn("border rounded-2xl p-6 transition-colors", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                    <h2 className={cn("text-lg font-bold mb-6", isDark ? "text-white" : "text-slate-900")}>Vitals Summary</h2>
                                    <div className="flex items-center justify-center h-[200px]">
                                        <Doughnut
                                            data={vitalsData}
                                            options={{
                                                cutout: '70%',
                                                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', usePointStyle: true, padding: 20 } } }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </main >
        </div >
    );
}
