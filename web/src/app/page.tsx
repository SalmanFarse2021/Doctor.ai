'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Float, Sparkles, Environment, Stars } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';
import { Activity, Heart, Shield, Brain, ChevronRight, Stethoscope, FileText, Smartphone, MessageSquare, Mic, User, Search, Zap, Clock, ArrowRight, CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession, signIn, signOut } from "next-auth/react";

// --- 3D Components ---

function NeuralNetwork({ dark }: { dark: boolean }) {
    const points = useMemo(() => random.inSphere(new Float32Array(3000), { radius: 2.5 }), []);
    const ref = useRef<any>();

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 15;
            ref.current.rotation.y -= delta / 20;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={points} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color={dark ? "#60a5fa" : "#0284c7"}
                    size={dark ? 0.008 : 0.006}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={dark ? 0.8 : 0.6}
                />
            </Points>
        </group>
    );
}

function FloatingOrbs({ dark }: { dark: boolean }) {
    return (
        <group>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                <mesh position={[2, 1, -2]}>
                    <sphereGeometry args={[0.4, 32, 32]} />
                    <meshStandardMaterial color={dark ? "#3b82f6" : "#e0f2fe"} roughness={0.1} metalness={0.8} transparent opacity={0.6} />
                </mesh>
            </Float>
            <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.8}>
                <mesh position={[-2, -1, -1]}>
                    <sphereGeometry args={[0.3, 32, 32]} />
                    <meshStandardMaterial color={dark ? "#a78bfa" : "#f0f9ff"} roughness={0.1} metalness={0.8} transparent opacity={0.5} />
                </mesh>
            </Float>
        </group>
    );
}

function Scene({ dark }: { dark: boolean }) {
    return (
        <div className={cn("absolute inset-0 -z-10 h-[120vh] w-full transition-colors duration-1000 bg-gradient-to-b from-slate-50 to-white dark:bg-[#020617] dark:bg-none")}>
            <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 2]}>
                <ambientLight intensity={dark ? 0.5 : 0.8} />
                <pointLight position={[10, 10, 10]} intensity={dark ? 1.5 : 1} color={dark ? "#60a5fa" : "#ffffff"} />
                {!dark && <Environment preset="city" />}
                {dark && <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />}
                <NeuralNetwork dark={dark} />
                <FloatingOrbs dark={dark} />
                <Sparkles count={dark ? 500 : 200} scale={5} size={2} speed={0.4} opacity={dark ? 0.5 : 0.4} color={dark ? "#ffffff" : "#0ea5e9"} />
                {dark && <fog attach="fog" args={['#020617', 5, 12]} />}
            </Canvas>
        </div>
    );
}

// --- UI Components ---

const FeatureCard = ({ title, desc, icon: Icon, index }: any) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: index * 0.1, duration: 0.6 }}
            className={cn(
                "group relative p-8 rounded-[2rem] border transition-all duration-500 hover:-translate-y-2 bg-white border-slate-200 shadow-xl shadow-slate-200/50 hover:border-blue-200 hover:shadow-blue-500/10 dark:bg-white/5 dark:border-white/10 dark:hover:border-blue-500/50 dark:hover:bg-white/10 dark:hover:shadow-2xl dark:hover:shadow-blue-900/20 backdrop-blur-sm"
            )}
        >
            <div className="relative z-10">
                <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border shadow-lg bg-blue-50 border-blue-100 shadow-blue-100 dark:bg-gradient-to-br dark:from-blue-600/20 dark:to-purple-600/20 dark:border-white/10 dark:shadow-blue-900/20"
                )}>
                    <Icon className={cn("w-7 h-7 transition-colors text-blue-600 group-hover:text-blue-500 dark:text-blue-400 dark:group-hover:text-blue-300")} />
                </div>
                <h3 className={cn("text-xl font-bold mb-3 tracking-tight text-slate-900 dark:text-white")}>{title}</h3>
                <p className={cn("leading-relaxed text-sm transition-colors text-slate-600 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300")}>
                    {desc}
                </p>
            </div>
        </motion.div>
    );
};

