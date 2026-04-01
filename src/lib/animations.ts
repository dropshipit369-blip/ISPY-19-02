import { Variants } from "framer-motion";

export const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 12,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: {
            duration: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
};

export const staggerContainer: Variants = {
    animate: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

export const staggerItem: Variants = {
    initial: { opacity: 0, y: 16 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const scaleIn: Variants = {
    initial: { opacity: 0, scale: 0.92 },
    animate: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const slideInLeft: Variants = {
    initial: { opacity: 0, x: -20 },
    animate: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const slideInRight: Variants = {
    initial: { opacity: 0, x: 20 },
    animate: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};
