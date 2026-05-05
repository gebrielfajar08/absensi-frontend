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

    const isMobile = window.matchMedia("(max-width:768px)").matches;

    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/settings");
        const data = await res.json();

        schoolLogo = data.schoolLogo || data.logo;
        primaryColor = data.primaryColor || primaryColor;
      } catch {
        const s = JSON.parse(localStorage.getItem("school_settings") || "{}");
        schoolLogo = s.schoolLogo || s.logo;
        primaryColor = s.primaryColor || primaryColor;
      }

      init();
    };

    const init = () => {
      const logo =
        resolvePhotoUrl(schoolLogo) ||
        "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg";

      const root = document.createElement("div");
      Object.assign(root.style, {
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      });
      document.body.appendChild(root);

      // 🔥 DOT (MAIN POINTER)
      const dot = document.createElement("div");
      Object.assign(dot.style, {
        position: "fixed",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: primaryColor,
        transform: "translate(-50%, -50%)",
        opacity: isMobile ? 0 : 1,
      });
      root.appendChild(dot);

      // 🔥 RING (SMOOTH FOLLOW)
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        border: `2px solid ${primaryColor}`,
        transform: "translate(-50%, -50%)",
        opacity: isMobile ? 0 : 1,
      });
      root.appendChild(ring);

      // 🔥 LOGO (HALUS DI DALAM)
      const head = document.createElement("img");
      head.src = logo;
      Object.assign(head.style, {
        position: "fixed",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        opacity: isMobile ? 0.8 : 0.8,
      });
      root.appendChild(head);

      let hideTimeout;

      // ===================
      // 📱 MOBILE
      // ===================
      if (isMobile) {
        const tap = (e) => {
          const t = e.touches[0];
          if (!t) return;

          const x = t.clientX;
          const y = t.clientY;

          dot.style.opacity = 1;
          ring.style.opacity = 1;
          head.style.opacity = 1;

          dot.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
          ring.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
          head.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;

          clearTimeout(hideTimeout);
          hideTimeout = setTimeout(() => {
            dot.style.opacity = 0;
            ring.style.opacity = 0;
            head.style.opacity = 0;
          }, 1500);
        };

        window.addEventListener("touchstart", tap);

        return () => {
          window.removeEventListener("touchstart", tap);
          document.body.removeChild(root);
        };
      }

      // ===================
      // 🖥️ DESKTOP
      // ===================
      const mouse = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };

      const ringPos = { ...mouse };

      const move = (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      };

      window.addEventListener("mousemove", move);

      const animate = () => {
        // dot langsung
        dot.style.transform = `translate(${mouse.x}px,${mouse.y}px) translate(-50%,-50%)`;
        head.style.transform = `translate(${mouse.x}px,${mouse.y}px) translate(-50%,-50%)`;

        // ring smooth (magnetic feel)
        ringPos.x += (mouse.x - ringPos.x) * 0.15;
        ringPos.y += (mouse.y - ringPos.y) * 0.15;

        ring.style.transform = `translate(${ringPos.x}px,${ringPos.y}px) translate(-50%,-50%)`;

        requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener("mousemove", move);
        document.body.removeChild(root);
      };
    };

    load();
  }, []);

  return null;
}