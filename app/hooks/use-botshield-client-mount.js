import { useEffect, useState } from "react";

export function useBotShieldClientMount() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
