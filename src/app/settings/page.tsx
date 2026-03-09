"use client";

import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";

export default function SettingsPage() {
    const { user, logout } = useAuth();

    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="animate-fade-in">
                    <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
                    <p className="text-sm text-white/40 mb-8">
                        Manage your account settings
                    </p>

                    <div className="max-w-lg space-y-6">
                        {/* Account Info */}
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
                            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                                Account
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">
                                        Email Address
                                    </label>
                                    <p className="text-white text-sm">{user?.email}</p>
                                </div>
                                <div>
                                    <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">
                                        User ID
                                    </label>
                                    <p className="text-white/50 text-xs font-mono">{user?.uid}</p>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
                            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                                Session
                            </h2>
                            <p className="text-xs text-white/40 mb-4">
                                Sign out of your TrackStar account on this device.
                            </p>
                            <button
                                onClick={logout}
                                className="px-5 py-2.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