const ProcessStep = ({ number, title, desc, active }: any) => (
    <div className={cn("relative pl-8 pb-12 border-l transition-colors duration-500",
        active ? "border-blue-600" : "border-slate-200 dark:border-white/10"
    )}>
        <span className={cn(
            "absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full border-4 transition-colors duration-500",
            active
                ? "border-blue-600 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] dark:border-blue-500 dark:bg-blue-500 dark:shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
        )} />
        <div className={cn("transition-all duration-500", active ? "opacity-100 translate-x-2" : "opacity-40")}>
            <span className={cn("text-xs font-mono mb-2 block font-bold text-blue-600 dark:text-blue-400")}>STEP {number}</span>
            <h4 className={cn("text-lg font-bold mb-2 text-slate-900 dark:text-white")}>{title}</h4>
            <p className={cn("text-sm text-slate-600 dark:text-slate-400")}>{desc}</p>
        </div>
    </div>
);

import { useTheme } from '@/context/ThemeContext';

// ...

export default function LandingPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { isDark, toggleTheme } = useTheme(); // Use global theme
    const [activeStep, setActiveStep] = useState(0);
    // const [isDark, setIsDark] = useState(true); // Removed local state
    const { scrollYProgress } = useScroll();

    // ...

    // Update Toggle Button to use toggleTheme
    // ...
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const handleStart = () => {
        if (session) {
            router.push('/dashboard');
        } else {
            signIn('google');
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % 4);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (session) {
            router.push('/dashboard');
        }
    }, [session, router]);

    return (
        <div className={cn("min-h-screen font-sans overflow-x-hidden transition-colors duration-700 bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900 dark:bg-[#020617] dark:text-slate-200 dark:selection:bg-blue-500/30"
        )}>
            {/* Scroll Progress Bar */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 origin-left z-[100]"
                style={{ scaleX }}
            />

            <Scene dark={isDark} />

            {/* Theme Toggle Button */}
            <button
                onClick={toggleTheme}
                className={cn(
                    "fixed bottom-8 right-8 z-[100] p-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border bg-white text-slate-900 hover:bg-slate-50 border-slate-200 shadow-slate-200/50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border-white/20 dark:backdrop-blur-md"
                )}
            >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>



            {/* Navbar */}
            <nav className={cn("fixed w-full z-50 border-b backdrop-blur-xl transition-colors duration-700 border-slate-200/60 bg-white/80 dark:border-white/5 dark:bg-[#020617]/80"
            )}>
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-600/20 dark:shadow-blue-900/20"
                        )}>
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <span className={cn("text-xl font-bold tracking-tight text-slate-900 dark:text-white")}>
                            Doctor<span className={cn("text-blue-600 dark:text-blue-500")}>.ai</span>
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-10">
                        {['Features', 'How it Works', 'Pricing'].map((item) => (
                            <Link key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`} className={cn("text-sm font-medium transition-colors hover:-translate-y-0.5 transform duration-200 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"
                            )}>
                                {item}
                            </Link>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-6">
                        {session ? (
                            <div className="flex items-center gap-4">
                                <Link href="/dashboard" className={cn("text-sm font-medium hover:text-blue-500 transition-colors text-slate-600 dark:text-slate-300")}>
                                    {session.user?.name}
                                </Link>
                                <button
                                    onClick={() => signOut()}
                                    className={cn("text-sm font-medium hover:underline text-slate-500 dark:text-slate-400")}
                                >
                                    Sign Out
                                </button>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                    {session.user?.name?.[0]}
                                </div>
                            </div>
                        ) : (
                            <>
                                <button onClick={() => signIn('google')} className={cn("text-sm font-medium hover:text-white transition-colors text-slate-600 dark:text-slate-300")}>Log In</button>
                                <button onClick={handleStart} className="px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-sm font-bold hover:shadow-lg hover:shadow-orange-500/20 transition-all">
                                    Try Free Beta
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-32 lg:pt-52 lg:pb-40">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md mb-8 bg-white border-slate-200 shadow-sm dark:bg-white/5 dark:border-white/10"
                            )}>
                            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            <span className={cn("text-sm font-medium text-slate-600 dark:text-slate-300")}>AI Diagnostic Engine v2.0 Live</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className={cn("text-6xl md:text-8xl font-bold tracking-tight mb-8 max-w-4xl text-slate-900 dark:text-white")}
                        >
                            Your Personal <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-gradient-x">
                                AI Doctor
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className={cn("text-xl mb-12 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400")}
                        >
                            Experience the future of healthcare. Instant symptom analysis, lab report interpretation, and personalized health plans—powered by advanced medical AI.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto"
                        >
                            <button
                                onClick={handleStart}
                                className={cn("px-8 py-4 rounded-full text-white font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-2 group min-w-[200px] hover:-translate-y-1 bg-blue-600 hover:bg-blue-700 shadow-blue-600/30 dark:hover:bg-blue-500 dark:shadow-blue-600/40"
                                )}>
                                Start Diagnosis
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className={cn("px-8 py-4 rounded-full font-bold text-lg transition-all border min-w-[200px] hover:-translate-y-1 bg-white text-slate-900 hover:bg-slate-50 border-slate-200 shadow-lg shadow-slate-200/50 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:border-white/10 dark:backdrop-blur-sm"
                            )}>
                                View Demo
                            </button>
                        </motion.div>
                    </div>

                    {/* Floating Interface Mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, rotateX: 10 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="mt-24 relative mx-auto max-w-5xl perspective-1000"
                    >
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            className={cn("relative z-10 rounded-t-3xl border shadow-2xl overflow-hidden transition-colors duration-700 bg-white border-slate-200 shadow-slate-300/50 dark:bg-[#0a0a0a] dark:border-white/10 dark:shadow-blue-900/20"
                            )}
                        >
                            <div className={cn("h-12 border-b flex items-center px-4 gap-2 bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/5"
                            )}>
                                <div className="flex gap-2">
                                    <div className={cn("w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/20 dark:border dark:border-red-500/50")} />
                                    <div className={cn("w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500/20 dark:border dark:border-yellow-500/50")} />
                                    <div className={cn("w-3 h-3 rounded-full bg-green-400 dark:bg-green-500/20 dark:border dark:border-green-500/50")} />
                                </div>
                                <div className={cn("mx-auto text-xs font-mono text-slate-400 dark:text-slate-500")}>health-ai-diagnostic-terminal</div>
                            </div>

                            <div className={cn("p-8 grid md:grid-cols-3 gap-8 bg-white dark:bg-gradient-to-b dark:from-[#0a0a0a] dark:to-black")}>
                                {/* Chat Column */}
                                <div className="md:col-span-2 space-y-6">
                                    <div className="flex gap-4">
                                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-gradient-to-br dark:from-blue-600 dark:to-purple-600 dark:shadow-lg dark:shadow-blue-500/20"
                                        )}>
                                            <Brain className={cn("w-5 h-5 text-blue-600 dark:text-white")} />
                                        </div>
                                        <div className={cn("rounded-2xl rounded-tl-none p-5 border max-w-[90%] bg-slate-50 border-slate-100 shadow-sm dark:bg-white/5 dark:border-white/5"
                                        )}>
                                            <p className={cn("text-sm leading-relaxed text-slate-700 dark:text-slate-300")}>
                                                Hello. I&apos;m your AI health assistant. I see you uploaded a CBC report. Your <span className={cn("font-bold text-red-500 dark:text-red-400")}>Platelet Count is 95,000</span>, which is lower than normal (150k-450k).
                                                <br /><br />
                                                Combined with your fever symptoms, this strongly suggests a viral infection. Do you have any body aches or rashes?
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 flex-row-reverse">
                                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-white/10"
                                        )}>
                                            <User className={cn("w-5 h-5 text-slate-500 dark:text-slate-400")} />
                                        </div>
                                        <div className={cn("rounded-2xl rounded-tr-none p-5 max-w-[90%] bg-blue-600 text-white shadow-md shadow-blue-600/20 dark:bg-blue-600/10 dark:border dark:border-blue-600/20"
                                        )}>
                                            <p className={cn("text-sm text-white dark:text-blue-100")}>Yes, I have severe joint pain and a mild headache. No rashes yet.</p>
                                        </div>
                                    </div>

                                    {/* Typing Indicator */}
                                    <div className={cn("flex gap-2 items-center text-xs ml-14 text-slate-400 dark:text-slate-500")}>
                                        <span className={cn("w-1.5 h-1.5 rounded-full animate-bounce bg-blue-400 dark:bg-blue-500")} />
                                        <span className={cn("w-1.5 h-1.5 rounded-full animate-bounce delay-100 bg-blue-400 dark:bg-blue-500")} />
                                        <span className={cn("w-1.5 h-1.5 rounded-full animate-bounce delay-200 bg-blue-400 dark:bg-blue-500")} />
                                        Analyzing symptoms...
                                    </div>
                                </div>

                                {/* Sidebar Stats */}
                                <div className="space-y-4">
                                    <div className={cn("rounded-xl p-4 border bg-slate-50 border-slate-100 dark:bg-white/5 dark:border-white/5")}>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Differential Diagnosis</h4>
                                        <div className="space-y-4">
                                            {[
                                                { name: "Viral Fever", prob: 78, color: "bg-blue-500" },
                                                { name: "Dengue", prob: 45, color: "bg-orange-500" },
                                                { name: "Typhoid", prob: 12, color: "bg-slate-400 dark:bg-slate-600" }
                                            ].map((item) => (
                                                <div key={item.name}>
                                                    <div className="flex justify-between text-xs mb-1.5">
                                                        <span className={cn("font-medium text-slate-600 dark:text-slate-300")}>{item.name}</span>
                                                        <span className={cn("font-mono text-slate-500 dark:text-slate-400")}>{item.prob}%</span>
                                                    </div>
                                                    <div className={cn("w-full h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-black")}>
                                                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.prob}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={cn("rounded-xl p-4 border bg-slate-50 border-slate-100 dark:bg-white/5 dark:border-white/5")}>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Recommended Actions</h4>
                                        <ul className="space-y-3">
                                            <li className={cn("flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300")}>
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                <span>Hydration Therapy</span>
                                            </li>
                                            <li className={cn("flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300")}>
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                <span>Monitor Temperature</span>
                                            </li>
                                            <li className={cn("flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300")}>
                                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                                <span>Repeat CBC in 24h</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Glow under the interface */}
                        <div className="absolute -inset-4 bg-blue-500/20 blur-3xl -z-10 rounded-[3rem] opacity-40" />
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section className={cn("py-32 relative z-10 border-t transition-colors duration-700 bg-white border-slate-100 dark:bg-[#020617] dark:border-white/5")}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="mb-20 text-center">
                        <h2 className={cn("text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white")}>Advanced Capabilities</h2>
                        <p className={cn("max-w-2xl mx-auto text-slate-500 dark:text-slate-400")}>
                            Built on a foundation of medical knowledge and cutting-edge AI to provide safe, accurate, and helpful guidance.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCard
                            index={0}
                            title="Symptom Analysis"
                            desc="Natural language processing that understands medical terminology and colloquial descriptions alike."
                            icon={Brain}
                        />
                        <FeatureCard
                            index={1}
                            title="Lab Report OCR"
                            desc="Instantly digitize and analyze PDF or photo lab reports. We spot trends doctors might miss."
                            icon={FileText}
                        />
                        <FeatureCard
                            index={2}
                            title="Emergency Triage"
                            desc="Real-time red flag detection system to identify critical conditions requiring urgent care."
                            icon={Shield}
                        />
                        <FeatureCard
                            index={3}
                            title="Personalized Plans"
                            desc="Dynamic recovery plans including diet, sleep, and lifestyle adjustments tailored to you."
                            icon={Heart}
                        />

                        <FeatureCard
                            index={5}
                            title="Doctor Assistant"
                            desc="Prepares you for doctor visits with summarized reports and suggested questions to ask."
                            icon={Stethoscope}
                        />
                    </div>
                </div>
            </section>

            {/* Workflow Section */}
            <section className={cn("py-32 border-t transition-colors duration-700 bg-slate-50 border-slate-100 dark:bg-[#020617] dark:border-white/5")}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <h2 className={cn("text-4xl md:text-5xl font-bold mb-8 text-slate-900 dark:text-white")}>
                                How it <br />
                                <span className={cn("text-blue-600 dark:text-blue-500")}>Works</span>
                            </h2>
                            <div className="space-y-2">
                                {[
                                    { title: "Describe Symptoms", desc: "Chat with AI naturally or upload lab reports." },
                                    { title: "AI Analysis", desc: "Our engine maps symptoms to medical conditions." },
                                    { title: "Receive Guidance", desc: "Get a breakdown of possibilities and next steps." },
                                    { title: "Take Action", desc: "Follow personalized recovery and lifestyle plans." }
                                ].map((step, i) => (
                                    <ProcessStep
                                        key={i}
                                        number={`0${i + 1}`}
                                        title={step.title}
                                        desc={step.desc}
                                        active={activeStep === i}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={cn("relative h-[600px] rounded-3xl overflow-hidden border shadow-2xl transition-colors duration-700 bg-white border-slate-200 shadow-slate-200/50 dark:bg-white/5 dark:border-white/10"
                        )}>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="relative w-64 h-64">
                                    <div className={cn("absolute inset-0 blur-[80px] rounded-full animate-pulse bg-blue-100 dark:bg-blue-500/30")} />
                                    <div className={cn("relative z-10 w-full h-full backdrop-blur-xl rounded-3xl border flex items-center justify-center shadow-lg transition-colors duration-700 bg-white/80 border-slate-100 dark:bg-black/40 dark:border-white/10"
                                    )}>
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={activeStep}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 0.4 }}
                                            >
                                                {activeStep === 0 && <MessageSquare className={cn("w-20 h-20 text-blue-500 dark:text-blue-400")} />}
                                                {activeStep === 1 && <Brain className={cn("w-20 h-20 text-indigo-500 dark:text-purple-400")} />}
                                                {activeStep === 2 && <FileText className={cn("w-20 h-20 text-green-500 dark:text-green-400")} />}
                                                {activeStep === 3 && <Activity className={cn("w-20 h-20 text-orange-500 dark:text-orange-400")} />}
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={cn("border-t pt-20 pb-10 transition-colors duration-700 bg-white border-slate-200 dark:bg-[#020617] dark:border-white/5")}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <span className={cn("text-xl font-bold text-slate-900 dark:text-white")}>Doctor.ai</span>
                        </div>
                        <div className={cn("flex gap-8 text-sm text-slate-500 dark:text-slate-400")}>
                            <Link href="#" className={cn("transition-colors hover:text-blue-600 dark:hover:text-white")}>Privacy</Link>
                            <Link href="#" className={cn("transition-colors hover:text-blue-600 dark:hover:text-white")}>Terms</Link>
                            <Link href="#" className={cn("transition-colors hover:text-blue-600 dark:hover:text-white")}>Twitter</Link>
                            <Link href="#" className={cn("transition-colors hover:text-blue-600 dark:hover:text-white")}>GitHub</Link>
                        </div>
                    </div>
                    <div className={cn("mt-8 text-center text-xs text-slate-400 dark:text-slate-600")}>
                        © 2024 Doctor.ai Inc. Not a replacement for professional medical advice.
                    </div>
                </div>
            </footer>
        </div>
    );
}
