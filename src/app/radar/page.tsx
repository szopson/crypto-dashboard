import RadarScore from '@/components/RadarScore';

export default function RadarPage() {
  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">RADAR Score</h1>
        <p className="text-zinc-500 text-sm mt-1">
          6-dimension market analysis: trend, momentum, volume, structure, bias, and conviction score.
        </p>
      </div>
      <RadarScore />
    </main>
  );
}
