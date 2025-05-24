// App.js
import React, { useState } from "react";
import { Chessboard } from "react-chessboard"; // Satranç tahtası bileşeni
import "./App.css";
import ChessLogic from "./ChessLogic"; // Satranç mantığını yöneten bileşen
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  // Kullanıcı adı state'i, localStorage'dan yükleniyor
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  // Giriş durumu (true/false)
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("username"));
  
  // Satranç tahtasının FEN durumu (başlangıç pozisyonu örnek olarak)
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/5n1b/8/8/5N1B/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  
  // Analiz verisi (null veya analiz objesi)
  const [analysis, setAnalysis] = useState(null);
  
  // Oyun durumu objesi
  const [game, setGame] = useState(null);
  
  // Mevcut hamlenin indeksi (seçili hamle)
  const [moveIndex, setMoveIndex] = useState(-1);
  
  // Hamle analizlerinin listesi
  const [moveAnalysis, setMoveAnalysis] = useState([]);
  
  // Özel oklar (örneğin tahtada gösterilen oklar)
  const [customArrows, setCustomArrows] = useState([]);
  
  // Yükleniyor durumu (örneğin analiz yapılırken)
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      {/* ChessLogic bileşeni, oyunun mantığını ve analizini yönetir */}
      <ChessLogic
        fen={fen}
        setFen={setFen}
        analysis={analysis}
        setAnalysis={setAnalysis}
        game={game}
        setGame={setGame}
        moveIndex={moveIndex}
        setMoveIndex={setMoveIndex}
        moveAnalysis={moveAnalysis}
        setMoveAnalysis={setMoveAnalysis}
        customArrows={customArrows}
        setCustomArrows={setCustomArrows}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        username={username}
        setUsername={setUsername}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
      />
    </div>
  );
}

export default App;
