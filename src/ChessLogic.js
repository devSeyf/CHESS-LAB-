import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Chess } from "chess.js";
import { ClipLoader } from "react-spinners";
import { IoArrowBack } from "react-icons/io5";

import { verboseMoveToUci, STANDARD_START_FEN } from "./chessUtils";

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
  // Bildirimler listesi
  const [notifications, setNotifications] = useState([]);
  // Oynatma hızı (ms)
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);

  /** Live game must use a ref so async analysis never sees a stale Chess instance. */
  const liveGameRef = useRef(null);
  /** Engine evaluation of the current live position (after each successful /analyze). Used for mistake deltas. */
  const lastLiveEvaluationRef = useRef(null);
  /** Monotonically increases; drop stale axios responses when the user moves again. */
  const liveAnalysisRequestIdRef = useRef(0);
  /** True while a live /analyze request is in flight OR initial live eval is loading — blocks drops to prevent board/engine desync. */
  const liveAnalysisBusyRef = useRef(false);

  const navigate = useNavigate();

  // Oyun değiştiğinde analiz yap veya hoşgeldiniz ekranını ayarla
  useEffect(() => {
    if (game) {
      handleAnalyzePgn();
      setShowWelcomeScreen(false);
    } else if (!isLiveMode) {
      setShowWelcomeScreen(true);
    }
    // Intentionally omit handleAnalyzePgn: only re-run when a new PGN is loaded (`game` reference).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isLiveMode]);

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
        liveGameRef.current = null;
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
      setFen(moveEvaluations[1]?.fen || STANDARD_START_FEN);
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

  // Canlı analiz başlat — engine eval for start position loads before play (avoids wrong mistake math + ref init).
  const startLiveAnalysis = async () => {
    liveAnalysisRequestIdRef.current += 1;
    const sessionId = liveAnalysisRequestIdRef.current;
    setIsLiveMode(true);
    const chess = new Chess();
    liveGameRef.current = chess;
    setFen(chess.fen());
    setAnalysis(null);
    setMoveAnalysis([]);
    setMoveIndex(-1);
    setCustomArrows([]);
    setGame(null);
    setShowWelcomeScreen(false);
    lastLiveEvaluationRef.current = null;
    liveAnalysisBusyRef.current = true;
    setIsLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/analyze",
        { fen: chess.fen() },
        { timeout: 30000 }
      );
      if (sessionId !== liveAnalysisRequestIdRef.current) return;
      lastLiveEvaluationRef.current = res.data.evaluation;
      setAnalysis({
        evaluation: res.data.evaluation,
        bestMove: res.data.bestMove,
        accuracy: "N/A",
        mistakes: [],
      });
    } catch (e) {
      console.error("Live start position analysis failed:", e);
      addNotification("Could not analyze start position — check server.");
      setAnalysis({ error: "Start position analysis failed: " + (e.message || "unknown") });
    } finally {
      if (sessionId === liveAnalysisRequestIdRef.current) {
        liveAnalysisBusyRef.current = false;
        setIsLoading(false);
      }
    }
    addNotification("Live Analysis Started!");
  };

  // Canlı analizi durdur
  const stopLiveAnalysis = () => {
    liveAnalysisRequestIdRef.current += 1;
    setIsLiveMode(false);
    liveGameRef.current = null;
    lastLiveEvaluationRef.current = null;
    liveAnalysisBusyRef.current = false;
    setFen(STANDARD_START_FEN);
    setAnalysis(null);
    setMoveAnalysis([]);
    setMoveIndex(-1);
    setCustomArrows([]);
    setShowWelcomeScreen(true);
    setIsLoading(false);
    addNotification("Live Analysis Stopped!");
  };

  // Canlı modda taş bırakıldığında: chess.js hamlesi (tek kaynak), sonra FEN ile tek /analyze.
  // chess.js v1+ throws Error("Invalid move: ...") for illegal moves — never let it propagate.
  const onPieceDrop = async (sourceSquare, targetSquare) => {
    const game = liveGameRef.current;
    if (!game || !isLiveMode) {
      return false;
    }
    if (liveAnalysisBusyRef.current) {
      return false;
    }

    let move;
    try {
      move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
    } catch {
      addNotification("Illegal move — not allowed.");
      return false;
    }

    if (move === null) {
      addNotification("Illegal move — not allowed.");
      return false;
    }

    const newFen = game.fen();
    setFen(newFen);

    const requestId = ++liveAnalysisRequestIdRef.current;
    liveAnalysisBusyRef.current = true;
    setIsLoading(true);

    const prevEval = lastLiveEvaluationRef.current;
    const moveNumber = game.history().length;

    try {
      const response = await axios.post(
        "http://localhost:5000/analyze",
        { fen: newFen },
        { timeout: 30000 }
      );

      if (requestId !== liveAnalysisRequestIdRef.current) {
        return true;
      }

      if (!response?.data) {
        throw new Error("No response from server.");
      }

      const evaluation = response.data.evaluation;
      const bestMove = response.data.bestMove;
      const previousEvaluation =
        typeof prevEval === "number" ? prevEval : evaluation;
      const scoreDiff = Math.abs(previousEvaluation - evaluation);

      let mistake = null;
      let mistakeColor = null;
      let suggestion = null;

      const bestUci = (bestMove || "").toLowerCase();
      const playedUci = verboseMoveToUci(move).toLowerCase();

      if (scoreDiff > 2) {
        mistake = `Blunder: ${move.san} (Move ${moveNumber})`;
        mistakeColor = "red";
        suggestion =
          move.san === "Qh5" || move.san === "Qb3"
            ? "Avoid bringing out the queen too early; develop minor pieces (e.g., Nf3 or Nc3) first."
            : `This move led to a significant disadvantage. Recommended move: ${bestMove}`;
        addNotification(`Blunder Detected! (${move.san})`);
      } else if (scoreDiff > 1) {
        mistake = `Mistake: ${move.san} (Move ${moveNumber})`;
        mistakeColor = "yellow";
        suggestion = `This move is not optimal. A better move would be: ${bestMove}`;
        addNotification(`Mistake Detected! (${move.san})`);
      } else if (playedUci && bestUci && playedUci === bestUci && scoreDiff < 0.5) {
        mistake = `Excellent Move: ${move.san} (Move ${moveNumber})`;
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

      lastLiveEvaluationRef.current = evaluation;

      setMoveAnalysis((prev) => {
        const next = [...prev, newMove];
        setMoveIndex(next.length - 1);
        setAnalysis({
          evaluation,
          bestMove,
          accuracy: "N/A",
          mistakes: next.filter((m) => m.mistake).map((m) => m.mistake),
        });
        return next;
      });

      if (newMove.mistake && newMove.from && newMove.to) {
        setCustomArrows([
          [newMove.from, newMove.to, newMove.mistakeColor || "red"],
        ]);
      } else {
        setCustomArrows([]);
      }

      return true;
    } catch (error) {
      console.error("Live analysis failed:", error);
      addNotification("Live Analysis Failed! Please check if the server is running.");
      try {
        game.undo();
        setFen(game.fen());
      } catch (undoErr) {
        console.warn("Could not undo after failed analysis:", undoErr);
      }
      return false;
    } finally {
      if (requestId === liveAnalysisRequestIdRef.current) {
        liveAnalysisBusyRef.current = false;
        setIsLoading(false);
      }
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
      setFen(STANDARD_START_FEN);
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

      setFen(fen || STANDARD_START_FEN);
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

  const handleBack = () => {
    if (showWelcomeScreen && !isLiveMode) {
      if (window.history.length > 1) {
        navigate(-1);
      }
      return;
    }
    stopPlayback();
    if (isLiveMode) {
      stopLiveAnalysis();
      return;
    }
    setShowWelcomeScreen(true);
    setGame(null);
    setFen(STANDARD_START_FEN);
    setAnalysis(null);
    setMoveAnalysis([]);
    setMoveIndex(-1);
    setCustomArrows([]);
  };

  return (
    <div className="container-fluid chess-lab-root h-100 d-flex flex-column px-0">
      {/* Hoşgeldiniz ekranı */}
      {showWelcomeScreen && !isLiveMode ? (
        <div className="welcome-screen">
          {typeof window !== "undefined" && window.history.length > 1 && (
            <button
              type="button"
              className="welcome-back-btn"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <IoArrowBack aria-hidden size={22} />
              <span>Back</span>
            </button>
          )}
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

          <header className="lab-header">
            <button
              type="button"
              className="lab-back-btn"
              onClick={handleBack}
              aria-label="Go back"
            >
              <IoArrowBack aria-hidden size={22} />
              <span>Back</span>
            </button>
            <div className="lab-header-title">
              <span className="lab-header-brand">Chess Lab</span>
              <span className="lab-header-sub">
                {isLiveMode ? "Live analysis" : game ? "PGN review" : "Analysis"}
              </span>
            </div>
          </header>

          <div className="lab-main-grid">
            <aside className="lab-sidebar-col">
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
            </aside>

            <main className="lab-board-col">
              <div className="lab-board-wrap">
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
                  isLoading={isLoading}
                />
                {isLoading && (
                  <div className="loading-overlay loading-overlay--board">
                    <ClipLoader color="#7eb8ff" size={40} />
                    <span>
                      {analysisProgress.total > 0
                        ? `Analyzing move ${analysisProgress.current} of ${analysisProgress.total}…`
                        : "Analyzing position…"}
                    </span>
                  </div>
                )}
              </div>
            </main>

            <section className="lab-analysis-col">
              <AnalysisPanel
                analysis={analysis}
                moveIndex={moveIndex}
                moveAnalysis={moveAnalysis}
                handleExplainMistake={handleExplainMistake}
                handleMoveSelect={handleMoveSelect}
                isLoading={isLoading}
                isLiveMode={isLiveMode}
              />
            </section>
          </div>

          <footer className="app-footer">
            <p>Chess Lab | Version 1.0.0 | © 2026</p>
          </footer>
        </>
      )}
    </div>
  );
}

export default ChessLogic;
