import { Link, useLocation } from 'react-router-dom';
import { Home, Library, Users, ListMusic, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const tabs = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/library', icon: Library, labelKey: 'nav.library' },
  { path: '/collab', icon: Users, labelKey: 'nav.collab' },
  { path: '/playlists', icon: ListMusic, labelKey: 'nav.playlists' },
];

export default function BottomNav({ onAddClick, notificationCount = 0 }) {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <nav className="bottom-navbar">
      <div className="h-full w-full bg-card/95 backdrop-blur-2xl border-t border-border shadow-2xl shadow-primary/10">
        <div className="flex h-[var(--bottom-nav-height)] items-center justify-around px-2 max-w-screen-lg mx-auto">
          {tabs.map(tab => {
            const isActive = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(`${tab.path}/`));
            return (
              <Link key={tab.path} to={tab.path} className="flex-1 min-w-0">
                <motion.div
                  whileTap={{ scale: 0.82 }}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-2xl transition-all
                    ${isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <div className={`relative ${isActive ? 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]' : ''}`}>
                    <tab.icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {tab.path === '/collab' && notificationCount > 0 && (
                      <span className="absolute -right-2 -top-2 min-w-4 h-4 rounded-full bg-red-500 px-1 text-[10px] font-black leading-4 text-white shadow-lg shadow-red-500/30">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold truncate max-w-full">{t(tab.labelKey)}</span>
                </motion.div>
              </Link>
            );
          })}

          <div className="flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.82 }}
              whileHover={{ scale: 1.08 }}
              onClick={onAddClick}
              className="flex flex-col items-center gap-1 py-2 px-2 text-foreground"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse-glow">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <span className="text-[9px] font-semibold">{t('nav.add')}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </nav>
  );
}
