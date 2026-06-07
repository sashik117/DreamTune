import { AlertTriangle, ChevronDown, Info, LifeBuoy, LogIn, LogOut, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function SettingCard({ id, icon: Icon, title, description, children, danger = false, settingOpen, toggleSetting }) {
  return (
    <section className={`rounded-3xl border ${danger ? 'border-destructive/40' : 'border-border'} bg-card/95 overflow-hidden`}>
      <button type="button" onClick={() => toggleSetting(id)} className="w-full p-4 text-left flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${danger ? 'text-destructive' : 'text-primary'} shrink-0`} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-foreground truncate">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <ChevronDown className={`w-4 h-4 mt-1 text-muted-foreground transition-transform ${settingOpen(id) ? 'rotate-180' : ''}`} />
      </button>
      {settingOpen(id) && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

export default function ProfileSettingsSection({
  confirmDelete,
  settingOpen,
  toggleSetting,
  onOpenSupport,
  onSignOut,
  onSignIn,
  onDeleteProfile,
  onCancelDelete,
  onAskDelete,
  currentUser,
}) {
  const cardProps = { settingOpen, toggleSetting };
  const isGuest = !currentUser?.id;

  return (
    <div className="space-y-3">
      <SettingCard
        {...cardProps}
        id="privacy"
        icon={Shield}
        title="Privacy"
        description="Playlist visibility is changed in each playlist edit dialog."
      >
        <p className="rounded-2xl bg-secondary/70 p-3 text-sm text-muted-foreground">
          Public playlists appear on your profile. Private playlists stay visible only to you.
        </p>
      </SettingCard>

      <SettingCard
        {...cardProps}
        id="support"
        icon={LifeBuoy}
        title="Support"
        description="Contact us if something is not working or you need help."
      >
        <button
          type="button"
          onClick={onOpenSupport}
          className="w-full rounded-2xl bg-secondary/70 p-3 text-left text-sm font-bold text-foreground hover:bg-secondary"
        >
          dreamtuneteam@gmail.com
          <span className="block text-xs font-medium text-muted-foreground">The email subject will be filled in automatically.</span>
        </button>
      </SettingCard>

      <SettingCard
        {...cardProps}
        id="about"
        icon={Info}
        title="About"
        description="DreamTune keeps your music, playlists, and settings close at hand."
      >
        <div className="rounded-2xl bg-secondary/70 p-3 text-sm text-muted-foreground space-y-2">
          <p>DreamTune is your personal music space for tracks, playlists, themes, and collaborative listening.</p>
          <p>The app is designed to keep music, covers, and settings close without extra noise.</p>
        </div>
      </SettingCard>

      <SettingCard
        {...cardProps}
        id="account"
        icon={AlertTriangle}
        title="Account"
        description={isGuest ? 'Sign in to load your saved tracks, playlists, and account settings.' : 'Sign out or delete your account if you no longer want to keep data here.'}
        danger
      >
        <div className="space-y-2">
          <Button variant="outline" className="w-full rounded-2xl border-border justify-start" onClick={isGuest ? onSignIn : onSignOut}>
            {isGuest ? <LogIn className="w-4 h-4 mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
            {isGuest ? 'Sign in' : 'Sign out'}
          </Button>
          {!isGuest && (confirmDelete ? (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-3 space-y-3">
              <p className="text-sm font-bold text-foreground">Are you sure? This will delete all your data forever.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-2xl border-border" onClick={onCancelDelete}>Cancel</Button>
                <Button variant="destructive" className="flex-1 rounded-2xl gap-2" onClick={onDeleteProfile}>
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" className="w-full rounded-2xl justify-start" onClick={onAskDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete account
            </Button>
          ))}
        </div>
      </SettingCard>
    </div>
  );
}
