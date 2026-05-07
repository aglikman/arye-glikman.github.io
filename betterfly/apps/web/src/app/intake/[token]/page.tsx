"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Question, ResponseValue, MedicationEntry } from "@betterfly/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface IntakeData {
  id: string;
  type: string;
  language: "en" | "he";
  status: string;
  first_name: string;
  last_name: string;
  preferred_language: string;
  template_schema: { questions: Question[] } | null;
  content_en: string | null;
  content_he: string | null;
}

type Phase = "consent" | "form" | "submitted" | "expired" | "error";

export default function IntakePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<IntakeData | null>(null);
  const [phase, setPhase] = useState<Phase>("consent");
  const [answers, setAnswers] = useState<Record<string, ResponseValue>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/intake/${token}`)
      .then(async (res) => {
        if (res.status === 410) { setPhase("expired"); return; }
        if (!res.ok) { setPhase("error"); return; }
        const json = await res.json();
        setData(json);
      })
      .catch(() => setPhase("error"));
  }, [token]);

  if (phase === "expired") return <StatusPage title="Link expired" message="This intake link has expired or the assessment has already been submitted. Please contact your clinic." />;
  if (phase === "error") return <StatusPage title="Invalid link" message="This link is not valid. Please contact your clinic." />;
  if (phase === "submitted") return <StatusPage title="Submitted" message="Thank you. Your responses have been received. Your clinician will review them and be in touch." success />;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>;

  const lang = (data.preferred_language ?? data.language ?? "en") as "en" | "he";
  const isRtl = lang === "he";
  const questions = data.template_schema?.questions ?? [];
  const consentText = lang === "he" ? data.content_he : data.content_en;

  async function submitAssessment() {
    setSubmitting(true);
    const responses = Object.entries(answers).map(([question_id, value]) => ({ question_id, value }));
    try {
      const res = await fetch(`${API_URL}/intake/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment_id: data!.id, client_id: data!.id, language: lang, responses }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setPhase("submitted");
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-8 py-6 text-white">
            <h1 className="text-xl font-bold">
              {lang === "he" ? "שאלון קבלה" : "Clinical Intake Questionnaire"}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {data.first_name} {data.last_name}
            </p>
          </div>

          <div className="px-8 py-6">
            {phase === "consent" && (
              <ConsentSection
                consentText={consentText}
                lang={lang}
                onAccept={() => setPhase("form")}
              />
            )}

            {phase === "form" && questions.length > 0 && (
              <FormSection
                questions={questions}
                currentIndex={currentIndex}
                answers={answers}
                lang={lang}
                onAnswer={(qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }))}
                onNext={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
                onPrev={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                onSubmit={submitAssessment}
                submitting={submitting}
              />
            )}

            {phase === "form" && questions.length === 0 && (
              <div className="text-sm text-gray-500 py-8 text-center">
                No questionnaire template is configured for this assessment.
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {lang === "he"
              ? "תוצאות השאלון מיועדות לתמיכה קלינית בלבד ואינן מהוות אבחנה."
              : "Questionnaire results are for clinical screening support only and do not constitute a diagnosis."}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsentSection({ consentText, lang, onAccept }: {
  consentText: string | null;
  lang: "en" | "he";
  onAccept: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {lang === "he" ? "הסכמה מדעת" : "Informed Consent"}
      </h2>
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 max-h-64 overflow-y-auto mb-5 whitespace-pre-wrap">
        {consentText ?? (lang === "he"
          ? "אני מסכים/ה לשתף את המידע הבריאותי שלי לצורך ההערכה הקלינית."
          : "I agree to share my health information for the purpose of this clinical assessment."
        )}
      </div>
      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-gray-700">
          {lang === "he" ? "אני מסכים/ה לתנאים הנ\"ל" : "I agree to the above terms"}
        </span>
      </label>
      <button
        disabled={!agreed}
        onClick={onAccept}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        {lang === "he" ? "המשך לשאלון" : "Continue to questionnaire"}
      </button>
    </div>
  );
}

function FormSection({ questions, currentIndex, answers, lang, onAnswer, onNext, onPrev, onSubmit, submitting }: {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, ResponseValue>;
  lang: "en" | "he";
  onAnswer: (id: string, val: ResponseValue) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{lang === "he" ? `שאלה ${currentIndex + 1} מתוך ${questions.length}` : `Question ${currentIndex + 1} of ${questions.length}`}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <p className="text-base font-medium text-gray-800 mb-5">
          {q.text[lang]}
          {q.required && <span className="text-red-400 ml-1">*</span>}
        </p>

        <QuestionInput q={q} lang={lang} value={answers[q.question_id]} onChange={(v) => onAnswer(q.question_id, v)} />
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"
        >
          {lang === "he" ? "← הקודם" : "← Previous"}
        </button>

        {isLast ? (
          <button
            onClick={onSubmit}
            disabled={submitting || (q.required && answers[q.question_id] === undefined)}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors"
          >
            {submitting ? "…" : (lang === "he" ? "שלח" : "Submit")}
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={q.required && answers[q.question_id] === undefined}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors"
          >
            {lang === "he" ? "הבא →" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionInput({ q, lang, value, onChange }: {
  q: Question;
  lang: "en" | "he";
  value: ResponseValue | undefined;
  onChange: (v: ResponseValue) => void;
}) {
  if (q.response_type === "scale_0_3" || q.response_type === "scale_0_4") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {q.options?.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value as number)}
            className={`px-4 py-3 rounded-lg text-sm border transition-all text-left ${
              value === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
            }`}
          >
            {opt.label[lang]}
          </button>
        ))}
      </div>
    );
  }

  if (q.response_type === "yes_no") {
    return (
      <div className="flex gap-3">
        {[{ label: lang === "he" ? "כן" : "Yes", value: true }, { label: lang === "he" ? "לא" : "No", value: false }].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-8 py-2.5 rounded-lg text-sm border transition-all ${
              value === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (q.response_type === "text") {
    return (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    );
  }

  if (q.response_type === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  if (q.response_type === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  if (q.response_type === "medication_table") {
    const meds = (Array.isArray(value) ? value : []) as MedicationEntry[];
    return (
      <MedicationTable
        value={meds}
        lang={lang}
        onChange={(v) => onChange(v)}
      />
    );
  }

  return <p className="text-sm text-gray-400">Response type "{q.response_type}" not yet rendered.</p>;
}

function MedicationTable({ value, lang, onChange }: {
  value: MedicationEntry[];
  lang: "en" | "he";
  onChange: (v: MedicationEntry[]) => void;
}) {
  function addRow() {
    onChange([...value, { name: "", dosage: "", frequency: "", indication: "" }]);
  }
  function updateRow(i: number, field: keyof MedicationEntry, val: string) {
    const updated = value.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {value.map((med, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
          {(["name", "dosage", "frequency", "indication"] as (keyof MedicationEntry)[]).map((field) => (
            <input
              key={field}
              placeholder={lang === "he" ? field : field.charAt(0).toUpperCase() + field.slice(1)}
              value={med[field]}
              onChange={(e) => updateRow(i, field, e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          ))}
        </div>
      ))}
      <button
        onClick={addRow}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        + {lang === "he" ? "הוסף תרופה" : "Add medication"}
      </button>
    </div>
  );
}

function StatusPage({ title, message, success }: { title: string; message: string; success?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md text-center">
        <div className={`text-4xl mb-4`}>{success ? "✓" : "✗"}</div>
        <h1 className={`text-xl font-bold mb-2 ${success ? "text-green-700" : "text-gray-800"}`}>{title}</h1>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
