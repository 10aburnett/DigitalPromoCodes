"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["USER", "ADMIN"]),
});

type UserForm = z.infer<typeof userSchema>;

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export default function EditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (params.id !== "new") {
      fetchUser();
    } else {
      setValue("role", "USER");
      setLoading(false);
    }
  }, [params.id]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      const data = await response.json();
      setUser(data);
      setValue("email", data.email);
      setValue("name", data.name || "");
      setValue("role", data.role);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: UserForm) => {
    setSaving(true);
    try {
      const method = params.id === "new" ? "POST" : "PUT";
      const url = params.id === "new" ? "/api/users" : `/api/users/${params.id}`;

      // Don't send empty password
      const submitData = { ...data };
      if (!submitData.password) {
        delete submitData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        toast.success(params.id === "new" ? "User created successfully" : "User updated successfully");
        router.push("/admin/users");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save user");
      }
    } catch (error) {
      console.error("Failed to save user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {params.id === "new" ? "Add New User" : "Edit User"}
          </h2>
          {user && (
            <p className="text-[#a7a9b4] mt-1">
              {user.role === "ADMIN" ? "Admin User" : "Regular User"} • Created {new Date(user.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/admin/users")}
          className="text-[#a7a9b4] hover:text-white transition-colors duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#292932] shadow-xl rounded-xl border border-[#404055] overflow-hidden">
        <div className="px-8 py-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address *
              </label>
              <input
                {...register("email")}
                type="email"
                id="email"
                className="w-full px-4 py-3 bg-[#3c3f4a] border border-[#404055] rounded-lg text-white placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200"
                placeholder="user@example.com"
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Full Name
              </label>
              <input
                {...register("name")}
                type="text"
                id="name"
                className="w-full px-4 py-3 bg-[#3c3f4a] border border-[#404055] rounded-lg text-white placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200"
                placeholder="Enter full name (optional)"
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password {params.id !== "new" && <span className="text-[#a7a9b4]">(Leave blank to keep current)</span>}
              </label>
              <input
                {...register("password")}
                type="password"
                id="password"
                className="w-full px-4 py-3 bg-[#3c3f4a] border border-[#404055] rounded-lg text-white placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200"
                placeholder={params.id === "new" ? "Enter password" : "Enter new password"}
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-white mb-2">
                User Role *
              </label>
              <select
                {...register("role")}
                id="role"
                className="w-full px-4 py-3 bg-[#3c3f4a] border border-[#404055] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200"
              >
                <option value="USER">Regular User</option>
                <option value="ADMIN">Administrator</option>
              </select>
              {errors.role && (
                <p className="mt-2 text-sm text-red-400">{errors.role.message}</p>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-[#404055]">
              <button
                type="button"
                onClick={() => router.push("/admin/users")}
                className="px-6 py-3 border border-[#404055] rounded-lg text-[#a7a9b4] hover:text-white hover:border-[#68D08B] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-[#68D08B] text-white rounded-lg hover:bg-[#5abc7a] focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:ring-offset-2 focus:ring-offset-[#292932] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {params.id === "new" ? "Create User" : "Update User"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 