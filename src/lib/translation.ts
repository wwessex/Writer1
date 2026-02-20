/**
 * Translation language mappings using correct NLLB-200 language codes.
 *
 * NLLB (No Language Left Behind) uses ISO 639-3 codes with script suffixes.
 * Some codes differ from the generic ISO 639-3 macrolanguage codes:
 *   - Pashto uses "pbt_Arab" (Southern Pashto), NOT "pus_Arab"
 *   - Persian uses "pes_Arab" (Iranian Persian), NOT "fas_Arab"
 *   - Malay uses "zsm_Latn" (Standard Malay), NOT "msa_Latn"
 *   - Latvian uses "lvs_Latn" (Standard Latvian), NOT "lav_Latn"
 *   - Chinese Simplified uses "zho_Hans", NOT "cmn_Hans"
 *   - Mongolian uses "khk_Cyrl" (Khalkha), NOT "mon_Cyrl"
 *   - Albanian uses "als_Latn" (Tosk), NOT "sqi_Latn"
 *   - Oromo uses "gaz_Latn" (West Central), NOT "orm_Latn"
 *   - Malagasy uses "plt_Latn" (Plateau), NOT "mlg_Latn"
 *   - Swahili uses "swh_Latn" (Coastal), NOT "swa_Latn"
 *   - Norwegian Bokmål uses "nob_Latn", NOT "nor_Latn"
 *   - Yiddish uses "ydd_Hebr" (Eastern), NOT "yid_Hebr"
 */

export interface TranslationLanguage {
  /** Human-readable language name */
  name: string;
  /** Valid NLLB-200 language code (ISO 639-3 + script) */
  code: string;
}

/**
 * Curated list of translation languages with correct NLLB-200 codes.
 * Sorted alphabetically by name for UI display.
 */
