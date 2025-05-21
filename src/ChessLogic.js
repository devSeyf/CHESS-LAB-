import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import axios from "axios";
import { Chess } from "chess.js";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { ClipLoader } from "react-spinners";

function ChessLogic({
  


  fen,
  setFen, 
  analysis,
  setAnalysis,
  game,
  setGame,
  moveIndex,
  setMoveIndex,
  moveAnalysis,
  setMoveAnalysis,
  customArrows,
  setCustomArrows,
  isLoading,
  setIsLoading,
  username,
  setUsername,
  isLoggedIn,
  setIsLoggedIn,
}) {

  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalId, setIntervalId] = useState(null);

 









  const startPlayback = () => {
    if (isPlaying || moveIndex >= moveAnalysis.length - 1) return;
  
    const id = setInterval(() => {
      setMoveIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= moveAnalysis.length) {
          clearInterval(id);
          setIsPlaying(false);
          return prev;
        }
        const nextMove = moveAnalysis[nextIndex];
        setFen(nextMove.fen);
        setAnalysis({
          evaluation: nextMove.evaluation,
          bestMove: nextMove.bestMove,
          accuracy: analysis.accuracy,
          mistakes: analysis.mistakes || [],
        });
        if (nextMove.from && nextMove.to) {
          setCustomArrows([[nextMove.from, nextMove.to, nextMove.mistakeColor || "red"]]);
        }
 
        return nextIndex;
      });
    }, 1000); // 1 ثانية بين كل نقلة
  
    setIntervalId(id);
    setIsPlaying(true);
  };
  const stopPlayback = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
      setIsPlaying(false);
    }
  };
  
  
  const handleAnalyzeFen = async () => {
    if (fen !== "start") {
      try {
        const chess = new Chess();
        chess.load(fen);
      } catch (error) {
        setAnalysis({ error: "Geçersiz FEN formatı: " + error.message });
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/analyze",
        { fen },
        { timeout: 30000 }
      );
      const result = { ...response.data, mistakes: [], accuracy: "N/A" };
      setAnalysis(result);
      setMoveAnalysis([]);
      setCustomArrows([]);
      setMoveIndex(-1);
      localStorage.setItem(
        "lastAnalysis",
        JSON.stringify({ fen, analysis: result, moveAnalysis: [] })
      );
    } catch (error) {
      console.error("FEN analiz hatası:", error);
      setAnalysis({ error: "FEN analizi başarısız: " + error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePgnUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const pgnText = e.target.result;
      const chess = new Chess();
      try {
        chess.loadPgn(pgnText);
        setGame(chess);
        setFen(chess.fen());
        setMoveIndex(-1);
        setAnalysis(null);
        setMoveAnalysis([]);
        setCustomArrows([]);
      } catch (error) {
        setAnalysis({ error: "PGN yüklenemedi: " + error.message });
      }
    };
    reader.readAsText(file);
  };

  const handleAnalyzePgn = async () => {
    if (!game) {
      setAnalysis({ error: "Yüklü bir PGN oyunu yok" });
      return;
    }

    setIsLoading(true);
    try {
      const chess = new Chess();
      const moves = game.history({ verbose: true });
      const moveEvaluations = [];
      const mistakes = [];
      let totalScoreDiff = 0;
      let moveCount = 0;

      chess.reset();
      const initialFen = chess.fen();
      const initialResponse = await axios.post(
        "http://localhost:5000/analyze",
        { fen: initialFen },
        { timeout: 30000 }
      );

      moveEvaluations.push({
        fen: initialFen,
        evaluation: initialResponse.data.evaluation,
        bestMove: initialResponse.data.bestMove,
        move: "Başlangıç",
        mistake: null,
        from: null,
        to: null,
        suggestion: null,
      });

      let previousEvaluation = initialResponse.data.evaluation;

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        chess.move(move.san);

        const afterFen = chess.fen();
        const afterResponse = await axios.post(
          "http://localhost:5000/analyze",
          { fen: afterFen },
          { timeout: 30000 }
        );

        const afterEvaluation = afterResponse.data.evaluation;
        const bestMove = afterResponse.data.bestMove;
        const scoreDiff = Math.abs(previousEvaluation - afterEvaluation);

        totalScoreDiff += scoreDiff;
        moveCount++;

        let mistake = null;
        let mistakeColor = null;
        let suggestion = null;

        if (scoreDiff > 2) {
          mistake = `?? hamlesi: ${move.san} (${i + 1}. hamle)`;
          mistakeColor = "red";
          mistakes.push(mistake);
          suggestion =
            move.san === "Qh5" || move.san === "Qb3"
              ? "Veziri çok erken çıkarmaktan kaçının, önce küçük taşları (örneğin Nf3 veya Nc3) geliştirin."
              : `Bu hamle avantaj kaybına neden oldu. Önerilen hamle: ${bestMove}`;
        } else if (scoreDiff > 1) {
          mistake = `? hamlesi: ${move.san} (${i + 1}. hamle)`;
          mistakeColor = "yellow";
          mistakes.push(mistake);
          suggestion = `Bu hamle en iyi tercih değil. Daha iyi bir hamle: ${bestMove}`;
        } else if (move.san === bestMove && scoreDiff < 0.5) {
          mistake = `! hamlesi: ${move.san} (${i + 1}. hamle)`;
          mistakeColor = "green";
          mistakes.push(mistake);
          suggestion = "Çok iyi bir hamle!";
        }

        moveEvaluations.push({
          fen: afterFen,
          evaluation: afterEvaluation,
          bestMove,
          move: move.san,
          mistake,
          from: move.from,
          to: move.to,
          mistakeColor,
          suggestion,
        });

        previousEvaluation = afterEvaluation;
      }

      const averageScoreDiff = totalScoreDiff / moveCount;
      const accuracy = Math.max(0, 100 - averageScoreDiff * 10).toFixed(2);

      const finalAnalysis = {
        evaluation: previousEvaluation,
        bestMove: moveEvaluations[moveEvaluations.length - 1].bestMove,
        accuracy: `${accuracy}%`,
        mistakes,
      };

      setMoveAnalysis(moveEvaluations);
      setMoveIndex(1);
      setFen(moveEvaluations[1]?.fen || "start");
      const firstMove = moveEvaluations[1];
      if (firstMove?.mistake && firstMove.from && firstMove.to) {
        setCustomArrows([
          [firstMove.from, firstMove.to, firstMove.mistakeColor || "red"],
        ]);
      } else {
        setCustomArrows([]);
      }

      setAnalysis(finalAnalysis);
      setMoveIndex(moveEvaluations.length - 1);
      setFen(moveEvaluations[moveEvaluations.length - 1].fen);

      const lastMove = moveEvaluations[moveEvaluations.length - 1];
      if (lastMove.mistake && lastMove.from && lastMove.to) {
        setCustomArrows([
          [lastMove.from, lastMove.to, lastMove.mistakeColor || "red"],
        ]);
      }

      localStorage.setItem(
        "lastAnalysis",
        JSON.stringify({
          fen: moveEvaluations[moveEvaluations.length - 1].fen,
          analysis: finalAnalysis,
          moveAnalysis: moveEvaluations,
        })
      );

      const allUserData = JSON.parse(localStorage.getItem("userAnalyses") || "{}");
      allUserData[username] = allUserData[username] || [];
      allUserData[username].push({
        date: new Date().toLocaleString(),
        analysis: finalAnalysis,
        moveAnalysis: moveEvaluations,
      });

      localStorage.setItem("userAnalyses", JSON.stringify(allUserData));
    } catch (error) {
      console.error("PGN analiz hatası:", error);
      setAnalysis({ error: "PGN analizi başarısız: " + error.message });
    } finally {
      setIsLoading(false);
    }
  };

const handleNextMove = () => {
 
  if (moveIndex < moveAnalysis.length - 1) {
    const nextIndex = moveIndex + 1;
    const currentMove = moveAnalysis[nextIndex];
    setMoveIndex(nextIndex);
    setFen(currentMove.fen);  
    setAnalysis({
      evaluation: currentMove.evaluation,
      bestMove: currentMove.bestMove,
      accuracy: analysis.accuracy,
      mistakes: analysis.mistakes || [],
    });
    if (currentMove.mistake && currentMove.from && currentMove.to) {
      setCustomArrows([
        [currentMove.from, currentMove.to, currentMove.mistakeColor || "red"],
      ]);
    } else {
      setCustomArrows([]);
    }
  }
};

  const handlePrevMove = () => {
 
    if (moveIndex > 0) {
      const prevIndex = moveIndex - 1;
      const currentMove = moveAnalysis[prevIndex];
      setMoveIndex(prevIndex);
      setFen(currentMove.fen);
      setAnalysis({
        evaluation: currentMove.evaluation,
        bestMove: currentMove.bestMove,
        accuracy: analysis.accuracy,
        mistakes: analysis.mistakes || [],
      });
      if (currentMove.mistake && currentMove.from && currentMove.to) {
        setCustomArrows([
          [currentMove.from, currentMove.to, currentMove.mistakeColor || "red"],
        ]);
      } else {
        setCustomArrows([]);
      }
    } else if (moveIndex === 0) {
      setMoveIndex(-1);
      setFen("start");
      setAnalysis(null);
      setCustomArrows([]);
    }
  };

  const handleLoadSavedAnalyses = () => {
    const allUserData = JSON.parse(localStorage.getItem("userAnalyses") || "{}");
    const userData = allUserData[username];

    if (!userData || userData.length === 0) {
      alert("Bu kullanıcıya ait kayıtlı analiz bulunamadı.");
      return;
    }

    const last = userData[userData.length - 1];
    setAnalysis(last.analysis);
    setMoveAnalysis(last.moveAnalysis);
    setMoveIndex(last.moveAnalysis.length - 1);
    setFen(last.moveAnalysis[last.moveAnalysis.length - 1].fen);

    const lastMove = last.moveAnalysis[last.moveAnalysis.length - 1];
    if (lastMove.from && lastMove.to) {
      setCustomArrows([[lastMove.from, lastMove.to, lastMove.mistakeColor || "red"]]);
    } else {
      setCustomArrows([]);
    }
  };

  const handleDownloadAnalysis = () => {
    const data = {
      accuracy: analysis?.accuracy || "N/A",
      mistakes: analysis?.mistakes || [],
      evaluations: moveAnalysis,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chess-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExplainMistake = (move) => {
    let explanation = "";
    if (!move || !move.mistake) {
      explanation = "Bu hamle hakkında özel bir açıklama bulunamadı.";
    } else if (move.mistakeColor === "red") {
      explanation =
        "Bu ciddi bir hata. Genellikle taş kaybı, mat tehdidi ya da büyük stratejik kayıplar içerir.";
    } else if (move.mistakeColor === "yellow") {
      explanation =
        "Bu hamle daha iyi bir alternatifin kaçırıldığını gösterir. Konumsal olarak zayıf veya pasif olabilir.";
    } else if (move.mistakeColor === "green") {
        explanation = "Tebrikler! Bu çok doğru ve etkili bir hamle.";    }
    alert(explanation);
  };

  const handleLoadLastAnalysis = () => {
    const saved = localStorage.getItem("lastAnalysis");
    if (saved) {
      const { fen, analysis, moveAnalysis } = JSON.parse(saved);
      setFen(fen);
      setAnalysis(analysis);
      setMoveAnalysis(moveAnalysis);
      setGame(null);
      setMoveIndex(moveAnalysis.length - 1);
      const lastMove = moveAnalysis[moveAnalysis.length - 1];
      if (lastMove.mistake && lastMove.from && lastMove.to) {
        setCustomArrows([
          [lastMove.from, lastMove.to, lastMove.mistakeColor || "red"],
        ]);
      } else {
        setCustomArrows([]);
      }
    } else {
      alert("Kayıtlı analiz bulunamadı.");
    }
  };

return (
  <div className="container-fluid h-100">
    <div className="row h-100">
      {/* Sidebar */}
        <div className="col-md-3 sidebar">
        <h5 className="mb-3">🎯 Kontroller</h5>

        <div className="input-group mb-3">
          <input
            type="text"
            value={fen}
            onChange={(e) => setFen(e.target.value)}
            className="form-control"
            placeholder="FEN konumu giriniz..."
          />
          <button
            className="btn btn-primary"
            onClick={handleAnalyzeFen}
            disabled={isLoading}
          >
            Analiz Et
          </button>
        </div>

        <div className="mb-3">
          <label htmlFor="pgn-upload" className="form-label">
            PGN Yükle
          </label>
          <input
            type="file"
            className="form-control"
            id="pgn-upload"
            accept=".pgn"
            onChange={handlePgnUpload}
          />
          <button
            className="btn btn-secondary w-100 mt-2"
            onClick={handleAnalyzePgn}
            disabled={!game || isLoading}
          >
            PGN Analiz Et
          </button>
        </div>

        <div className="d-grid gap-2 mb-3">
          <button className="btn btn-outline-dark" onClick={handlePrevMove} disabled={moveIndex === -1}>
            ⬅️ Önceki Hamle
          </button>
             <button
          className="btn btn-outline-secondary"
          onClick={() => {
            setFen("start");
            setGame(null);
            setAnalysis(null);
            setMoveIndex(-1);
            setMoveAnalysis([]);
            setCustomArrows([]);
          }}
        >
          🔁 Oyunu Sıfırla
        </button>



          <button className="btn btn-outline-dark" onClick={handleNextMove} disabled={moveIndex === moveAnalysis.length - 1}>
            Sonraki Hamle ➡️
          </button>
        </div>


{isLoading && (
  <div className="d-flex justify-content-center align-items-center mt-3 flex-column">
    <ClipLoader color="#0d6efd" size={35} />
    <span style={{ marginTop: "10px", fontSize: "0.9rem", color: "#333" }}>
      Analiz yapılıyor...
    </span>
  </div>
)}



        <div className="d-grid gap-2">
          <button className="btn btn-warning" onClick={handleLoadLastAnalysis}>Son Analizi Yükle</button>
          <button className="btn btn-secondary" onClick={handleLoadSavedAnalyses}>Kayıtlı Analizler</button>
          {moveAnalysis.length > 0 && (
            <button className="btn btn-success" onClick={handleDownloadAnalysis}>İndir (JSON)</button>
          )}
          <button className="btn btn-danger" onClick={() => { localStorage.removeItem("username"); setUsername(""); setIsLoggedIn(false); }}>Çıkış Yap</button>
        </div>
      </div>

      {/* Chessboard */}
      <div className="col-md-6 chessboard-container">

        <Chessboard
          position={fen}
          customArrows={customArrows}
          customSquareStyles={
            moveIndex >= 0 && moveAnalysis[moveIndex]?.to
              ? {
                  [moveAnalysis[moveIndex].to]: {
                    animation: "pieceShake 0.3s ease-in-out",
                  },
                }
              : {}
          }
        />
      </div>

      
<div className="d-flex justify-content-center gap-2 my-3">
  <button className="control-btn" onClick={handlePrevMove} disabled={moveIndex <= 0}>
    ⬅
  </button>

  {!isPlaying ? (
    <button className="control-btn" onClick={startPlayback}>
      ▶
    </button>
  ) : (
    <button className="control-btn" onClick={stopPlayback}>
      ⏸
    </button>
  )}

  <button className="control-btn" onClick={handleNextMove} disabled={moveIndex >= moveAnalysis.length - 1}>
    ➡
  </button>
</div>


      {/* Analysis */}
      <div className="col-md-3 analysis-panel">

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
                {moveIndex >= 0 && moveAnalysis[moveIndex] && (
                  <div>
                    <p><strong>Hamle:</strong> {moveAnalysis[moveIndex].move}</p>
                    {moveAnalysis[moveIndex].mistake && (
                      <>
                                  <div
                                    className={`alert ${
                                      moveAnalysis[moveIndex].mistakeColor === "red"
                                        ? "alert-danger"
                                        : moveAnalysis[moveIndex].mistakeColor === "yellow"
                                        ? "alert-warning"
                                        : "alert-success"
                                    }`}
                                  >
                                    <strong>⚠️ Analiz:</strong> {moveAnalysis[moveIndex].mistake}
                                    <br />
                                    <strong>💡 Öneri:</strong> {moveAnalysis[moveIndex].suggestion}
                                  </div>
                        <p><strong>Öneri:</strong> {moveAnalysis[moveIndex].suggestion}</p>
                        <button className="btn btn-sm btn-info mb-2" onClick={() => handleExplainMistake(moveAnalysis[moveIndex])}>Öğren</button>
                        <div className="progress">
                          <div
                            className="progress-bar"
                            style={{
                              width: `${Math.min(Math.abs(moveAnalysis[moveIndex].evaluation) * 50, 100)}%`,
                              backgroundColor:
                                moveAnalysis[moveIndex].mistakeColor === "red"
                                  ? "#ef5350"
                                  : moveAnalysis[moveIndex].mistakeColor === "yellow"
                                  ? "#ffeb3b"
                                  : "#81c784",
                            }}
                          ></div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
    {isLoading && (
  <div className="loading-overlay">
    <ClipLoader color="#0d6efd" size={40} />
    <span>Analiz yapılıyor, lütfen bekleyin...</span>
  </div>
)}

  </div>



);

}

export default ChessLogic;