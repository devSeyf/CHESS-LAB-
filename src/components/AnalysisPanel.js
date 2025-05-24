import React from "react";

function AnalysisPanel({ analysis, moveIndex, moveAnalysis, handleExplainMistake }) {
  const currentMove = moveIndex >= 0 && moveIndex < moveAnalysis.length ? moveAnalysis[moveIndex] : null;

  return (
    <div className="analysis-panel d-flex flex-column">
      <h5>Analysis</h5>
      {analysis && (
        <div className="alert alert-light border">
          {analysis.error ? (
            <p className="text-danger">{analysis.error}</p>
          ) : (
            <>
              <ul className="list-unstyled">
                <li><strong>Evaluation:</strong> {analysis.evaluation}</li>
                <li><strong>Best Move:</strong> {analysis.bestMove}</li>
                <li><strong>Accuracy:</strong> {analysis.accuracy}</li>
                <li><strong>Mistakes:</strong> {analysis.mistakes.length ? analysis.mistakes.join(", ") : "None"}</li>
              </ul>

              {currentMove && currentMove.mistake && (
                <>
                  <div className={`alert alert-${currentMove.mistakeColor === "red" ? "danger" : currentMove.mistakeColor === "yellow" ? "warning" : "success"}`}>
                    <strong>Analysis:</strong> {currentMove.mistake}<br />
                    <strong>Suggestion:</strong> {currentMove.suggestion}
                  </div>
                  <button className="btn btn-sm btn-info mb-2" onClick={() => handleExplainMistake(currentMove)}>Learn More</button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AnalysisPanel;