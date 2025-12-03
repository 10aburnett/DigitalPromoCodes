"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import FaqEditor from "@/components/admin/FaqEditor";
import { FaqItem, parseFaqContent } from "@/lib/faq-types";
import { isMeaningful } from "@/lib/textRender";

interface DealContent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  aboutContent?: string;
  howToRedeemContent?: string;
  promoDetailsContent?: string;
  featuresContent?: string;
  termsContent?: string;
  faqContent?: string;
}

export default function WhopContentEditor() {
  const [whop, setWhop] = useState<DealContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [actualWhopId, setActualWhopId] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const whopId = params.id as string;

  // Content sections
  const [aboutContent, setAboutContent] = useState("");
  const [howToRedeemContent, setHowToRedeemContent] = useState("");
  const [promoDetailsContent, setPromoDetailsContent] = useState("");
  const [featuresContent, setFeaturesContent] = useState("");
  const [termsContent, setTermsContent] = useState("");
  const [faqContent, setFaqContent] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && whopId) {
      fetchWhop();
    }
  }, [isAuthenticated, whopId]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin-auth');
      const data = await response.json();
      
      if (response.ok && data.success && data.user) {
        setIsAuthenticated(true);
      } else {
        router.push('/admin/login');
        return;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/admin/login');
      return;
    } finally {
      setLoading(false);
    }
  };

  const fetchWhop = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/whops/${encodeURIComponent(whopId)}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched whop data:", data);
        setWhop(data);
        // Cache the UUID for writes
        setActualWhopId(data.id);
        
        // Set content with better fallback handling
        setAboutContent(data.aboutContent || "");
        setHowToRedeemContent(data.howToRedeemContent || "");
        setPromoDetailsContent(data.promoDetailsContent || "");
        setFeaturesContent(data.featuresContent || "");
        setTermsContent(data.termsContent || "");
        setFaqContent(data.faqContent || "");
        
        // Parse FAQ content - could be structured array or legacy text
        const parsedFaq = parseFaqContent(data.faqContent);
        if (Array.isArray(parsedFaq)) {
          setFaqItems(parsedFaq);
        } else {
          // Legacy text content - keep for backward compatibility
          setFaqItems([]);
        }
        
        console.log("Content loaded:", {
          aboutContent: data.aboutContent ? "Has content" : "Empty",
          howToRedeemContent: data.howToRedeemContent ? "Has content" : "Empty",
          promoDetailsContent: data.promoDetailsContent ? "Has content" : "Empty",
          featuresContent: data.featuresContent ? "Has content" : "Empty",
          termsContent: data.termsContent ? "Has content" : "Empty",
          faqContent: data.faqContent ? "Has content" : "Empty"
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to fetch whop data");
        router.push('/admin/whops');
      }
    } catch (error) {
      console.error("Error fetching whop:", error);
      toast.error("Error fetching whop data");
      router.push('/admin/whops');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Prepare FAQ content - use structured data if we have items, otherwise keep legacy text
      let finalFaqContent = faqContent;
      if (faqItems.length > 0 && faqItems.some(f => f.question.trim() && f.answerHtml.trim())) {
        const validFaqs = faqItems.filter(f => f.question.trim() && f.answerHtml.trim());
        finalFaqContent = JSON.stringify(validFaqs);
      }
      
      // Use the cached UUID for writes, fallback to URL param
      const idForPut = actualWhopId || whopId;
      const response = await fetch(`/api/whops/${encodeURIComponent(idForPut)}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aboutContent,
          howToRedeemContent,
          promoDetailsContent,
          featuresContent,
          termsContent,
          faqContent: finalFaqContent,
        }),
      });

      if (response.ok) {
        toast.success("Whop content updated successfully!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update whop content");
      }
    } catch (error) {
      console.error("Error updating whop content:", error);
      toast.error("Error updating whop content");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="admin-spinner"></div>
        <p className="text-gray-600">
          {!isAuthenticated ? "Checking authentication..." : "Loading whop content..."}
        </p>
      </div>
    );
  }

  if (!whop) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Whop Not Found</h3>
          <p className="text-gray-500 mb-4">The whop you're looking for doesn't exist or has been removed.</p>
          <Link
            href="/admin/whops"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Whops
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Whop Content</h1>
          <p className="text-gray-600">{whop.name}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${whop.slug}`}
            target="_blank"
            className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Preview Page
          </Link>
          <Link
            href="/admin/whops"
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Whops
          </Link>
        </div>
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* About Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">About Content</h2>
          <textarea
            value={aboutContent}
            onChange={(e) => setAboutContent(e.target.value)}
            placeholder="Enter about content for this whop..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono whitespace-break-spaces"
          />
          <p className="text-xs text-gray-500 mt-2">
            Type plain text. Line breaks will be preserved. Smart fallback to description happens on public page.
          </p>
        </div>

        {/* How to Redeem Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">How to Redeem Content</h2>
          <textarea
            value={howToRedeemContent}
            onChange={(e) => setHowToRedeemContent(e.target.value)}
            placeholder="Enter how to redeem instructions..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono whitespace-break-spaces"
          />
          <p className="text-xs text-gray-500 mt-2">
            Type plain text. Line breaks will be preserved.
          </p>
        </div>

        {/* Promo Details Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Promo Details Content</h2>
          <textarea
            value={promoDetailsContent}
            onChange={(e) => setPromoDetailsContent(e.target.value)}
            placeholder="Enter promo details content..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono whitespace-break-spaces"
          />
          <p className="text-xs text-gray-500 mt-2">
            Type plain text. Line breaks will be preserved.
          </p>
        </div>

        {/* Features Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Features Content</h2>
          <textarea
            value={featuresContent}
            onChange={(e) => setFeaturesContent(e.target.value)}
            placeholder="Enter features content..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono whitespace-break-spaces"
          />
          <p className="text-xs text-gray-500 mt-2">
            Type plain text. Line breaks will be preserved.
          </p>
        </div>

        {/* Terms Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Terms & Conditions Content</h2>
          <textarea
            value={termsContent}
            onChange={(e) => setTermsContent(e.target.value)}
            placeholder="Enter terms and conditions content..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono whitespace-break-spaces"
          />
          <p className="text-xs text-gray-500 mt-2">
            Type plain text. Line breaks will be preserved.
          </p>
        </div>

        {/* FAQ Content */}
        <div className="col-span-1 lg:col-span-2">
          <FaqEditor
            initialFaqs={faqItems}
            onChange={setFaqItems}
          />
          
          {/* Legacy FAQ Content (for backward compatibility) */}
          {faqItems.length === 0 && faqContent && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-medium text-yellow-800 mb-2">Legacy FAQ Content</h3>
              <p className="text-sm text-yellow-700 mb-3">
                This whop has legacy FAQ content. You can edit it below or migrate to the new structured FAQ editor above.
              </p>
              <textarea
                value={faqContent}
                onChange={(e) => setFaqContent(e.target.value)}
                placeholder="Legacy FAQ content..."
                className="w-full h-32 p-3 border border-yellow-300 rounded-lg resize-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save Content"}
        </button>
      </div>
    </div>
  );
} 