import { useEffect } from "react";

const resolvePhotoUrl = (photo, base = "http://127.0.0.1:8000") => {
  if (!photo) return null;
  if (photo.startsWith("http") || photo.startsWith("data:")) return photo;
  return `${base}/${photo.replace(/^\//, "")}`;
};

export default function CustomCursor() {
  useEffect(() => {
    let schoolLogo = null;
    let primaryColor = "#6366f1";
    let animationId = null;
    let root = null;
    let idleTimer = null;
    let isIdle = false;
    let transitionProgress = 0; // 0 = ekor normal, 1 = menyusut di belakang logo
    let lastMousePos = { x: 0, y: 0 };
    let mouseSpeed = 0;

    const isMobile = window.matchMedia("(max-width:768px)").matches;

    // 🎨 PASTEL COLOR PALETTE
    const pastelColors = [
      '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA',
      '#FFDFBA', '#E0BBE4', '#957DAD', '#D291BC',
      '#FEC8D8', '#D4A5A5', '#98D8C8', '#F7DC6F'
    ];

    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/public/settings");
        const data = await res.json();
        schoolLogo = data.schoolLogo || data.logo;
        primaryColor = data.primaryColor || data.themeColor || pastelColors[2];
      } catch {
        const s = JSON.parse(localStorage.getItem("school_settings") || "{}");
        schoolLogo = s.schoolLogo || s.logo;
        primaryColor = s.primaryColor || s.themeColor || pastelColors[2];
      }
      init();
    };

    const init = () => {
      const logo =
        resolvePhotoUrl(schoolLogo) ||
        "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg";

      root = document.createElement("div");
      Object.assign(root.style, {
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 99999,
      });
      document.body.appendChild(root);

      // 🐍 TRAIL DOTS - 10 titik dengan warna pastel
      const TRAIL_COUNT = 10;
      const trailDots = [];
      const trailPositions = Array(TRAIL_COUNT).fill(null).map(() => ({ x: 0, y: 0 }));

      for (let i = 0; i < TRAIL_COUNT; i++) {
        const dot = document.createElement("div");
        const size = 16 - i * 1.1;
        const color = pastelColors[i % pastelColors.length];
        Object.assign(dot.style, {
          position: "fixed",
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: color,
          transform: "translate(-50%, -50%)",
          opacity: isMobile ? 0 : 0.75 - i * 0.06,
          boxShadow: `0 0 ${10 - i}px ${color}70`,
          left: "0px",
          top: "0px",
          pointerEvents: "none",
          willChange: "transform, left, top, opacity",
        });
        root.appendChild(dot);
        trailDots.push(dot);
      }

      // ✨ SPARKLE PARTICLES
      const SPARKLE_COUNT = 6;
      const sparkles = [];
      const sparkleStates = Array(SPARKLE_COUNT).fill(null).map(() => ({
        angle: Math.random() * Math.PI * 2,
        distance: 32 + Math.random() * 20,
        speed: 0.012 + Math.random() * 0.01,
        size: 2.5 + Math.random() * 2,
        opacity: 0,
        targetOpacity: 0.5 + Math.random() * 0.4,
        scale: 0.6 + Math.random() * 0.4,
        color: pastelColors[Math.floor(Math.random() * pastelColors.length)]
      }));

      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const sparkle = document.createElement("div");
        const state = sparkleStates[i];
        Object.assign(sparkle.style, {
          position: "fixed",
          width: `${state.size}px`,
          height: `${state.size}px`,
          borderRadius: "50%",
          background: state.color,
          transform: "translate(-50%, -50%)",
          opacity: "0",
          boxShadow: `0 0 ${6 + i}px ${state.color}`,
          left: "0px",
          top: "0px",
          pointerEvents: "none",
        });
        root.appendChild(sparkle);
        sparkles.push(sparkle);
      }

      // 🔵 RING
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        width: "46px",
        height: "46px",
        borderRadius: "50%",
        border: `2px solid ${primaryColor}`,
        transform: "translate(-50%, -50%)",
        opacity: isMobile ? 0 : 0.55,
        left: "0px",
        top: "0px",
        boxShadow: `0 0 20px ${primaryColor}40`,
        pointerEvents: "none",
        transition: "width 0.25s ease, height 0.25s ease, border-color 0.3s ease",
      });
      root.appendChild(ring);

      // 🏫 LOGO
      const head = document.createElement("img");
      head.src = logo;
      head.crossOrigin = "anonymous";
      Object.assign(head.style, {
        position: "fixed",
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        opacity: isMobile ? 0 : 0.95,
        objectFit: "cover",
        border: `2px solid white`,
        boxShadow: `0 0 15px ${primaryColor}60, 0 2px 8px rgba(0,0,0,0.1)`,
        background: "white",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        transition: "transform 0.2s ease-out",
      });
      root.appendChild(head);

      // 🔴 DOT utama
      const dot = document.createElement("div");
      Object.assign(dot.style, {
        position: "fixed",
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: primaryColor,
        transform: "translate(-50%, -50%)",
        opacity: isMobile ? 0 : 1,
        left: "0px",
        top: "0px",
        boxShadow: `0 0 10px ${primaryColor}`,
        zIndex: 2,
        pointerEvents: "none",
      });
      root.appendChild(dot);

      // 📍 Posisi
      const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const ringPos = { x: mouse.x, y: mouse.y };
      const headPos = { x: mouse.x, y: mouse.y };
      const history = [];
      const HISTORY_LENGTH = 12; // ✨ DIPERPENDEK: ekor lebih rapat

      let isHovering = false;
      let rotationAngle = 0;
      
      const IDLE_DELAY = 300; // ms sebelum mulai transisi ke idle
      const TRANSITION_SPEED = 0.08; // Kecepatan transisi (lebih cepat biar smooth)
      const IDLE_ROTATION_SPEED = 0.025;

      // ===================
      // 📱 MOBILE
      // ===================
      if (isMobile) {
        let hideTimeout;
        const tap = (e) => {
          const t = e.touches[0];
          if (!t) return;
          const x = t.clientX;
          const y = t.clientY;
          [dot, ring, head, ...trailDots].forEach((el) => {
            el.style.opacity = "1";
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
          });
          clearTimeout(hideTimeout);
          hideTimeout = setTimeout(() => {
            [dot, ring, head, ...trailDots].forEach((el) => {
              el.style.opacity = "0.6";
            });
          }, 1500);
        };
        window.addEventListener("touchstart", tap);
        window.addEventListener("touchmove", tap);
        return () => {
          window.removeEventListener("touchstart", tap);
          window.removeEventListener("touchmove", tap);
          if (root && document.body.contains(root)) document.body.removeChild(root);
        };
      }

      // ===================
      // 🖥️ DESKTOP
      // ===================
      const move = (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        const dx = mouse.x - lastMousePos.x;
        const dy = mouse.y - lastMousePos.y;
        mouseSpeed = Math.sqrt(dx * dx + dy * dy);
        lastMousePos = { x: mouse.x, y: mouse.y };

        if (isIdle) {
          isIdle = false;
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          isIdle = true;
        }, IDLE_DELAY);

        history.unshift({ x: mouse.x, y: mouse.y });
        if (history.length > HISTORY_LENGTH) history.pop();
      };

      const handleMouseOver = (e) => {
        const target = e.target;
        if (
          target.tagName === "A" ||
          target.tagName === "BUTTON" ||
          target.closest("a") ||
          target.closest("button") ||
          target.style.cursor === "pointer" ||
          getComputedStyle(target).cursor === "pointer"
        ) {
          isHovering = true;
          ring.style.width = "70px";
          ring.style.height = "70px";
          ring.style.opacity = "0.85";
          ring.style.borderColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
          head.style.transform = "translate(-50%, -50%) scale(1.35) rotate(18deg)";
        }
      };

      const handleMouseOut = () => {
        isHovering = false;
        ring.style.width = "46px";
        ring.style.height = "46px";
        ring.style.opacity = "0.55";
        ring.style.borderColor = primaryColor;
        head.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
      };

      window.addEventListener("mousemove", move);
      document.addEventListener("mouseover", handleMouseOver);
      document.addEventListener("mouseout", handleMouseOut);

      // 🎬 ANIMATION LOOP
      const animate = () => {
        dot.style.left = `${mouse.x}px`;
        dot.style.top = `${mouse.y}px`;

        headPos.x += (mouse.x - headPos.x) * 0.28;
        headPos.y += (mouse.y - headPos.y) * 0.28;
        head.style.left = `${headPos.x}px`;
        head.style.top = `${headPos.y}px`;

        ringPos.x += (mouse.x - ringPos.x) * 0.16;
        ringPos.y += (mouse.y - ringPos.y) * 0.16;
        ring.style.left = `${ringPos.x}px`;
        ring.style.top = `${ringPos.y}px`;

        // ✨ SPARKLE
        sparkles.forEach((sparkle, i) => {
          const state = sparkleStates[i];
          state.angle += state.speed;
          if (Math.random() < 0.02) {
            state.targetOpacity = 0.4 + Math.random() * 0.5;
          }
          state.opacity += (state.targetOpacity - state.opacity) * 0.04;
          const orbitX = headPos.x + Math.cos(state.angle) * state.distance;
          const orbitY = headPos.y + Math.sin(state.angle) * state.distance;
          sparkle.style.left = `${orbitX}px`;
          sparkle.style.top = `${orbitY}px`;
          sparkle.style.opacity = state.opacity * (isIdle ? 1 : 0.5);
          sparkle.style.transform = `translate(-50%, -50%) scale(${state.scale})`;
        });

        // 🔄 TRANSISI PROGRESS
        // Saat idle: naik ke 1 (ekor menyusut di belakang logo)
        // Saat bergerak: turun ke 0 (ekor normal)
        if (isIdle && !isHovering) {
          transitionProgress = Math.min(1, transitionProgress + TRANSITION_SPEED);
        } else {
          transitionProgress = Math.max(0, transitionProgress - TRANSITION_SPEED * 2);
        }

        // 🐍 TRAIL ULAR dengan transisi smooth ke "menyusut di belakang logo"
        for (let i = 0; i < TRAIL_COUNT; i++) {
          // Posisi ekor normal (dari history) - lebih rapat
          const historyIndex = Math.min((i + 1) * 1, history.length - 1);
          const tailPos = history[historyIndex] || { x: mouse.x, y: mouse.y };

          // Posisi "menyusut di belakang logo" - titik kecil berputar di belakang logo
          // Semua dot berkumpul di belakang logo dengan radius sangat kecil
          const shrinkRadius = 4 + i * 1.5; // Radius sangat kecil (4-18px)
          const angle = rotationAngle + (i * 0.628); // 2π/10 = 0.628 rad spacing
          const shrinkPos = {
            x: headPos.x + Math.cos(angle) * shrinkRadius,
            y: headPos.y + Math.sin(angle) * shrinkRadius
          };

          // Blend antara ekor normal dan posisi menyusut
          const targetX = tailPos.x + (shrinkPos.x - tailPos.x) * transitionProgress;
          const targetY = tailPos.y + (shrinkPos.y - tailPos.y) * transitionProgress;

          // Smooth interpolation ke target
          trailPositions[i].x += (targetX - trailPositions[i].x) * 0.25;
          trailPositions[i].y += (targetY - trailPositions[i].y) * 0.25;

          trailDots[i].style.left = `${trailPositions[i].x}px`;
          trailDots[i].style.top = `${trailPositions[i].y}px`;

          // ✨ Scale & Opacity Effect
          // Saat idle: mengecil + fade out
          // Saat bergerak: normal size + opacity normal
          const normalScale = 1 + Math.min(mouseSpeed * 0.015, 0.3);
          const idleScale = 0.3 - i * 0.015; // Semakin ke belakang semakin kecil saat idle
          const finalScale = normalScale + (idleScale - normalScale) * transitionProgress;

          const normalOpacity = 0.75 - i * 0.06;
          const idleOpacity = 0; // ✨ Hilang saat idle
          const finalOpacity = normalOpacity + (idleOpacity - normalOpacity) * transitionProgress;

          trailDots[i].style.transform = `translate(-50%, -50%) scale(${finalScale})`;
          trailDots[i].style.opacity = finalOpacity;
        }

        // 🎡 ROTASI IDLE - kecepatan sedang
        if (isIdle && !isHovering) {
          rotationAngle -= IDLE_ROTATION_SPEED; // Counter-clockwise
          const gentleWobble = Math.sin(rotationAngle) * 8;
          head.style.transform = `translate(-50%, -50%) rotate(${gentleWobble}deg) scale(1.05)`;
        } else {
          rotationAngle -= IDLE_ROTATION_SPEED * 0.1;
        }

        animationId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener("mousemove", move);
        document.removeEventListener("mouseover", handleMouseOver);
        document.removeEventListener("mouseout", handleMouseOut);
        clearTimeout(idleTimer);
        if (animationId) cancelAnimationFrame(animationId);
        if (root && document.body.contains(root)) {
          document.body.removeChild(root);
        }
      };
    };

    load();
  }, []);

  return null;
}