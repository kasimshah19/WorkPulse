import re
import json
import unicodedata
import difflib
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple

LEXICON_PATH = Path(__file__).parent.parent / "data" / "lexicon.json"

with open(LEXICON_PATH, "r", encoding="utf-8") as f:
    LEXICON = json.load(f)["skills"]

# Number words mappings (Hindi, Marathi, Roman Hinglish, English)
NUMBER_WORDS: Dict[str, int] = {
    # English
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "twenty five": 25, "thirty": 30, "thirty five": 35, "forty": 40, "fifty": 50,
    # Hindi / Roman
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5,
    "chhe": 6, "chheh": 6, "saat": 7, "aath": 8, "ath": 8, "nau": 9, "das": 10,
    "gyarah": 11, "barah": 12, "terah": 13, "chaudah": 14, "pandrah": 15,
    "solah": 16, "satrah": 17, "atharah": 18, "unnis": 19, "bees": 20,
    "pachchis": 25, "pachees": 25, "tees": 30, "pentyis": 35, "chalis": 40, "pachas": 50,
    # Marathi / Roman
    "pach": 5, "don": 2, "saha": 6, "daha": 10, "bara": 12, "pandhra": 15, "vis": 20, "panchvis": 25,
    # Devanagari Hindi & Marathi
    "शून्य": 0, "एक": 1, "दो": 2, "दोन": 2, "तीन": 3, "चार": 4,
    "पांच": 5, "पाँच": 5, "पाच": 5, "छह": 6, "सहा": 6, "सात": 7,
    "आठ": 8, "नौ": 9, "नऊ": 9, "दस": 10, "दहा": 10, "ग्यारह": 11,
    "अकरा": 11, "बारह": 12, "बारा": 12, "तेरह": 13, "तेरा": 13,
    "चौदह": 14, "चौदा": 14, "पंद्रह": 15, "पंधरा": 15, "सोलह": 16,
    "सोळा": 16, "सत्रह": 17, "सतरा": 17, "अठारह": 18, "अठरा": 18,
    "उन्नीस": 19, "एकोणीस": 19, "बीस": 20, "वीस": 20, "पच्चीस": 25,
    "पंचवीस": 25, "तीस": 30, "चालीस": 40, "चाळीस": 40, "पचास": 50, "पन्नास": 50
}

DEVA_TO_ASCII_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

# Nukta character stripping
DEVA_NUKTA_SIGN = "\u093c"
PRECOMPOSED_NUKTA_MAP = str.maketrans({
    "\u0958": "\u0915", "\u0959": "\u0916", "\u095a": "\u0917", "\u095b": "\u091c",
    "\u095c": "\u0921", "\u095d": "\u0922", "\u095e": "\u092b", "\u095f": "\u092f",
    "\u0929": "\u0928", "\u0931": "\u0930", "\u0934": "\u0933"
})

NEGATION_TOKENS = {
    "nahi", "nahin", "nai", "na", "नहीं", "नाही", "नही", "ना", "न", "not", "no", "never", "dont"
}

YEAR_MARKERS = [
    "saal", "sal", "varsh", "varshe", "वर्ष", "वर्षांचा", "वर्षाचा", "वर्षांचे",
    "साल", "years", "year", "yrs", "yr", "वर्षाचे", "सालांचा"
]

MONTH_MARKERS = ["mahine", "mahina", "महीने", "महीना", "महिने", "महिना", "months", "month"]

FRESHER_PHRASES = [
    "fresher", "naya hoon", "naye hain", "nava ahe", "navin ahe", "naya", "navin",
    "koi experience nahi", "kuch experience nahi", "experience nahi hai",
    "anubhav nahi", "अनुभव नाही", "अनुभव नहीं", "काही अनुभव नाही", "नया हूँ", "नवीन आहे"
]

def normalize(text: str) -> str:
    """
    Normalizes Hindi, Marathi, Roman Hinglish, and English text.
    Handles Unicode NFC, zero-width chars, nukta, chandrabindu, repeated Roman characters, and digits.
    """
    if not text:
        return ""

    # 1. Unicode NFC
    s = unicodedata.normalize("NFC", str(text))

    # 2. Lowercase
    s = s.lower()

    # 3. Strip zero-width joiners and marks
    for zw in ["\u200b", "\u200c", "\u200d", "\ufeff"]:
        s = s.replace(zw, "")

    # 4. Remove Nukta
    s = s.replace(DEVA_NUKTA_SIGN, "").translate(PRECOMPOSED_NUKTA_MAP)

    # 5. Normalize Chandrabindu (\u0901) to Anusvara (\u0902)
    s = s.replace("\u0901", "\u0902")

    # 6. Normalize Devanagari Digits to ASCII Digits
    s = s.translate(DEVA_TO_ASCII_DIGITS)

    # 7. Collapse 3+ repeated Roman letters (e.g., "paaainter" -> "painter")
    s = re.sub(r"([a-z])\1{2,}", r"\1", s)

    # 8. Replace punctuation with space, preserving alphanumeric and Devanagari
    # Devanagari range: \u0900-\u097F
    s = re.sub(r"[^\w\s\u0900-\u097F]", " ", s)

    # 9. Collapse multiple whitespaces
    s = re.sub(r"\s+", " ", s).strip()

    return s

