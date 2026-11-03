import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { GameState, GameStats } from './game/types';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, TOTAL_GAME_TIME } from './game/constants';
import { soundEngine } from './game/audio';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Trophy,
  Flame,
  Zap,
  ShieldAlert,
  Sparkles,
  Info,
  Home,
} from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  const [gameState, setGameState] = useState<GameState>('READY');
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    timeRemaining: TOTAL_GAME_TIME,
    totalTime: TOTAL_GAME_TIME,
    nitro: 0,
    isFever: false,
    feverTimeLeft: 0,
    combo: 0,
    maxCombo: 0,
    nearMissCount: 0,
    crashCount: 0,
    smashCount: 0,
    highScore: 0,
    currentSpeed: 580,
  });

  const [isMuted, setIsMuted] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Initialize Game on Mount
  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current, {
      onStateChange: (newState) => setGameState(newState),
      onStatsChange: (newStats) => setStats(newStats),
    });

    gameRef.current = game;

    return () => {
      game.destroy();
    };
  }, []);

  const handleStart = () => {
    gameRef.current?.start();
  };

  const handleResume = () => {
    gameRef.current?.resume();
  };

  const handlePause = () => {
    gameRef.current?.pause();
  };

  const handleRestart = () => {
    gameRef.current?.restart();
  };

  const handleHome = () => {
    gameRef.current?.ready();
  };

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const lastTouchRef = useRef<number>(0);

  const handleLaneUp = () => {
    gameRef.current?.switchLane('UP');
  };

  const handleLaneDown = () => {
    gameRef.current?.switchLane('DOWN');
  };

  const handleTouchLaneUp = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      e.preventDefault();
      lastTouchRef.current = Date.now();
      handleLaneUp();
    } else {
      if (Date.now() - lastTouchRef.current < 400) return;
      handleLaneUp();
    }
  };

  const handleTouchLaneDown = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      e.preventDefault();
      lastTouchRef.current = Date.now();
      handleLaneDown();
    } else {
      if (Date.now() - lastTouchRef.current < 400) return;
      handleLaneDown();
    }
  };

  // Rank determination based on final score
  const getRankBadge = (score: number) => {
    if (score >= 45000) return { rank: 'SSS', label: '신급 드라이버', color: 'from-amber-300 via-rose-400 to-cyan-400' };
    if (score >= 32000) return { rank: 'SS', label: '전설의 레이서', color: 'from-yellow-400 to-amber-500' };
    if (score >= 22000) return { rank: 'S', label: '슈퍼 스피드스터', color: 'from-cyan-400 to-blue-500' };
    if (score >= 14000) return { rank: 'A', label: '베테랑 라이더', color: 'from-emerald-400 to-teal-500' };
    if (score >= 7000) return { rank: 'B', label: '스트리트 루키', color: 'from-indigo-400 to-purple-500' };
    return { rank: 'C', label: '초보 운전자', color: 'from-slate-400 to-gray-500' };
  };

  const rankInfo = getRankBadge(stats.score);

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] bg-[#070512] flex flex-col items-center justify-start p-2 sm:p-3 md:p-4 overflow-hidden font-jua select-none text-white">
      {/* Background Neon Grid Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(65,22,120,0.35),transparent_70%)] pointer-events-none" />

      {/* TOP HEADER CONTROLS BAR (Dedicated layout with generous spacing from canvas) */}
      <header className="relative w-full max-w-6xl shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0e0a22]/90 backdrop-blur-md border border-indigo-900/60 rounded-xl sm:rounded-2xl shadow-xl z-30 mb-2 sm:mb-3">
        {/* Left: Game Title Badge & High Score */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl bg-cyan-500/15 border border-cyan-400/30 shadow-[0_0_12px_rgba(0,240,255,0.25)] shrink-0">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 animate-pulse" />
            <span className="text-xs sm:text-sm font-black text-cyan-300 tracking-wider font-orbitron">
              NITRO DASH
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl bg-yellow-500/10 text-yellow-300 border border-yellow-400/25 shrink-0">
            <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400" />
            <span className="hidden sm:inline text-slate-300">최고:</span>
            <strong className="font-orbitron font-bold text-yellow-300">{stats.highScore.toLocaleString()}</strong>
            <span className="hidden xs:inline">점</span>
          </div>
        </div>

        {/* Center: Controls Shortcut Info (Desktop only) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
          <span className="bg-slate-900/70 px-2.5 py-1 rounded-lg border border-slate-800">
            조작: <strong className="text-cyan-300">↑ / ↓</strong> 키 (차선 변경)
          </span>
          <span className="bg-slate-900/70 px-2.5 py-1 rounded-lg border border-slate-800">
            일시정지: <strong className="text-yellow-300">Enter</strong>
          </span>
        </div>

        {/* Right: Action Buttons (Pause, Help, Sound) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {gameState === 'PLAYING' && (
            <button
              onClick={handlePause}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition cursor-pointer"
              title="게임 일시정지"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">일시정지</span>
            </button>
          )}

          {gameState === 'PAUSED' && (
            <button
              onClick={handleResume}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-bold border border-cyan-400 transition cursor-pointer"
              title="게임 재개"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>계속하기</span>
            </button>
          )}

          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/80 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
            title="게임 방법 및 룰 안내"
          >
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">규칙</span>
          </button>

          <button
            onClick={handleToggleMute}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/80 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline text-rose-400">음소거</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline text-cyan-400">사운드</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Game Screen Wrapper (Preserves exact 1200:650 aspect ratio and prevents any layout break) */}
      <div className="relative w-full max-w-6xl flex-1 flex items-center justify-center min-h-0 min-w-0">
        <div className="relative w-full aspect-[1200/650] max-h-full max-w-full flex items-center justify-center rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-900/60 bg-[#090518]">
          {/* Canvas Element */}
          <canvas
            ref={canvasRef}
            width={VIRTUAL_WIDTH}
            height={VIRTUAL_HEIGHT}
            className="w-full h-full object-fill block"
          />

          {/* START SCREEN OVERLAY */}
          {gameState === 'READY' && (
            <div className="absolute inset-0 bg-[#090616]/92 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 z-20 overflow-y-auto max-h-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 mb-1 sm:mb-2 shrink-0">
                <Flame className="w-5 h-5 sm:w-7 sm:h-7 text-rose-500 animate-pulse" />
                <span className="text-xs sm:text-sm tracking-widest text-cyan-400 uppercase font-orbitron">
                  Cyberpunk Time-Attack
                </span>
                <Flame className="w-5 h-5 sm:w-7 sm:h-7 text-rose-500 animate-pulse" />
              </div>

              <h1 className="text-3xl sm:text-6xl font-black tracking-tight mb-1 sm:mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-yellow-300 to-rose-500 drop-shadow-[0_4px_12px_rgba(0,240,255,0.4)] shrink-0">
                니트로 대시
              </h1>
              <p className="text-slate-300 text-xs sm:text-base mb-4 sm:mb-6 text-center max-w-md shrink-0">
                네온 도시를 40초 동안 질주하는 극한의 아케이드 레이싱!
              </p>

              {/* Core Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 max-w-2xl w-full mb-4 sm:mb-6 shrink-0">
                <div className="bg-slate-900/80 border border-cyan-500/30 p-2.5 sm:p-3.5 rounded-xl flex flex-col items-center text-center">
                  <Sparkles className="w-5 h-5 text-cyan-400 mb-1" />
                  <div className="text-cyan-300 font-bold text-xs sm:text-sm">스침 (Near-miss)</div>
                  <div className="text-slate-400 text-[11px] sm:text-xs mt-0.5">
                    옆 차선 질주 통과 시 +1,000점 & 니트로 충전!
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-rose-500/30 p-2.5 sm:p-3.5 rounded-xl flex flex-col items-center text-center">
                  <ShieldAlert className="w-5 h-5 text-rose-400 mb-1" />
                  <div className="text-rose-300 font-bold text-xs sm:text-sm">충돌 (Crash)</div>
                  <div className="text-slate-400 text-[11px] sm:text-xs mt-0.5">
                    충돌 시 -1,000점 감점, 니트로 감소 & 0.5초 스턴!
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-yellow-500/30 p-2.5 sm:p-3.5 rounded-xl flex flex-col items-center text-center">
                  <Zap className="w-5 h-5 text-yellow-400 mb-1" />
                  <div className="text-yellow-300 font-bold text-xs sm:text-sm">무적 대시 (Fever)</div>
                  <div className="text-slate-400 text-[11px] sm:text-xs mt-0.5">
                    니트로 100% 충전 시 5초간 무적 & 파괴 +5,000점!
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                className="group relative px-8 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-lg sm:text-2xl shadow-[0_0_25px_rgba(0,240,255,0.5)] hover:shadow-[0_0_35px_rgba(0,240,255,0.8)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 sm:gap-3 shrink-0"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
                <span>질주 시작 (START)</span>
                <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-black/30 border border-white/20 font-sans ml-1">
                  [Enter]
                </span>
              </button>

              <div className="text-slate-400 text-[11px] sm:text-xs mt-3 sm:mt-4 flex items-center gap-2 sm:gap-4 shrink-0">
                <span>방향키: 위(↑), 아래(↓)</span>
                <span>•</span>
                <span>일시정지: Enter</span>
              </div>
            </div>
          )}

          {/* PAUSE OVERLAY */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 bg-[#090616]/92 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 z-20">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-yellow-300 mb-2 drop-shadow-[0_0_20px_rgba(255,230,0,0.5)]">
                일시정지 (PAUSED)
              </h2>
              <p className="text-slate-300 text-xs sm:text-base mb-6 text-center">
                잠시 호흡을 가다듬고 다시 속도를 올리세요.
              </p>

              <div className="flex gap-3 sm:gap-4">
                <button
                  onClick={handleResume}
                  className="px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base sm:text-xl shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                  <span>계속하기</span>
                </button>

                <button
                  onClick={handleRestart}
                  className="px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm sm:text-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>처음부터</span>
                </button>
              </div>
            </div>
          )}

          {/* GAME OVER OVERLAY */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-[#070414]/94 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 z-20 overflow-y-auto max-h-full animate-in fade-in zoom-in-95 duration-200">
              <div className="text-rose-400 text-xs sm:text-sm tracking-widest uppercase font-orbitron mb-0.5 shrink-0">
                TIME ATTACK FINISHED
              </div>
              <h2 className="text-2xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-rose-400 to-cyan-300 mb-1 sm:mb-2 shrink-0">
                최종 레이스 결과
              </h2>

              {/* Rank & Score Box */}
              <div className="flex flex-col items-center mb-3 sm:mb-5 shrink-0">
                <div
                  className={`text-5xl sm:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${rankInfo.color} drop-shadow-[0_0_25px_rgba(255,230,0,0.6)] font-orbitron`}
                >
                  {rankInfo.rank}
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-300 px-3 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 mt-1">
                  {rankInfo.label}
                </div>
                <div className="text-2xl sm:text-4xl font-black text-yellow-300 mt-2 font-orbitron">
                  {stats.score.toLocaleString()} <span className="text-base text-slate-300 font-jua">점</span>
                </div>
                {stats.score >= stats.highScore && stats.score > 0 && (
                  <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 mt-1 animate-pulse">
                    🏆 최고 신기록 달성!
                  </span>
                )}
              </div>

              {/* Detailed Stats Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 max-w-xl w-full mb-4 sm:mb-6 shrink-0">
                <div className="bg-slate-900/80 border border-cyan-500/30 p-2 sm:p-2.5 rounded-xl text-center">
                  <div className="text-[11px] sm:text-xs text-slate-400">아슬아슬 스침</div>
                  <div className="text-base sm:text-xl font-bold text-cyan-300 mt-0.5">{stats.nearMissCount}회</div>
                </div>
                <div className="bg-slate-900/80 border border-yellow-500/30 p-2 sm:p-2.5 rounded-xl text-center">
                  <div className="text-[11px] sm:text-xs text-slate-400">피버 장애물 격파</div>
                  <div className="text-base sm:text-xl font-bold text-yellow-300 mt-0.5">{stats.smashCount}회</div>
                </div>
                <div className="bg-slate-900/80 border border-rose-500/30 p-2 sm:p-2.5 rounded-xl text-center">
                  <div className="text-[11px] sm:text-xs text-slate-400">충돌 횟수</div>
                  <div className="text-base sm:text-xl font-bold text-rose-400 mt-0.5">{stats.crashCount}회</div>
                </div>
                <div className="bg-slate-900/80 border border-purple-500/30 p-2 sm:p-2.5 rounded-xl text-center">
                  <div className="text-[11px] sm:text-xs text-slate-400">최대 콤보</div>
                  <div className="text-base sm:text-xl font-bold text-purple-300 mt-0.5">{stats.maxCombo}연속</div>
                </div>
              </div>

              {/* Action Buttons: Restart & Home */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3.5 shrink-0 mt-1">
                <button
                  onClick={handleRestart}
                  className="px-7 sm:px-9 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-base sm:text-xl shadow-[0_0_25px_rgba(0,240,255,0.6)] hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>다시 질주하기 [Enter]</span>
                </button>

                <button
                  onClick={handleHome}
                  className="px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600 text-slate-200 font-extrabold text-base sm:text-xl hover:text-white shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  <span>처음 화면으로 [Esc]</span>
                </button>
              </div>
            </div>
          )}

          {/* MOBILE / ON-SCREEN TOUCH CONTROLS (Enlarged for thumb ergonomics & zero-latency touch) */}
          {gameState === 'PLAYING' && (
            <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 flex flex-col gap-2.5 sm:gap-3 z-20">
              <button
                onTouchStart={handleTouchLaneUp}
                onClick={handleTouchLaneUp}
                className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-slate-950/85 hover:bg-slate-900 active:bg-cyan-950/80 border-2 border-cyan-400/80 active:border-cyan-300 flex flex-col items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.35)] active:shadow-[0_0_30px_rgba(0,240,255,0.7)] cursor-pointer active:scale-90 transition transform duration-75 backdrop-blur-md select-none touch-none"
                aria-label="상단 차선 이동 (UP)"
              >
                <ChevronUp className="w-9 h-9 sm:w-11 sm:h-11 stroke-[3.5]" />
                <span className="text-[10px] font-extrabold text-cyan-300/80 -mt-1 tracking-widest">위</span>
              </button>
              <button
                onTouchStart={handleTouchLaneDown}
                onClick={handleTouchLaneDown}
                className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-slate-950/85 hover:bg-slate-900 active:bg-cyan-950/80 border-2 border-cyan-400/80 active:border-cyan-300 flex flex-col items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.35)] active:shadow-[0_0_30px_rgba(0,240,255,0.7)] cursor-pointer active:scale-90 transition transform duration-75 backdrop-blur-md select-none touch-none"
                aria-label="하단 차선 이동 (DOWN)"
              >
                <ChevronDown className="w-9 h-9 sm:w-11 sm:h-11 stroke-[3.5]" />
                <span className="text-[10px] font-extrabold text-cyan-300/80 -mt-1 tracking-widest">아래</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* HELP / RULES MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#120e24] border border-cyan-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 text-white shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-3 sm:mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
              니트로 대시 규칙 안내
            </h3>

            <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <span className="font-bold text-cyan-300">⏱️ 플레이 타임 (40초)</span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                  총 40초 동안 최대한 많은 점수를 획득하는 타임어택입니다.
                </p>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <span className="font-bold text-yellow-300">⚡ 아슬아슬 스침 (Near-miss)</span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                  장애물 옆 차선으로 아슬아슬하게 스쳐 질주하거나 회피하면 <b>+1,000점</b>과 함께 니트로 게이지가 대폭(+30%) 충전됩니다.
                </p>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <span className="font-bold text-rose-400">💥 정면 충돌 (Crash)</span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                  장애물과 충돌 시 <b>-1,000점</b> 차감, 니트로 대폭 감소, 직전 스침 점수가 무효화되며 차체가 0.5초 동안 제자리 스턴 상태가 됩니다. (충돌 시 점수 획득 원천 차단)
                </p>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <span className="font-bold text-emerald-400">🔥 무적 대시 (Fever Time)</span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                  스침으로 니트로를 100% 충전하면 5초간 무적 대시 발동! 속도가 2배로 폭증하며 부딪힌 장애물을 박살내고 <b>+5,000점</b>을 얻습니다.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="mt-4 sm:mt-6 w-full py-2.5 sm:py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm sm:text-base transition cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