export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { name: 'Acehnese (Arabic)', code: 'ace_Arab' },
  { name: 'Acehnese (Latin)', code: 'ace_Latn' },
  { name: 'Afrikaans', code: 'afr_Latn' },
  { name: 'Albanian (Tosk)', code: 'als_Latn' },
  { name: 'Amharic', code: 'amh_Ethi' },
  { name: 'Arabic (Modern Standard)', code: 'arb_Arab' },
  { name: 'Arabic (Moroccan)', code: 'ary_Arab' },
  { name: 'Arabic (Egyptian)', code: 'arz_Arab' },
  { name: 'Armenian', code: 'hye_Armn' },
  { name: 'Assamese', code: 'asm_Beng' },
  { name: 'Asturian', code: 'ast_Latn' },
  { name: 'Azerbaijani (Latin)', code: 'azj_Latn' },
  { name: 'Azerbaijani (South, Arabic)', code: 'azb_Arab' },
  { name: 'Bambara', code: 'bam_Latn' },
  { name: 'Banjar (Arabic)', code: 'bjn_Arab' },
  { name: 'Banjar (Latin)', code: 'bjn_Latn' },
  { name: 'Bashkir', code: 'bak_Cyrl' },
  { name: 'Basque', code: 'eus_Latn' },
  { name: 'Belarusian', code: 'bel_Cyrl' },
  { name: 'Bengali', code: 'ben_Beng' },
  { name: 'Bhojpuri', code: 'bho_Deva' },
  { name: 'Bosnian', code: 'bos_Latn' },
  { name: 'Bulgarian', code: 'bul_Cyrl' },
  { name: 'Burmese', code: 'mya_Mymr' },
  { name: 'Catalan', code: 'cat_Latn' },
  { name: 'Cebuano', code: 'ceb_Latn' },
  { name: 'Central Kurdish', code: 'ckb_Arab' },
  { name: 'Chinese (Simplified)', code: 'zho_Hans' },
  { name: 'Chinese (Traditional)', code: 'zho_Hant' },
  { name: 'Crimean Tatar', code: 'crh_Latn' },
  { name: 'Croatian', code: 'hrv_Latn' },
  { name: 'Czech', code: 'ces_Latn' },
  { name: 'Danish', code: 'dan_Latn' },
  { name: 'Dutch', code: 'nld_Latn' },
  { name: 'English', code: 'eng_Latn' },
  { name: 'Esperanto', code: 'epo_Latn' },
  { name: 'Estonian', code: 'est_Latn' },
  { name: 'Ewe', code: 'ewe_Latn' },
  { name: 'Faroese', code: 'fao_Latn' },
  { name: 'Fijian', code: 'fij_Latn' },
  { name: 'Finnish', code: 'fin_Latn' },
  { name: 'Fon', code: 'fon_Latn' },
  { name: 'French', code: 'fra_Latn' },
  { name: 'Friulian', code: 'fur_Latn' },
  { name: 'Galician', code: 'glg_Latn' },
  { name: 'Georgian', code: 'kat_Geor' },
  { name: 'German', code: 'deu_Latn' },
  { name: 'Greek', code: 'ell_Grek' },
  { name: 'Guarani', code: 'grn_Latn' },
  { name: 'Gujarati', code: 'guj_Gujr' },
  { name: 'Haitian Creole', code: 'hat_Latn' },
  { name: 'Hausa', code: 'hau_Latn' },
  { name: 'Hebrew', code: 'heb_Hebr' },
  { name: 'Hindi', code: 'hin_Deva' },
  { name: 'Hungarian', code: 'hun_Latn' },
  { name: 'Icelandic', code: 'isl_Latn' },
  { name: 'Igbo', code: 'ibo_Latn' },
  { name: 'Ilocano', code: 'ilo_Latn' },
  { name: 'Indonesian', code: 'ind_Latn' },
  { name: 'Irish', code: 'gle_Latn' },
  { name: 'Italian', code: 'ita_Latn' },
  { name: 'Japanese', code: 'jpn_Jpan' },
  { name: 'Javanese', code: 'jav_Latn' },
  { name: 'Kannada', code: 'kan_Knda' },
  { name: 'Kashmiri (Arabic)', code: 'kas_Arab' },
  { name: 'Kashmiri (Devanagari)', code: 'kas_Deva' },
  { name: 'Kazakh', code: 'kaz_Cyrl' },
  { name: 'Khmer', code: 'khm_Khmr' },
  { name: 'Kinyarwanda', code: 'kin_Latn' },
  { name: 'Korean', code: 'kor_Hang' },
  { name: 'Kurdish (Northern)', code: 'kmr_Latn' },
  { name: 'Kyrgyz', code: 'kir_Cyrl' },
  { name: 'Lao', code: 'lao_Laoo' },
  { name: 'Latvian', code: 'lvs_Latn' },
  { name: 'Lingala', code: 'lin_Latn' },
  { name: 'Lithuanian', code: 'lit_Latn' },
  { name: 'Luxembourgish', code: 'ltz_Latn' },
  { name: 'Macedonian', code: 'mkd_Cyrl' },
  { name: 'Malagasy (Plateau)', code: 'plt_Latn' },
  { name: 'Malay', code: 'zsm_Latn' },
  { name: 'Malayalam', code: 'mal_Mlym' },
  { name: 'Maltese', code: 'mlt_Latn' },
  { name: 'Maori', code: 'mri_Latn' },
  { name: 'Marathi', code: 'mar_Deva' },
  { name: 'Mongolian (Khalkha)', code: 'khk_Cyrl' },
  { name: 'Nepali', code: 'npi_Deva' },
  { name: 'Norwegian Bokmål', code: 'nob_Latn' },
  { name: 'Norwegian Nynorsk', code: 'nno_Latn' },
  { name: 'Occitan', code: 'oci_Latn' },
  { name: 'Oriya', code: 'ory_Orya' },
  { name: 'Oromo (West Central)', code: 'gaz_Latn' },
  { name: 'Pashto (Southern)', code: 'pbt_Arab' },
  { name: 'Persian', code: 'pes_Arab' },
  { name: 'Polish', code: 'pol_Latn' },
  { name: 'Portuguese', code: 'por_Latn' },
  { name: 'Punjabi', code: 'pan_Guru' },
  { name: 'Quechua', code: 'quy_Latn' },
  { name: 'Romanian', code: 'ron_Latn' },
  { name: 'Russian', code: 'rus_Cyrl' },
  { name: 'Samoan', code: 'smo_Latn' },
  { name: 'Sanskrit', code: 'san_Deva' },
  { name: 'Scottish Gaelic', code: 'gla_Latn' },
  { name: 'Serbian', code: 'srp_Cyrl' },
  { name: 'Shona', code: 'sna_Latn' },
  { name: 'Sindhi', code: 'snd_Arab' },
  { name: 'Sinhala', code: 'sin_Sinh' },
  { name: 'Slovak', code: 'slk_Latn' },
  { name: 'Slovenian', code: 'slv_Latn' },
  { name: 'Somali', code: 'som_Latn' },
  { name: 'Spanish', code: 'spa_Latn' },
  { name: 'Sundanese', code: 'sun_Latn' },
  { name: 'Swahili', code: 'swh_Latn' },
  { name: 'Swedish', code: 'swe_Latn' },
  { name: 'Tagalog', code: 'tgl_Latn' },
  { name: 'Tajik', code: 'tgk_Cyrl' },
  { name: 'Tamil', code: 'tam_Taml' },
  { name: 'Tatar', code: 'tat_Cyrl' },
  { name: 'Telugu', code: 'tel_Telu' },
  { name: 'Thai', code: 'tha_Thai' },
  { name: 'Tibetan', code: 'bod_Tibt' },
  { name: 'Tigrinya', code: 'tir_Ethi' },
  { name: 'Tok Pisin', code: 'tpi_Latn' },
  { name: 'Turkish', code: 'tur_Latn' },
  { name: 'Turkmen', code: 'tuk_Latn' },
  { name: 'Ukrainian', code: 'ukr_Cyrl' },
  { name: 'Urdu', code: 'urd_Arab' },
  { name: 'Uyghur', code: 'uig_Arab' },
  { name: 'Uzbek', code: 'uzn_Latn' },
  { name: 'Vietnamese', code: 'vie_Latn' },
  { name: 'Welsh', code: 'cym_Latn' },
  { name: 'Wolof', code: 'wol_Latn' },
  { name: 'Xhosa', code: 'xho_Latn' },
  { name: 'Yiddish (Eastern)', code: 'ydd_Hebr' },
  { name: 'Yoruba', code: 'yor_Latn' },
  { name: 'Yue Chinese (Cantonese)', code: 'yue_Hant' },
  { name: 'Zulu', code: 'zul_Latn' },
];

