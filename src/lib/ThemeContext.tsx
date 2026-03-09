"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";
import { UserProfile } from "./types";

const DEFAULT_PROFILE: UserProfile = {
    themeMode: "dark",
    accentColor: "#3b82f6", // Electric Blue
    displayName: "",
    defaults: {
        paymentMethod: "",
        accountHandle: "",
        promoterName: "",
    },
};

interface ThemeContextType {
    profile: UserProfile;
    updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
    loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    profile: DEFAULT_PROFILE,
    updateProfile: async () => { },
    loading: true,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [loading, setLoading] = useState(true);

    // Fetch user profile from Firestore
    useEffect(() => {
        if (!user) {
            setProfile(DEFAULT_PROFILE);
            setLoading(false);
            return;
        }

        const userDocRef = doc(db, "users", user.uid);

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setProfile({ ...DEFAULT_PROFILE, ...docSnap.data() } as UserProfile);
            } else {
                // Initial creation
                setDoc(userDocRef, DEFAULT_PROFILE, { merge: true }).catch(console.error);
                setProfile(DEFAULT_PROFILE);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching user profile:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Apply Theme (CSS Variables) when profile changes
    useEffect(() => {
        const root = document.documentElement;

        // Theme Mode
        if (profile.themeMode === "light") {
            root.setAttribute("data-theme", "light");
        } else {
            root.removeAttribute("data-theme"); // default dark
        }

        // Accent Color
        root.style.setProperty("--accent", profile.accentColor);

        // Calculate a light version of the accent (for backgrounds)
        // Convert Hex to RGB to use with `rgba()`
        const hexToRgb = (hex: string) => {
            const h = hex.replace("#", "");
            if (h.length === 3) {
                return `${parseInt(h[0] + h[0], 16)}, ${parseInt(h[1] + h[1], 16)}, ${parseInt(h[2] + h[2], 16)}`;
            }
            if (h.length === 6) {
                return `${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}`;
            }
            return "59, 130, 246"; // default blue
        };
        const rgb = hexToRgb(profile.accentColor);
        root.style.setProperty("--accent-rgb", rgb);

    }, [profile.themeMode, profile.accentColor]);

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user) return;
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, updates, { merge: true });
    };

    return (
        <ThemeContext.Provider value={{ profile, updateProfile, loading }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
