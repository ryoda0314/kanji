// ルーター（App.tsx）が URL を読む前に、ことのあめ から戻ってきたログインの印を受け取る。
import "./boot.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App.tsx";
import DataGate from "./components/DataGate.tsx";
import { PrefsProvider } from "./prefs.tsx";
import { carryParams } from "./util/carry.ts";
import { adoptCarriedUsage, countUsage } from "./util/usage.ts";
import "./index.css";

// 引き継ぎのリンクで開いたら、開いたと数える前に、前のところの番号を引き継ぐ（語は pages/Carry で足す）。
const carried = carryParams(location.hash);
if (carried) adoptCarriedUsage(carried, false);
// 開いた（何人が使っているかを数える。util/usage.ts）。
countUsage("open");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrefsProvider>
      <DataGate>
        <RouterProvider router={router} />
      </DataGate>
    </PrefsProvider>
  </StrictMode>
);
