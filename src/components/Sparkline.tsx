interface SparklineProps {
  prices: number[];
}

export default function Sparkline({ prices }: SparklineProps) {
  if (!prices || prices.length < 2) {
    return <svg width={80} height={32} />;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const width = 80;
  const height = 32;
  const padding = 2;

  const points = prices
    .map((price, i) => {
      const x = padding + (i / (prices.length - 1)) * (width - padding * 2);
      const y =
        padding +
        (1 - (price - min) / range) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const isPositive = prices[prices.length - 1] >= prices[0];
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
