import MarketChat from '@/components/MarketChat';

export default function AssistantPage() {
  return (
    <main className="max-w-screen-lg mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Market Assistant</h1>
        <p className="text-zinc-500 text-sm mt-1">
          AI-powered market analysis with real-time RADAR context. Paste a chart for vision analysis.
        </p>
      </div>
      <MarketChat />
    </main>
  );
}
