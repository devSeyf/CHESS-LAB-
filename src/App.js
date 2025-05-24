// App.js
import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import "./App.css";
import ChessLogic from "./ChessLogic";
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("username"));
const [fen, setFen] = useState("rnbqkbnr/pppppppp/5n1b/8/8/5N1B/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [analysis, setAnalysis] = useState(null);
  const [game, setGame] = useState(null);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [moveAnalysis, setMoveAnalysis] = useState([]);
  const [customArrows, setCustomArrows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
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
