import { createContext, useContext } from "react";

export const BotShieldPolarisReadyContext = createContext({
  ready: false,
  error: "",
});

export function useBotShieldPolarisReady() {
  return useContext(BotShieldPolarisReadyContext);
}
