"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCasinoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [casinoData, setCasinoData] = useState({
    name: "",
    slug: "",
    logo: "",
    description: "",
    rating: 4,
    affiliateLink: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCasinoData({ ...casinoData, [name]: value });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCasinoData({ ...casinoData, [name]: parseFloat(value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!casinoData.name || !casinoData.slug) {
      alert("Name and slug are required!");
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch("/api/casinos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(casinoData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create casino");
      }
      
      router.push("/admin/casinos");
      router.refresh();
    } catch (error) {
      console.error("Error creating casino:", error);
      alert("Failed to create casino. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Add New Casino</h2>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="bg-[#292932] shadow-md rounded-lg overflow-hidden border border-[#404055] p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[#a7a9b4] text-sm font-medium mb-2">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={casinoData.name}
                onChange={handleChange}
                required
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
            </div>
            
            <div>
              <label className="block text-[#a7a9b4] text-sm font-medium mb-2">
                Slug *
              </label>
              <input
                type="text"
                name="slug"
                value={casinoData.slug}
                onChange={handleChange}
                required
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
                placeholder="e.g. stake-casino"
              />
            </div>
            
            <div>
              <label className="block text-[#a7a9b4] text-sm font-medium mb-2">
                Logo URL
              </label>
              <input
                type="text"
                name="logo"
                value={casinoData.logo}
                onChange={handleChange}
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
                placeholder="/images/casino-logo.png"
              />
            </div>
            
            <div>
              <label className="block text-[#a7a9b4] text-sm font-medium mb-2">
                Rating
              </label>
              <input
                type="number"
                name="rating"
                value={casinoData.rating}
                onChange={handleNumberChange}
                min="1"
                max="5"
                step="0.1"
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[#a7a9b4] text-sm font-medium mb-2">
                Affiliate Link
              </label>
              <input
                type="text"
                name="affiliateLink"
                value={casinoData.affiliateLink}
                onChange={handleChange}
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
                placeholder="https://example.com/affiliate"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[#a7a9b4] text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={casinoData.description}
                onChange={handleChange}
                rows={4}
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#68D08B] text-white rounded-md hover:bg-[#5abc7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Casino"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 