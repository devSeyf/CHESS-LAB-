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
  // Oynatma durumu - hamlelerin otomatik oynatılması
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  // Analiz ilerleme durumu
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  // Hoşgeldiniz ekranını gösterme durumu
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(!game);
  // Canlı analiz modu durumu
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveGame, setLiveGame] = useState(null);
  const [liveMoves, setLiveMoves] = useState([]);
  // Bildirimler listesi
  const [notifications, setNotifications] = useState([]);
  // Oynatma hızı (ms)
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);

  // Oyun değiştiğinde analiz yap veya hoşgeldiniz ekranını ayarla
  useEffect(() => {
    if (game) {
      handleAnalyzePgn();
      setShowWelcomeScreen(false);
    } else {
      setShowWelcomeScreen(true);
    }
  }, [game]);

  // Hamlelerin otomatik oynatılmasını başlat
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
    }, playbackSpeed);

    setIntervalId(id);
    setIsPlaying(true);
  };

  // Oynatmayı durdur
  const stopPlayback = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
      setIsPlaying(false);
    }
  };

  // PGN dosyası yüklendiğinde işleme
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
        setIsLiveMode(false);
        setLiveGame(null);
        setLiveMoves([]);
      } catch (error) {
        setAnalysis({ error: "Failed to load PGN: " + error.message });
      }
    };
    reader.readAsText(file);
  };

  // PGN analizini yap
  const handleAnalyzePgn = async () => {
    if (!game) {
      setAnalysis({ error: "No PGN game loaded" });
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

      setAnalysisProgress({ current: 0, total: moves.length + 1 });
      console.log(`Starting analysis for ${moves.length} moves...`);

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
        move: "Starting Position",
        mistake: null,
        from: null,
        to: null,
        suggestion: null,
      });

      console.log(`Initial position evaluated: Score ${initialResponse.data.evaluation}, Best Move: ${initialResponse.data.bestMove}`);
      setAnalysisProgress((prev) => ({ ...prev, current: 1 }));

      let previousEvaluation = initialResponse.data.evaluation;

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        chess.move(move.san);

        const afterFen = chess.fen();
        console.log(`Analyzing move ${i + 1}/${moves.length}: ${move.san}`);
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
          mistake = `Blunder: ${move.san} (Move ${i + 1})`;
          mistakeColor = "red";
          mistakes.push(mistake);
          suggestion =
            move.san === "Qh5" || move.san === "Qb3"
              ? "Avoid bringing out the queen too early; develop minor pieces (e.g., Nf3 or Nc3) first."
              : `This move led to a significant disadvantage. Recommended move: ${bestMove}`;
          addNotification(`Blunder Detected! (${move.san})`);
        } else if (scoreDiff > 1) {
          mistake = `Mistake: ${move.san} (Move ${i + 1})`;
          mistakeColor = "yellow";
          mistakes.push(mistake);
          suggestion = `This move is not optimal. A better move would be: ${bestMove}`;
          addNotification(`Mistake Detected! (${move.san})`);
        } else if (move.san === bestMove && scoreDiff < 0.5) {
          mistake = `Excellent Move: ${move.san} (Move ${i + 1})`;
          mistakeColor = "green";
          mistakes.push(mistake);
          suggestion = "This is a very strong move!";
          addNotification(`Excellent Move! (${move.san})`);
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

        console.log(`Move ${i + 1} evaluated: Score ${afterEvaluation}, Best Move: ${bestMove}, Score Diff: ${scoreDiff}`);
        setAnalysisProgress((prev) => ({ ...prev, current: prev.current + 1 }));

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

      // Son analizi localStorage'a kaydet
      localStorage.setItem(
        "lastAnalysis",
        JSON.stringify({
          fen: moveEvaluations[moveEvaluations.length - 1].fen,
          analysis: finalAnalysis,
          moveAnalysis: moveEvaluations,
        })
      );

      // Kullanıcıya özel analizleri kaydet
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
      console.log("Analysis completed successfully!");
      addNotification("Analysis Completed!");
    } catch (error) {
      console.error("PGN analysis failed:", error);
      setAnalysis({ error: "PGN analysis failed: " + error.message });
      addNotification("Analysis Failed!");
    } finally {
      setIsLoading(false);
      setAnalysisProgress({ current: 0, total: 0 });
    }
  };

  // Canlı analiz başlat
  const startLiveAnalysis = () => {
    setIsLiveMode(true);
    const chess = new Chess();
    setLiveGame(chess);
    setLiveMoves([]);
    setFen(chess.fen());
    setAnalysis(null);
    setMoveAnalysis([]);
    setMoveIndex(-1);
    setCustomArrows([]);
    setGame(null);
    setShowWelcomeScreen(false);
    addNotification("Live Analysis Started!");
  };

  // Canlı analizi durdur
  const stopLiveAnalysis = () => {
    setIsLiveMode(false);
    setLiveGame(null);
    setLiveMoves([]);
    setFen("start");
    setAnalysis(null);
    setMoveAnalysis([]);
    setMoveIndex(-1);
    setCustomArrows([]);
    setShowWelcomeScreen(true);
    addNotification("Live Analysis Stopped!");
  };

  // Canlı modda taş bırakıldığında hamle yap ve analiz et
  const onPieceDrop = async (sourceSquare, targetSquare) => {
    if (!liveGame) {
      console.error("No live game instance available.");
      addNotification("Live Analysis Failed: No game instance.");
      return false;
    }

    try {
      const move = liveGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) {
        console.log("Invalid move:", sourceSquare, targetSquare);
        return false;
      }

      const newFen = liveGame.fen();
      setFen(newFen);

      // Yeni pozisyonu analiz et
      console.log("Sending FEN for analysis:", newFen);
      const response = await axios.post(
        "http://localhost:5000/analyze",
        { fen: newFen },
        { timeout: 30000 }
      );

      if (!response || !response.data) {
        throw new Error("No response from server.");
      }

      const evaluation = response.data.evaluation;
      const bestMove = response.data.bestMove;

      console.log("Analysis received:", { evaluation, bestMove });

      let previousEvaluation = 0;
      if (liveMoves.length > 0) {
        const previousFen = liveMoves[liveMoves.length - 1].fen;
        console.log("Sending previous FEN for analysis:", previousFen);
        const previousResponse = await axios.post(
          "http://localhost:5000/analyze",
          { fen: previousFen },
          { timeout: 30000 }
        );
        previousEvaluation = previousResponse.data.evaluation;
      } else {
        // İlk hamle için başlangıç pozisyonunu karşılaştır
        const initialFen = "rnbqkbnr/pppppppp/5n1p/8/8/5N1P/PPPPPPPP/RNBQKB1R w KQkq - 0 2";
        console.log("Sending initial FEN for analysis:", initialFen);
        const initialResponse = await axios.post(
          "http://localhost:5000/analyze",
          { fen: initialFen },
          { timeout: 30000 }
        );
        previousEvaluation = initialResponse.data.evaluation;
      }

      const scoreDiff = Math.abs(previousEvaluation - evaluation);

      let mistake = null;
      let mistakeColor = null;
      let suggestion = null;

      if (scoreDiff > 2) {
        mistake = `Blunder: ${move.san} (Move ${liveMoves.length + 1})`;
        mistakeColor = "red";
        suggestion =
          move.san === "Qh5" || move.san === "Qb3"
            ? "Avoid bringing out the queen too early; develop minor pieces (e.g., Nf3 or Nc3) first."
            : `This move led to a significant disadvantage. Recommended move: ${bestMove}`;
        addNotification(`Blunder Detected! (${move.san})`);
      } else if (scoreDiff > 1) {
        mistake = `Mistake: ${move.san} (Move ${liveMoves.length + 1})`;
        mistakeColor = "yellow";
        suggestion = `This move is not optimal. A better move would be: ${bestMove}`;
        addNotification(`Mistake Detected! (${move.san})`);
      } else if (move.san === bestMove && scoreDiff < 0.5) {
        mistake = `Excellent Move: ${move.san} (Move ${liveMoves.length + 1})`;
        mistakeColor = "green";
        suggestion = "This is a very strong move!";
        addNotification(`Excellent Move! (${move.san})`);
      }

      const newMove = {
        fen: newFen,
        evaluation,
        bestMove,
        move: move.san,
        mistake,
        from: move.from,
        to: move.to,
        mistakeColor,
        suggestion,
      };

      // liveMoves ve moveAnalysis güncelle
      setLiveMoves((prev) => {
        const updatedLiveMoves = [...prev, newMove];
        console.log("Updated liveMoves:", updatedLiveMoves);

        setMoveAnalysis([...updatedLiveMoves]);
        setMoveIndex(updatedLiveMoves.length - 1);

        setAnalysis({
          evaluation,
          bestMove,
          accuracy: "N/A",
          mistakes: updatedLiveMoves
            .filter((m) => m.mistake)
            .map((m) => m.mistake),
        });

        return updatedLiveMoves;
      });

      // Okları güncelle
      if (newMove.mistake && newMove.from && newMove.to) {
        setCustomArrows([
          [newMove.from, newMove.to, newMove.mistakeColor || "red"],
        ]);
      } else {
        setCustomArrows([]);
      }

      console.log("Live move analyzed:", newMove);
      return true;
    } catch (error) {
      console.error("Live analysis failed:", error);
      addNotification("Live Analysis Failed! Please check if the server is running.");
      return false;
    }
  };

  // Sonraki hamleye geç
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

  // Önceki hamleye geç
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

  // Kaydedilmiş analizleri yükle
  const handleLoadSavedAnalyses = () => {
    const allUserData = JSON.parse(
      localStorage.getItem("userAnalyses") || "{}"
    );
    const userData = allUserData[username];

    if (!userData || userData.length === 0) {
      alert("No saved analyses found for this user.");
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

  // Analizi JSON olarak indir
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

  // Hamledeki hatayı açıkla
  const handleExplainMistake = (move) => {
    let explanation = "";
    if (!move || !move.mistake) {
      explanation = "No specific explanation available for this move.";
    } else if (move.mistakeColor === "red") {
      explanation =
        "This is a serious mistake. It often leads to material loss, checkmate threats, or significant strategic disadvantages.";
    } else if (move.mistakeColor === "yellow") {
      explanation =
        "This move missed a better alternative. It might be positionally weak or passive.";
    } else if (move.mistakeColor === "green") {
      explanation = "Congratulations! This is a very accurate and effective move.";
    }
    return explanation;
  };

  // Son analizi yükle
  const handleLoadLastAnalysis = () => {
    const saved = localStorage.getItem("lastAnalysis");

    if (!saved) {
      alert("No saved analysis found.");
      return;
    }

    try {
      const { fen, analysis, moveAnalysis } = JSON.parse(saved);

      if (!Array.isArray(moveAnalysis)) {
        alert("Data appears to be corrupted.");
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
      console.error("Failed to load analysis:", error);
      alert("An error occurred while loading the data.");
    }
  };

  // Belirli bir hamleyi seç
  const handleMoveSelect = (index) => {
    const selectedMove = moveAnalysis[index];
    setMoveIndex(index);
    setFen(selectedMove.fen);
    setAnalysis({
      evaluation: selectedMove.evaluation,
      bestMove: selectedMove.bestMove,
      accuracy: analysis.accuracy,
      mistakes: analysis.mistakes || [],
    });
    if (selectedMove.mistake && selectedMove.from && selectedMove.to) {
      setCustomArrows([
        [selectedMove.from, selectedMove.to, selectedMove.mistakeColor || "red"],
      ]);
    } else {
      setCustomArrows([]);
    }
  };

  // Bildirim ekle
  const addNotification = (message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, 3000);
  };

  return (
    <div className="container-fluid h-100 d-flex flex-column">
      {/* Hoşgeldiniz ekranı */}
      {showWelcomeScreen && !isLiveMode ? (
        <div className="welcome-screen">
          <div className="welcome-content">
            <img src="/logo.png" alt="Chess Lab Logo" className="welcome-logo" />
            <h1 className="welcome-title">Welcome to Chess Lab!</h1>
            <p className="welcome-message">
              Choose a mode to start analyzing your chess games.
            </p>
            <div className="welcome-buttons d-flex gap-3 justify-content-center">
              <button
                className="welcome-btn welcome-btn-live"
                onClick={startLiveAnalysis}
              >
                Live Analysis
              </button>
              <label
                htmlFor="welcome-pgn-upload"
                className="welcome-btn welcome-btn-upload"
              >
                Upload PGN File
              </label>
              <input
                id="welcome-pgn-upload"
                type="file"
                accept=".pgn"
                onChange={handlePgnUpload}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Bildirimler */}
          <div className="notification-container">
            {notifications.map((notif) => (
              <div key={notif.id} className="notification">
                {notif.message}
              </div>
            ))}
          </div>
          <div className="row flex-grow-1">
            {/* Yan menü */}
            <div className="col-md-2 d-flex flex-column">
              <Sidebar
                handlePgnUpload={handlePgnUpload}
                handleLoadLastAnalysis={handleLoadLastAnalysis}
                handleLoadSavedAnalyses={handleLoadSavedAnalyses}
                handleDownloadAnalysis={handleDownloadAnalysis}
                moveAnalysis={moveAnalysis}
                startLiveAnalysis={startLiveAnalysis}
                isLiveMode={isLiveMode}
                stopLiveAnalysis={stopLiveAnalysis}
              />
            </div>

            {/* Satranç tahtası alanı */}
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
                isLiveMode={isLiveMode}
                onPieceDrop={onPieceDrop}
                playbackSpeed={playbackSpeed}
                setPlaybackSpeed={setPlaybackSpeed}
              />
              {isLoading && (
                <div className="loading-overlay">
                  <ClipLoader color="#0d6efd" size={40} />
                  <span>
                    Analyzing move {analysisProgress.current} of {analysisProgress.total}...
                  </span>
                </div>
              )}
            </div>

            {/* Analiz paneli */}
            <div className="col-md-5 d-flex flex-column">
              <AnalysisPanel
                analysis={analysis}
                moveIndex={moveIndex}
                moveAnalysis={moveAnalysis}
                handleExplainMistake={handleExplainMistake}
                handleMoveSelect={handleMoveSelect}
              />
            </div>
          </div>

          <footer className="app-footer">
            <p>Chess Lab | Version 1.0.0 | © 2025</p>
          </footer>
        </>
      )}
    </div>
  );
}

export default ChessLogic;
