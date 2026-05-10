import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, x: 40, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -40, scale: 0.99 },
};

export default function PageTransition({ children }) {
  const isNative = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
  if (isNative) return <>{children}</>;

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
