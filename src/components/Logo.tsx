"use client";

interface LogoProps {
    size?: "sm" | "lg";
    className?: string;
}

export default function Logo({ size = "sm", className = "" }: LogoProps) {
    const iconSize = size === "lg" ? 48 : 28;
    const textSize = size === "lg" ? "text-3xl" : "text-lg";

    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            {/* Running Man SVG — geometric/minimal silhouette */}
            <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
            >
                {/* Head */}
                <circle cx="38" cy="10" r="5.5" fill="currentColor" className="text-accent" />
                {/* Torso — angled for sprint pose */}
                <path
                    d="M36 16L28 34"
                    stroke="currentColor"
                    className="text-accent"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
                {/* Leading arm (forward) */}
                <path
                    d="M33 22L42 18L48 22"
                    stroke="currentColor"
                    className="text-accent"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Trailing arm (back) */}
                <path
                    d="M33 22L22 28L18 24"
                    stroke="currentColor"
                    className="text-accent"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Leading leg (forward stride) */}
                <path
                    d="M28 34L38 44L44 52"
                    stroke="currentColor"
                    className="text-accent"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Trailing leg (back kick) */}
                <path
                    d="M28 34L18 44L12 50"
                    stroke="currentColor"
                    className="text-accent"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <span className={`${textSize} tracking-tight font-light`}>
                <span className="font-light">TRACK</span>
                <span className="font-bold">STAR</span>
            </span>
        </div>
    );
}
