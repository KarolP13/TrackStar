"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Logo from "@/components/Logo";

export default function LoginPage() {
    const { user, loading, signIn, signUp, resetPassword } = useAuth();
    const router = useRouter();
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push("/");
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            if (isSignUp) {
                await signUp(email, password);
            } else {
                await signIn(email, password);
            }
            router.push("/");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "An error occurred";
            // Clean up Firebase error messages
            if (message.includes("auth/invalid-credential")) {
                setError("Invalid email or password.");
            } else if (message.includes("auth/email-already-in-use")) {
                setError("This email is already registered. Try signing in.");
            } else if (message.includes("auth/weak-password")) {
                setError("Password must be at least 6 characters.");
            } else if (message.includes("auth/invalid-email")) {
                setError("Please enter a valid email address.");
            } else {
                setError(message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setResetMessage("");
        setSubmitting(true);
        try {
            await resetPassword(email);
            setResetMessage("Check your email for a password reset link.");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "An error occurred";
            if (message.includes("auth/user-not-found")) {
                setError("No account found with this email.");
            } else if (message.includes("auth/invalid-email")) {
                setError("Please enter a valid email address.");
            } else if (message.includes("auth/too-many-requests")) {
                setError("Too many attempts. Please try again later.");
            } else {
                setError(message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (user) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
            <div className="w-full max-w-sm animate-fade-in">
                {/* Logo */}
                <div className="flex flex-col items-center mb-10">
                    <Logo size="lg" className="mb-4" />
                    <p className="text-white/30 text-sm tracking-wide">
                        Track every promo. Never miss a payment.
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm animate-pulse-glow">
                    <h2 className="text-lg font-semibold text-white mb-5">
                        {isForgotPassword
                            ? "Reset Password"
                            : isSignUp
                                ? "Create Account"
                                : "Welcome Back"}
                    </h2>

                    {isForgotPassword ? (
                        /* ── Forgot Password Form ─────────────────── */
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 animate-fade-in">
                                    {error}
                                </div>
                            )}
                            {resetMessage && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400 animate-fade-in">
                                    {resetMessage}
                                </div>
                            )}

                            <p className="text-sm text-white/40">
                                Enter your email and we&apos;ll send you a link to reset your password.
                            </p>

                            <div>
                                <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                Send Reset Link
                            </button>
                        </form>
                    ) : (
                        /* ── Sign In / Sign Up Form ───────────────── */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 animate-fade-in">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 pr-11 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            /* Eye-off icon */
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            /* Eye icon */
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {isSignUp ? "Sign Up" : "Sign In"}
                            </button>

                            {/* Forgot password link — only on sign-in */}
                            {!isSignUp && (
                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotPassword(true);
                                            setError("");
                                            setResetMessage("");
                                        }}
                                        className="text-xs text-white/30 hover:text-accent/80 transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="mt-5 text-center">
                        <button
                            onClick={() => {
                                if (isForgotPassword) {
                                    setIsForgotPassword(false);
                                } else {
                                    setIsSignUp(!isSignUp);
                                }
                                setError("");
                                setResetMessage("");
                            }}
                            className="text-xs text-white/30 hover:text-white/50 transition-colors"
                        >
                            {isForgotPassword
                                ? "← Back to sign in"
                                : isSignUp
                                    ? "Already have an account? Sign in"
                                    : "Don't have an account? Sign up"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
