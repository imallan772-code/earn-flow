import { useEffect, useState } from "react";
import { CountUp } from "./CountUp";

interface Props {
  base: number;
  driftPerSec?: number;
  className?: string;
}

/** 접속자 카운터 — base에서 초당 미세 증가 mock */
export function RollingCountUp({ base, driftPerSec = 12, className }: Props) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    setValue(base);
    const id = setInterval(() => {
      setValue((v) => v + Math.floor(driftPerSec * (0.6 + Math.random() * 0.9)));
    }, 1000);
    return () => clearInterval(id);
  }, [base, driftPerSec]);
  return <CountUp value={value} duration={900} className={className} />;
}
