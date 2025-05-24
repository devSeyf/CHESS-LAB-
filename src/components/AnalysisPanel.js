// components/AnalysisPanel.jsx
import React from "react";

function AnalysisPanel({ analysis, moveIndex, moveAnalysis, handleExplainMistake }) {
  const currentMove = moveIndex >= 0 && moveIndex < moveAnalysis.length ? moveAnalysis[moveIndex] : null;

  return (
    <div className="analysis-panel d-flex flex-column">
      <h5>📊 Analiz</h5>
      {analysis && (
        <div className="alert alert-light border">
          {analysis.error ? (
            <p className="text-danger">{analysis.error}</p>
          ) : (
            <>
              <ul className="list-unstyled">
                <li><strong>Değerlendirme:</strong> {analysis.evaluation}</li>
                <li><strong>En İyi Hamle:</strong> {analysis.bestMove}</li>
                <li><strong>Doğruluk:</strong> {analysis.accuracy}</li>
                <li><strong>Hatalar:</strong> {analysis.mistakes.length ? analysis.mistakes.join(", ") : "Yok"}</li>
              </ul>

              {currentMove && currentMove.mistake && (
                <>
                  <div className={`alert alert-${currentMove.mistakeColor === "red" ? "danger" : currentMove.mistakeColor === "yellow" ? "warning" : "success"}`}>
                    <strong>⚠️ Analiz:</strong> {currentMove.mistake}<br />
                    <strong>💡 Öneri:</strong> {currentMove.suggestion}
                  </div>
                  <button className="btn btn-sm btn-info mb-2" onClick={() => handleExplainMistake(currentMove)}>Öğren</button>
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
