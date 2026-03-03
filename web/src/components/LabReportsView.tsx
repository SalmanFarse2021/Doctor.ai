import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Upload, TrendingUp, AlertTriangle,
    Calendar, ChevronRight, Search, Filter, X,
    Activity, CheckCircle2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Line } from 'react-chartjs-2';
import LabUploadForm from './LabUploadForm';

// Mock Data
const LAB_REPORTS = [
    {
        id: '1',
        title: 'Comprehensive Metabolic Panel',
        date: '2024-12-10',
        doctor: 'Dr. Sarah Smith',
        status: 'Analyzed',
        abnormalCount: 2,
        summary: 'Glucose levels are slightly elevated. Liver function tests are normal.',
        key_metrics: { 'Glucose': 105, 'Calcium': 9.2, 'Sodium': 140 }
    },
    {
        id: '2',
        title: 'Lipid Panel',
        date: '2024-11-15',
        doctor: 'Dr. James Wilson',
        status: 'Analyzed',
        abnormalCount: 1,
        summary: 'LDL cholesterol is higher than recommended range.',
        key_metrics: { 'Total Cholesterol': 210, 'LDL': 145, 'HDL': 50 }
    },
    {
        id: '3',
        title: 'CBC with Differential',
        date: '2024-10-01',
        doctor: 'Dr. Sarah Smith',
        status: 'Analyzed',
        abnormalCount: 0,
        summary: 'All blood counts are within normal ranges.',
        key_metrics: { 'WBC': 6.5, 'RBC': 4.8, 'Hemoglobin': 14.2 }
    }
];

const TREND_DATA = {
    labels: ['Oct 1', 'Nov 15', 'Dec 10'],
    datasets: [
        {
            label: 'Glucose (mg/dL)',
            data: [98, 101, 105],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        },
        {
            label: 'Cholesterol (mg/dL)',
            data: [195, 210, 205],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            hidden: true
        }
    ]
};

export default function LabReportsView() {
    const { isDark } = useTheme();
    const [showUpload, setShowUpload] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState('Glucose');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredReports = LAB_REPORTS.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.doctor.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={cn("text-2xl font-bold mb-2 text-slate-900 dark:text-white")}>Lab Reports</h2>
                    <p className={cn("text-sm text-slate-500 dark:text-slate-400")}>View and analyze your medical test results.</p>
                </div>
                <button
                    onClick={() => setShowUpload(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                    <Upload className="w-5 h-5" />
                    Upload Report
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={cn("p-6 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#0F1420] dark:border-white/5")}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={cn("text-sm font-medium text-slate-500 dark:text-slate-400")}>Total Reports</p>
                            <h3 className={cn("text-2xl font-bold text-slate-900 dark:text-white")}>{LAB_REPORTS.length}</h3>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Last uploaded on Dec 10, 2024</p>
                </div>

                <div className={cn("p-6 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#0F1420] dark:border-white/5")}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={cn("text-sm font-medium text-slate-500 dark:text-slate-400")}>Abnormal Results</p>
                            <h3 className={cn("text-2xl font-bold text-slate-900 dark:text-white")}>
                                {LAB_REPORTS.reduce((acc, r) => acc + r.abnormalCount, 0)}
                            </h3>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Requires attention</p>
                </div>

                <div className={cn("p-6 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#0F1420] dark:border-white/5")}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={cn("text-sm font-medium text-slate-500 dark:text-slate-400")}>Health Status</p>
                            <h3 className={cn("text-2xl font-bold text-slate-900 dark:text-white")}>Stable</h3>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Based on recent analysis</p>
                </div>
            </div>

            {/* Trends Chart */}
            <section className={cn("p-6 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#0F1420] dark:border-white/5")}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className={cn("text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white")}>
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            Biomarker Trends
                        </h3>
                        <p className={cn("text-sm text-slate-500 dark:text-slate-400")}>Track your key health metrics over time.</p>
                    </div>
                    <select
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value)}
                        className={cn("px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
                        )}
                    >
                        <option value="Glucose">Glucose</option>
                        <option value="Cholesterol">Cholesterol</option>
                        <option value="WBC">WBC Count</option>
                    </select>
                </div>
                <div className="h-[300px] w-full">
                    <Line
                        data={TREND_DATA}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, ticks: { color: '#94a3b8' } },
                                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                            },
                            plugins: { legend: { display: true, labels: { color: isDark ? '#cbd5e1' : '#475569' } } }
                        }}
                    />
                </div>
            </section>

            {/* Reports List */}
            <section className={cn("rounded-2xl border overflow-hidden bg-white border-slate-200 shadow-sm dark:bg-[#0F1420] dark:border-white/5")}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className={cn("text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white")}>
                        <FileText className="w-5 h-5 text-purple-500" />
                        Recent Reports
                    </h3>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn("pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-64 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
                            )}
                        />
                    </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredReports.map((report) => (
                        <div key={report.id} className={cn("p-6 flex flex-col md:flex-row items-start md:items-center gap-6 transition-colors hover:bg-slate-50 dark:hover:bg-white/5")}>
                            <div className="flex items-center gap-4 flex-1">
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-500"
                                )}>
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className={cn("font-bold text-lg text-slate-900 dark:text-white")}>{report.title}</h4>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {report.date}</span>
                                        <span>•</span>
                                        <span>{report.doctor}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {Object.entries(report.key_metrics).slice(0, 3).map(([key, value]) => (
                                    <div key={key} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                                    )}>
                                        <span className="opacity-70">{key}:</span> <span className="font-bold">{value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                {report.abnormalCount > 0 ? (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {report.abnormalCount} Abnormal
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-500 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Normal
                                    </span>
                                )}
                                <button className={cn("p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 dark:hover:bg-white/10 dark:text-slate-400")}>
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Upload Modal */}
            <AnimatePresence>
                {showUpload && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn("w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative bg-white dark:bg-[#0B0F19]")}
                        >
                            <button
                                onClick={() => setShowUpload(false)}
                                className={cn("absolute top-4 right-4 p-2 rounded-full transition-colors z-10 hover:bg-slate-100 text-slate-900 dark:hover:bg-white/10 dark:text-white")}
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <div className="p-8">
                                <h2 className={cn("text-2xl font-bold mb-6 text-slate-900 dark:text-white")}>Upload Lab Results</h2>
                                <LabUploadForm
                                    visitId="general_upload" // Placeholder for general uploads
                                    onSuccess={() => {
                                        setShowUpload(false);
                                        // Ideally refresh list here
                                    }}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
