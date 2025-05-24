import React from "react";

// Kenar çubuğu bileşeni - analiz işlemlerini kontrol eder
function Sidebar({
  handlePgnUpload,          // PGN dosyası yükleme işlevi
  handleLoadLastAnalysis,   // Son analizi yükleme
  handleLoadSavedAnalyses,  // Kayıtlı analizleri görüntüleme
  handleDownloadAnalysis,   // Analizi indirme
  moveAnalysis,             // Hamle analiz listesi
  startLiveAnalysis,        // Canlı analiz başlatma
  isLiveMode,               // Canlı modda mı kontrolü
  stopLiveAnalysis,         // Canlı analizi durdurma
}) {
  return (
    <div className="sidebar d-flex flex-column">
      {/* Logo */}
      <img src="/logo.png" alt="logo" style={{ width: "110px", marginBottom: "10px" }} />

      {/* Ayırıcı çizgi */}
      <hr style={{ borderColor: "#333", width: "80%", margin: "15px auto" }} />
      <h4 className="text-light mb-4">Chess Lab</h4>

      {/* PGN dosyası yükleme alanı */}
      <div className="fen-pgn-box mb-3">
        <div className="d-grid mt-1">
          <label htmlFor="pgn-upload" className="upload-btn">Upload PGN File</label>
          <input
            id="pgn-upload"
            type="file"
            accept=".pgn"
            onChange={handlePgnUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* Ayırıcı çizgi */}
      <hr style={{ borderColor: "#333", width: "80%", margin: "15px auto" }} />

      {/* Fonksiyonel butonlar grubu */}
      <div className="d-grid gap-2 mt-2">
        {/* Canlı analiz kontrolü */}
        {isLiveMode ? (
          <button className="btn" onClick={stopLiveAnalysis} title="Stop Live Analysis">
            {/* Durdur simgesi */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
        ) : (
          <button className="btn" onClick={startLiveAnalysis} title="Start Live Analysis">
            {/* Başlat simgesi */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        )}

        {/* Son analiz yükleme */}
        <button className="btn" onClick={handleLoadLastAnalysis} title="Load Last Analysis">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v6h6" />
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            <polyline points="12 7 12 12 16 14" />
          </svg>
        </button>

        {/* Kayıtlı analizleri görüntüleme */}
        <button className="btn" onClick={handleLoadSavedAnalyses} title="View Saved Analyses">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Analiz sonucu varsa indirme butonu */}
        {moveAnalysis.length > 0 && (
          <button className="btn" onClick={handleDownloadAnalysis} title="Download Analysis">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
