import { UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProfileEntryButton({ profileAvatar, friendRequestCount = 0, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      className="fixed top-[calc(12px+env(safe-area-inset-top,0px))] left-4 z-[70] w-11 h-11 rounded-full"
      aria-label="Open profile"
    >
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/25 border border-white/20 overflow-hidden">
        {profileAvatar ? <img src={profileAvatar} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-7 h-7 text-white" />}
      </span>
      {friendRequestCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 z-[2] min-w-5 h-5 rounded-full bg-red-500 px-1 text-[10px] font-black leading-5 text-white shadow-lg shadow-red-500/40 ring-2 ring-background">
          {friendRequestCount > 9 ? '9+' : friendRequestCount}
        </span>
      )}
    </motion.button>
  );
}
