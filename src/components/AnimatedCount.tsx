import { useEffect, useRef, useState } from 'react';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const AnimatedCount = ({ value }: { value: number }) => {
  const chars = String(value).split('');
  const prevLengthRef = useRef(chars.length);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Skip animation on first render
    setAnimate(true);
  }, []);

  // When digit count changes, we still animate smoothly
  useEffect(() => {
    prevLengthRef.current = chars.length;
  }, [chars.length]);

  return (
    <span className="rolling-count">
      {chars.map((char, i) => (
        <span key={i} className="rolling-digit">
          <span
            className="rolling-digit-strip"
            style={{
              transform: `translateY(${-Number(char) * 10}%)`,
              transition: animate ? undefined : 'none',
            }}
          >
            {DIGITS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
};

export default AnimatedCount;
