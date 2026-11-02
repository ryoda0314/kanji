import { createHashRouter, Navigate, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import Collect from "./pages/Collect";
import Find from "./pages/Find";
import Words from "./pages/Words";
import Hanja from "./pages/Hanja";
import HanjaDetail from "./pages/HanjaDetail";
import Me from "./pages/Me";
import Carry from "./pages/Carry";

/** 前の版の図鑑のアドレス（#/dex/學）は字のページへ。 */
function OldDexChar() {
  const { char = "" } = useParams();
  return <Navigate to={`/hanja/${encodeURIComponent(char)}`} replace />;
}

// Capacitor の WebView は file:// で動くため、ハッシュのルーターを使う。
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Collect /> },
      { path: "/find", element: <Find /> },
      { path: "/words", element: <Words /> },
      { path: "/hanja", element: <Hanja /> },
      { path: "/hanja/:char", element: <HanjaDetail /> },
      { path: "/me", element: <Me /> },
      { path: "/carry", element: <Carry /> },
      // 前の版のアドレス
      { path: "/add", element: <Navigate to="/" replace /> },
      { path: "/dex", element: <Navigate to="/hanja" replace /> },
      { path: "/dex/:char", element: <OldDexChar /> },
      { path: "/combine", element: <Navigate to="/find" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
