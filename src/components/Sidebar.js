import React from "react";

function Sidebar({
  handlePgnUpload,
  handleLoadLastAnalysis,
  handleLoadSavedAnalyses,
  handleDownloadAnalysis,
  moveAnalysis,
}) {
  return (
    <div className="sidebar d-flex flex-column">
      <img src="/logo.png" alt="logo" style={{ width: "110px", marginBottom: "10px" }} />
      <hr style={{ borderColor: "#333", width: "80%", margin: "15px auto" }} />
      <h4 className="text-light mb-4">Chess Lab</h4>

      <div className="fen-pgn-box mb-3">
        <label className="fen-pgn-label">Upload PGN File</label>
        <div className="d-grid mt-1">
          <label htmlFor="pgn-upload" className="upload-btn">Select PGN File</label>
          <input
            id="pgn-upload"
            type="file"
            accept=".pgn"
            onChange={handlePgnUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <hr style={{ borderColor: "#333", width: "80%", margin: "15px auto" }} />

      <div className="d-grid gap-2 mt-2">
        <button className="btn" onClick={handleLoadLastAnalysis}>Load Last Analysis</button>
        <button className="btn" onClick={handleLoadSavedAnalyses}>View Saved Analyses</button>
        {moveAnalysis.length > 0 && (
          <button className="btn" onClick={handleDownloadAnalysis}>Download Analysis</button>
        )}
      </div>
    </div>
  );
}

export default Sidebar;