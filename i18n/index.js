import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from '../locales/en.json';
import ru from '../locales/ru.json';

// Source of truth is English. Add a locale by dropping a new JSON file here and
// registering it in `resources`. Missing keys in any locale fall back to `en`,
// so a partially translated language is always safe to ship.
const resources = {
  en: { translation: en },
  ru: { translation: ru },
};

// Device language code only (e.g. 'en', 'ru') — region is ignored for now.
// expo-localization returns the ordered list of the user's preferred locales.
const deviceLanguage = getLocales()?.[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: 'en',
  // Uses i18next's default (v4) plural rules, which give Russian its correct
  // one/few/many/other forms.
  interpolation: {
    escapeValue: false, // React Native already escapes against injection
  },
  returnNull: false,
  returnEmptyString: false,
});

export default i18n;
