"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface Whop {
  id: string;
  name: string;
  slug: string;
}

const reviewSchema = z.object({
  author: z.string().min(1, "Author name is required"),
  content: z.string().min(3, "Review content is required"),
  rating: z.union([z.number(), z.string()]).transform((val) => 
    typeof val === 'string' ? parseFloat(val) : val
  ),
  whopId: z.string().min(1, "Whop course is required"),
  verified: z.boolean().optional().default(false)
});

type ReviewFormData = z.infer<typeof reviewSchema>;

export default function EditReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [whops, setWhops] = useState<Whop[]>([]);
  const [filteredWhops, setFilteredWhops] = useState<Whop[]>([]);
  const [whopSearch, setWhopSearch] = useState("");
  const [showWhopDropdown, setShowWhopDropdown] = useState(false);
  const [selectedWhop, setSelectedWhop] = useState<Whop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      author: "",
      content: "",
      rating: 5,
      whopId: "",
      verified: false
    }
  });

  // Filter whops based on search
  useEffect(() => {
    if (whopSearch.trim() === "") {
      setFilteredWhops(whops);
    } else {
      const filtered = whops.filter(whop =>
        whop.name.toLowerCase().includes(whopSearch.toLowerCase())
      );
      setFilteredWhops(filtered);
    }
  }, [whopSearch, whops]);

  // Handle whop selection
  const handleWhopSelect = (whop: Whop) => {
    setSelectedWhop(whop);
    setWhopSearch(whop.name);
    setValue("whopId", whop.id);
    setShowWhopDropdown(false);
  };

  // Handle search input - completely independent from selection
  const handleWhopSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWhopSearch(value);
    setShowWhopDropdown(true);
    
    // Don't auto-select anything, let user type freely
    // Only clear selection if they completely clear the input
    if (value.trim() === "") {
      setSelectedWhop(null);
      setValue("whopId", "");
    }
  };

  // Handle clearing the search
  const handleClearSearch = () => {
    setWhopSearch("");
    setSelectedWhop(null);
    setValue("whopId", "");
    setShowWhopDropdown(false);
  };

  useEffect(() => {
    const fetchWhops = async () => {
      try {
        const response = await fetch('/api/whops?limit=1000'); // Get all whops for the dropdown
        if (!response.ok) {
          throw new Error("Failed to fetch whop courses");
        }
        const data = await response.json();
        // Handle both paginated and direct array responses
        const whopsData = data.data || data;
        setWhops(Array.isArray(whopsData) ? whopsData : []);
      } catch (err) {
        setError("Error fetching whop courses. Please try again.");
        console.error(err);
      }
    };

    const fetchReview = async () => {
      try {
        // Only fetch review data if we have an ID (not for new reviews)
        if (params.id !== "new") {
          const response = await fetch(`/api/admin/reviews/${params.id}`);
          if (!response.ok) {
            throw new Error("Failed to fetch review");
          }
          const review = await response.json();
          
          // Populate the form with fetched data
          setValue("author", review.author);
          setValue("content", review.content);
          setValue("rating", review.rating);
          setValue("whopId", review.whopId);
          setValue("verified", review.verified || false);
          
          // Set selected whop for display (only if not already typing)
          if (review.whop && whopSearch === "") {
            setSelectedWhop(review.whop);
            setWhopSearch(review.whop.name);
          }
        } else {
          // For new reviews, check if whopId is provided in URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const whopId = urlParams.get('whopId');
          if (whopId && whopSearch === "") {
            setValue("whopId", whopId);
          }
        }
      } catch (err) {
        setError("Error fetching review. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    Promise.all([fetchWhops(), fetchReview()])
      .then(() => setLoading(false))
      .catch(err => {
        console.error("Error during initialization:", err);
        setLoading(false);
        setError("An error occurred. Please try again.");
      });
  }, [params.id, setValue]);

  // Separate effect to handle URL whopId parameter after whops are loaded
  useEffect(() => {
    if (params.id === "new" && whops.length > 0 && !selectedWhop) {
      const urlParams = new URLSearchParams(window.location.search);
      const whopId = urlParams.get('whopId');
      if (whopId) {
        const whop = whops.find(w => w.id === whopId);
        if (whop) {
          setSelectedWhop(whop);
          setWhopSearch(whop.name);
        }
      }
    }
  }, [whops, params.id, selectedWhop]);

  const onSubmit = async (data: ReviewFormData) => {
    setIsSaving(true);
    setError(null);
    
    try {
      // Debug: log the form data being sent
      console.log('Form data being submitted:', data);
      console.log('Selected whop:', selectedWhop);
      
      // Ensure we have proper whop data
      const payload = {
        whopId: data.whopId || selectedWhop?.id,
        whopSlug: selectedWhop?.slug,
        author: data.author,
        rating: Number(data.rating),
        content: data.content,
        verified: data.verified
      };
      
      console.log('Payload being sent:', payload);
      
      const url = params.id === "new" 
        ? '/api/admin/reviews' 
        : `/api/admin/reviews/${params.id}`;
      
      const method = params.id === "new" ? 'POST' : 'PATCH';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save review");
      }
      
      router.push('/admin/reviews');
    } catch (err: any) {
      setError(err.message || "An error occurred saving the review");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">
        {params.id === "new" ? "Add New Review" : "Edit Review"}
      </h1>
      
      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="form-group">
          <label className="block mb-2 font-medium">Whop Course</label>
          
          {/* Show currently selected whop */}
          {selectedWhop && (
            <div className="mb-2 p-2 bg-green-800 border border-green-600 rounded text-sm">
              <span className="text-green-200">Selected: </span>
              <span className="font-medium text-white">{selectedWhop.name}</span>
              <button
                type="button"
                onClick={handleClearSearch}
                className="ml-2 text-green-300 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
          
          <div className="relative">
            <input
              type="text"
              value={whopSearch}
              onChange={handleWhopSearchChange}
              onFocus={() => setShowWhopDropdown(true)}
              placeholder={selectedWhop ? "Search for a different whop course..." : "Search for a whop course..."}
              className="w-full p-2 pr-10 border rounded bg-gray-800 border-gray-700 text-white"
            />
            
            {/* Clear button */}
            {whopSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
            
            {showWhopDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredWhops.length > 0 ? (
                  filteredWhops.map(whop => (
                    <div
                      key={whop.id}
                      onClick={() => handleWhopSelect(whop)}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-700 text-white ${
                        selectedWhop?.id === whop.id ? 'bg-blue-700' : ''
                      }`}
                    >
                      {whop.name}
                      {selectedWhop?.id === whop.id && (
                        <span className="ml-2 text-blue-300">✓</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-400">
                    No whop courses found
                  </div>
                )}
              </div>
            )}
            
            {/* Click outside to close dropdown */}
            {showWhopDropdown && (
              <div 
                className="fixed inset-0 z-5"
                onClick={() => setShowWhopDropdown(false)}
              />
            )}
          </div>
          
          {/* Hidden input for form validation */}
          <input
            type="hidden"
            {...register("whopId")}
          />
          
          {errors.whopId && (
            <p className="admin-error mt-1">{errors.whopId.message}</p>
          )}
        </div>
        
        <div className="form-group">
          <label className="block mb-2 font-medium">Author Name</label>
          <input
            type="text"
            {...register("author")}
            className="w-full p-2 border rounded bg-gray-800 border-gray-700"
            placeholder="John Doe"
          />
          {errors.author && (
            <p className="admin-error mt-1">{errors.author.message}</p>
          )}
        </div>
        
        <div className="form-group">
          <label className="block mb-2 font-medium">Rating (1-5)</label>
          <input
            type="number"
            {...register("rating")}
            className="w-full p-2 border rounded bg-gray-800 border-gray-700"
            min="1"
            max="5"
            step="0.1"
          />
          {errors.rating && (
            <p className="admin-error mt-1">{errors.rating.message}</p>
          )}
        </div>
        
        <div className="form-group">
          <label className="block mb-2 font-medium">Review Content</label>
          <textarea
            {...register("content")}
            className="w-full p-2 border rounded bg-gray-800 border-gray-700"
            rows={6}
            placeholder="Write your review here..."
          ></textarea>
          {errors.content && (
            <p className="admin-error mt-1">{errors.content.message}</p>
          )}
        </div>
        
        <div className="form-group">
          <div className="flex items-center">
            <input
              type="checkbox"
              {...register("verified")}
              id="verified"
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="verified" className="font-medium">
              Verified Review
            </label>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Check this to show the review with a verified badge on the frontend
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Review"}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/admin/reviews')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
} 