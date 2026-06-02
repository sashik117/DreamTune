import { Check, Languages } from 'lucide-react';

export default function ProfileLanguageSection({ language, languages, t, onChooseLanguage }) {
  return (
    <section className="rounded-3xl border border-border bg-card/95 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Languages className="w-6 h-6 text-primary mt-0.5" />
        <div>
          <h2 className="text-base font-black text-foreground">{t('language.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('language.description')}</p>
          <p className="text-xs text-muted-foreground mt-2">{t('language.auto')}</p>
        </div>
      </div>
      <div className="grid gap-2">
        {languages.map(({ code, nameKey, nativeName }) => (
          <button
            key={code}
            type="button"
            onClick={() => onChooseLanguage(code)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${language === code ? 'border-primary bg-primary/15 ring-2 ring-primary/20' : 'border-border bg-secondary/70 hover:bg-secondary'}`}
          >
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${language === code ? 'border-primary bg-primary' : 'border-muted-foreground/50'}`}>
              {language === code && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-foreground">{t(nameKey)}</p>
              <p className="text-xs text-muted-foreground">{nativeName}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