def _extract_experience(normalized_text: str) -> Tuple[Optional[int], Dict[str, int], List[str]]:
    """
    Extracts experienceYears, perSkillYears, and relevant flags from normalized text.
    """
    flags: List[str] = []
    per_skill: Dict[str, int] = {}

    # Check for Fresher / Zero experience indicators
    for fp in FRESHER_PHRASES:
        norm_fp = normalize(fp)
        if norm_fp in normalized_text:
            return 0, {}, flags

    found_values: List[int] = []

    # Token-based scanning
    tokens = normalized_text.split()
    n = len(tokens)

    for i in range(n):
        tok = tokens[i]
        val: Optional[int] = None

        if tok.isdigit():
            val = int(tok)
        elif tok in NUMBER_WORDS:
            val = NUMBER_WORDS[tok]

        if val is not None and 0 <= val <= 50:
            # Check adjacent tokens for year/month markers
            is_year = False
            is_month = False

            # Check forward (e.g. "5 saal", "5 years", "5 varsh")
            if i + 1 < n:
                next_tok = tokens[i + 1]
                if any(next_tok.startswith(ym) for ym in YEAR_MARKERS):
                    is_year = True
                elif any(next_tok.startswith(mm) for mm in MONTH_MARKERS):
                    is_month = True

            # Check backward (e.g. "experience 5", "anubhav 5")
            if not is_year and not is_month and i - 1 >= 0:
                prev_tok = tokens[i - 1]
                if prev_tok in ["experience", "anubhav", "anubhavi", "साल", "वर्ष"]:
                    is_year = True

            if is_year:
                found_values.append(val)
            elif is_month:
                years_from_months = val // 12
                found_values.append(years_from_months)
                if val < 12:
                    flags.append("EXPERIENCE_UNDER_ONE_YEAR")

    if not found_values:
        # Fallback regex search for pattern like "5 saal", "पाँच वर्ष", "7 years"
        for tok, num_val in NUMBER_WORDS.items():
            pattern = rf"\b{re.escape(tok)}\s*(?:saal|sal|varsh|varshe|वर्ष|साल|years|year|yrs)\b"
            if re.search(pattern, normalized_text):
                found_values.append(num_val)

        regex_num = re.findall(r"\b(\d{1,2})\s*(?:saal|sal|varsh|varshe|वर्ष|साल|years|year|yrs)\b", normalized_text)
        for r in regex_num:
            v = int(r)
            if 0 <= v <= 50:
                found_values.append(v)

    if not found_values:
        return None, per_skill, flags

    if len(set(found_values)) > 1:
        flags.append("MULTIPLE_EXPERIENCE_VALUES")

    max_years = min(max(found_values), 50)
    return max_years, per_skill, flags

