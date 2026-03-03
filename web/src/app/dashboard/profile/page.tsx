'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { User, Heart, Activity, AlertCircle, Save, Calendar, Phone, FileText, CheckCircle2, ArrowLeft, LogOut } from 'lucide-react';
import { cn, API_BASE_URL } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isAddingProfile, setIsAddingProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileRelation, setNewProfileRelation] = useState('Child');

    const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
    const [heightFt, setHeightFt] = useState('');
    const [heightIn, setHeightIn] = useState('');

    const [formData, setFormData] = useState({
        dob: '',
        gender: '',
        blood_type: '',
        height_cm: '',
        weight_kg: '',
        allergies: '',
        conditions: '',
        medications: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        language: 'English'
    });

    const fetchProfiles = async () => {
        if (session?.user) {
            try {
                const uid = (session?.user as any).id || session?.user?.email;
                const res = await fetch(`${API_BASE_URL}/api/users/${uid}/profiles`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setProfiles(data);
                    // If no profile selected yet, select the first one
                    if (!selectedProfileId && data.length > 0) {
                        setSelectedProfileId(data[0]._id);
                    }
                } else {
                    setProfiles([]);
                }
            } catch (error) {
                console.error('Error fetching profiles:', error);
                setProfiles([]);
            }
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchProfiles();
        }
    }, [status, session]);

    useEffect(() => {
        if (selectedProfileId && profiles.length > 0) {
            const profile = profiles.find(p => p._id === selectedProfileId);
            if (profile) {
                setFormData({
                    dob: profile.dob || '',
                    gender: profile.gender || '',
                    blood_type: profile.blood_type || '',
                    height_cm: profile.height_cm || '',
                    weight_kg: profile.weight_kg || '',
                    allergies: profile.allergies?.join(', ') || '',
                    conditions: profile.conditions?.join(', ') || '',
                    medications: profile.medications?.join(', ') || '',
                    emergency_contact_name: profile.emergency_contact_name || '',
                    emergency_contact_phone: profile.emergency_contact_phone || '',
                    language: 'English'
                });

                if (profile.height_cm) {
                    const cm = parseFloat(profile.height_cm);
                    const totalInches = cm / 2.54;
                    const ft = Math.floor(totalInches / 12);
                    const inches = Math.round(totalInches % 12);
                    setHeightFt(ft.toString());
                    setHeightIn(inches.toString());
                } else {
                    setHeightFt('');
                    setHeightIn('');
                }
            }
        }
    }, [selectedProfileId, profiles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(false);

        try {
            const uid = (session?.user as any).id || session?.user?.email;

            if (selectedProfileId) {
                await fetch(`${API_BASE_URL}/api/profiles/${selectedProfileId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dob: formData.dob,
                        gender: formData.gender,
                        blood_type: formData.blood_type,
                        height_cm: parseFloat(formData.height_cm) || null,
                        weight_kg: parseFloat(formData.weight_kg) || null,
                        allergies: formData.allergies.split(',').map(s => s.trim()).filter(Boolean),
                        conditions: formData.conditions.split(',').map(s => s.trim()).filter(Boolean),
                        medications: formData.medications.split(',').map(s => s.trim()).filter(Boolean),
                        emergency_contact_name: formData.emergency_contact_name,
                        emergency_contact_phone: formData.emergency_contact_phone
                    }),
                });
            }

            // Save Language Preference
            await fetch(`${API_BASE_URL}/api/users/${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: formData.language
                }),
            });

            setSuccess(true);
            await fetchProfiles(); // Refresh data
            setIsEditing(false); // Exit edit mode
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

        // If updating height in cm directly, update ft/in state
        if (e.target.name === 'height_cm') {
            const cm = parseFloat(e.target.value);
            if (!isNaN(cm)) {
                const totalInches = cm / 2.54;
                const ft = Math.floor(totalInches / 12);
                const inches = Math.round(totalInches % 12);
                setHeightFt(ft.toString());
                setHeightIn(inches.toString());
            } else {
                setHeightFt('');
                setHeightIn('');
            }
        }
    };

    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let newFt = heightFt;
        let newIn = heightIn;

        if (name === 'height_ft') {
            setHeightFt(value);
            newFt = value;
        } else if (name === 'height_in') {
            setHeightIn(value);
            newIn = value;
        }

        const ft = parseFloat(newFt) || 0;
        const inches = parseFloat(newIn) || 0;
        if (ft > 0 || inches > 0) {
            const cm = ((ft * 12) + inches) * 2.54;
            setFormData(prev => ({ ...prev, height_cm: cm.toFixed(0) }));
        } else {
            setFormData(prev => ({ ...prev, height_cm: '' }));
        }
    };



    const handleAddProfile = async () => {
        if (!newProfileName) return;
        try {
            const uid = (session?.user as any).id || session?.user?.email;
            const res = await fetch(`${API_BASE_URL}/api/users/${uid}/profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_id: uid,
                    name: newProfileName,
                    relation: newProfileRelation
                })
            });
            const data = await res.json();
            if (data.status === 'created') {
                await fetchProfiles();
                setSelectedProfileId(data.profile_id);
                setIsAddingProfile(false);
                setNewProfileName('');
                setIsEditing(true); // Enter edit mode for new profile
            }
        } catch (error) {
            console.error('Error adding profile:', error);
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-lg mb-6">Please sign in to view your profile.</p>
                <button
                    onClick={() => signIn('google')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                >
                    Sign In
                </button>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen p-4 md:p-8 transition-colors duration-500", isDark ? "bg-[#0B0F19] text-slate-200" : "bg-slate-50 text-slate-900")}>
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className={cn("mb-6 flex items-center gap-2 md:hidden text-sm font-medium transition-colors", isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className={cn("text-3xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Health Profile</h1>
                        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Manage your personal health information and medical history.</p>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className={cn("px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                                isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                            )}
                        >
                            Edit Profile
                        </button>
                    )}
                </header>

                {/* Family Profiles */}
                <section className="mb-8">
                    <div className="flex items-center gap-4 overflow-x-auto pb-4">
                        {profiles.map(profile => (
                            <button
                                key={profile._id}
                                onClick={() => { setSelectedProfileId(profile._id); setIsEditing(false); }}
                                className={cn("px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all border",
                                    selectedProfileId === profile._id
                                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20"
                                        : isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                {profile.name} ({profile.relation})
                            </button>
                        ))}
                        <button
                            onClick={() => setIsAddingProfile(true)}
                            className={cn("px-4 py-3 rounded-xl font-bold whitespace-nowrap transition-all border border-dashed flex items-center gap-2",
                                isDark ? "border-white/20 hover:border-white/40 text-slate-400 hover:text-white" : "border-slate-300 hover:border-slate-400 text-slate-500 hover:text-slate-700"
                            )}
                        >
                            + Add Family Member
                        </button>
                    </div>

                    {isAddingProfile && (
                        <div className={cn("p-6 rounded-2xl border mb-6", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h3 className="font-bold mb-4">Add New Profile</h3>
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    className={cn("flex-1 p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                                <select
                                    value={newProfileRelation}
                                    onChange={(e) => setNewProfileRelation(e.target.value)}
                                    className={cn("p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    <option value="Spouse">Spouse</option>
                                    <option value="Child">Child</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Other">Other</option>
                                </select>
                                <button
                                    onClick={handleAddProfile}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => setIsAddingProfile(false)}
                                    className={cn("px-6 py-3 rounded-xl font-bold", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Personal Info */}
                        <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <User className="w-5 h-5 text-blue-500" />
                                Personal Information
                            </h2>
                            <div className="mb-6">
                                <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Preferred Language</label>
                                <select
                                    name="language"
                                    value={formData.language}
                                    onChange={handleChange}
                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish (Español)</option>
                                    <option value="French">French (Français)</option>
                                    <option value="German">German (Deutsch)</option>
                                    <option value="Chinese">Chinese (中文)</option>
                                    <option value="Hindi">Hindi (हिन्दी)</option>
                                    <option value="Arabic">Arabic (العربية)</option>
                                </select>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Date of Birth</label>
                                    <input
                                        type="date"
                                        name="dob"
                                        value={formData.dob}
                                        onChange={handleChange}
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
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Blood Type</label>
                                    <select
                                        name="blood_type"
                                        value={formData.blood_type}
                                        onChange={handleChange}
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    >
                                        <option value="">Select Blood Type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* Vitals */}
                        <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <Activity className="w-5 h-5 text-green-500" />
                                Body Measurements
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">Height</label>
                                        <div className="flex bg-slate-100 dark:bg-white/10 rounded-lg p-1">
                                            <button
                                                type="button"
                                                onClick={() => setHeightUnit('cm')}
                                                className={cn("px-2 py-1 text-xs rounded-md transition-all", heightUnit === 'cm' ? "bg-white dark:bg-white/20 shadow-sm font-bold" : "text-slate-500 dark:text-slate-400")}
                                            >
                                                CM
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHeightUnit('ft')}
                                                className={cn("px-2 py-1 text-xs rounded-md transition-all", heightUnit === 'ft' ? "bg-white dark:bg-white/20 shadow-sm font-bold" : "text-slate-500 dark:text-slate-400")}
                                            >
                                                FT
                                            </button>
                                        </div>
                                    </div>

                                    {heightUnit === 'cm' ? (
                                        <input
                                            type="number"
                                            name="height_cm"
                                            value={formData.height_cm}
                                            onChange={handleChange}
                                            placeholder="e.g. 175"
                                            className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                            )}
                                        />
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="number"
                                                    name="height_ft"
                                                    value={heightFt}
                                                    onChange={handleHeightChange}
                                                    placeholder="5"
                                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                                    )}
                                                />
                                                <span className="text-xs text-slate-500 mt-1 block text-center">ft</span>
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="number"
                                                    name="height_in"
                                                    value={heightIn}
                                                    onChange={handleHeightChange}
                                                    placeholder="9"
                                                    className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                                        isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                                    )}
                                                />
                                                <span className="text-xs text-slate-500 mt-1 block text-center">in</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Weight (kg)</label>
                                    <input
                                        type="number"
                                        name="weight_kg"
                                        value={formData.weight_kg}
                                        onChange={handleChange}
                                        placeholder="e.g. 70"
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Medical History */}
                        <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <FileText className="w-5 h-5 text-purple-500" />
                                Medical History
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Allergies (comma separated)</label>
                                    <textarea
                                        name="allergies"
                                        value={formData.allergies}
                                        onChange={handleChange}
                                        placeholder="e.g. Peanuts, Penicillin"
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[100px]",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Chronic Conditions (comma separated)</label>
                                    <textarea
                                        name="conditions"
                                        value={formData.conditions}
                                        onChange={handleChange}
                                        placeholder="e.g. Asthma, Diabetes"
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[100px]",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Current Medications (comma separated)</label>
                                    <textarea
                                        name="medications"
                                        value={formData.medications}
                                        onChange={handleChange}
                                        placeholder="e.g. Ibuprofen, Insulin"
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[100px]",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Emergency Contact */}
                        <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <Phone className="w-5 h-5 text-red-500" />
                                Emergency Contact
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Contact Name</label>
                                    <input
                                        type="text"
                                        name="emergency_contact_name"
                                        value={formData.emergency_contact_name}
                                        onChange={handleChange}
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Phone Number</label>
                                    <input
                                        type="tel"
                                        name="emergency_contact_phone"
                                        value={formData.emergency_contact_phone}
                                        onChange={handleChange}
                                        className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end pt-4 gap-4">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className={cn("px-8 py-4 rounded-xl font-bold text-lg transition-all",
                                    isDark ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600"
                                )}
                            >
                                Cancel
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
                                ) : success ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Saved Successfully
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Profile
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-8">
                        {/* Read-Only View */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Personal Info Card */}
                            <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                    <User className="w-5 h-5 text-blue-500" />
                                    Personal Information
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Language</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.language}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Date of Birth</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.dob || 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Gender</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.gender || 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Blood Type</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.blood_type || 'Not set'}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Vitals Card */}
                            <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                    <Activity className="w-5 h-5 text-green-500" />
                                    Body Measurements
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Height</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.height_cm ? `${formData.height_cm} cm` : 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Weight</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.weight_kg ? `${formData.weight_kg} kg` : 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">BMI</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>
                                            {formData.height_cm && formData.weight_kg
                                                ? (Number(formData.weight_kg) / Math.pow(Number(formData.height_cm) / 100, 2)).toFixed(1)
                                                : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Medical History Card */}
                        <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                            <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                <FileText className="w-5 h-5 text-purple-500" />
                                Medical History
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className={cn("p-4 rounded-xl", isDark ? "bg-white/5" : "bg-slate-50")}>
                                    <h3 className="font-bold mb-2 text-sm uppercase tracking-wider text-slate-500">Allergies</h3>
                                    <p className={isDark ? "text-white" : "text-slate-900"}>{formData.allergies || 'None listed'}</p>
                                </div>
                                <div className={cn("p-4 rounded-xl", isDark ? "bg-white/5" : "bg-slate-50")}>
                                    <h3 className="font-bold mb-2 text-sm uppercase tracking-wider text-slate-500">Conditions</h3>
                                    <p className={isDark ? "text-white" : "text-slate-900"}>{formData.conditions || 'None listed'}</p>
                                </div>
                                <div className={cn("p-4 rounded-xl", isDark ? "bg-white/5" : "bg-slate-50")}>
                                    <h3 className="font-bold mb-2 text-sm uppercase tracking-wider text-slate-500">Medications</h3>
                                    <p className={isDark ? "text-white" : "text-slate-900"}>{formData.medications || 'None listed'}</p>
                                </div>
                            </div>
                        </section>

                        {/* Emergency Contact & Apps */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                    <Phone className="w-5 h-5 text-red-500" />
                                    Emergency Contact
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Name</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.emergency_contact_name || 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-500">Phone</span>
                                        <span className={isDark ? "text-white" : "text-slate-900"}>{formData.emergency_contact_phone || 'Not set'}</span>
                                    </div>
                                </div>
                            </section>

                            <section className={cn("p-6 rounded-2xl border", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                                <h2 className={cn("text-lg font-bold mb-6 flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                                    <LogOut className="w-5 h-5 text-gray-500" />
                                    Account Actions
                                </h2>
                                <button
                                    onClick={() => window.location.href = '/api/auth/signout'}
                                    className="w-full py-3 rounded-xl font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </section>


                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
