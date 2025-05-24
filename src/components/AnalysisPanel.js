import React, { useState } from "react";

function AnalysisPanel({ analysis, moveIndex, moveAnalysis, handleExplainMistake, handleMoveSelect }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState("");

  const currentMove = moveIndex >= 0 && moveIndex < moveAnalysis.length ? moveAnalysis[moveIndex] : null;

  const toggleExplanation = (move) => {
    if (showExplanation) {
      setShowExplanation(false);
      setExplanationText("");
    } else {
      const explanation = handleExplainMistake(move);
      setExplanationText(explanation);
      setShowExplanation(true);
    }
  };

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
            <div className="analysis-section mb-2">
              <h6 className="section-title">Game Overview</h6>
              <div className="overview-content">
                <div className="overview-item">
                  <span className="item-label">Evaluation</span>
                  <span className="item-value">{analysis.evaluation}</span>
                </div>
                <div className="overview-item">
                  <span className="item-label">Best Move</span>
                  <span className="item-value">{analysis.bestMove}</span>
                </div>
                <div className="overview-item">
                  <span className="item-label">Accuracy</span>
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
                  <span className="item-label">Mistakes</span>
                  <span className="item-value">
                    {analysis.mistakes.length ? analysis.mistakes.length : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Move Analysis Section */}
            {currentMove && currentMove.mistake && (
              <div className="analysis-section mb-2">
                <h6 className="section-title">Move Analysis</h6>
                <div className={`move-analysis-content move-${currentMove.mistakeColor}`}>
                  <div className="move-analysis-header">
                    {currentMove.mistakeColor === "red" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v2m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                      </svg>
                    )}
                    {currentMove.mistakeColor === "yellow" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffeb3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v2m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                      </svg>
                    )}
                    {currentMove.mistakeColor === "green" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#81c784" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                      </svg>
                    )}
                    <span className="move-analysis-title">{currentMove.mistake}</span>
                  </div>
                  <div className="move-analysis-details">
                    <p>{currentMove.suggestion}</p>
                    <button
                      className="btn btn-sm btn-explain"
                      onClick={() => toggleExplanation(currentMove)}
                    >
                      {showExplanation ? "Hide Details" : "Learn More"}
                    </button>
                    {showExplanation && (
                      <div className="explanation-content">
                        <p>{explanationText}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Move History Section */}
            {moveAnalysis.length > 0 && (
              <div className="analysis-section">
                <h6 className="section-title">Move History</h6>
                <div className="move-history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Move</th>
                        <th>Evaluation</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moveAnalysis.map((move, index) => (
                        <tr
                          key={index}
                          onClick={() => handleMoveSelect(index)}
                          className={index === moveIndex ? "selected-move" : ""}
                        >
                          <td>{index}</td>
                          <td>{move.move}</td>
                          <td>{move.evaluation}</td>
                          <td>
                            {move.mistake && (
                              <>
                                {move.mistakeColor === "red" && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 9v2m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                                  </svg>
                                )}
                                {move.mistakeColor === "yellow" && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffeb3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 9v2m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                                  </svg>
                                )}
                                {move.mistakeColor === "green" && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#81c784" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6L9 17l-5-5" />
                                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                                  </svg>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        <p className="text-muted">No analysis available. Upload a PGN file to start.</p>
      )}
    </div>
  );
}

export default AnalysisPanel;