"use client";

import { useState, useEffect } from "react";
import { FaqItem, sanitizeAnswerHtml, isGenericQuestion, hasDuplicateQuestions, FaqArraySchema } from "@/lib/faq-types";

interface FaqEditorProps {
  initialFaqs: FaqItem[];
  onChange: (faqs: FaqItem[]) => void;
  className?: string;
}

export default function FaqEditor({ initialFaqs, onChange, className = "" }: FaqEditorProps) {
  const [faqs, setFaqs] = useState<FaqItem[]>(initialFaqs.length > 0 ? initialFaqs : [
    { question: "", answerHtml: "" }
  ]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    onChange(faqs);
    validateFaqs();
  }, [faqs]);

  const validateFaqs = () => {
    const errors: string[] = [];
    
    // Check for duplicate questions
    const duplicates = hasDuplicateQuestions(faqs);
    if (duplicates.length > 0) {
      errors.push(`Duplicate questions detected: ${duplicates.join(", ")}`);
    }
    
    // Check for banned generic questions
    faqs.forEach((faq, index) => {
      if (faq.question.trim() && isGenericQuestion(faq.question)) {
        errors.push(`FAQ ${index + 1}: Avoid generic questions like "${faq.question}"`);
      }
    });
    
    // Check overall structure
    const result = FaqArraySchema.safeParse(faqs.filter(f => f.question.trim() && f.answerHtml.trim()));
    if (!result.success && faqs.some(f => f.question.trim() || f.answerHtml.trim())) {
      errors.push("Must have 3-12 FAQs with valid questions (8-160 chars) and answers (20-2000 chars)");
    }
    
    setValidationErrors(errors);
  };

  const addFaq = () => {
    if (faqs.length < 12) {
      setFaqs([...faqs, { question: "", answerHtml: "" }]);
    }
  };

  const removeFaq = (index: number) => {
    if (faqs.length > 1) {
      setFaqs(faqs.filter((_, i) => i !== index));
    }
  };

  const updateFaq = (index: number, field: keyof FaqItem, value: string) => {
    const newFaqs = [...faqs];
    if (field === 'answerHtml') {
      newFaqs[index][field] = sanitizeAnswerHtml(value);
    } else {
      newFaqs[index][field] = value;
    }
    setFaqs(newFaqs);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newFaqs = [...faqs];
    const draggedItem = newFaqs[draggedIndex];
    newFaqs.splice(draggedIndex, 1);
    newFaqs.splice(dropIndex, 0, draggedItem);
    
    setFaqs(newFaqs);
    setDraggedIndex(null);
  };

  const exportJson = () => {
    const validFaqs = faqs.filter(f => f.question.trim() && f.answerHtml.trim());
    const blob = new Blob([JSON.stringify(validFaqs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faqs.json';
    a.click();
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const result = FaqArraySchema.safeParse(imported);
        if (result.success) {
          setFaqs(result.data);
        } else {
          alert("Invalid FAQ format in JSON file");
        }
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">FAQ Editor</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            {showPreview ? "Hide" : "Show"} Preview
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Export JSON
          </button>
          <label className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 cursor-pointer">
            Import JSON
            <input
              type="file"
              accept=".json"
              onChange={importJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <h4 className="font-medium text-red-800 mb-2">Validation Issues:</h4>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {validationErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={`grid ${showPreview ? "grid-cols-2" : "grid-cols-1"} gap-6`}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {faqs.filter(f => f.question.trim() && f.answerHtml.trim()).length} / 12 FAQs
            </span>
            <button
              type="button"
              onClick={addFaq}
              disabled={faqs.length >= 12}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              Add FAQ
            </button>
          </div>

          {faqs.map((faq, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={`border border-gray-200 rounded-lg p-4 ${draggedIndex === index ? 'opacity-50' : ''} cursor-move hover:bg-gray-50`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <span className="text-xs text-gray-400">Drag to reorder</span>
                </div>
                <div className="flex items-center gap-2">
                  {isGenericQuestion(faq.question) && faq.question.trim() && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Generic</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    disabled={faqs.length <= 1}
                    className="text-red-500 hover:text-red-700 disabled:text-gray-400"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question ({faq.question.length}/160)
                  </label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => updateFaq(index, 'question', e.target.value)}
                    placeholder="Enter a specific question about this whop..."
                    maxLength={160}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Answer ({faq.answerHtml.length}/2000 chars, ~{wordCount(faq.answerHtml)} words)
                  </label>
                  <textarea
                    value={faq.answerHtml}
                    onChange={(e) => updateFaq(index, 'answerHtml', e.target.value)}
                    placeholder="Provide a detailed answer. You can use basic HTML: <p>, <strong>, <em>, <ul>, <ol>, <li>, <a>"
                    maxLength={2000}
                    rows={4}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Allowed HTML: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showPreview && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Live Preview</h3>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              {faqs.filter(f => f.question.trim() && f.answerHtml.trim()).length > 0 ? (
                <div className="space-y-4">
                  {faqs
                    .filter(f => f.question.trim() && f.answerHtml.trim())
                    .map((faq, index) => (
                      <div key={index} className="border-b border-gray-200 pb-3 last:border-b-0">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Q: {faq.question}
                        </h4>
                        <div 
                          className="text-gray-700 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: faq.answerHtml }}
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No complete FAQs to preview</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800 mb-2 font-medium">FAQ Guidelines:</p>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Target 6-9 FAQs per page for optimal user experience</li>
          <li>• Make ≥60% of questions whop-specific (features, pricing tiers, support, etc.)</li>
          <li>• Avoid generic questions already covered elsewhere on the page</li>
          <li>• Keep answers concise but comprehensive</li>
        </ul>
      </div>
    </div>
  );
}