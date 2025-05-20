import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import axios from "axios";
import { Chess } from "chess.js";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("username")
  );

  const [fen, setFen] = useState("start");
  const [analysis, setAnalysis] = useState(null);
  const [game, setGame] = useState(null);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [moveAnalysis, setMoveAnalysis] = useState([]);
  const [customArrows, setCustomArrows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("tahta");
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
      setMoveIndex(1); // ilk hamleye geç
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

  const last = userData[userData.length - 1]; // son analiz
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
      explanation = "Tebrikler! Bu çok doğru ve etkili bir hamle.";
    }

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

  const chartData = {
    labels: moveAnalysis.map((_, index) =>
      index === 0 ? "Start" : `Move ${index}`
    ),
    datasets: [
      {
        label: "Evaluation",
        data: moveAnalysis.map((move) => move.evaluation),
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: false,
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Evaluation Over Game" },
    },
    scales: {
      y: {
        title: { display: true, text: "Evaluation" },
        suggestedMin: -2,
        suggestedMax: 2,
      },
      x: { title: { display: true, text: "Move" } },
    },
  };

  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <h2>Satranç Lab'a Hoş Geldin!</h2>
        <input
          type="text"
          placeholder="Adınızı giriniz..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={() => {
            if (username.trim()) {
              localStorage.setItem("username", username.trim());
              setIsLoggedIn(true);
            }
          }}
        >
          Giriş Yap
        </button>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <div className="card">
        <header className="header">
          <span className="logo">♟️</span>
          <h1>Chess Lab</h1>
          <p className="subtitle">Satranç analizine hoş geldiniz!</p>
        </header>
        <p>
          👤 Kullanıcı: <strong>{username}</strong>
        </p>

        {isLoading && (
          <div className="loading">
            <p>Analiz ediliyor... Lütfen bekleyin</p>
          </div>
        )}

        <div className="tabs">
          <button
            className={activeTab === "grafik" ? "tab active" : "tab"}
            onClick={() => setActiveTab("grafik")}
          >
            📈 Grafik
          </button>
          <button
            className={activeTab === "analiz" ? "tab active" : "tab"}
            onClick={() => setActiveTab("analiz")}
          >
            📋 Analiz
          </button>
        </div>

        <div className="main-content">
          {activeTab === "grafik" && moveAnalysis.length > 0 && (
            <div className="board-container">
              <div className="chart-section">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          )}

          {activeTab === "analiz" && (
            <div className="sidebar">
              {/* ♟️ Tahta */}
              <div
                className="board-section"
                style={{
                  border: "2px solid #ddd",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <Chessboard
                  position={fen}
                  customArrows={customArrows}
                  className="chess-board"
                />
              </div>

              {/* 🎯 FEN Analiz */}
              <div className="input-group">
                <input
                  type="text"
                  value={fen}
                  onChange={(e) => setFen(e.target.value)}
                  placeholder="FEN konumu giriniz..."
                />
                <button onClick={handleAnalyzeFen} disabled={isLoading}>
                  Analiz Et (FEN)
                </button>
              </div>

              {/* 📂 PGN Dosyası */}
              <div className="input-group">
                <label htmlFor="pgn-upload">PGN Dosyası Yükle:</label>
                <div className="file-input-group">
                  <input
                    type="file"
                    id="pgn-upload"
                    accept=".pgn"
                    onChange={handlePgnUpload}
                  />
                  <button
                    onClick={handleAnalyzePgn}
                    disabled={!game || isLoading}
                  >
                    Analiz Et (PGN)
                  </button>
                </div>
              </div>

              {/* 🔄 Navigasyon */}
              <div className="input-group navigation-buttons">
                <button onClick={handlePrevMove} disabled={moveIndex === -1}>
                  ◀️ Önceki Hamle
                </button>
                <button
                  onClick={handleNextMove}
                  disabled={moveIndex === moveAnalysis.length - 1}
                >
                  Sonraki Hamle ▶️
                </button>
              </div>

              {/* 💡 İpucu */}
              <p className="hint">
                Örnek:{" "}
                <code>
                  rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
                </code>
              </p>

              {/* 📋 Analiz Sonuçları */}
              {analysis && (
                <div className="analysis-result">
                  <h3>Analiz Sonuçları:</h3>
                  {analysis.error ? (
                    <p className="error">{analysis.error}</p>
                  ) : (
                    <ul>
                      <li>
                        <strong>Değerlendirme:</strong> {analysis.evaluation}
                      </li>
                      <li>
                        <strong>En İyi Hamle:</strong> {analysis.bestMove}
                      </li>
                      <li>
                        <strong>Doğruluk:</strong> {analysis.accuracy}
                      </li>
                      <li>
                        <strong>Hatalar:</strong>{" "}
                        {analysis.mistakes.length
                          ? analysis.mistakes.join(", ")
                          : "Yok"}
                      </li>

                      {moveIndex >= 0 && moveAnalysis[moveIndex] && (
                        <div className="current-move-info">
                          <p>
                            <strong>Hamle:</strong>{" "}
                            {moveAnalysis[moveIndex].move} ({moveIndex}. hamle)
                          </p>

                          {moveAnalysis[moveIndex].mistake && (
                            <>
                              <p>
                                <strong>Analiz:</strong>{" "}
                                {moveAnalysis[moveIndex].mistake}
                              </p>
                              <p>
                                <strong>Öneri:</strong>{" "}
                                {moveAnalysis[moveIndex].suggestion}
                              </p>
                              <button
                                onClick={() =>
                                  handleExplainMistake(moveAnalysis[moveIndex])
                                }
                                className="learn-button"
                              >
                                Öğren
                              </button>
                              <div className="eval-bar-wrapper">
                                <div
                                  className="eval-bar"
                                  style={{
                                    width: `${Math.min(
                                      Math.abs(
                                        moveAnalysis[moveIndex].evaluation
                                      ) * 50,
                                      100
                                    )}%`,
                                    backgroundColor:
                                      moveAnalysis[moveIndex].mistakeColor ===
                                      "red"
                                        ? "#ef5350"
                                        : moveAnalysis[moveIndex]
                                            .mistakeColor === "yellow"
                                        ? "#ffeb3b"
                                        : "#81c784",
                                  }}
                                ></div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {/* 💾 Ekstra */}
              <button onClick={handleLoadLastAnalysis}>
                Son Analizi Yükle
              </button>
              <button onClick={handleLoadSavedAnalyses}>Kayıtlı Analizleri Göster</button>

              {moveAnalysis.length > 0 && (
                <button onClick={handleDownloadAnalysis}>
                  Analizi İndir (JSON)
                </button>
              )}
              <button
                onClick={() => {
                  localStorage.removeItem("username");
                  setUsername("");
                  setIsLoggedIn(false);
                }}
              >
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
