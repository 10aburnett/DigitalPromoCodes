"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { normalizeImagePath } from "@/lib/image-utils";
import InitialsAvatar from "@/components/InitialsAvatar";

const whopSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  logo: z.string().optional(),
  description: z.string().optional(),
  affiliateLink: z.string().url("Must be a valid URL").min(1, "Affiliate link is required"),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  price: z.string().optional(),
  category: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  // Promo code fields (all optional)
  promoTitle: z.string().optional(),
  promoDescription: z.string().optional(),
  promoCode: z.string().optional(),
  promoType: z.enum(["DISCOUNT", "FREE_TRIAL", "EXCLUSIVE_ACCESS", "BUNDLE_DEAL", "LIMITED_TIME"]).optional(),
  promoValue: z.string().optional(),
});

type WhopForm = z.infer<typeof whopSchema>;

interface Whop {
  id: string;
  name: string;
  PromoCode?: PromoCode[];
}

interface PromoCode {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

export default function EditWhopPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [calculatedRating, setCalculatedRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [promoCodeId, setPromoCodeId] = useState<string | null>(null);
  const [logoImageError, setLogoImageError] = useState(false);
  
  // Screenshot state
  const [screenshotFiles, setScreenshotFiles] = useState<(File | null)[]>([null, null, null]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<(string | null)[]>([null, null, null]);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WhopForm>({
    resolver: zodResolver(whopSchema),
    defaultValues: {
      promoType: "DISCOUNT",
      screenshots: [],
    }
  });

  const watchedName = watch("name", "");

  useEffect(() => {
    if (params.id !== "new") {
      fetchWhop();
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchWhop = async () => {
    try {
      // Trust Next.js params as-is (they're already properly encoded for URLs)
      const idFromPath = params.id;
      console.log(`Fetching whop: ${idFromPath}`);
      const response = await fetch(`/api/whops/${idFromPath}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch whop details");
      }
      
      const data = await response.json();
      
      setValue("name", data.name);
      setValue("slug", data.slug);
      setValue("logo", data.logo || "");
      setValue("description", data.description);
      setValue("affiliateLink", data.affiliateLink || "");
      setValue("website", data.website || "");
      setValue("price", data.price || "");
      setValue("category", data.category || "");
      
      // Store the calculated rating for display
      setCalculatedRating(data.rating);
      
      // Count verified reviews
      if (data.Review && Array.isArray(data.Review)) {
        setReviewCount(data.Review.filter(review => review.verified).length);
      }
      
      // Set logo preview if one exists
      if (data.logo) {
        setLogoPreview(normalizeImagePath(data.logo));
      }
      
      // Set screenshots previews if they exist
      if (data.screenshots && Array.isArray(data.screenshots)) {
        setValue("screenshots", data.screenshots);
        
        const previews = [...screenshotPreviews];
        data.screenshots.forEach((url, index) => {
          if (index < 3) {
            previews[index] = normalizeImagePath(url);
          }
        });
        setScreenshotPreviews(previews);
      }
      
      // Set promo code data if it exists
      if (data.PromoCode && data.PromoCode.length > 0) {
        const firstPromo = data.PromoCode[0];
        setPromoCodeId(firstPromo.id);
        setValue("promoTitle", firstPromo.title);
        setValue("promoDescription", firstPromo.description);
        setValue("promoCode", firstPromo.code || "");
        setValue("promoType", firstPromo.type);
        setValue("promoValue", firstPromo.value);
      }
      
    } catch (error) {
      console.error("Failed to fetch whop:", error);
      setFormError("Failed to load whop details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoImageError(false); // Reset error state when new file is selected
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        setValue("logo", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoImageError = () => {
    setLogoImageError(true);
  };

  const handleScreenshotChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFiles = [...screenshotFiles];
      newFiles[index] = file;
      setScreenshotFiles(newFiles);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const newPreviews = [...screenshotPreviews];
        newPreviews[index] = result;
        setScreenshotPreviews(newPreviews);
        
        // Update form value
        const currentScreenshots = screenshotPreviews.filter(Boolean);
        currentScreenshots[index] = result;
        setValue("screenshots", currentScreenshots);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = (index: number) => {
    const newFiles = [...screenshotFiles];
    const newPreviews = [...screenshotPreviews];
    newFiles[index] = null;
    newPreviews[index] = null;
    setScreenshotFiles(newFiles);
    setScreenshotPreviews(newPreviews);
    
    // Update form value
    const updatedScreenshots = newPreviews.filter(Boolean);
    setValue("screenshots", updatedScreenshots);
  };

  const onSubmit = async (data: WhopForm) => {
    try {
      setFormError(null);
      
      const idFromPath = params.id;
      const method = params.id === "new" ? "POST" : "PUT";
      const url = params.id === "new" ? "/api/whops" : `/api/whops/${idFromPath}`;

      let currentDisplayOrder = 0;

      if (params.id !== "new") {
        const response = await fetch(`/api/whops/${idFromPath}`, {
          cache: "no-store"
        });
        if (response.ok) {
          const currentData = await response.json();
          currentDisplayOrder = currentData.displayOrder || 0;
        }
      }

      // Prepare whop data including promo code data
      const whopData = {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        description: data.description,
        affiliateLink: data.affiliateLink,
        website: data.website,
        price: data.price,
        category: data.category,
        screenshots: data.screenshots,
        displayOrder: currentDisplayOrder,
        // Add promo code data directly to the whop update request
        promoCodeId: promoCodeId,
        promoTitle: data.promoTitle,
        promoDescription: data.promoDescription,
        promoCode: data.promoCode,
        promoType: data.promoType,
        promoValue: data.promoValue
      };

      // Save the whop with promo code data included
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(whopData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save whop");
      }

      const savedWhop = await response.json();

      // Only create a separate promo code if we're creating a new whop, there's no promoCodeId, 
      // AND the user has filled in the required promo fields
      if (params.id === "new" && !promoCodeId && data.promoTitle && data.promoDescription && data.promoType && data.promoValue) {
        const promoData = {
          title: data.promoTitle,
          description: data.promoDescription,
          code: data.promoCode || null,
          type: data.promoType,
          value: data.promoValue,
          whopId: savedWhop.id
        };

        const promoResponse = await fetch("/api/promo-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${document.cookie.split('; ').find(row => row.startsWith('admin-token='))?.split('=')[1] || ''}`
          },
          credentials: "include",
          body: JSON.stringify(promoData),
        });

        if (!promoResponse.ok) {
          const errorData = await promoResponse.json();
          throw new Error(errorData.error || "Failed to save promo code");
        }
      }

      // On success, navigate back to the whops list
      router.push("/admin/whops");
    } catch (error) {
      console.error("Failed to save whop:", error);
      setFormError("Failed to save whop. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="admin-heading">
        {params.id === "new" ? "Add New Whop" : "Edit Whop"}
      </h2>

      <div className="admin-container">
        {formError && (
          <div className="bg-red-500 text-white p-3 rounded-md mb-4">
            {formError}
          </div>
        )}
        
        {params.id !== "new" && calculatedRating !== null && (
          <div className="bg-[#2A2B37] p-4 rounded-md mb-6">
            <h3 className="text-lg font-semibold mb-2">Rating Information</h3>
            <p className="text-[#a4a5b0]">
              Current rating: <span className="text-white font-semibold">
                {reviewCount > 0 ? `${calculatedRating.toFixed(1)}/5` : '0.0/5'}
              </span> 
              {reviewCount > 0 && (
                <span className="ml-2 text-sm">
                  (Based on {reviewCount} verified {reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              )}
            </p>
            <p className="text-xs text-[#a4a5b0] mt-2">
              Note: Rating is automatically calculated from verified reviews and cannot be manually edited.
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="border-b border-[#404055] pb-6">
            <h3 className="text-xl font-semibold mb-4">Whop Information</h3>
            
            <div className="form-group">
              <label htmlFor="name" className="form-label">Name</label>
              <input {...register("name")} type="text" id="name" />
              {errors.name && <p className="admin-error">{errors.name.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="slug" className="form-label">Slug</label>
              <input {...register("slug")} type="text" id="slug" />
              {errors.slug && <p className="admin-error">{errors.slug.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="logo" className="form-label">Logo Image</label>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    id="logoFile"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full"
                  />
                  <input {...register("logo")} type="hidden" id="logo" />
                  <p className="text-xs text-gray-400 mt-1">Upload a new logo image or keep the existing one.</p>
                </div>
                {logoPreview && (
                  <div className="flex-shrink-0">
                    <div className="relative w-24 h-24 rounded-md overflow-hidden bg-[#1E1E27] flex items-center justify-center">
                      {!logoImageError ? (
                        <Image 
                          src={logoPreview} 
                          alt="Logo preview" 
                          fill 
                          className="object-contain" 
                          onError={handleLogoImageError}
                        />
                      ) : (
                        <InitialsAvatar 
                          name={watchedName || "Whop"} 
                          size="lg" 
                          shape="square"
                          className="w-full h-full"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              {errors.logo && <p className="admin-error">{errors.logo.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="website" className="form-label">Whop Website</label>
              <input {...register("website")} type="url" id="website" placeholder="https://whop-name.com" />
              {errors.website && <p className="admin-error">{errors.website.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="affiliateLink" className="form-label">Affiliate Link</label>
              <input {...register("affiliateLink")} type="url" id="affiliateLink" placeholder="https://whpcodes.com/go/whop-name" />
              {errors.affiliateLink && <p className="admin-error">{errors.affiliateLink.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">Price</label>
              <input {...register("price")} type="text" id="price" placeholder="e.g. $29.99/month" />
              {errors.price && <p className="admin-error">{errors.price.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="category" className="form-label">Category</label>
              <input {...register("category")} type="text" id="category" placeholder="e.g. Trading, Education, Tools" />
              {errors.category && <p className="admin-error">{errors.category.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea {...register("description")} id="description" rows={6} />
              {errors.description && <p className="admin-error">{errors.description.message}</p>}
            </div>
          </div>

          <div className="border-b border-[#404055] pb-6">
            <h3 className="text-xl font-semibold mb-4">Screenshots</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2">
                  <label className="form-label">Screenshot {index + 1}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleScreenshotChange(index, e)}
                    className="w-full"
                  />
                  {screenshotPreviews[index] && (
                    <div className="relative">
                      <div className="relative w-full h-32 rounded-md overflow-hidden bg-[#1E1E27]">
                        <Image
                          src={screenshotPreviews[index]!}
                          alt={`Screenshot ${index + 1} preview`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-4">Promo Code (Optional)</h3>
            
            <div className="form-group">
              <label htmlFor="promoTitle" className="form-label">Promo Title (Optional)</label>
              <input {...register("promoTitle")} type="text" id="promoTitle" placeholder="e.g. Free Trial Week" />
              {errors.promoTitle && <p className="admin-error">{errors.promoTitle.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="promoValue" className="form-label">Promo Value (Optional)</label>
              <input {...register("promoValue")} type="text" id="promoValue" placeholder="e.g. 50% off first month" />
              {errors.promoValue && <p className="admin-error">{errors.promoValue.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="promoType" className="form-label">Promo Type (Optional)</label>
              <select {...register("promoType")} id="promoType" className="text-white bg-[#2c2f3a] border border-[#404055] rounded-md p-2 w-full">
                <option value="DISCOUNT">Discount</option>
                <option value="FREE_TRIAL">Free Trial</option>
                <option value="EXCLUSIVE_ACCESS">Exclusive Access</option>
                <option value="BUNDLE_DEAL">Bundle Deal</option>
                <option value="LIMITED_TIME">Limited Time</option>
              </select>
              {errors.promoType && <p className="admin-error">{errors.promoType.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="promoCode" className="form-label">Promo Code (Optional)</label>
              <input {...register("promoCode")} type="text" id="promoCode" placeholder="e.g. SAVE50" />
              <p className="text-xs text-gray-400 mt-1">Leave empty if no code is required</p>
              {errors.promoCode && <p className="admin-error">{errors.promoCode.message}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="promoDescription" className="form-label">Promo Description (Optional)</label>
              <textarea {...register("promoDescription")} id="promoDescription" rows={4} placeholder="Describe the promo details and any requirements" />
              {errors.promoDescription && <p className="admin-error">{errors.promoDescription.message}</p>}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => router.push("/admin/whops")}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
} 