import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import axios from "axios";
import { Chess } from "chess.js";
import { ClipLoader } from "react-spinners";

import Sidebar from "../src/components/Sidebar";
import ChessBoardArea from "../src/components/ChessBoardArea";
import AnalysisPanel from "../src/components/AnalysisPanel";

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

  // Automatically analyze when game changes
  useEffect(() => {
    if (game) {
      handleAnalyzePgn();
    }
  }, [game]);

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
          setCustomArrows([
            [nextMove.from, nextMove.to, nextMove.mistakeColor || "red"],
          ]);
        }

        return nextIndex;
      });
    }, 1000);

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

      const allUserData = JSON.parse(
        localStorage.getItem("userAnalyses") || "{}"
      );
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
    const allUserData = JSON.parse(
      localStorage.getItem("userAnalyses") || "{}"
    );
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
      setCustomArrows([
        [lastMove.from, lastMove.to, lastMove.mistakeColor || "red"],
      ]);
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
        "Bu hamle daha iyi bir alternatifin kaçırıldığını gösterir. Konumsal olarak ضعيف veya پاسيف olabilir.";
    } else if (move.mistakeColor === "green") {
      explanation = "Tebrikler! Bu çok doğru و etkili bir حمله.";
    }
    alert(explanation);
  };

  const handleLoadLastAnalysis = () => {
    const saved = localStorage.getItem("lastAnalysis");

    if (!saved) {
      alert("Kayıtlı analiz bulunamadı.");
      return;
    }

    try {
      const { fen, analysis, moveAnalysis } = JSON.parse(saved);

      if (!Array.isArray(moveAnalysis)) {
        alert("Veriler bozuk görünüyor.");
        return;
      }

      setFen(fen || "start");
      setAnalysis(analysis || null);
      setMoveAnalysis(moveAnalysis);
      setGame(null);

      const lastIndex = moveAnalysis.length - 1;
      setMoveIndex(lastIndex >= 0 ? lastIndex : -1);

      if (lastIndex >= 0) {
        const lastMove = moveAnalysis[lastIndex];
        if (lastMove?.from && lastMove?.to) {
          setCustomArrows([
            [lastMove.from, lastMove.to, lastMove.mistakeColor || "red"],
          ]);
        } else {
          setCustomArrows([]);
        }
      } else {
        setCustomArrows([]);
      }
    } catch (error) {
      console.error("Analiz yüklenemedi:", error);
      alert("Veri yüklenirken hata oluştu.");
    }
  };

  return (
    <div className="container-fluid h-100">
      <div className="row h-100">
        {/* Sidebar */}
        <div className="col-md-4 d-flex flex-column">
          <Sidebar
            handlePgnUpload={handlePgnUpload}
            handleLoadLastAnalysis={handleLoadLastAnalysis}
            handleLoadSavedAnalyses={handleLoadSavedAnalyses}
            handleDownloadAnalysis={handleDownloadAnalysis}
            moveAnalysis={moveAnalysis}
          />
        </div>

        {/* Chessboard */}
        <div className="col-md-5 d-flex align-items-center justify-content-center">
          <ChessBoardArea
            fen={fen}
            customArrows={customArrows}
            moveAnalysis={moveAnalysis}
            moveIndex={moveIndex}
            handlePrevMove={handlePrevMove}
            handleNextMove={handleNextMove}
            isPlaying={isPlaying}
            startPlayback={startPlayback}
            stopPlayback={stopPlayback}
          />
          {isLoading && (
            <div className="loading-overlay">
              <ClipLoader color="#0d6efd" size={40} />
              <span>Analiz yapılıyor, lütfen bekleyin...</span>
            </div>
          )}
        </div>

        {/* Analysis */}
        <div className="col-md-3 d-flex flex-column">
          <AnalysisPanel
            analysis={analysis}
            moveIndex={moveIndex}
            moveAnalysis={moveAnalysis}
            handleExplainMistake={handleExplainMistake}
          />
        </div>
      </div>
    </div>
  );
}

export default ChessLogic;