import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, Languages, LogIn, LogOut, Moon, Palette, Settings, UserCircle, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function ProfileDrawer({
  open,
  onOpenChange,
  songs = [],
  playlists = [],
  profileAvatar = '',
  profileNickname = 'Guest',
  currentUser = null,
  notificationCount = 0,
  onSignOut,
  onNavigate,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isGuest = !currentUser?.id;
  const publicPlaylists = playlists.filter(playlist => playlist.is_public);
  const menu = [
    { path: '/profile', labelKey: 'profile.title', icon: UserCircle },
    { path: '/profile/friends', labelKey: 'profile.friends', icon: Users },
    { path: '/profile/stats', labelKey: 'profile.stats', icon: BarChart3 },
    { path: '/profile/theme', labelKey: 'profile.theme', icon: Palette },
    { path: '/profile/sleep', labelKey: 'profile.sleep', icon: Moon },
    { path: '/profile/language', labelKey: 'profile.language', icon: Languages },
    { path: '/profile/settings', labelKey: 'profile.settings', icon: Settings },
  ];

  const signOut = async () => {
    try {
      onOpenChange(false);
      await onSignOut?.();
      toast.success(t('profile.signOut'));
    } catch (err) {
      toast.error(err.message || 'Could not sign out');
    }
  };

  const signIn = () => {
    onOpenChange(false);
    navigate('/auth', { replace: false });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close profile menu"
            className="fixed inset-0 z-[105] bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            className="app-chrome-surface fixed left-0 top-0 bottom-0 z-[110] w-[min(88vw,340px)] border-r border-border shadow-2xl overflow-hidden flex flex-col will-change-transform"
            initial={{ x: '-104%' }}
            animate={{ x: 0 }}
            exit={{ x: '-104%' }}
            transition={{ type: 'spring', stiffness: 210, damping: 34, mass: 1.02 }}
          >
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 overflow-hidden">
                {profileAvatar ? <img src={profileAvatar} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-7 h-7 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-foreground truncate">{profileNickname || t('app.name')}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {songs.length} {t('profile.songs')} {'\u00b7'} {publicPlaylists.length} {t('profile.public')}
                </p>
              </div>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-full hover:bg-secondary">
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>

            <nav className="p-3 space-y-1 overflow-y-auto">
              {menu.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => onNavigate?.(location.pathname)}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${active ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary'}`}
                  >
                    <span className="relative shrink-0">
                      <item.icon className="w-5 h-5" />
                      {item.path === '/profile/friends' && notificationCount > 0 && (
                        <span className="absolute -right-2.5 -top-2.5 z-[2] min-w-4 h-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white ring-2 ring-card">
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </span>
                      )}
                    </span>
                    <span className="flex-1">{t(item.labelKey)}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto p-3 border-t border-border">
              <button onClick={isGuest ? signIn : signOut} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-foreground hover:bg-secondary">
                {isGuest ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                {isGuest ? t('profile.signIn') : t('profile.signOut')}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
