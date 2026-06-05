import { useMemo, useState, type FC, type ReactNode } from "react";
import { GameLayoutContext, type MainMode } from "./gameLayoutContext";

export const GameLayoutProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [mainMode, setMainMode] = useState<MainMode>("mobile");
  const [rightRail, setRightRail] = useState<ReactNode | null>(null);
  const value = useMemo(
    () => ({
      mainMode,
      setMainMode,
      rightRail,
      setRightRail,
    }),
    [mainMode, rightRail],
  );
  return <GameLayoutContext.Provider value={value}>{children}</GameLayoutContext.Provider>;
};
