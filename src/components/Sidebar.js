import React from "react";

function Sidebar({
  handlePgnUpload,
  handleLoadLastAnalysis,
  handleLoadSavedAnalyses,
  handleDownloadAnalysis,
  moveAnalysis,
}) {
  return (
    <div className="sidebar d-flex flex-column text-start">
      <img src="/logo.png" alt="logo" style={{ width: "110px", marginBottom: "10px" }} />
      <hr style={{ borderColor: "#333", width: "100%", margin: "20px 0" }} />
      <h4 className="text-light mb-4">chess-lab</h4>

      <div className="w-100">
        {/* Analyze by PGN File Only */}
        <div className="fen-pgn-box mb-4">
          <label className="fen-pgn-label">📂 Upload PGN File</label>
          <div className="d-grid gap-2 mt-2">
            <label htmlFor="pgn-upload" className="import-game-btn w-100">📁 Import PGN File</label>
            <input
              id="pgn-upload"
              type="file"
              accept=".pgn"
              onChange={handlePgnUpload}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <hr className="text-light" />

        {/* Saved actions */}
        <div className="d-grid gap-2 mt-3">
          <button className="btn w-100" onClick={handleLoadLastAnalysis}>📥 Load Last</button>
          <button className="btn w-100" onClick={handleLoadSavedAnalyses}>📚 My Analyses</button>
          {moveAnalysis.length > 0 && (
            <button className="btn w-100" onClick={handleDownloadAnalysis}>⬇ Download</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;