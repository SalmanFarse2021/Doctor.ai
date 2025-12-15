import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/ThemeContext';
import { motion } from 'framer-motion';
import {
    User, Bell, Shield, Moon, Sun, Globe,
    LogOut, ChevronRight, Lock, Smartphone,
    Download, Trash2, Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsView() {
    const { data: session } = useSession();
    const { isDark, toggleTheme } = useTheme();

    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        marketing: false
    });

    const [language, setLanguage] = useState('English');

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h2 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>Settings</h2>
                <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Manage your account preferences and application settings.</p>
            </header>

            {/* Account Section */}
            <section className={cn("rounded-2xl border overflow-hidden", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                        <User className="w-5 h-5 text-blue-500" />
                        Account Information
                    </h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Full Name</label>
                            <input
                                type="text"
                                defaultValue={session?.user?.name || ''}
                                className={cn("w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                                    isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium uppercase tracking-wider mb-2 text-slate-500">Email Address</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    defaultValue={session?.user?.email || ''}
                                    disabled
                                    className={cn("w-full p-3 pl-10 rounded-xl border opacity-70 cursor-not-allowed",
                                        isDark ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Appearance & Language */}
            <section className={cn("rounded-2xl border overflow-hidden", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                        <Globe className="w-5 h-5 text-purple-500" />
                        Preferences
                    </h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className={cn("font-medium mb-1", isDark ? "text-white" : "text-slate-900")}>Appearance</h4>
                            <p className="text-xs text-slate-500">Customize how Doctor.ai looks on your device.</p>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                                isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900"
                            )}
                        >
                            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                    </div>
                    <div className={cn("h-px w-full", isDark ? "bg-white/5" : "bg-slate-100")} />
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className={cn("font-medium mb-1", isDark ? "text-white" : "text-slate-900")}>Language</h4>
                            <p className="text-xs text-slate-500">Select your preferred language for the interface.</p>
                        </div>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className={cn("px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                        >
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Notifications */}
            <section className={cn("rounded-2xl border overflow-hidden", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                        <Bell className="w-5 h-5 text-orange-500" />
                        Notifications
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    {[
                        { id: 'email', label: 'Email Notifications', desc: 'Receive updates about your health reports via email.' },
                        { id: 'push', label: 'Push Notifications', desc: 'Get instant alerts on your device.' },
                        { id: 'marketing', label: 'Marketing Emails', desc: 'Receive news and special offers.' }
                    ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                            <div>
                                <h4 className={cn("font-medium mb-1", isDark ? "text-white" : "text-slate-900")}>{item.label}</h4>
                                <p className="text-xs text-slate-500">{item.desc}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(notifications as any)[item.id]}
                                    onChange={() => setNotifications(prev => ({ ...prev, [item.id]: !(prev as any)[item.id] }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </section>

            {/* Security */}
            <section className={cn("rounded-2xl border overflow-hidden", isDark ? "bg-[#0F1420] border-white/5" : "bg-white border-slate-200 shadow-sm")}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                        <Shield className="w-5 h-5 text-green-500" />
                        Security
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <button className={cn("w-full flex items-center justify-between p-4 rounded-xl border transition-colors",
                        isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}>
                        <div className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-slate-400" />
                            <div className="text-left">
                                <h4 className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>Change Password</h4>
                                <p className="text-xs text-slate-500">Update your password regularly to stay safe.</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                    <button className={cn("w-full flex items-center justify-between p-4 rounded-xl border transition-colors",
                        isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}>
                        <div className="flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-slate-400" />
                            <div className="text-left">
                                <h4 className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>Two-Factor Authentication</h4>
                                <p className="text-xs text-slate-500">Add an extra layer of security to your account.</p>
                            </div>
                        </div>
                        <div className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-500">Enabled</div>
                    </button>
                </div>
            </section>

            {/* Danger Zone */}
            <section className={cn("rounded-2xl border overflow-hidden border-red-200 dark:border-red-900/30", isDark ? "bg-[#0F1420]" : "bg-red-50/30")}>
                <div className="p-6 border-b border-red-100 dark:border-red-900/30">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-red-600">
                        <AlertTriangle className="w-5 h-5" />
                        Danger Zone
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className={cn("font-medium mb-1", isDark ? "text-white" : "text-slate-900")}>Export Data</h4>
                            <p className="text-xs text-slate-500">Download a copy of all your health data.</p>
                        </div>
                        <button className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                            isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        )}>
                            <Download className="w-4 h-4" />
                            <span>Export</span>
                        </button>
                    </div>
                    <div className={cn("h-px w-full", isDark ? "bg-red-500/10" : "bg-red-200")} />
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className={cn("font-medium mb-1", isDark ? "text-white" : "text-slate-900")}>Delete Account</h4>
                            <p className="text-xs text-slate-500">Permanently delete your account and all data.</p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors">
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Account</span>
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

import { AlertTriangle } from 'lucide-react';
