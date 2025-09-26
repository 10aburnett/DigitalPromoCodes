"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const bonusSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  code: z.string().optional(),
  type: z.enum(["WELCOME", "NO_DEPOSIT", "FREE_SPINS", "RELOAD", "CASHBACK"]),
  value: z.string().min(1, "Value is required"),
  casinoId: z.string().min(1, "Casino is required"),
});

type BonusForm = z.infer<typeof bonusSchema>;

interface Casino {
  id: string;
  name: string;
}

export default function EditBonusPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BonusForm>({
    resolver: zodResolver(bonusSchema),
  });

  useEffect(() => {
    fetchCasinos();
    if (params.id !== "new") {
      fetchBonus();
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchCasinos = async () => {
    try {
      const response = await fetch("/api/casinos");
      const data = await response.json();
      setCasinos(data);
    } catch (error) {
      console.error("Failed to fetch casinos:", error);
    }
  };

  const fetchBonus = async () => {
    try {
      const response = await fetch(`/api/bonuses/${params.id}`);
      const data = await response.json();
      setValue("title", data.title);
      setValue("description", data.description);
      setValue("code", data.code || "");
      setValue("type", data.type);
      setValue("value", data.value);
      setValue("casinoId", data.casinoId);
    } catch (error) {
      console.error("Failed to fetch bonus:", error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BonusForm) => {
    try {
      const method = params.id === "new" ? "POST" : "PUT";
      const url = params.id === "new" ? "/api/bonuses" : `/api/bonuses/${params.id}`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push("/admin/bonuses");
      }
    } catch (error) {
      console.error("Failed to save bonus:", error);
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">
          {params.id === "new" ? "Add New Bonus" : "Edit Bonus"}
        </h2>
        <button
          onClick={() => router.push("/admin/bonuses")}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="bg-[#292932] shadow-md rounded-lg overflow-hidden border border-[#404055] p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="title"
                className="block text-[#a7a9b4] text-sm font-medium mb-2"
              >
                Title
              </label>
              <input
                {...register("title")}
                type="text"
                id="title"
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="code"
                className="block text-[#a7a9b4] text-sm font-medium mb-2"
              >
                Bonus Code (Optional)
              </label>
              <input
                {...register("code")}
                type="text"
                id="code"
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
              {errors.code && (
                <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="type"
                className="block text-[#a7a9b4] text-sm font-medium mb-2"
              >
                Type
              </label>
              <select
                {...register("type")}
                id="type"
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B] appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='white' viewBox='0 0 16 16'%3E%3Cpath d='M2 5l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", paddingRight: "2.5rem" }}
              >
                <option value="WELCOME">Welcome Bonus</option>
                <option value="NO_DEPOSIT">No Deposit Bonus</option>
                <option value="FREE_SPINS">Free Spins</option>
                <option value="RELOAD">Reload Bonus</option>
                <option value="CASHBACK">Cashback</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-500">{errors.type.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="value"
                className="block text-[#a7a9b4] text-sm font-medium mb-2"
              >
                Value
              </label>
              <input
                {...register("value")}
                type="text"
                id="value"
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
              {errors.value && (
                <p className="mt-1 text-sm text-red-500">{errors.value.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="casinoId"
                className="block text-[#a7a9b4] text-sm font-medium mb-2"
              >
                Casino
              </label>
              <select
                {...register("casinoId")}
                id="casinoId"
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B] appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='white' viewBox='0 0 16 16'%3E%3Cpath d='M2 5l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", paddingRight: "2.5rem" }}
              >
                <option value="">Select a casino</option>
                {casinos.map((casino) => (
                  <option key={casino.id} value={casino.id}>
                    {casino.name}
                  </option>
                ))}
              </select>
              {errors.casinoId && (
                <p className="mt-1 text-sm text-red-500">{errors.casinoId.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="description"
                className="block text-[#a7a9b4] text-sm font-medium mb-2"
              >
                Description
              </label>
              <textarea
                {...register("description")}
                id="description"
                rows={4}
                className="w-full bg-[#1E1E27] border border-[#404055] rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-[#68D08B] text-white rounded-md hover:bg-[#5abc7a] transition-colors"
            >
              Save Bonus
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 