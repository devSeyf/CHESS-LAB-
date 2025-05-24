// components/ChessBoardArea.jsx
import React from "react";
import { Chessboard } from "react-chessboard";

function ChessBoardArea({
  fen,
  customArrows,
  moveAnalysis,
  moveIndex,
  handlePrevMove,
  handleNextMove,
  isPlaying,
  startPlayback,
  stopPlayback,
}) {
  return (
    <div className="chessboard-container d-flex flex-column align-items-center justify-content-center">
      <Chessboard
        position={fen}
        customArrows={customArrows}
        boardOrientation="white"
        boardWidth={600}
        customDarkSquareStyle={{ backgroundColor: "#5b5e7a" }}
        customLightSquareStyle={{ backgroundColor: "#e0e0e0" }}
        customSquareStyles={
          moveIndex >= 0 && moveAnalysis[moveIndex]?.to
            ? { [moveAnalysis[moveIndex].to]: { animation: "pieceShake 0.3s ease-in-out" } }
            : {}
        }
      />
      <div className="d-flex justify-content-center gap-2 mt-3">
        <button className="control-btn" onClick={handlePrevMove} disabled={moveIndex <= 0}>⬅</button>
        {!isPlaying ? (
          <button className="control-btn" onClick={startPlayback}>▶</button>
        ) : (
          <button className="control-btn" onClick={stopPlayback}>⏸</button>
        )}
        <button className="control-btn" onClick={handleNextMove} disabled={moveIndex >= moveAnalysis.length - 1}>➡</button>
      </div>
    </div>
  );
}

export default ChessBoardArea;
