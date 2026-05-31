import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import lv from './locales/lv.json'
import en from './locales/en.json'
import ru from './locales/ru.json'

const savedLng = typeof window !== 'undefined' ? localStorage.getItem('kursor-language') : null

i18n.use(initReactI18next).init({
  resources: {
    lv: { translation: lv },
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: savedLng || 'lv',
  fallbackLng: 'lv',
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
})

export function setLanguage(lng: string) {
  i18n.changeLanguage(lng)
  if (typeof window !== 'undefined') localStorage.setItem('kursor-language', lng)
}

export default i18n
