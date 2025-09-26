"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { normalizeImagePath } from "@/lib/image-utils";

const casinoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  logo: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "Description is required"),
  affiliateLink: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  wageringRequirement: z.string().optional().or(z.literal("")),
  minimumDeposit: z.string().optional().or(z.literal("")),
  screenshots: z.array(z.string()).optional(),
  // Bonus fields
  bonusTitle: z.string().min(1, "Bonus title is required"),
  bonusDescription: z.string().min(1, "Bonus description is required"),
  bonusCode: z.string().optional().or(z.literal("")),
  bonusType: z.enum(["WELCOME", "NO_DEPOSIT", "FREE_SPINS", "RELOAD", "CASHBACK"]),
  bonusValue: z.string().min(1, "Bonus value is required"),
});

type CasinoForm = z.infer<typeof casinoSchema>;

interface Casino {
  id: string;
  name: string;
  bonuses?: Bonus[];
}

interface Bonus {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

export default function EditCasinoPage({
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
  const [bonusId, setBonusId] = useState<string | null>(null);
  
  // Screenshot state
  const [screenshotFiles, setScreenshotFiles] = useState<(File | null)[]>([null, null, null]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<(string | null)[]>([null, null, null]);
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CasinoForm>({
    resolver: zodResolver(casinoSchema),
    defaultValues: {
      bonusType: "WELCOME",
      screenshots: [],
    }
  });

  useEffect(() => {
    if (params.id !== "new") {
      fetchCasino();
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchCasino = async () => {
    try {
      const response = await fetch(`/api/casinos/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch casino details");
      }
      
      const data = await response.json();
      
      setValue("name", data.name);
      setValue("slug", data.slug);
      setValue("logo", data.logo || "");
      setValue("description", data.description);
      setValue("affiliateLink", data.affiliateLink || "");
      setValue("website", data.website || "");
      setValue("wageringRequirement", data.wageringRequirement || "");
      setValue("minimumDeposit", data.minimumDeposit || "");
      
      // Store the calculated rating for display
      setCalculatedRating(data.rating);
      
      // Count verified reviews
      if (data.reviews && Array.isArray(data.reviews)) {
        setReviewCount(data.reviews.filter(review => review.verified).length);
      }
      
      // Set logo preview if one exists
      if (data.logo) {
        // Use the normalized path for the logo preview
        setLogoPreview(normalizeImagePath(data.logo));
      }
      
      // Set screenshots previews if they exist
      if (data.screenshots && Array.isArray(data.screenshots)) {
        setValue("screenshots", data.screenshots);
        
        // Create preview array from existing screenshots
        const previews = [...screenshotPreviews];
        data.screenshots.forEach((url, index) => {
          if (index < 3) {
            // Use the normalized path for screenshot previews
            previews[index] = normalizeImagePath(url);
          }
        });
        setScreenshotPreviews(previews);
      }
      
      // Load the first bonus if it exists
      if (data.bonuses && data.bonuses.length > 0) {
        const bonus = data.bonuses[0];
        setBonusId(bonus.id);
        setValue("bonusTitle", bonus.title);
        setValue("bonusDescription", bonus.description);
        setValue("bonusCode", bonus.code || "");
        setValue("bonusType", bonus.type as any);
        setValue("bonusValue", bonus.value);
      }
      
    } catch (error) {
      console.error("Failed to fetch casino:", error);
      setFormError("Failed to load casino details");
    } finally {
      setLoading(false);
    }
  };

  // Handle logo file change
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files[0]) {
        setLogoPreview(URL.createObjectURL(e.target.files[0]));
        setLogoFile(e.target.files[0]);
        
        // Don't auto-upload yet - wait for form submission
        console.log("Logo file selected and preview generated");
      }
    } catch (error) {
      console.error("Error handling logo change:", error);
      alert("Error selecting logo file. Please try again.");
    }
  };

  // Upload logo file and get the URL
  const uploadLogo = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      console.log("Uploading logo file...");
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload logo file");
      }
      
      const data = await response.json();
      
      // Check if the response has the expected structure
      if (!data || !data.url) {
        console.error("Unexpected response format:", data);
        throw new Error("Invalid response from upload API");
      }
      
      console.log("Logo uploaded successfully:", data.url);
      
      // Make sure we have a proper image path format
      const logoPath = data.url.startsWith('/') ? data.url : `/${data.url}`;
      return logoPath;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw new Error("Failed to upload logo. Please try again.");
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      // If there was a previous preview URL that was created with createObjectURL, revoke it
      if (screenshotPreviews[index] && screenshotPreviews[index]?.startsWith('blob:')) {
        URL.revokeObjectURL(screenshotPreviews[index]!);
      }
      
      // Update the file at the specific index
      const newFiles = [...screenshotFiles];
      newFiles[index] = file;
      setScreenshotFiles(newFiles);
      
      // Create and set preview URL
      const previewUrl = URL.createObjectURL(file);
      const newPreviews = [...screenshotPreviews];
      newPreviews[index] = previewUrl;
      setScreenshotPreviews(newPreviews);
    }
  };

  const removeScreenshot = (index: number) => {
    // Remove the preview if it exists
    if (screenshotPreviews[index] && screenshotPreviews[index]?.startsWith('blob:')) {
      URL.revokeObjectURL(screenshotPreviews[index]!);
    }
    
    // Update the arrays
    const newFiles = [...screenshotFiles];
    newFiles[index] = null;
    setScreenshotFiles(newFiles);
    
    const newPreviews = [...screenshotPreviews];
    newPreviews[index] = null;
    setScreenshotPreviews(newPreviews);
  };

  const onSubmit = async (data: CasinoForm) => {
    try {
      setFormError(null);
      
      // Handle image upload first if there's a new file
      if (logoFile) {
        const logoUrl = await uploadLogo(logoFile);
        data.logo = logoUrl;
        
        // Update the preview with the new URL
        if (logoPreview && logoPreview.startsWith('blob:')) {
          URL.revokeObjectURL(logoPreview);
        }
        setLogoPreview(logoUrl);
      }
      
      // Handle screenshot uploads
      const screenshotUrls: string[] = [];
      
      // First, keep any existing screenshots that weren't changed
      for (let i = 0; i < screenshotPreviews.length; i++) {
        if (screenshotPreviews[i] && !screenshotFiles[i]) {
          // This is an existing screenshot that wasn't changed
          screenshotUrls.push(screenshotPreviews[i]!);
        }
      }
      
      // Then upload any new screenshots
      for (const file of screenshotFiles.filter(f => f !== null) as File[]) {
        const previewUrl = URL.createObjectURL(file);
        screenshotUrls.push(previewUrl);
      }
      
      // Update the form data with the screenshot URLs
      data.screenshots = screenshotUrls;
      
      const method = params.id === "new" ? "POST" : "PUT";
      const url = params.id === "new" ? "/api/casinos" : `/api/casinos/${params.id}`;

      // Get the current casino data if editing
      let currentDisplayOrder = 0;
      if (params.id !== "new") {
        const response = await fetch(`/api/casinos/${params.id}`);
        if (response.ok) {
          const currentData = await response.json();
          currentDisplayOrder = currentData.displayOrder || 0;
        }
      }

      // Prepare casino data including bonus data
      const casinoData = {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        description: data.description,
        affiliateLink: data.affiliateLink,
        website: data.website,
        wageringRequirement: data.wageringRequirement,
        minimumDeposit: data.minimumDeposit,
        screenshots: data.screenshots,
        displayOrder: currentDisplayOrder,
        // Add bonus data directly to the casino update request
        bonusId: bonusId,
        bonusTitle: data.bonusTitle,
        bonusDescription: data.bonusDescription,
        bonusCode: data.bonusCode,
        bonusType: data.bonusType,
        bonusValue: data.bonusValue
      };

      // Save the casino with bonus data included
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include credentials for auth
        body: JSON.stringify(casinoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save casino");
      }

      const savedCasino = await response.json();

      // Only create a separate bonus if we're creating a new casino and there's no bonusId
      if (params.id === "new" && !bonusId) {
        // Create new bonus
        const bonusData = {
          title: data.bonusTitle,
          description: data.bonusDescription,
          code: data.bonusCode || null,
          type: data.bonusType,
          value: data.bonusValue,
          casinoId: savedCasino.id
        };

        const bonusResponse = await fetch("/api/bonuses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add authorization header with admin token from cookies if available
            "Authorization": `Bearer ${document.cookie.split('; ').find(row => row.startsWith('admin-token='))?.split('=')[1] || ''}`
          },
          credentials: "include", // Include cookies for auth
          body: JSON.stringify(bonusData),
        });

        if (!bonusResponse.ok) {
          const errorData = await bonusResponse.json();
          throw new Error(errorData.error || "Failed to save bonus");
        }
      }

      // On success, navigate back to the casinos list
      router.push("/admin/casinos");
    } catch (error) {
      console.error("Failed to save casino:", error);
      setFormError("Failed to save casino. Please try again.");
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
        {params.id === "new" ? "Add New Casino" : "Edit Casino"}
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
            <h3 className="text-xl font-semibold mb-4">Casino Information</h3>
            
            <div className="form-group">
              <label
                htmlFor="name"
                className="form-label"
              >
                Name
              </label>
              <input
                {...register("name")}
                type="text"
                id="name"
              />
              {errors.name && (
                <p className="admin-error">{errors.name.message}</p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="slug"
                className="form-label"
              >
                Slug
              </label>
              <input
                {...register("slug")}
                type="text"
                id="slug"
              />
              {errors.slug && (
                <p className="admin-error">{errors.slug.message}</p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="logo"
                className="form-label"
              >
                Logo Image
              </label>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    id="logoFile"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full"
                  />
                  <input
                    {...register("logo")}
                    type="hidden"
                    id="logo"
                  />
                  <p className="text-xs text-gray-400 mt-1">Upload a new logo image or keep the existing one.</p>
                </div>
                {logoPreview && (
                  <div className="flex-shrink-0">
                    <div className="relative w-24 h-24 rounded-md overflow-hidden bg-[#1E1E27]">
                      <Image
                        src={logoPreview}
                        alt="Logo preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
              {errors.logo && (
                <p className="admin-error">{errors.logo.message}</p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="website"
                className="form-label"
              >
                Casino Website
              </label>
              <input
                {...register("website")}
                type="url"
                id="website"
                placeholder="https://casino-name.com"
              />
              {errors.website && (
                <p className="admin-error">{errors.website.message}</p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="affiliateLink"
                className="form-label"
              >
                Affiliate Link
              </label>
              <input
                {...register("affiliateLink")}
                type="url"
                id="affiliateLink"
                placeholder="https://whpcodes.com/go/whop-name"
              />
              {errors.affiliateLink && (
                <p className="admin-error">{errors.affiliateLink.message}</p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="description"
                className="form-label"
              >
                Description
              </label>
              <textarea
                {...register("description")}
                id="description"
                rows={6}
              />
              {errors.description && (
                <p className="admin-error">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          <div className="border-b border-[#404055] pb-6">
            <h3 className="text-xl font-semibold mb-4">Screenshots (Up to 3)</h3>
            <p className="text-sm text-gray-400 mb-4">Upload screenshots of the casino to show users what the platform looks like.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="form-group">
                  <label className="form-label">
                    Screenshot {index + 1}
                  </label>
                  <div className="flex flex-col items-start gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleScreenshotChange(e, index)}
                      className="w-full"
                    />
                    {screenshotPreviews[index] ? (
                      <div className="w-full">
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
                          className="mt-2 text-sm text-red-400 hover:text-red-300"
                        >
                          Remove Screenshot
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No screenshot selected</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-b border-[#404055] pb-6">
            <h3 className="text-xl font-semibold mb-4">SEO Information</h3>
            
            <div className="form-group">
              <label
                htmlFor="wageringRequirement"
                className="form-label"
              >
                Wagering Requirement
              </label>
              <input
                {...register("wageringRequirement")}
                type="text"
                id="wageringRequirement"
                placeholder="e.g. 35x"
              />
              {errors.wageringRequirement && (
                <p className="admin-error">{errors.wageringRequirement.message}</p>
              )}
            </div>
            
            <div className="form-group">
              <label
                htmlFor="minimumDeposit"
                className="form-label"
              >
                Minimum Deposit
              </label>
              <input
                {...register("minimumDeposit")}
                type="text"
                id="minimumDeposit"
                placeholder="e.g. $20 or 0.001 BTC"
              />
              {errors.minimumDeposit && (
                <p className="admin-error">{errors.minimumDeposit.message}</p>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-4">Whop Promo</h3>
            
            <div className="form-group">
              <label
                htmlFor="bonusTitle"
                className="form-label"
              >
                Promo Title
              </label>
              <input
                {...register("bonusTitle")}
                type="text"
                id="bonusTitle"
                placeholder="e.g. Welcome Promo"
              />
              {errors.bonusTitle && (
                <p className="admin-error">{errors.bonusTitle.message}</p>
              )}
            </div>
            
            <div className="form-group">
              <label
                htmlFor="bonusValue"
                className="form-label"
              >
                Promo Value
              </label>
              <input
                {...register("bonusValue")}
                type="text"
                id="bonusValue"
                placeholder="e.g. 100% up to 1 BTC"
              />
              {errors.bonusValue && (
                <p className="admin-error">{errors.bonusValue.message}</p>
              )}
            </div>
            
            <div className="form-group">
              <label
                htmlFor="bonusType"
                className="form-label"
              >
                Promo Type
              </label>
              <select
                {...register("bonusType")}
                id="bonusType"
                className="text-white bg-[#2c2f3a] border border-[#404055] rounded-md p-2 w-full"
              >
                <option value="WELCOME">Welcome</option>
                <option value="NO_DEPOSIT">No Deposit</option>
                <option value="FREE_SPINS">Free Spins</option>
                <option value="RELOAD">Reload</option>
                <option value="CASHBACK">Cashback</option>
              </select>
              {errors.bonusType && (
                <p className="admin-error">{errors.bonusType.message}</p>
              )}
            </div>
            
            <div className="form-group">
              <label
                htmlFor="bonusCode"
                className="form-label"
              >
                Promo Code (Optional)
              </label>
              <input
                {...register("bonusCode")}
                type="text"
                id="bonusCode"
                placeholder="e.g. CRYPTO100"
              />
              {errors.bonusCode && (
                <p className="admin-error">{errors.bonusCode.message}</p>
              )}
            </div>
            
            <div className="form-group">
              <label
                htmlFor="bonusDescription"
                className="form-label"
              >
                Promo Description
              </label>
              <textarea
                {...register("bonusDescription")}
                id="bonusDescription"
                rows={4}
                placeholder="Describe the promo details and any requirements"
              />
              {errors.bonusDescription && (
                <p className="admin-error">
                  {errors.bonusDescription.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => router.push("/admin/casinos")}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 