import sys
import json
from pathlib import Path
from typing import Dict, Any, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.skill_extractor import extract_skills_and_experience

UTTERANCES_FILE = Path(__file__).parent.parent.parent / "tests" / "data" / "utterances.json"

def run_evaluation() -> Dict[str, Any]:
    with open(UTTERANCES_FILE, "r", encoding="utf-8") as f:
        utterances = json.load(f)

    total = len(utterances)
    skills_correct = 0
    years_correct = 0

    lang_stats: Dict[str, Dict[str, int]] = {}

    print("\n" + "=" * 90)
    print("🎯 WorkPulse Voice Service: Skill & Experience Extractor Golden Set Evaluation")
    print("=" * 90)
    print(f"{'ID':<4} | {'Lang':<5} | {'Skills Result':<13} | {'Years Result':<13} | {'Utterance Text'}")
    print("-" * 90)

    for item in utterances:
        uid = item["id"]
        text = item["text"]
        lang = item.get("language", "hi")
        expected_skills = set(item.get("expectedSkills", []))
        expected_years = item.get("expectedYears")

        if lang not in lang_stats:
            lang_stats[lang] = {"total": 0, "skills_correct": 0, "years_correct": 0}
        lang_stats[lang]["total"] += 1

        extracted = extract_skills_and_experience(text, language=lang)
        predicted_skills = set(s["key"] for s in extracted["skills"])
        predicted_years = extracted["experienceYears"]

        # Skills match check
        s_match = (predicted_skills == expected_skills)
        if s_match:
            skills_correct += 1
            lang_stats[lang]["skills_correct"] += 1
            s_str = "✅ PASS"
        else:
            s_str = f"❌ {predicted_skills}"

        # Years match check
        y_match = (predicted_years == expected_years)
        if y_match:
            years_correct += 1
            lang_stats[lang]["years_correct"] += 1
            y_str = "✅ PASS"
        else:
            y_str = f"❌ {predicted_years}!=exp:{expected_years}"

        short_text = text if len(text) <= 45 else text[:42] + "..."
        print(f"{uid:<4} | {lang:<5} | {s_str:<13} | {y_str:<13} | {short_text}")

    skills_accuracy = (skills_correct / total) * 100 if total > 0 else 0
    years_accuracy = (years_correct / total) * 100 if total > 0 else 0

    print("=" * 90)
    print("📊 OVERALL SUMMARY METRICS")
    print(f"Total Test Utterances  : {total}")
    print(f"Skills Exact Match Acc : {skills_accuracy:.1f}% ({skills_correct}/{total})")
    print(f"Experience Years Match : {years_accuracy:.1f}% ({years_correct}/{total})")
    print("-" * 90)
    print("🌐 PER-LANGUAGE BREAKDOWN:")
    for l_code, stats in sorted(lang_stats.items()):
        l_total = stats["total"]
        s_acc = (stats["skills_correct"] / l_total) * 100 if l_total > 0 else 0
        y_acc = (stats["years_correct"] / l_total) * 100 if l_total > 0 else 0
        print(f"  • [{l_code.upper()}]: Total={l_total} | Skills Acc={s_acc:.1f}% | Years Acc={y_acc:.1f}%")
    print("=" * 90 + "\n")

    return {
        "total": total,
        "skillsAccuracy": skills_accuracy,
        "yearsAccuracy": years_accuracy,
        "languageBreakdown": lang_stats
    }

if __name__ == "__main__":
    run_evaluation()
