import React, { useState, useRef } from "react";

const NORMAL_SRC = "/goldie/goldie_normal.png";
const TONGUE_SRC = "/goldie/goldie_tongue.png";
const ONOMATOPOEIAS = ["Pet", "pat pat", "❤️", "yum", "dog"];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function GoldiePortrait({ size = 68 }) {
  const [showTongue, setShowTongue] = useState(false);
  const timeoutRef = useRef(null);
  const [words, setWords] = useState([]);
  const idRef = useRef(0);

  const triggerTongue = (e) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTongue(true);
    timeoutRef.current = setTimeout(() => {
      setShowTongue(false);
    }, 3000);
    spawnWord(e);
  };

  const spawnWord = (e) => {
    const word = ONOMATOPOEIAS[getRandomInt(0, ONOMATOPOEIAS.length - 1)];
    const id = idRef.current++;
    // Randomize horizontal offset and angle
    const left = getRandomInt(20, size - 40); // px
    const rotate = getRandomInt(-20, 20); // deg (askew)
    const angle = getRandomFloat(-45, 45); // deg (rise direction)
    const distance = 40; // px (rise distance)
    // Calculate dx, dy for the animation
    const dx = Math.sin((angle * Math.PI) / 180) * distance;
    const dy = -Math.cos((angle * Math.PI) / 180) * distance;
    setWords((prev) => [...prev, { id, word, left, rotate, dx, dy }]);
    // Remove after animation (1s)
    setTimeout(() => {
      setWords((prev) => prev.filter((w) => w.id !== id));
    }, 1000);
  };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
      }}
    >
      <img
        src={showTongue ? TONGUE_SRC : NORMAL_SRC}
        alt="Goldie the dog"
        width={size}
        height={size}
        style={{
          display: "block",
          cursor: "pointer",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          userSelect: "none",
        }}
        onMouseEnter={triggerTongue}
        onTouchStart={triggerTongue}
        onClick={triggerTongue}
        draggable={false}
      />
      {words.map(({ id, word, left, rotate, dx, dy }) => (
        <span
          key={id}
          style={{
            position: "absolute",
            left: left,
            top: -10, // start just above the image
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "#764ba2",
            pointerEvents: "none",
            transform: `translate(0px, 0px) scale(1) rotate(${rotate}deg)`,
            opacity: 1,
            animation: `goldie-pop-anim-${id} 1s forwards`,
            textShadow: "0 2px 8px #fff, 0 1px 0 #fff",
            userSelect: "none",
            zIndex: 2,
          }}
        >
          {word}
        </span>
      ))}
      {/* Dynamically generate keyframes for each word */}
      <style>
        {words
          .map(
            ({ id, rotate, dx, dy }) => `
          @keyframes goldie-pop-anim-${id} {
            0% { opacity: 1; transform: translate(0px, 0px) scale(1) rotate(${rotate}deg); }
            80% { opacity: 1; }
            100% { opacity: 0; transform: translate(${dx}px, ${dy}px) scale(1.2) rotate(${
              rotate + 10
            }deg); }
          }
        `
          )
          .join("\n")}
      </style>
    </div>
  );
}

export default GoldiePortrait;
