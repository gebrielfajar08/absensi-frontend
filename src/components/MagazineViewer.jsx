import { useState, useEffect } from 'react';

const MagazineViewer = ({ magazine, onClose }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    const pages = magazine.pages || [];
    const totalPages = pages.length;

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    const nextPage = () => {
        if (currentPage < totalPages - 1 && !isAnimating) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentPage(currentPage + 1);
                setIsAnimating(false);
            }, 300);
        }
    };

    const prevPage = () => {
        if (currentPage > 0 && !isAnimating) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentPage(currentPage - 1);
                setIsAnimating(false);
            }, 300);
        }
    };

    const minSwipeDistance = 50;
    
    const onTouchStart = (e) => {
        setTouchEnd(0);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        
        if (isLeftSwipe) nextPage();
        else if (isRightSwipe) prevPage();
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') nextPage();
            if (e.key === 'ArrowLeft') prevPage();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, isAnimating]);

    return (
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Header */}
            <div className="absolute top-3 left-3 right-16 sm:top-4 sm:left-4 sm:right-20 text-left z-10">
                <h2 className="text-white text-sm sm:text-lg font-bold truncate">{magazine.title}</h2>
                <p className="text-white/60 text-[10px] sm:text-xs">
                    Halaman {currentPage + 1} dari {totalPages}
                </p>
            </div>

            {/* Book Container */}
            <div 
                className="relative w-full max-w-4xl h-[85vh] sm:h-[80vh] bg-white rounded-lg sm:rounded-2xl shadow-2xl overflow-hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className="relative w-full h-full">
                    {pages.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                            <div className="text-center p-8">
                                <span className="text-6xl mb-4 block">📭</span>
                                <p className="text-gray-600 font-semibold">Belum ada halaman</p>
                            </div>
                        </div>
                    ) : (
                        pages.map((page, index) => (
                            <div
                                key={page.id || index}
                                className={`absolute inset-0 transition-all duration-300 ${
                                    index === currentPage 
                                        ? 'opacity-100 scale-100 z-10' 
                                        : index < currentPage 
                                        ? 'opacity-0 scale-95 -translate-x-full z-0' 
                                        : 'opacity-0 scale-95 translate-x-full z-0'
                                }`}
                            >
                                {page.image ? (
                                    <img 
                                        src={page.image} 
                                        alt={`Halaman ${page.page_number}`}
                                        className="w-full h-full object-contain bg-gray-100"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4 sm:p-8">
                                        <div className="text-center max-w-2xl">
                                            {page.content && (
                                                <div 
                                                    className="prose prose-sm sm:prose-lg max-w-none text-gray-800" 
                                                    dangerouslySetInnerHTML={{ __html: page.content }} 
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Navigation Arrows */}
                {currentPage > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); prevPage(); }}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all"
                    >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {currentPage < totalPages - 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); nextPage(); }}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all"
                    >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* Page Dots */}
                {totalPages > 1 && (
                    <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 sm:gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full">
                        {pages.map((_, index) => (
                            <button
                                key={index}
                                onClick={(e) => { e.stopPropagation(); setCurrentPage(index); }}
                                className={`h-1.5 sm:h-2 rounded-full transition-all ${
                                    index === currentPage 
                                        ? 'bg-white w-6 sm:w-8' 
                                        : 'bg-white/50 w-1.5 sm:w-2 hover:bg-white/70'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default MagazineViewer;