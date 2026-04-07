import BiasGrid from '@/components/BiasGrid';
import RadarScore from '@/components/RadarScore';

export default function DashboardPage() {
  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Trading Command Center</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Multi-symbol market bias overview and RADAR scoring.
        </p>
      </div>
      <BiasGrid />
      <RadarScore />
    </main>
  );
}
