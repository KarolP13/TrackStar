"use client";

export default function BoltIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Dog silhouette — sleek greyhound side profile */}
            <path
                d="M12 44c0-2 1-4 3-5l4-3c1-1 2-3 2-5l1-7c0-2 1-4 3-5l3-2c1-1 3-1 4 0l2 2c1 1 1 2 0 3l-1 2h3c2 0 3 1 4 2l2 3c1 1 2 2 4 2h5c2 0 3 1 3 3v2c0 2-1 3-3 3h-2l-1 2c-1 2-2 3-4 3h-1l1 4c0 1 0 2-1 2h-2c-1 0-2-1-2-2l-1-4h-6l-1 4c0 1-1 2-2 2h-2c-1 0-2-1-1-2l1-4h-2c-2 0-4-1-5-3l-2-3c-1-1-2-2-4-2-2 0-3 1-3 3z"
                fill="currentColor"
                opacity="0.9"
            />
            {/* Dog ear detail */}
            <path
                d="M28 19c0-1 1-2 2-2s2 1 2 1l1 3c0 1-1 2-2 2h-1c-1 0-2-1-2-2v-2z"
                fill="currentColor"
            />
            {/* Lightning bolt — overlapping the body */}
            <path
                d="M34 22l-6 12h5l-3 10 8-13h-5l4-9z"
                fill="currentColor"
                className="bolt-flash"
            />
            {/* Lightning bolt glow outline */}
            <path
                d="M34 22l-6 12h5l-3 10 8-13h-5l4-9z"
                stroke="currentColor"
                strokeWidth="0.5"
                fill="none"
                opacity="0.3"
            />
        </svg>
    );
}
