import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import uk from './locales/uk.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhCN from './locales/zh-CN.json';
import ar from './locales/ar.json';
import pl from './locales/pl.json';
import tr from './locales/tr.json';

export const supportedLanguages = [
  { code: 'en', nameKey: 'language.english', nativeName: 'English' },
  { code: 'es', nameKey: 'language.spanish', nativeName: 'Español' },
  { code: 'pt-BR', nameKey: 'language.portugueseBR', nativeName: 'Português (BR)' },
  { code: 'de', nameKey: 'language.german', nativeName: 'Deutsch' },
  { code: 'fr', nameKey: 'language.french', nativeName: 'Français' },
  { code: 'ja', nameKey: 'language.japanese', nativeName: '日本語' },
  { code: 'ko', nameKey: 'language.korean', nativeName: '한국어' },
  { code: 'zh-CN', nameKey: 'language.chineseSimplified', nativeName: '简体中文' },
  { code: 'ar', nameKey: 'language.arabic', nativeName: 'العربية' },
  { code: 'uk', nameKey: 'language.ukrainian', nativeName: 'Українська' },
  { code: 'pl', nameKey: 'language.polish', nativeName: 'Polski' },
  { code: 'tr', nameKey: 'language.turkish', nativeName: 'Türkçe' },
];

const resources = {
  en: { translation: en },
  uk: { translation: uk },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  de: { translation: de },
  fr: { translation: fr },
  ja: { translation: ja },
  ko: { translation: ko },
  'zh-CN': { translation: zhCN },
  ar: { translation: ar },
  pl: { translation: pl },
  tr: { translation: tr },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages.map(language => language.code),
    nonExplicitSupportedLngs: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'dreamtune-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
