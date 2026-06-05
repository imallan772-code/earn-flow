import { useMemo, useState, type FC, type ReactNode } from "react";
import { GameLayoutContext } from "./gameLayoutContext";

export const GameLayoutProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [rightRail, setRightRail] = useState<ReactNode | null>(null);
  const value = useMemo(
    () => ({
      rightRail,
      setRightRail,
    }),
    [rightRail],
  );
  return <GameLayoutContext.Provider value={value}>{children}</GameLayoutContext.Provider>;
};
