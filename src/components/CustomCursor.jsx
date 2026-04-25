import { useEffect, useRef, useState } from "react";

const resolvePhotoUrl = (photo, fallbackBase = "http://127.0.0.1:8000") => {
  if (!photo || typeof photo !== "string") return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http") || trimmed.startsWith("data:")) return trimmed;
  return `${fallbackBase}/${trimmed.replace(/^\//, "")}`;
};

export default function CustomCursor() {
  const [settings, setSettings] = useState({
    schoolName: "SMPK DON BOSCO",
    schoolLogo: null,
  });

  const mouse = useRef({ x: 0, y: 0 });
  const [renderMouse, setRenderMouse] = useState({ x: 0, y: 0 });
  const particlesRef = useRef([]);

  // LOAD SETTINGS
  useEffect(() => {
    const saved = localStorage.getItem("school_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          schoolName: parsed.schoolName || parsed.nama_sekolah,
          schoolLogo: parsed.schoolLogo || parsed.logo,
        });
      } catch {}
    }
  }, []);

  // PARTICLE SYSTEM
  useEffect(() => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    canvas.style.position = "fixed";
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = 9998;

    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const createParticle = () => {
      particlesRef.current.push({
        x: mouse.current.x,
        y: mouse.current.y,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 4,
        speedY: (Math.random() - 0.5) * 4,
        life: 60,
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      createParticle();

      particlesRef.current.forEach((p, i) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.life--;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59,130,246,0.8)";
        ctx.fill();

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        }
      });

      requestAnimationFrame(animate);
    };

    animate();

    const move = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    window.addEventListener("mousemove", move);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("resize", resize);
      document.body.removeChild(canvas);
    };
  }, []);

  // smooth follow cursor
  useEffect(() => {
    const animate = () => {
      setRenderMouse({
        x: mouse.current.x,
        y: mouse.current.y,
      });
      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const logoSrc =
    resolvePhotoUrl(settings.schoolLogo) ||
    "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg";

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        transform: `translate(${renderMouse.x}px, ${renderMouse.y}px) translate(-50%, -50%)`,
      }}
    >
      <img
        src={logoSrc}
        alt="logo"
        className="w-[40px] h-[40px] drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]"
      />
    </div>
  );
}