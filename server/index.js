// Gerekli modülleri dahil ediyoruz.
// Express: Web sunucusu oluşturmak için kullanılır.
// Cors: Farklı kaynaklardan gelen isteklere izin verir.
// Spawn: Stockfish gibi harici bir programı çalıştırmak için kullanılır.
// Path: Dosya yollarını yönetmek için kullanılır.
// Chess.js: Satranç hamlelerini ve FEN formatını işlemek için kullanılır.
const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const { Chess } = require("chess.js");

// Express uygulamasını oluşturuyoruz.
// Bu, web sunucumuzu başlatmamızı sağlar.
const app = express();

// CORS'u etkinleştiriyoruz.
// Bu, farklı domainlerden gelen isteklere izin verir (örneğin, React uygulamasından gelen istekler).
app.use(cors());

// JSON formatındaki istekleri işlemek için middleware ekliyoruz.
// İstek gövdesini JSON olarak ayrıştırır.
app.use(express.json());

// Ana yol ("/") için bir GET endpoint'i tanımlıyoruz.
// Kullanıcı bu yola eriştiğinde bir mesaj gönderir.
app.get("/", (req, res) => {
  res.send("Hello from Chess Lab server!");
});

// "/analyze" yoluna POST isteği için endpoint tanımlıyoruz.
// Bu endpoint, bir FEN pozisyonunu analiz eder.
app.post("/analyze", async (req, res) => {
  // İstek gövdesinden FEN değerini alıyoruz.
  // FEN, satranç tahtasının mevcut durumunu temsil eder.
  const { fen } = req.body;
  
  // Eğer FEN yoksa, hata mesajı döndürüyoruz.
  // 400 kodu, istemci hatasını temsil eder.
  if (!fen) {
    return res.status(400).json({ error: "FEN is required" });
  }

  // FEN string'ini temizliyoruz.
  // Gereksiz boşlukları kaldırır ve birden fazla boşluğu tek bir boşluğa indirger.
  const cleanFen = fen.trim().replace(/\s+/g, " ");

  // FEN'in geçerli olup olmadığını kontrol ediyoruz.
  // Chess.js ile FEN'i yüklüyoruz ve geçerliliğini doğruluyoruz.
  try {
    const chess = new Chess();
    chess.load(cleanFen);
    if (!chess.fen()) {
      return res.status(400).json({ error: "Invalid FEN format" });
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid FEN: " + error.message });
  }

  // FEN analiz edildiğini log'a yazıyoruz.
  // Bu, hata ayıklama için faydalıdır.
  console.log("Analyzing FEN:", cleanFen);

  // Stockfish'in dosya yolunu belirliyoruz.
  // Stockfish.exe dosyasını projenin kök dizininde buluyoruz.
  const stockfishPath = path.join(__dirname, "stockfish.exe");
  console.log("Stockfish path:", stockfishPath); // ✅ Stockfish dosyasının yolunu log'a yazdık

  // Stockfish motorunu başlatıyoruz.
  // spawn fonksiyonu, Stockfish'i bir alt süreç olarak çalıştırır.
  let engine;
  try {
    engine = spawn(stockfishPath);
  } catch (error) {
    console.error("Failed to spawn Stockfish:", error.message);
    return res.status(500).json({ error: "Failed to spawn Stockfish: " + error.message });
  }

  // Stockfish'in çıktısını saklamak için bir değişken oluşturuyoruz.
  let output = "";
  // Yanıtın gönderilip gönderilmediğini takip ediyoruz.
  let responded = false;

  // Stockfish'in standart çıktısını (stdout) dinliyoruz.
  // Stockfish analiz sonuçlarını buradan gönderir.
  engine.stdout.on("data", (data) => {
    console.log("Stockfish stdout:", data.toString()); // ✅ Stockfish'in çıktısını log'a yazdık
    output += data.toString();

    // Eğer Stockfish "bestmove" içeren bir çıktı gönderirse, analizin bittiğini anlarız.
    if (output.includes("bestmove") && !responded) {
      responded = true;
      // Stockfish'e çıkış komutu gönderiyoruz.
      engine.stdin.write("quit\n");
      // Süreci sonlandırıyoruz.
      engine.kill();

      // Çıktıyı satırlara ayırıyoruz.
      const lines = output.split("\n");
      let evaluation = 0;
      let bestMove = "unknown";

      // Çıktı satırlarını döngüyle tarıyoruz.
      for (const line of lines) {
        // "score cp" içeren satırdan pozisyon değerlendirmesini alıyoruz.
        if (line.includes("score cp")) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) {
            evaluation = parseInt(match[1]) / 100; // Değerlendirmeyi centipawn'dan ondalık skora çeviriyoruz.
          }
        }
        // "bestmove" içeren satırdan en iyi hamleyi alıyoruz.
        if (line.includes("bestmove")) {
          const match = line.match(/bestmove (\w+)/);
          if (match) {
            bestMove = match[1];
          }
        }
      }

      // Analiz sonuçlarını istemciye JSON formatında gönderiyoruz.
      return res.json({ evaluation, bestMove });
    }
  });

  // Stockfish'in hata çıktısını (stderr) dinliyoruz.
  // Eğer bir hata varsa, bunu log'a yazdırıyoruz.
  engine.stderr.on("data", (data) => {
    console.error("Stockfish stderr:", data.toString());
  });

  // Stockfish'te bir hata oluşursa bunu yakalıyoruz.
  engine.on("error", (error) => {
    console.error("Stockfish error:", error.message); // ✅ Stockfish hatasını log'a yazdık
    if (!responded) {
      responded = true;
      res.status(500).json({ error: "Stockfish failed to start: " + error.message });
    }
  });

  // Stockfish süreci sona erdiğinde çıkış kodunu log'a yazıyoruz.
  engine.on("exit", (code) => {
    console.log("Stockfish exited with code:", code); // ✅ Stockfish'in çıkış kodunu log'a yazdık
  });

  // Stockfish'e komutlar gönderiyoruz.
  // "uci": Stockfish'i UCI modunda başlatır.
  engine.stdin.write("uci\n");
  // "position fen": FEN pozisyonunu Stockfish'e yüklüyoruz.
  engine.stdin.write(`position fen ${cleanFen}\n`);
  // "go movetime 100": Stockfish'e 100 milisaniye içinde analiz yapmasını söylüyoruz.
  engine.stdin.write("go movetime 100\n");

  // Analizin zaman aşımına uğramaması için bir zamanlayıcı kuruyoruz.
  // Eğer 10 saniye içinde yanıt gelmezse, analizi durduruyoruz.
  setTimeout(() => {
    if (!responded) {
      responded = true;
      engine.stdin.write("quit\n");
      engine.kill();
      res.status(500).json({ error: "Stockfish analysis timed out" });
    }
  }, 10000);
});

// Sunucunun çalışacağı port numarasını belirliyoruz.
const PORT = 5000;
// Sunucuyu başlatıyoruz ve port üzerinde dinlemeye başlıyoruz.
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});