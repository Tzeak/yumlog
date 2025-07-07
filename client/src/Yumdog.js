import React, { useEffect, useRef } from "react";

const SPRITE_SRC = "/yumdog_sprite.png";
const FRAME_COLS = 2;
const FRAME_ROWS = 2;
const FRAME_WIDTH = 435; // Updated for 871x871 sprite (2x2 grid)
const FRAME_HEIGHT = 436; // Updated for 871x871 sprite (2x2 grid)
const FRAME_COUNT = 4;
const ANIMATION_SPEED = 200; // ms

function Yumdog({ size = 128 }) {
  const canvasRef = useRef(null);
  const frameIndex = useRef(0);
  const spriteRef = useRef(null);

  useEffect(() => {
    const sprite = new window.Image();
    sprite.src = SPRITE_SRC;
    sprite.onload = () => {
      spriteRef.current = sprite;
      drawFrame();
    };
    function drawFrame() {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      const idx = frameIndex.current;
      const sx = (idx % FRAME_COLS) * FRAME_WIDTH;
      const sy = Math.floor(idx / FRAME_COLS) * FRAME_HEIGHT;
      ctx.drawImage(
        sprite,
        sx,
        sy,
        FRAME_WIDTH,
        FRAME_HEIGHT,
        0,
        0,
        size,
        size
      );
    }
    const interval = setInterval(() => {
      frameIndex.current = (frameIndex.current + 1) % FRAME_COUNT;
      if (spriteRef.current) drawFrame();
    }, ANIMATION_SPEED);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", imageRendering: "pixelated" }}
      aria-label="Animated dog sprite"
    />
  );
}

export default Yumdog;
