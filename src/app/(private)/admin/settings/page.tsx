"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";

const settingsSchema = z.object({
  faviconUrl: z.string().optional(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setValue('faviconUrl', data.faviconUrl || '');

      // Set favicon preview if one exists
      if (data.faviconUrl) {
        setFaviconPreview(data.faviconUrl);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setFormError('Failed to load settings. Please try again.');
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // If there was a previous preview URL that was created with createObjectURL, revoke it
      if (faviconPreview && faviconPreview.startsWith('blob:')) {
        URL.revokeObjectURL(faviconPreview);
      }

      setFaviconFile(file);

      // Create and set preview URL
      const previewUrl = URL.createObjectURL(file);
      setFaviconPreview(previewUrl);
    }
  };

  const onSubmit = async (data: SettingsForm) => {
    try {
      setFormError(null);
      setSuccessMessage(null);
      
      // Handle image upload first if there's a new file
      if (faviconFile) {
        const formData = new FormData();
        formData.append('file', faviconFile);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload favicon image');
        }
        
        const uploadResult = await uploadResponse.json();
        data.faviconUrl = uploadResult.url; // Use the URL returned from upload
        
        // Update the preview with the new URL
        if (faviconPreview && faviconPreview.startsWith('blob:')) {
          URL.revokeObjectURL(faviconPreview);
        }
        setFaviconPreview(uploadResult.url);
      }

      // Save the settings
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setSuccessMessage('Settings saved successfully.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setFormError('Failed to save settings. Please try again.');
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
      <h2 className="admin-heading">Site Settings</h2>

      <div className="admin-container">
        {formError && (
          <div className="bg-red-500 text-white p-3 rounded-md mb-4">
            {formError}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-500 text-white p-3 rounded-md mb-4">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="border-b border-[#404055] pb-6">
            <h3 className="text-xl font-semibold mb-4">Appearance</h3>
            
            <div className="form-group">
              <label htmlFor="favicon" className="form-label">
                Favicon
              </label>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    id="faviconFile"
                    accept="image/*,.ico"
                    onChange={handleFileChange}
                    className="w-full"
                  />
                  <input
                    {...register("faviconUrl")}
                    type="hidden"
                    id="faviconUrl"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Upload a new favicon (recommended size: 32x32px or 64x64px).
                    Supported formats: .ico, .png, .svg
                  </p>
                </div>
                {faviconPreview && (
                  <div className="flex-shrink-0">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-white">
                      <Image
                        src={faviconPreview}
                        alt="Favicon preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
              {errors.faviconUrl && (
                <p className="admin-error">{errors.faviconUrl.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="admin-button"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 