def extract_skills_and_experience(
    text: str,
    language: str = "hi",
    allowed_skills: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Extracts skills, suggestions, experience years, and flags from text.
    Deterministic, rule-based matching with compound phrase precedence and negation filtering.
    """
    flags: List[str] = []

    # Truncate text if exceeding 500 characters
    if len(text) > 500:
        text = text[:500]
        flags.append("TEXT_TRUNCATED")

    normalized = normalize(text)
    tokens = normalized.split()

    extracted_skills: List[Dict[str, Any]] = []
    suggestions: List[Dict[str, Any]] = []
    matched_skills_map: Dict[str, float] = {}
    matched_text_map: Dict[str, str] = {}
    negated_skills: Set[str] = set()

    # 1. Compound Phrase Matches (Higher Priority)
    # Compound mappings:
    compound_phrases = [
        (["raj mistri", "rajmistri", "राज मिस्त्री", "राजमिस्त्री", "chinai mistri"], "mason"),
        (["bijli mistri", "bijli ka kaam", "बिजली मिस्त्री", "लाइट मिस्त्री"], "electrician"),
        (["nal mistri", "नल मिस्त्री", "नल फिटिंग", "pipe fitter"], "plumber"),
        (["rang mistri", "रंग मिस्त्री", "कलर मिस्त्री"], "painter"),
        (["lakdi mistri", "लकड़ी मिस्त्री", "लाकडी काम", "लकड़ी का काम"], "carpenter"),
        (["tile layer", "tile fitter", "टाइल लेयर", "टाइल फिटर"], "tile_layer"),
        (["tile worker", "टाइल कारीगर", "फरशी कारागीर"], "tile_worker"),
        (["bar bender", "सरिया कारीगर", "सरिया बांधने वाला"], "bar_bender"),
        (["concrete worker", "ढलाई कारीगर", "काँक्रीट कामगार"], "concrete_worker")
    ]

    for phrases, skill_key in compound_phrases:
        for phrase in phrases:
            norm_phrase = normalize(phrase)
            if norm_phrase and norm_phrase in normalized:
                matched_skills_map[skill_key] = max(matched_skills_map.get(skill_key, 0.0), 0.95)
                matched_text_map[skill_key] = phrase
                # Mask out matched phrase from text to avoid conflicting single-word triggers
                normalized = normalized.replace(norm_phrase, " ")

    # 2. Check for Ambiguous Bare "Mistri" / "मिस्त्री"
    tokens_after_compounds = normalized.split()
    if any(tok in ["mistri", "मिस्त्री", "मिस्तरी"] for tok in tokens_after_compounds):
        if "mason" not in matched_skills_map:
            matched_skills_map["mason"] = 0.50
            matched_text_map["mason"] = "mistri"
            flags.append("AMBIGUOUS_MISTRI")

    # 3. Match against Lexicon Synonyms
    for skill_key, data in LEXICON.items():
        synonyms_dict = data.get("synonyms", {})
        all_synonyms: List[str] = []
        for lang_key, syn_list in synonyms_dict.items():
            all_synonyms.extend(syn_list)

        for syn in all_synonyms:
            norm_syn = normalize(syn)
            if not norm_syn:
                continue

            syn_tokens = norm_syn.split()
            # Exact phrase / token match
            if len(syn_tokens) > 1:
                if norm_syn in normalized:
                    matched_skills_map[skill_key] = max(matched_skills_map.get(skill_key, 0.0), 0.95)
                    matched_text_map[skill_key] = syn
            else:
                for tok in tokens_after_compounds:
                    if tok == norm_syn:
                        matched_skills_map[skill_key] = max(matched_skills_map.get(skill_key, 0.0), 0.95)
                        matched_text_map[skill_key] = tok
                    elif len(tok) >= 4 and len(norm_syn) >= 4:
                        # Fuzzy match using difflib
                        ratio = difflib.SequenceMatcher(None, tok, norm_syn).ratio()
                        if ratio >= 0.84:
                            confidence = round(ratio * 0.9, 2)
                            if confidence > matched_skills_map.get(skill_key, 0.0):
                                matched_skills_map[skill_key] = confidence
                                matched_text_map[skill_key] = tok

    # 4. Negation Detection (e.g., "plumber nahi, painter hoon")
    # A skill is negated if followed within 2 tokens by negation (Hindi/Marathi: "plumber nahi")
    # or preceded by English negation ("not a plumber", "no plumber")
    raw_tokens = normalize(text).split()
    m = len(raw_tokens)

    for skill_key in list(matched_skills_map.keys()):
        matched_str = matched_text_map.get(skill_key, "")
        matched_toks = normalize(matched_str).split()
        if not matched_toks:
            continue

        first_tok = matched_toks[0]
        for idx, tok in enumerate(raw_tokens):
            if tok == first_tok:
                is_negated = False
                # Case A: Followed within 2 tokens by negation
                for f_offset in [0, 1]:
                    f_idx = idx + len(matched_toks) + f_offset
                    if 0 <= f_idx < m and raw_tokens[f_idx] in NEGATION_TOKENS:
                        is_negated = True
                        break

                # Case B: Preceded by English negation
                if not is_negated:
                    for b_offset in [1, 2]:
                        b_idx = idx - b_offset
                        if 0 <= b_idx < m and raw_tokens[b_idx] in {"not", "no", "never", "dont"}:
                            is_negated = True
                            break

                if is_negated:
                    negated_skills.add(skill_key)
                    break

    for neg_skill in negated_skills:
        if neg_skill in matched_skills_map:
            del matched_skills_map[neg_skill]
            flags.append("NEGATED_SKILL_REMOVED")

    # 5. Filter by allowed_skills (if provided)
    if allowed_skills:
        allowed_set = set(allowed_skills)
        matched_skills_map = {k: v for k, v in matched_skills_map.items() if k in allowed_set}

    # 6. Segregate into Skills (>= 0.6) and Suggestions (0.4 <= conf < 0.6)
    for skill_key, conf in sorted(matched_skills_map.items(), key=lambda x: x[1], reverse=True):
        entry = {
            "key": skill_key,
            "confidence": conf,
            "matchedText": matched_text_map.get(skill_key, skill_key)
        }
        if conf >= 0.60:
            extracted_skills.append(entry)
        elif conf >= 0.40:
            suggestions.append(entry)

    # 7. Extract Experience Years
    exp_years, per_skill_years, exp_flags = _extract_experience(normalize(text))
    flags.extend(exp_flags)

    # Deduplicate flags while preserving order
    deduped_flags = list(dict.fromkeys(flags))

    return {
        "skills": extracted_skills,
        "suggestions": suggestions,
        "experienceYears": exp_years,
        "perSkillYears": per_skill_years,
        "flags": deduped_flags,
        "normalizedText": normalize(text)
    }

async def extract_skills(text: str) -> List[str]:
    """Compatibility stub for Phase 2/3 callers"""
    res = extract_skills_and_experience(text)
    return [s["key"] for s in res["skills"]]
