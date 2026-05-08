import BiasGrid from '@/components/BiasGrid';
import RadarScore from '@/components/RadarScore';
import ActivePatternCard from '@/components/ActivePatternCard';
import RecentAlertsFeed from '@/components/RecentAlertsFeed';
import TodayPnlCard from '@/components/TodayPnlCard';

export default function DashboardPage() {
  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Trading Command Center</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Multi-symbol market bias overview and RADAR scoring.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><ActivePatternCard ticker="BTC" /></div>
        <TodayPnlCard />
      </div>

      <RecentAlertsFeed limit={10} />

      <BiasGrid />
      <RadarScore />
    </main>
  );
}
