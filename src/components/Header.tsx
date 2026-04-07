import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-screen-xl mx-auto flex items-center gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Follio</h1>
          <span className="text-zinc-500 text-sm">Crypto Dashboard</span>
        </div>
        <nav className="flex items-center gap-4 ml-4">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/cycle"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Cycle
          </Link>
          <Link
            href="/calculator"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Calculator
          </Link>
        </nav>
      </div>
    </header>
  );
}
