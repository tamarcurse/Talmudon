import { toHebrewPageLabel } from './hebrew-page-label.js'
import type { ShasPageRecord, TractateRecord } from './database.js'

export const TRACTATES_SEED: Array<Omit<TractateRecord, 'id'>> = [
  { name_he: 'ברכות', name_en: 'Berakhot', total_pages: 64 },
  { name_he: 'שבת', name_en: 'Shabbat', total_pages: 156 },
  { name_he: 'עירובין', name_en: 'Eruvin', total_pages: 104 },
  { name_he: 'פסחים', name_en: 'Pesachim', total_pages: 120 },
  { name_he: 'שקלים', name_en: 'Shekalim', total_pages: 22 },
  { name_he: 'יומא', name_en: 'Yoma', total_pages: 88 },
  { name_he: 'סוכה', name_en: 'Sukkah', total_pages: 56 },
  { name_he: 'ביצה', name_en: 'Beitzah', total_pages: 40 },
  { name_he: 'ראש השנה', name_en: 'Rosh Hashanah', total_pages: 35 },
  { name_he: 'תענית', name_en: 'Taanit', total_pages: 28 },
  { name_he: 'מגילה', name_en: 'Megillah', total_pages: 32 },
  { name_he: 'מועד קטן', name_en: 'Moed Katan', total_pages: 29 },
  { name_he: 'חגיגה', name_en: 'Chagigah', total_pages: 27 },
  { name_he: 'יבמות', name_en: 'Yevamot', total_pages: 122 },
  { name_he: 'כתובות', name_en: 'Ketubot', total_pages: 112 },
  { name_he: 'נדרים', name_en: 'Nedarim', total_pages: 90 },
  { name_he: 'נזיר', name_en: 'Nazir', total_pages: 66 },
  { name_he: 'סוטה', name_en: 'Sotah', total_pages: 49 },
  { name_he: 'גיטין', name_en: 'Gittin', total_pages: 90 },
  { name_he: 'קידושין', name_en: 'Kiddushin', total_pages: 82 },
  { name_he: 'בבא קמא', name_en: 'Bava Kamma', total_pages: 119 },
  { name_he: 'בבא מציעא', name_en: 'Bava Metzia', total_pages: 119 },
  { name_he: 'בבא בתרא', name_en: 'Bava Batra', total_pages: 176 },
  { name_he: 'סנהדרין', name_en: 'Sanhedrin', total_pages: 113 },
  { name_he: 'מכות', name_en: 'Makkot', total_pages: 24 },
  { name_he: 'שבועות', name_en: 'Shevuot', total_pages: 49 },
  { name_he: 'עבודה זרה', name_en: 'Avodah Zarah', total_pages: 76 },
  { name_he: 'הוריות', name_en: 'Horayot', total_pages: 14 },
  { name_he: 'זבחים', name_en: 'Zevachim', total_pages: 120 },
  { name_he: 'מנחות', name_en: 'Menachot', total_pages: 110 },
  { name_he: 'חולין', name_en: 'Chullin', total_pages: 142 },
  { name_he: 'בכורות', name_en: 'Bechorot', total_pages: 61 },
  { name_he: 'ערכין', name_en: 'Arachin', total_pages: 34 },
  { name_he: 'תמורה', name_en: 'Temurah', total_pages: 34 },
  { name_he: 'כריתות', name_en: 'Keritot', total_pages: 28 },
  { name_he: 'מעילה', name_en: 'Meilah', total_pages: 22 },
  { name_he: 'נדה', name_en: 'Niddah', total_pages: 73 },
]

export function buildShasPagesSeed(): ShasPageRecord[] {
  return Array.from({ length: 200 }, (_, index) => {
    const pageNumber = index + 1
    return {
      page_number: pageNumber,
      page_label_he: toHebrewPageLabel(pageNumber),
    }
  })
}
