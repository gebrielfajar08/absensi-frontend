import { useState, useEffect, useRef } from 'react';
import MagazineViewer from './MagazineViewer';

const FloatingMagazine = () => {
    const [showViewer, setShowViewer] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = useState(false);
    const buttonRef = useRef(null);

    // Load posisi dari localStorage
    useEffect(() => {
        const savedPos = localStorage.getItem('magazine_button_position');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                const maxX = window.innerWidth - 70;
                const maxY = window.innerHeight - 70;
                setPosition({
                    x: Math.max(10, Math.min(pos.x || 20, maxX)),
                    y: Math.max(10, Math.min(pos.y || 100, maxY))
                });
            } catch (e) {
                console.error('Invalid saved position');
            }
        } else {
            // Default posisi kanan bawah
            setPosition({
                x: window.innerWidth - 80,
                y: window.innerHeight - 150
            });
        }
    }, []);

    // Mouse events
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        setHasMoved(false);
        setDragStartPos({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            const newX = e.clientX - dragStartPos.x;
            const newY = e.clientY - dragStartPos.y;
            
            const maxX = window.innerWidth - 70;
            const maxY = window.innerHeight - 70;
            
            const finalX = Math.max(10, Math.min(newX, maxX));
            const finalY = Math.max(10, Math.min(newY, maxY));
            
            if (Math.abs(finalX - position.x) > 3 || Math.abs(finalY - position.y) > 3) {
                setHasMoved(true);
            }
            
            setPosition({ x: finalX, y: finalY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            localStorage.setItem('magazine_button_position', JSON.stringify(position));
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStartPos, position]);

    // Touch events
    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setHasMoved(false);
        setDragStartPos({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleTouchMove = (e) => {
            const touch = e.touches[0];
            const newX = touch.clientX - dragStartPos.x;
            const newY = touch.clientY - dragStartPos.y;
            
            const maxX = window.innerWidth - 70;
            const maxY = window.innerHeight - 70;
            
            const finalX = Math.max(10, Math.min(newX, maxX));
            const finalY = Math.max(10, Math.min(newY, maxY));
            
            if (Math.abs(finalX - position.x) > 3 || Math.abs(finalY - position.y) > 3) {
                setHasMoved(true);
            }
            
            setPosition({ x: finalX, y: finalY });
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
            localStorage.setItem('magazine_button_position', JSON.stringify(position));
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [isDragging, dragStartPos, position]);

    const handleClick = () => {
        if (hasMoved) return;
        setShowViewer(true);
    };

    // ===== DATA MAJALAH - EDIT DI SINI =====
    const magazineData = {
        title: 'Poster Digital AI Sekolah',
        buttonIcon: '📖',
        buttonColor: '#3b82f6',
        pages: [
            {
                id: 1,
                page_number: 1,
                // Ganti URL gambar di bawah dengan gambar kamu
                image: 'https://i.pinimg.com/736x/bd/b4/68/bdb468eb30a35a31104d0ff92c5aea5f.jpg',
                content: null
            },
            {
                id: 2,
                page_number: 2,
                // Ganti URL gambar di bawah dengan gambar kamu
                image: 'https://i.pinimg.com/originals/b0/55/5f/b0555fa69eacfb3c5ec39f1043b095e7.png',
                content: null
            },
            {
                id: 3,
                page_number: 3,
                // Ganti URL gambar di bawah dengan gambar kamu
                image: 'https://i.pinimg.com/736x/ee/4f/f1/ee4ff198fb5ab49d50a8e18ee9db8c0b.jpg',
                content: null
            }
        ]
    };
    // ===== AKHIR DATA MAJALAH =====

    return (
        <>
            <div
                ref={buttonRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={handleClick}
                className={`fixed z-[9998] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center select-none ${
                    isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-110'
                } transition-transform duration-200`}
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    backgroundColor: magazineData.buttonColor,
                    touchAction: 'none',
                    willChange: 'transform'
                }}
                title="Klik untuk buka majalah • Drag untuk pindahkan"
            >
                <span className="text-2xl pointer-events-none">
                    {magazineData.buttonIcon}
                </span>
                
                {!isDragging && (
                    <>
                        <div 
                            className="absolute inset-0 rounded-full animate-ping opacity-30 pointer-events-none"
                            style={{ backgroundColor: magazineData.buttonColor }}
                        />
                        <div 
                            className="absolute -inset-1 rounded-full opacity-20 pointer-events-none"
                            style={{ backgroundColor: magazineData.buttonColor, filter: 'blur(8px)' }}
                        />
                    </>
                )}

                {isDragging && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                        Geser...
                    </div>
                )}
            </div>

            {showViewer && (
                <MagazineViewer 
                    magazine={magazineData}
                    onClose={() => setShowViewer(false)}
                />
            )}
        </>
    );
};

export default FloatingMagazine;