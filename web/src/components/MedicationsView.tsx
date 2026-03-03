import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Pill, Clock, Plus, Trash2, Edit2, CheckCircle2,
    XCircle, AlertCircle, Calendar, ChevronRight, Search, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Medication = {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    time: string[];
    instructions: string;
    refillDate: string;
    adherence: boolean[]; // last 7 days
    stock: number;
};

const SAMPLE_MEDS: Medication[] = [
    {
        id: '1',
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        time: ['08:00', '14:00', '20:00'],
        instructions: 'Take with food',
        refillDate: '2025-01-15',
        adherence: [true, true, true, false, true, true, true],
        stock: 12
    },
    {
        id: '2',
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        time: ['09:00'],
        instructions: 'Take in the morning',
        refillDate: '2024-12-28',
        adherence: [true, true, true, true, true, true, true],
        stock: 25
    },
    {
        id: '3',
        name: 'Metformin',
        dosage: '850mg',
        frequency: 'Twice daily',
        time: ['08:00', '20:00'],
        instructions: 'Take with meals',
        refillDate: '2025-01-05',
        adherence: [true, false, true, true, true, false, true],
        stock: 45
    }
];

export default function MedicationsView() {
    const { isDark } = useTheme();
    const [meds, setMeds] = useState<Medication[]>(SAMPLE_MEDS);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [newMed, setNewMed] = useState<Partial<Medication>>({
        name: '',
        dosage: '',
        frequency: 'Once daily',
        time: ['09:00'],
        instructions: '',
        stock: 30
    });

    const handleAddMed = (e: React.FormEvent) => {
        e.preventDefault();
        const med: Medication = {
            id: Date.now().toString(),
            name: newMed.name || 'New Med',
            dosage: newMed.dosage || 'N/A',
            frequency: newMed.frequency || 'Once daily',
            time: newMed.time || ['09:00'],
            instructions: newMed.instructions || '',
            refillDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            adherence: [false, false, false, false, false, false, false],
            stock: newMed.stock || 30
        };
        setMeds([...meds, med]);
        setShowAddModal(false);
        setNewMed({ name: '', dosage: '', frequency: 'Once daily', time: ['09:00'], instructions: '', stock: 30 });
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to remove this medication?')) {
            setMeds(meds.filter(m => m.id !== id));
        }
    };

    const filteredMeds = meds.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.instructions.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getAdherenceRate = (adherence: boolean[]) => {
        const taken = adherence.filter(Boolean).length;
        return Math.round((taken / adherence.length) * 100);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Medications</h2>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Manage your prescriptions, schedule, and refills.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                    <Plus className="w-5 h-5" />
                    Add Medication
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                            <Pill className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Active Prescriptions</p>
                            <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>{meds.length}</h3>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
                    </div>
                </div>

                <div className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Adherence Score</p>
                            <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                                {Math.round(meds.reduce((acc, m) => acc + getAdherenceRate(m.adherence), 0) / (meds.length || 1))}%
                            </h3>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-green-500 h-full rounded-full" style={{ width: `${Math.round(meds.reduce((acc, m) => acc + getAdherenceRate(m.adherence), 0) / (meds.length || 1))}%` }} />
                    </div>
                </div>

                <div className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Refills Needed</p>
                            <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                                {meds.filter(m => m.stock < 10).length}
                            </h3>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${(meds.filter(m => m.stock < 10).length / meds.length) * 100}%` }} />
                    </div>
                </div>
            </div>

            {/* Today's Schedule */}
            <section>
                <h3 className={cn("text-lg font-bold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                    <Clock className="w-5 h-5 text-purple-500" />
                    Today&apos;s Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['Morning', 'Afternoon', 'Evening', 'Night'].map((period, idx) => (
                        <div key={period} className={cn("p-4 rounded-xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h4 className={cn("font-bold mb-3 text-sm uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>{period}</h4>
                            <div className="space-y-3">
                                {meds.filter(m => {
                                    if (period === 'Morning') return m.time.some(t => parseInt(t) < 12);
                                    if (period === 'Afternoon') return m.time.some(t => parseInt(t) >= 12 && parseInt(t) < 17);
                                    if (period === 'Evening') return m.time.some(t => parseInt(t) >= 17 && parseInt(t) < 21);
                                    return m.time.some(t => parseInt(t) >= 21);
                                }).map(m => (
                                    <div key={m.id} className={cn("flex items-center gap-3 p-2 rounded-lg", isDark ? "bg-white/5" : "bg-slate-50")}>
                                        <div className={cn("w-2 h-8 rounded-full",
                                            period === 'Morning' ? "bg-yellow-400" :
                                                period === 'Afternoon' ? "bg-orange-400" :
                                                    period === 'Evening' ? "bg-blue-400" : "bg-purple-400"
                                        )} />
                                        <div className="flex-1">
                                            <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>{m.name}</p>
                                            <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{m.dosage}</p>
                                        </div>
                                        <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    </div>
                                ))}
                                {meds.filter(m => {
                                    if (period === 'Morning') return m.time.some(t => parseInt(t) < 12);
                                    if (period === 'Afternoon') return m.time.some(t => parseInt(t) >= 12 && parseInt(t) < 17);
                                    if (period === 'Evening') return m.time.some(t => parseInt(t) >= 17 && parseInt(t) < 21);
                                    return m.time.some(t => parseInt(t) >= 21);
                                }).length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No meds scheduled</p>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Medication List */}
            <section className={cn("rounded-2xl border overflow-hidden", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                        <Pill className="w-5 h-5 text-blue-500" />
                        All Medications
                    </h3>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search medications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn("pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-64",
                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className={cn("border-b", isDark ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50")}>
                            <tr>
                                <th className={cn("p-4 font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Medication</th>
                                <th className={cn("p-4 font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Schedule</th>
                                <th className={cn("p-4 font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Refill Date</th>
                                <th className={cn("p-4 font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Stock</th>
                                <th className={cn("p-4 font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Adherence</th>
                                <th className={cn("p-4 font-medium text-right", isDark ? "text-slate-300" : "text-slate-600")}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredMeds.map((med) => (
                                <tr key={med.id} className={cn("group transition-colors", isDark ? "hover:bg-white/5" : "hover:bg-slate-50")}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Pill className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>{med.name}</p>
                                                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{med.dosage}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className={cn("font-medium", isDark ? "text-slate-200" : "text-slate-700")}>{med.frequency}</p>
                                        <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{med.time.join(', ')}</p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <span className={isDark ? "text-slate-300" : "text-slate-700"}>{med.refillDate}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={cn("px-2 py-1 rounded text-xs font-bold",
                                            med.stock < 10 ? "bg-red-500/10 text-red-500" :
                                                med.stock < 20 ? "bg-yellow-500/10 text-yellow-500" : "bg-green-500/10 text-green-500"
                                        )}>
                                            {med.stock} left
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1">
                                            {med.adherence.slice(-5).map((taken, i) => (
                                                <div key={i} className={cn("w-2 h-8 rounded-full", taken ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700")} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(med.id)}
                                                className={cn("p-2 rounded-lg transition-colors hover:bg-red-500/10 text-red-500")}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Add Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn("w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden", isDark ? "bg-[#0F1420]" : "bg-white")}
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                                <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Add Medication</h3>
                                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
                                    <XCircle className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>
                            <form onSubmit={handleAddMed} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-500">Medication Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newMed.name}
                                        onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                        placeholder="e.g. Amoxicillin"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-500">Dosage</label>
                                        <input
                                            type="text"
                                            required
                                            value={newMed.dosage}
                                            onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                                            className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                            placeholder="e.g. 500mg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-500">Stock Quantity</label>
                                        <input
                                            type="number"
                                            required
                                            value={newMed.stock}
                                            onChange={e => setNewMed({ ...newMed, stock: parseInt(e.target.value) })}
                                            className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-500">Frequency</label>
                                    <select
                                        value={newMed.frequency}
                                        onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    >
                                        <option>Once daily</option>
                                        <option>Twice daily</option>
                                        <option>3 times daily</option>
                                        <option>Every 4 hours</option>
                                        <option>As needed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-500">Instructions</label>
                                    <textarea
                                        value={newMed.instructions}
                                        onChange={e => setNewMed({ ...newMed, instructions: e.target.value })}
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-24 resize-none",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                        placeholder="e.g. Take with food"
                                    />
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                                    >
                                        Save Medication
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
