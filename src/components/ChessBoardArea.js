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
    <div className="chessboard-container">
      <Chessboard
        position={fen}
        customArrows={customArrows}
        boardWidth={450}
        customSquareStyles={
          moveAnalysis[moveIndex]?.mistake
            ? {
                [moveAnalysis[moveIndex].from]: { className: "square-pulse" },
                [moveAnalysis[moveIndex].to]: { className: "square-shake" },
              }
            : {}
        }
        boardStyle={{
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        }}
        lightSquareStyle={{ backgroundColor: "#f0d9b5" }}
        darkSquareStyle={{ backgroundColor: "#b58863" }}
      />
      <div className="d-flex justify-content-center gap-2 mt-3">
        <button
          className="control-btn"
          onClick={handlePrevMove}
          disabled={moveIndex === -1}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button
          className="control-btn"
          onClick={isPlaying ? stopPlayback : startPlayback}
        >
          {isPlaying ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          )}
        </button>
        <button
          className="control-btn"
          onClick={handleNextMove}
          disabled={moveIndex >= moveAnalysis.length - 1}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChessBoardArea;