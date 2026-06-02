import { Camera, Moon, Sparkles, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const THEME_MODES = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
  ['custom', 'Custom', Sparkles],
];

export default function ProfileThemeSection({
  localThemeMode,
  themeAccent,
  themeBackground,
  themePhoto,
  showBackgrounds,
  showPalettes,
  bgInputRef,
  backgrounds,
  accents,
  onChooseMode,
  onChooseAccent,
  onThemeBackgroundChange,
  onThemePhotoChange,
  onThemePhotoSelect,
  onToggleBackgrounds,
  onTogglePalettes,
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-3">
        <h2 className="text-base font-black text-foreground">Mode</h2>
        <div className="grid grid-cols-3 gap-2">
          {THEME_MODES.map(([mode, label, Icon]) => (
            <button key={mode} onClick={() => onChooseMode(mode)} className={`rounded-2xl border p-3 text-sm font-black transition ${localThemeMode === mode ? 'border-primary bg-primary/15 text-primary ring-2 ring-primary/25' : 'border-border bg-secondary text-foreground'}`}>
              <Icon className="w-5 h-5 mx-auto mb-1" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {localThemeMode === 'custom' && (
        <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-3">
          <button onClick={onToggleBackgrounds} className="w-full rounded-2xl bg-secondary text-foreground px-4 py-3 text-sm font-bold text-left">
            {showBackgrounds ? 'Hide backgrounds' : 'Show backgrounds'}
          </button>
          {showBackgrounds && (
            <div className="space-y-3">
              <div className="rounded-3xl border border-primary/25 bg-primary/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-2xl bg-secondary flex items-center justify-center">
                    {themePhoto ? <img src={themePhoto} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">Custom background photo</p>
                    <p className="text-xs text-muted-foreground">Use any image as the app background.</p>
                  </div>
                  <Button type="button" size="sm" onClick={() => bgInputRef.current?.click()} className="rounded-2xl">Choose</Button>
                </div>
                <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={onThemePhotoSelect} />
                {themePhoto && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { onThemePhotoChange?.(''); if (themeBackground === 'photo') onThemeBackgroundChange?.('pastel-lilac'); }} className="mt-2 rounded-2xl text-muted-foreground">
                    Remove photo
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {backgrounds.map(bg => (
                  <button key={bg.key} onClick={() => onThemeBackgroundChange(bg.key)} className={`rounded-2xl border p-2 text-left transition ${themeBackground === bg.key ? 'border-primary bg-primary/10 ring-2 ring-primary/25' : 'border-border bg-secondary/70'}`}>
                    <div className="h-16 rounded-xl mb-2" style={{ background: bg.preview }} />
                    <p className="text-sm font-bold text-foreground">{bg.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-3">
        <button onClick={onTogglePalettes} className="w-full rounded-2xl bg-secondary text-foreground px-4 py-3 text-sm font-bold text-left">
          {showPalettes ? 'Hide palette' : 'Show palette'}
        </button>
        {showPalettes && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {accents.map(theme => (
              <button key={theme.key} onClick={() => onChooseAccent(theme.key)} className={`rounded-2xl border p-2 text-left transition ${themeAccent === theme.key ? 'border-primary bg-primary/10 ring-2 ring-primary/25' : 'border-border bg-secondary/70'}`}>
                <div className="h-14 rounded-xl mb-2" style={{ background: `linear-gradient(135deg, hsl(${theme.primary}), hsl(${theme.accent}))` }} />
                <p className="text-sm font-bold text-foreground">{theme.name}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
