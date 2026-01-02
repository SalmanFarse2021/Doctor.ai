'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { FlaskConical, Save, Plus, Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const LAB_TEMPLATES = {
    CBC: [
        { name: 'Hemoglobin', unit: 'g/dL', range: '13.5-17.5' },
        { name: 'WBC', unit: 'x10^9/L', range: '4.5-11.0' },
        { name: 'Platelets', unit: 'x10^9/L', range: '150-450' },
        { name: 'RBC', unit: 'x10^12/L', range: '4.5-5.9' },
        { name: 'Hematocrit', unit: '%', range: '41-50' },
    ],
    LFT: [
        { name: 'ALT', unit: 'U/L', range: '7-56' },
        { name: 'AST', unit: 'U/L', range: '10-40' },
        { name: 'ALP', unit: 'U/L', range: '44-147' },
        { name: 'Bilirubin (Total)', unit: 'mg/dL', range: '0.1-1.2' },
        { name: 'Albumin', unit: 'g/dL', range: '3.4-5.4' },
    ]
};

import { Suspense } from 'react';

function LabEntryContent() {
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const router = useRouter();
    const { data: session } = useSession();
    const { isDark } = useTheme();

    const [testType, setTestType] = useState('CBC');
    const [entries, setEntries] = useState<any[]>(LAB_TEMPLATES['CBC']);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const checkAbnormal = (value: string | number, range: string) => {
        if (!value || !range) return false;
        const numVal = parseFloat(value.toString());
        if (isNaN(numVal)) return false;

        // Parse range "min-max"
        const parts = range.split('-').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return numVal < parts[0] || numVal > parts[1];
        }
        // Handle "< X" or "> X"
        if (range.includes('<')) {
            const max = parseFloat(range.replace('<', '').trim());
            return !isNaN(max) && numVal >= max;
        }
        if (range.includes('>')) {
            const min = parseFloat(range.replace('>', '').trim());
            return !isNaN(min) && numVal <= min;
        }
        return false;
    };

    const handleTypeChange = (type: string) => {
        setTestType(type);
        setEntries(LAB_TEMPLATES[type as keyof typeof LAB_TEMPLATES] || []);
    };

    const handleEntryChange = (index: number, field: string, value: string) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const addEntry = () => {
        setEntries([...entries, { name: '', value: '', unit: '', range: '' }]);
    };

    const removeEntry = (index: number) => {
        setEntries(entries.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const uid = (session?.user as any).id || session?.user?.email;

            // Filter out empty entries
            const validEntries = entries.filter(e => e.value).map(e => ({
                name: e.name,
                value: parseFloat(e.value),
                unit: e.unit,
                reference_range: e.range
            }));

            if (validEntries.length === 0) {
                alert("Please enter at least one value.");
                setLoading(false);
                return;
            }

            const res = await fetch(`${API_BASE_URL}/api/labs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visit_id: visitId || null,
                    user_id: uid,
                    test_type: testType,
                    entries: validEntries
                }),
            });

            const data = await res.json();

            setSuccess(true);
            setTimeout(() => {
                if (visitId) {
                    router.push(`/dashboard/results?visitId=${visitId}`);
                } else {
                    if (data.lab_id) {
                        router.push(`/dashboard/labs/analysis?labId=${data.lab_id}`);
                    } else {
                        router.push('/dashboard');
                    }
                }
            }, 1500);

        } catch (error) {
            console.error('Error saving labs:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className={cn("mb-6 flex items-center gap-2 text-sm font-medium transition-colors", isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <header className="mb-8">
                    <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Enter Lab Results</h1>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Manually input your test results for analysis.</p>
                </header>

                <div className={cn("p-6 rounded-2xl border mb-8", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                    <div className="flex gap-4 mb-8">
                        <button
                            onClick={() => handleTypeChange('CBC')}
                            className={cn("px-4 py-2 rounded-lg font-medium transition-all",
                                testType === 'CBC'
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            CBC (Blood Count)
                        </button>
                        <button
                            onClick={() => handleTypeChange('LFT')}
                            className={cn("px-4 py-2 rounded-lg font-medium transition-all",
                                testType === 'LFT'
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            LFT (Liver Function)
                        </button>
                    </div>

                    <div className={cn("mb-8 p-6 rounded-xl border border-dashed text-center", isDark ? "border-white/10 bg-white/5" : "border-slate-300 bg-slate-50")}>
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setLoading(true);
                                    const formData = new FormData();
                                    formData.append('file', e.target.files[0]);

                                    try {
                                        const res = await fetch(`${API_BASE_URL}/api/labs/upload`, {
                                            method: 'POST',
                                            body: formData
                                        });
                                        const data = await res.json();
                                        if (data.entries) {
                                            setEntries(data.entries.map((entry: any) => ({
                                                name: entry.name,
                                                value: entry.value,
                                                unit: entry.unit,
                                                range: entry.range
                                            })));
                                            setTestType('Custom'); // Switch to custom mode
                                        }
                                    } catch (error) {
                                        console.error('Upload failed:', error);
                                        alert('Failed to process file.');
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="hidden"
                            id="lab-upload"
                        />
                        <label htmlFor="lab-upload" className="cursor-pointer flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FlaskConical className="w-6 h-6" />
                            </div>
                            <span className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>Upload Lab Report</span>
                            <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>Supports Images & PDF</span>
                        </label>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-bold uppercase tracking-wider opacity-50">
                            <div className="col-span-4">Test Name</div>
                            <div className="col-span-3">Value</div>
                            <div className="col-span-2">Unit</div>
                            <div className="col-span-2">Range</div>
                        </div>

                        {entries.map((entry, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-4">
                                    <input
                                        type="text"
                                        value={entry.name}
                                        onChange={(e) => handleEntryChange(idx, 'name', e.target.value)}
                                        placeholder="Test Name"
                                        className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={entry.value || ''}
                                        onChange={(e) => handleEntryChange(idx, 'value', e.target.value)}
                                        placeholder="Value"
                                        className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900",
                                            checkAbnormal(entry.value, entry.range) && "border-red-500 text-red-500 bg-red-500/10"
                                        )}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        value={entry.unit}
                                        onChange={(e) => handleEntryChange(idx, 'unit', e.target.value)}
                                        placeholder="Unit"
                                        className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        value={entry.range || ''}
                                        onChange={(e) => handleEntryChange(idx, 'range', e.target.value)}
                                        placeholder="Range"
                                        className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => removeEntry(idx)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addEntry}
                            className={cn("w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-colors mt-4",
                                isDark ? "border-white/10 hover:bg-white/5 text-slate-400" : "border-slate-300 hover:bg-slate-50 text-slate-500"
                            )}
                        >
                            <Plus className="w-4 h-4" /> Add Row
                        </button>

                        <div className="flex justify-end pt-8">
                            <button
                                type="submit"
                                disabled={loading}
                                className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                                    isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
                                    loading && "opacity-50 cursor-not-allowed",
                                    success && "bg-green-500 hover:bg-green-600 shadow-green-500/20"
                                )}
                            >
                                {loading ? (
                                    <>Saving...</>
                                ) : success ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" /> Saved
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" /> Save Results
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
}

export default function LabEntryPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LabEntryContent />
        </Suspense>
    );
}
