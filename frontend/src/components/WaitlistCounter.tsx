"use client";

import { useEffect, useState } from "react";

export function WaitlistCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist/count")
      .then((res) => res.json())
      .then((data) => setCount(data.count))
      .catch(() => setCount(null));
  }, []);

  if (count === null || count < 3) return null;

  return (
    <p className="text-sm text-zinc-500">
      Join{" "}
      <span className="text-zinc-300 font-medium">{count} traders</span>{" "}
      waiting for launch
    </p>
  );
}
