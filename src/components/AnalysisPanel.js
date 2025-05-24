import React from "react";

function AnalysisPanel({ analysis, moveIndex, moveAnalysis, handleExplainMistake }) {
  const currentMove = moveIndex >= 0 && moveIndex < moveAnalysis.length ? moveAnalysis[moveIndex] : null;

  return (
    <div className="analysis-panel d-flex flex-column">
      <h5>Analysis</h5>

      {analysis ? (
        analysis.error ? (
          <div className="alert alert-danger">
            <strong>Error:</strong> {analysis.error}
          </div>
        ) : (
          <>
            {/* Game Overview Section */}
            <div className="analysis-section mb-3">
              <h6 className="section-title">Game Overview</h6>
              <div className="overview-content">
                <div className="overview-item">
                  <span className="item-label">Evaluation:</span>
                  <span className="item-value">{analysis.evaluation}</span>
                </div>
                <div className="overview-item">
                  <span className="item-label">Best Move:</span>
                  <span className="item-value">{analysis.bestMove}</span>
                </div>
                <div className="overview-item">
                  <span className="item-label">Accuracy:</span>
                  <div className="accuracy-wrapper">
                    <span className="item-value">{analysis.accuracy}</span>
                    <div className="accuracy-bar">
                      <div
                        className="accuracy-fill"
                        style={{ width: analysis.accuracy }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="overview-item">
                  <span className="item-label">Mistakes:</span>
                  <span className="item-value">
                    {analysis.mistakes.length ? analysis.mistakes.join(", ") : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Move Analysis Section */}
            {currentMove && currentMove.mistake && (
              <div className="analysis-section">
                <h6 className="section-title">Move Analysis</h6>
                <div className={`move-analysis-content move-${currentMove.mistakeColor}`}>
                  <div className="move-analysis-header">
                    {currentMove.mistakeColor === "red" && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v2m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                      </svg>
                    )}
                    {currentMove.mistakeColor === "yellow" && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffeb3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v2m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                      </svg>
                    )}
                    {currentMove.mistakeColor === "green" && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#81c784" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                      </svg>
                    )}
                    <span className="move-analysis-title">{currentMove.mistake}</span>
                  </div>
                  <div className="move-analysis-details">
                    <p><strong>Suggestion:</strong> {currentMove.suggestion}</p>
                    <button className="btn btn-sm btn-info" onClick={() => handleExplainMistake(currentMove)}>
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        <p className="text-muted">No analysis available. Please upload a PGN file to start.</p>
      )}
    </div>
  );
}

export default AnalysisPanel;