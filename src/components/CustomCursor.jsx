import { useEffect } from "react";

const resolvePhotoUrl = (photo, fallbackBase = "http://127.0.0.1:8000") => {
  if (!photo || typeof photo !== "string") return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http") || trimmed.startsWith("data:")) return trimmed;
  return `${fallbackBase}/${trimmed.replace(/^\//, "")}`;
};

export default function CustomCursor() {
  useEffect(() => {
    let schoolName = "AbsensiPro";
    let schoolLogo = null;

    const saved = localStorage.getItem("school_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        schoolName =
          parsed.schoolName || parsed.nama_sekolah || schoolName;
        schoolLogo = parsed.schoolLogo || parsed.logo;
      } catch {}
    }

    const logoSrc =
      resolvePhotoUrl(schoolLogo) ||
      "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg";

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const trail = [];
    let lastMove = Date.now();
    let idle = false;

    // container
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "fixed",
      top: 0,
      left: 0,
      pointerEvents: "none",
      zIndex: 9999,
    });
    document.body.appendChild(container);

    // 🔥 LOGO (CENTER FIX)
    const head = document.createElement("img");
    head.src = logoSrc;
    Object.assign(head.style, {
      position: "fixed",
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)", // 🔥 CENTER FIX
    });
    container.appendChild(head);

    // 🔥 TEXT
    const letters = schoolName.split("");
    const letterEls = letters.map((char) => {
      const el = document.createElement("span");
      el.innerText = char;
      Object.assign(el.style, {
        position: "fixed",
        fontSize: "15px",
        fontWeight: "600",
        color: "#2563eb",
      });
      container.appendChild(el);
      return el;
    });

    // init trail
    for (let i = 0; i < letters.length + 1; i++) {
      trail.push({ x: mouse.x, y: mouse.y });
    }

    // mouse
    const move = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      lastMove = Date.now();
      idle = false;
    };
    window.addEventListener("mousemove", move);

    // animasi
    const animate = () => {
      if (Date.now() - lastMove > 300) idle = true;

      // kepala
      trail[0].x += (mouse.x - trail[0].x) * 0.2;
      trail[0].y += (mouse.y - trail[0].y) * 0.2;

      // badan
      for (let i = 1; i < trail.length; i++) {
        trail[i].x += (trail[i - 1].x - trail[i].x) * 0.2;
        trail[i].y += (trail[i - 1].y - trail[i].y) * 0.2;
      }

      // 🔥 CENTER LOGO FIX (DOUBLE CENTER)
      head.style.transform = `translate(${trail[0].x}px, ${trail[0].y}px) translate(-50%, -50%)`;

      if (idle) {
        // 🔥 RADIUS LEBIH KECIL (BIAR RAPAT)
        const radius = 40;
        const time = Date.now() * 0.002;

        for (let i = 0; i < letterEls.length; i++) {
          const angle =
            (i / letterEls.length) * Math.PI * 2 + time;

          const x = trail[0].x + Math.cos(angle) * radius;
          const y = trail[0].y + Math.sin(angle) * radius;

          letterEls[i].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        }
      } else {
        for (let i = 0; i < letterEls.length; i++) {
          const p = trail[i + 1];
          letterEls[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", move);
      document.body.removeChild(container);
    };
  }, []);

  return null;
}