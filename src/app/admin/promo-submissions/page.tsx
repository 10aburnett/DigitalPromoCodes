import { Suspense } from 'react'
import PromoSubmissionsManager from '@/components/admin/PromoSubmissionsManager'

export const dynamic = 'force-dynamic';

export default function PromoSubmissionsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Promo Code Submissions
          </h1>
          <p className="text-gray-300">
            Review and manage community-submitted promo codes. Approve submissions to add them to the respective whop pages.
          </p>
        </div>

        <Suspense fallback={
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        }>
          <PromoSubmissionsManager />
        </Suspense>
      </div>
    </div>
  )
}