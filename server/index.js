const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Chess Lab server!");
});

app.post("/analyze", async (req, res) => {
  const { fen } = req.body;
  if (!fen) {
    return res.status(400).json({ error: "FEN is required" });
  }

  const stockfishPath = path.join(__dirname, "stockfish.exe");
  const engine = spawn(stockfishPath);

  let output = "";
  let responded = false;

  engine.stdout.on("data", (data) => {
    output += data.toString();
    if (output.includes("bestmove") && !responded) {
      responded = true;
      engine.stdin.write("quit\n");
      engine.kill();

      const lines = output.split("\n");
      let evaluation = 0;
      let bestMove = "unknown";

      for (const line of lines) {
        if (line.includes("score cp")) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) {
            evaluation = parseInt(match[1]) / 100;
          }
        }
        if (line.includes("bestmove")) {
          const match = line.match(/bestmove (\w+)/);
          if (match) {
            bestMove = match[1];
          }
        }
      }

      return res.json({ evaluation, bestMove });
    }
  });

  engine.stderr.on("data", (data) => {
    console.error("Stockfish stderr:", data.toString());
  });

  engine.on("error", (error) => {
    if (!responded) {
      responded = true;
      res.status(500).json({ error: "Stockfish failed to start: " + error.message });
    }
  });

  engine.stdin.write("uci\n");
  engine.stdin.write(`position fen ${fen}\n`);
  engine.stdin.write("go movetime 100\n");

  setTimeout(() => {
    if (!responded) {
      responded = true;
      engine.stdin.write("quit\n");
      engine.kill();
      res.status(500).json({ error: "Stockfish analysis timed out" });
    }
  }, 10000);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
