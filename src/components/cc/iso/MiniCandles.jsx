const CANDLES = [
  { o: 10, c: 12, h: 13, l: 9 },
  { o: 12, c: 11, h: 13, l: 10 },
  { o: 11, c: 14, h: 15, l: 10 },
  { o: 14, c: 13, h: 15, l: 12 },
  { o: 13, c: 16, h: 17, l: 12 },
  { o: 16, c: 15, h: 17, l: 14 },
  { o: 15, c: 18, h: 19, l: 14 },
  { o: 18, c: 17, h: 19, l: 16 }
];

export default function MiniCandles({ width = 120, height = 26 }) {
  const min = 8;
  const max = 20;
  const scale = (value) => height - ((value - min) / (max - min)) * height;
  const step = width / CANDLES.length;

  return (
    <svg width={width} height={height} role="img" aria-label="กราฟแท่งตัวอย่างตกแต่ง ไม่ใช่ราคาตลาดสด">
      {CANDLES.map((candle, index) => {
        const x = index * step + step / 2;
        const up = candle.c >= candle.o;
        const color = up ? '#34d399' : '#f87171';
        const bodyTop = scale(Math.max(candle.o, candle.c));
        const bodyHeight = Math.max(2, Math.abs(scale(candle.o) - scale(candle.c)));

        return (
          <g key={index}>
            <line x1={x} x2={x} y1={scale(candle.h)} y2={scale(candle.l)} stroke={color} strokeWidth="1" />
            <rect
              x={x - 2.5}
              y={bodyTop}
              width="5"
              height={bodyHeight}
              fill={color}
              className={index === CANDLES.length - 1 ? 'animate-pulse-fast' : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}