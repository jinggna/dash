// Virtual Canvas Dimensions (Internal logical resolution for crisp scaling)
export const VIRTUAL_WIDTH = 1200;
export const VIRTUAL_HEIGHT = 650;

// Road layout (2 lanes: Upper & Lower)
export const ROAD_TOP = 320;
export const ROAD_BOTTOM = 580;
export const ROAD_HEIGHT = ROAD_BOTTOM - ROAD_TOP; // 260px
export const LANE_HEIGHT = ROAD_HEIGHT / 2; // 130px

// Lane center Y coordinates
export const LANE_Y = [
  ROAD_TOP + LANE_HEIGHT * 0.5, // Upper lane (~385)
  ROAD_TOP + LANE_HEIGHT * 1.5, // Lower lane (~515)
];

// Gameplay Timing & Rules
export const TOTAL_GAME_TIME = 40.0; // 40 seconds time-attack
export const FEVER_DURATION = 5.0; // 5 seconds fever time
export const STUN_DURATION = 0.5; // 0.5s stun on crash
export const NEAR_MISS_POINTS = 1000;
export const CRASH_POINTS = 1000;
export const SMASH_POINTS = 5000;
export const NEAR_MISS_NITRO_GAIN = 30; // +30% nitro on near miss

// Speeds (pixels per second)
export const NORMAL_ROAD_SPEED = 580;
export const FEVER_ROAD_SPEED = 1150;
export const MIN_OBSTACLE_SPACING_X = 460; // Guarantee no unavoidable walls!

// Near-miss distance range (Generous X & Y margins so adjacent lane passes and close dodges register easily)
export const NEAR_MISS_EXPANSION_X = 65;
export const NEAR_MISS_EXPANSION_Y = 75;

// Colors
export const COLORS = {
  playerCyan: '#00F0FF',
  playerMagenta: '#FF007F',
  neonYellow: '#FFE600',
  neonGreen: '#00FF66',
  neonPurple: '#9D00FF',
  neonRed: '#FF2A4D',
  roadDark: '#14121F',
  roadLine: '#00F0FF',
  roadLineGlow: 'rgba(0, 240, 255, 0.4)',
  shadow: 'rgba(8, 5, 20, 0.75)',
};
