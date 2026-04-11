/** UCI string for a chess.js verbose move (matches Stockfish bestmove format, e.g. e2e4, e7e8q). */
export function verboseMoveToUci(move) {
  if (!move || !move.from || !move.to) return "";
  let uci = move.from + move.to;
  if (move.promotion) uci += move.promotion;
  return uci;
}

/** Standard starting position FEN (chess.js default). */
export const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
