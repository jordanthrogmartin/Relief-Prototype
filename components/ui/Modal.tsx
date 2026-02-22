import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/90 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-sm overflow-hidden border shadow-2xl bg-[#0F172A]/90 backdrop-blur-md rounded-3xl border-white/5 max-h-[90vh] flex flex-col shadow-black/40">
                {(title || onClose) && (
                    <div className="flex items-center justify-between px-6 pt-6 pb-2">
                        {title && <h3 className="text-xl font-bold italic text-relief-primary">{title}</h3>}
                        <button onClick={onClose} className="p-2 transition-colors rounded-full hover:bg-white/10">
                            <X className="w-6 h-6 text-relief-text-secondary" />
                        </button>
                    </div>
                )}
                <div className="flex-grow p-6 overflow-y-auto scrollbar-hide">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};