/**
 * Set of all valid NLLB-200 language codes for fast validation.
 */
export const VALID_NLLB_CODES: ReadonlySet<string> = new Set(
  TRANSLATION_LANGUAGES.map(l => l.code)
);

/**
 * Commonly misused language codes mapped to their correct NLLB equivalents.
 * Prevents errors like "pus_Arab is not valid".
 */
const CODE_CORRECTIONS: Record<string, string> = {
  // Pashto: generic ISO 639-3 → NLLB-specific Southern Pashto
  'pus_Arab': 'pbt_Arab',
  // Persian: macrolanguage → NLLB-specific Iranian Persian
  'fas_Arab': 'pes_Arab',
  // Malay: macrolanguage → NLLB-specific Standard Malay
  'msa_Latn': 'zsm_Latn',
  // Latvian: macrolanguage → NLLB-specific Standard Latvian
  'lav_Latn': 'lvs_Latn',
  // Chinese: Mandarin → NLLB Chinese
  'cmn_Hans': 'zho_Hans',
  'cmn_Hant': 'zho_Hant',
  // Mongolian: macrolanguage → Khalkha
  'mon_Cyrl': 'khk_Cyrl',
  // Albanian: macrolanguage → Tosk
  'sqi_Latn': 'als_Latn',
  // Oromo: macrolanguage → West Central
  'orm_Latn': 'gaz_Latn',
  // Malagasy: macrolanguage → Plateau
  'mlg_Latn': 'plt_Latn',
  // Swahili: macrolanguage → Coastal
  'swa_Latn': 'swh_Latn',
  // Norwegian: macrolanguage → Bokmål
  'nor_Latn': 'nob_Latn',
  // Yiddish: macrolanguage → Eastern
  'yid_Hebr': 'ydd_Hebr',
  // Dari → Persian (Dari)
  'prs_Arab': 'pes_Arab',
};

/**
 * Resolves a language code to its correct NLLB-200 equivalent.
 * Returns the corrected code if the input is a known incorrect code,
 * otherwise returns the input unchanged.
 */
export function resolveNllbCode(code: string): string {
  return CODE_CORRECTIONS[code] ?? code;
}

/**
 * Validates whether a language code is in the NLLB-200 supported set.
 * Automatically applies known code corrections before checking.
 */
export function isValidNllbCode(code: string): boolean {
  return VALID_NLLB_CODES.has(resolveNllbCode(code));
}

/**
 * Builds a translation prompt for use with AI providers.
 * This leverages the existing AI infrastructure to perform translation
 * rather than requiring a separate NLLB model endpoint.
 */
export function buildTranslationPrompt(
  text: string,
  targetLanguage: TranslationLanguage,
  preserveFormatting: boolean
): string {
  const formatInstruction = preserveFormatting
    ? ' Preserve all paragraph breaks, formatting, and structural elements.'
    : '';

  return (
    `Translate the following text into ${targetLanguage.name}.` +
    ` Output ONLY the translated text with no commentary, preamble, or explanation.` +
    formatInstruction +
    `\n\n---\n\n${text}`
  );
}

/**
 * Frequently used languages shown at the top of the language picker.
 */
export const POPULAR_LANGUAGE_CODES: ReadonlySet<string> = new Set([
  'eng_Latn', 'spa_Latn', 'fra_Latn', 'deu_Latn', 'ita_Latn',
  'por_Latn', 'zho_Hans', 'zho_Hant', 'jpn_Jpan', 'kor_Hang',
  'arb_Arab', 'hin_Deva', 'rus_Cyrl', 'tur_Latn', 'vie_Latn',
]);

/**
 * Returns the popular languages first, then the rest alphabetically.
 */
export function getSortedLanguages(): TranslationLanguage[] {
  const popular: TranslationLanguage[] = [];
  const rest: TranslationLanguage[] = [];

  for (const lang of TRANSLATION_LANGUAGES) {
    if (POPULAR_LANGUAGE_CODES.has(lang.code)) {
      popular.push(lang);
    } else {
      rest.push(lang);
    }
  }

  return [...popular, ...rest];
}
