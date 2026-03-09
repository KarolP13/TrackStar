"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Logo from "@/components/Logo";

export default function LoginPage() {
    const { user, loading, signIn, signUp } = useAuth();
    const router = useRouter();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
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
                        {isSignUp ? "Create Account" : "Welcome Back"}
                    </h2>

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
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
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
                            {isSignUp ? "Sign Up" : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-5 text-center">
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError("");
                            }}
                            className="text-xs text-white/30 hover:text-white/50 transition-colors"
                        >
                            {isSignUp
                                ? "Already have an account? Sign in"
                                : "Don't have an account? Sign up"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
