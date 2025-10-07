// src/components/StatisticsSectionServer.tsx
import Link from 'next/link';
import Image from 'next/image';
import type { StatisticsData } from '@/data/statistics';

interface StatisticsServerProps {
  stats: StatisticsData;
}

export default function StatisticsSectionServer({ stats }: StatisticsServerProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const StatCard = ({
    title,
    value,
    suffix = '',
    link = null,
    icon,
    showLogo = false,
    logoUrl
  }: {
    title: string;
    value: number | string;
    suffix?: string;
    link?: string | null;
    icon: string | React.ReactElement;
    showLogo?: boolean;
    logoUrl?: string;
  }) => {
    const displayValue = typeof value === 'number' ? formatNumber(value) : value;

    const content = (
      <div className="w-full h-[164px] md:h-auto rounded-2xl border p-4 md:p-6 flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg" style={{
        backgroundColor: 'var(--background-color)',
        borderColor: 'var(--border-color)',
      }}>
        {showLogo && logoUrl ? (
          <div className="w-8 h-8 mx-auto mb-1 rounded-md overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <Image
              src={logoUrl}
              alt={`${value} logo`}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="mb-1 shrink-0 text-2xl" style={{ color: 'var(--accent-color)' }}>
            {typeof icon === 'string' ? icon : icon}
          </div>
        )}
        <div className="text-2xl font-semibold leading-tight" style={{ color: 'var(--text-color)' }}>
          {displayValue}{suffix}
        </div>
        <div className="mt-0.5 text-sm leading-snug line-clamp-2 mb-2 md:mb-6" style={{ color: 'var(--text-secondary)' }}>{title}</div>
      </div>
    );

    if (link) {
      return (
        <Link href={link} className="block">
          {content}
        </Link>
      );
    }

    return content;
  };

  return (
    <section
      id="platform-stats"
      className="
        stats-section
        -mt-8 md:mt-0
        pt-5 md:pt-16
        pb-10 md:pb-16 mb-2 md:mb-12
        border-t-0 md:border-t md:border-white/10
      "
      style={{ backgroundColor: 'var(--background-secondary)' }}
    >
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>Platform Statistics</h2>
          <p className="max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Real-time data from our growing community
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:gap-6">
          <StatCard
            title="Active Users"
            value={stats?.totalUsers || 0}
            icon="👥"
          />
          <StatCard
            title="Available Offers"
            value={stats?.totalOffersAvailable || 0}
            icon="🎯"
          />
          <StatCard
            title="Promo Codes Claimed"
            value={stats?.promoCodesClaimed || 0}
            icon="🎉"
          />
          <StatCard
            title="Most Popular"
            value={stats?.mostClaimedOffer?.name || 'N/A'}
            icon="⭐"
            link={stats?.mostClaimedOffer?.slug ? `/whop/${stats.mostClaimedOffer.slug.toLowerCase()}` : undefined}
            logoUrl={stats?.mostClaimedOffer?.logoUrl}
            showLogo={true}
          />
        </div>
      </div>
    </section>
  );
}
