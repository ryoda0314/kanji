import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { t } from "../copy";
import { receiveCarry } from "../util/carry";
import app from "../app.module.css";

/**
 * 引き継ぎのリンク（util/carry）で開いた：リンクの語をここに足して、何語入ったかを見せる。
 * 開き直しで読み直さないよう、足しはじめたらアドレスから語を外す。
 */
export default function Carry() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  // 開いたときの中身（アドレスから外したあとも、これで足す）。
  const [params] = useState(() => (search.get("d") ? new URLSearchParams(search) : null));
  const started = useRef(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null | undefined>(undefined);

  useEffect(() => {
    if (!params || started.current) return;
    started.current = true;
    void receiveCarry(params).then(setResult);
    navigate("/carry", { replace: true });
  }, [params, navigate]);

  if (!params) return <Navigate to="/" replace />;

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.carry.title}</h1>
      </header>
      <div className={app.bodyTight}>
        <p className={result === null ? app.error : app.lead} role="status">
          {result === undefined ? t.carry.reading : result === null ? t.carry.failed : t.carry.received(result.added, result.skipped)}
        </p>
        <div>
          <Link to="/" className="btn">
            {t.carry.toCollect}
          </Link>
        </div>
      </div>
    </>
  );
}
