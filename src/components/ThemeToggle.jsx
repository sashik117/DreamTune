import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-14 h-7 rounded-full transition-all duration-300 flex items-center px-1"
      style={{ background: isDark ? 'hsl(0 72% 30%)' : 'hsl(340 50% 85%)' }}
    >
      <span
        className="absolute w-5 h-5 rounded-full flex items-center justify-center shadow-md transition-all duration-300"
        style={{
          left: isDark ? 'calc(100% - 24px)' : '4px',
          background: isDark ? 'hsl(0 72% 51%)' : 'hsl(340 65% 60%)'
        }}
      >
        {isDark
          ? <Moon className="w-3 h-3 text-white" />
          : <Sun className="w-3 h-3 text-white" />
        }
      </span>
    </button>
  );
}