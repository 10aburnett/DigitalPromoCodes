"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";

interface Casino {
  id: string;
  name: string;
  slug: string;
  aboutContent?: string;
  howToRedeemContent?: string;
  bonusDetailsContent?: string;
  gameContent?: string;
  termsContent?: string;
  faqContent?: string;
}

export default function CasinoContentEditor() {
  const [casino, setCasino] = useState<Casino | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const params = useParams();
  const casinoId = params.id as string;

  // Content sections
  const [aboutContent, setAboutContent] = useState("");
  const [howToRedeemContent, setHowToRedeemContent] = useState("");
  const [bonusDetailsContent, setBonusDetailsContent] = useState("");
  const [gameContent, setGameContent] = useState("");
  const [termsContent, setTermsContent] = useState("");
  const [faqContent, setFaqContent] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && casinoId) {
      fetchCasino();
    }
  }, [isAuthenticated, casinoId]);

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

  const fetchCasino = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/casinos/${casinoId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched casino data:", data); // Debug log
        setCasino(data);
        
        // Set content with better fallback handling
        setAboutContent(data.aboutContent || "");
        setHowToRedeemContent(data.howToRedeemContent || "");
        setBonusDetailsContent(data.bonusDetailsContent || "");
        setGameContent(data.gameContent || "");
        setTermsContent(data.termsContent || "");
        setFaqContent(data.faqContent || "");
        
        console.log("Content loaded:", {
          aboutContent: data.aboutContent ? "Has content" : "Empty",
          howToRedeemContent: data.howToRedeemContent ? "Has content" : "Empty",
          bonusDetailsContent: data.bonusDetailsContent ? "Has content" : "Empty",
          gameContent: data.gameContent ? "Has content" : "Empty",
          termsContent: data.termsContent ? "Has content" : "Empty",
          faqContent: data.faqContent ? "Has content" : "Empty"
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to fetch casino data");
        router.push('/admin/casinos');
      }
    } catch (error) {
      console.error("Error fetching casino:", error);
      toast.error("Error fetching casino data");
      router.push('/admin/casinos');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/casinos/${casinoId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aboutContent,
          howToRedeemContent,
          bonusDetailsContent,
          gameContent,
          termsContent,
          faqContent,
        }),
      });

      if (response.ok) {
        toast.success("Casino content updated successfully!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update casino content");
      }
    } catch (error) {
      console.error("Error updating casino content:", error);
      toast.error("Error updating casino content");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="admin-spinner"></div>
        <p className="text-gray-600">
          {!isAuthenticated ? "Checking authentication..." : "Loading casino content..."}
        </p>
      </div>
    );
  }

  if (!casino) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Casino Not Found</h3>
          <p className="text-gray-500 mb-4">The casino you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link
            href="/admin/casinos"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Casinos
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
          <h1 className="text-2xl font-bold text-gray-900">Edit Casino Content</h1>
          <p className="text-gray-600">{casino.name}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${casino.slug}`}
            target="_blank"
            className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Preview Page
          </Link>
          <Link
            href="/admin/casinos"
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Casinos
          </Link>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        {/* About Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">About Section</h2>
            <span className="text-sm text-gray-500">{aboutContent.length} characters</span>
          </div>
          <textarea
            value={aboutContent}
            onChange={(e) => setAboutContent(e.target.value)}
            placeholder="Enter the about content for this casino..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            This content will appear in the &quot;About {casino.name}&quot; section. You can use HTML tags for formatting.
          </p>
        </div>

        {/* How to Redeem Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">How to Redeem Section</h2>
            <span className="text-sm text-gray-500">{howToRedeemContent.length} characters</span>
          </div>
          <textarea
            value={howToRedeemContent}
            onChange={(e) => setHowToRedeemContent(e.target.value)}
            placeholder="Enter custom how to redeem instructions..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            Custom instructions for redeeming promos. Leave empty to use default instructions.
          </p>
        </div>

        {/* Promo Details Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Promo Details Section</h2>
            <span className="text-sm text-gray-500">{bonusDetailsContent.length} characters</span>
          </div>
          <textarea
            value={bonusDetailsContent}
            onChange={(e) => setBonusDetailsContent(e.target.value)}
            placeholder="Enter detailed information about the promo offer..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            Detailed description of the promo offer, terms, and conditions.
          </p>
        </div>

        {/* Game Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Games Section</h2>
            <span className="text-sm text-gray-500">{gameContent.length} characters</span>
          </div>
          <textarea
            value={gameContent}
            onChange={(e) => setGameContent(e.target.value)}
            placeholder="Enter information about available games..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            Information about the whop&apos;s content, features, and offerings.
          </p>
        </div>

        {/* Terms Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Terms & Conditions Section</h2>
            <span className="text-sm text-gray-500">{termsContent.length} characters</span>
          </div>
          <textarea
            value={termsContent}
            onChange={(e) => setTermsContent(e.target.value)}
            placeholder="Enter terms and conditions information..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            Terms and conditions specific to this casino&apos;s bonuses.
          </p>
        </div>

        {/* FAQ Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">FAQ Section</h2>
            <span className="text-sm text-gray-500">{faqContent.length} characters</span>
          </div>
          <textarea
            value={faqContent}
            onChange={(e) => setFaqContent(e.target.value)}
            placeholder="Enter FAQ content in HTML format..."
            className="w-full h-48 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            FAQ content in HTML format. Use div elements with classes for proper styling.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-between items-center pt-6 border-t">
        <div className="text-sm text-gray-500">
          {saving && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Saving changes...</span>
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save Content</span>
            </>
          )}
        </button>
      </div>

      {/* HTML Formatting Guide */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">HTML Formatting Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Basic Formatting:</h4>
            <ul className="space-y-1 text-gray-600">
              <li><code>&lt;p&gt;Paragraph&lt;/p&gt;</code></li>
              <li><code>&lt;strong&gt;Bold text&lt;/strong&gt;</code></li>
              <li><code>&lt;em&gt;Italic text&lt;/em&gt;</code></li>
              <li><code>&lt;br&gt;</code> - Line break</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Lists:</h4>
            <ul className="space-y-1 text-gray-600">
              <li><code>&lt;ul&gt;&lt;li&gt;Item&lt;/li&gt;&lt;/ul&gt;</code></li>
              <li><code>&lt;ol&gt;&lt;li&gt;Item&lt;/li&gt;&lt;/ol&gt;</code></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Headings:</h4>
            <ul className="space-y-1 text-gray-600">
              <li><code>&lt;h3&gt;Section Title&lt;/h3&gt;</code></li>
              <li><code>&lt;h4&gt;Subsection&lt;/h4&gt;</code></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Special:</h4>
            <ul className="space-y-1 text-gray-600">
              <li><code>&lt;span class=&quot;text-[#68D08B] font-bold&quot;&gt;Green text&lt;/span&gt;</code></li>
              <li><code>&lt;div class=&quot;bg-[#343541] p-4 rounded-lg&quot;&gt;Box&lt;/div&gt;</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 