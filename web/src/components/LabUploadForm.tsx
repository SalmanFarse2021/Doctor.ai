'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { FlaskConical, Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';


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

interface LabUploadFormProps {
    visitId: string;
    onSuccess: () => void;
}

export default function LabUploadForm({ visitId, onSuccess }: LabUploadFormProps) {
    const { data: session } = useSession();


    const [testType, setTestType] = useState('CBC');
    const [entries, setEntries] = useState<any[]>(LAB_TEMPLATES['CBC']);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [fileSelected, setFileSelected] = useState(false);

    const checkAbnormal = (value: string | number, range: string) => {
        if (!value || !range) return false;
        const numVal = parseFloat(value.toString());
        if (isNaN(numVal)) return false;

        const parts = range.split('-').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return numVal < parts[0] || numVal > parts[1];
        }
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
                    visit_id: visitId,
                    user_id: uid,
                    test_type: testType,
                    entries: validEntries
                }),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            }
        } catch (error) {
            console.error('Error saving labs:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn("p-6 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#0F1420] dark:border-white/5")}>
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => handleTypeChange('CBC')}
                    className={cn("px-4 py-2 rounded-lg font-medium transition-all",
                        testType === 'CBC'
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                    )}
                >
                    CBC
                </button>
                <button
                    onClick={() => handleTypeChange('LFT')}
                    className={cn("px-4 py-2 rounded-lg font-medium transition-all",
                        testType === 'LFT'
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                    )}
                >
                    LFT
                </button>
                {testType === 'Custom' && (
                    <button
                        className={cn("px-4 py-2 rounded-lg font-medium transition-all bg-purple-600 text-white shadow-lg shadow-purple-600/20")}
                    >
                        Custom / Extracted
                    </button>
                )}
            </div>

            <div className={cn("mb-8 p-6 rounded-xl border border-dashed text-center border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5")}>
                <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            const fileLabel = document.getElementById('file-label-text');
                            if (fileLabel) fileLabel.innerText = file.name;
                            setFileSelected(true);
                        } else {
                            setFileSelected(false);
                        }
                    }}
                    className="hidden"
                    id="lab-upload-inline"
                />
                <label htmlFor="lab-upload-inline" className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <FlaskConical className="w-6 h-6" />
                    </div>
                    <span id="file-label-text" className={cn("font-medium text-slate-900 dark:text-white")}>Select Lab Report (PDF/Image)</span>
                    <span className={cn("text-xs text-slate-500 dark:text-slate-400")}>Click to browse</span>
                </label>

                <button
                    id="extract-btn"
                    type="button"
                    disabled={!fileSelected || loading}
                    onClick={async () => {
                        const fileInput = document.getElementById('lab-upload-inline') as HTMLInputElement;
                        if (fileInput && fileInput.files && fileInput.files[0]) {
                            setLoading(true);
                            const formData = new FormData();
                            formData.append('file', fileInput.files[0]);

                            try {
                                const res = await fetch(`${API_BASE_URL}/api/labs/upload`, {
                                    method: 'POST',
                                    body: formData
                                });
                                const data = await res.json();
                                if (data.error) {
                                    alert(`Extraction failed: ${data.error}`);
                                } else if (data.entries) {
                                    console.log("Extracted data:", data);
                                    if (data.warning) {
                                        alert(data.warning);
                                    }
                                    setEntries(data.entries.map((entry: any) => ({
                                        name: entry.name || entry.test_name || '',
                                        value: entry.value,
                                        unit: entry.unit || '',
                                        range: entry.range || entry.reference_range || ''
                                    })));
                                    setTestType('Custom');
                                }
                            } catch (error) {
                                console.error('Upload failed:', error);
                                alert('Failed to process file.');
                            } finally {
                                setLoading(false);
                            }
                        }
                    }}
                    className={cn("mt-4 px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500"
                    )}
                >
                    {loading ? 'Extracting...' : 'Extract Data'}
                </button>
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
                                className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
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
                                className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white",
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
                                className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
                                )}
                            />
                        </div>
                        <div className="col-span-2">
                            <input
                                type="text"
                                value={entry.range || ''}
                                onChange={(e) => handleEntryChange(idx, 'range', e.target.value)}
                                placeholder="Range"
                                className={cn("w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
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
                    className={cn("w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-colors mt-4 border-slate-300 hover:bg-slate-50 text-slate-500 dark:border-white/10 dark:hover:bg-white/5 dark:text-slate-400"
                    )}
                >
                    <Plus className="w-4 h-4" /> Add Row
                </button>

                <div className="flex justify-end pt-8">
                    <button
                        type="submit"
                        disabled={loading}
                        className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 dark:hover:bg-blue-500",
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
    );
}
