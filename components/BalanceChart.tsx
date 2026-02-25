import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Transaction } from '../types';
import { normalizeDate } from '../utils/dateUtils';

export interface ChartPoint {
    day: number;
    dateStr: string;
    balance: number;
    projectedBalance?: number;
    isFuture: boolean;
    isToday: boolean;
}

interface BalanceChartProps {
    transactions: Transaction[];
    openingBalance: number;
    currentDate: Date;
    threshold: number;
    todayStr: string;
    burnRates: Record<string, { rate: number, startDay: number, isProjected: boolean }>;
    showProjected: boolean;
    monthsToShow?: number;
    onPointHover: (point: ChartPoint | null) => void;
}

export const BalanceChart: React.FC<BalanceChartProps> = ({ 
    transactions, 
    openingBalance,
    currentDate, 
    threshold,
    todayStr,
    burnRates,
    showProjected,
    monthsToShow = 1,
    onPointHover
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(300);
    const height = 160; 
    const padding = { top: 30, right: 0, bottom: 20, left: 0 };

    const [activePoint, setActivePoint] = useState<ChartPoint | null>(null);

    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.clientWidth);
        }
    }, []);

    // Notify parent when active point changes
    useEffect(() => {
        onPointHover(activePoint);
    }, [activePoint, onPointHover]);

    const data = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const startOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        
        const endDate = new Date(year, month + monthsToShow, 0);
        const startDate = new Date(year, month, 1);
        const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        const windowPriorBalance = transactions
            .filter(t => normalizeDate(t.transaction_date) < startOfMonthStr && t.status !== 'skipped')
            .reduce((acc, t) => acc + t.amount, 0);

        const initialBalance = openingBalance + windowPriorBalance;

        const points: ChartPoint[] = [];
        let currentBalance = initialBalance;
        let cumulativeBurn = 0;

        for (let d = 1; d <= totalDays; d++) {
            const currentDayDate = new Date(year, month, d);
            const dYear = currentDayDate.getFullYear();
            const dMonth = currentDayDate.getMonth() + 1;
            const dDate = currentDayDate.getDate();
            const dateStr = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(dDate).padStart(2, '0')}`;
            const monthKey = `${dYear}-${String(dMonth).padStart(2, '0')}`;
            
            const dayTxns = transactions.filter(t => normalizeDate(t.transaction_date) === dateStr && t.status !== 'skipped');
            const dayTotal = dayTxns.reduce((acc, t) => acc + t.amount, 0);
            
            currentBalance += dayTotal;

            let projected = undefined;
            const burnInfo = burnRates[monthKey];
            
            if (showProjected && burnInfo && burnInfo.isProjected) {
                // If it's the current month (or any month with a startDay > 1), check startDay
                // For future months, startDay is usually 1, so dDate >= 1 is always true
                if (dDate >= burnInfo.startDay) {
                    cumulativeBurn += burnInfo.rate;
                }
                projected = currentBalance - cumulativeBurn;
            } else if (showProjected && cumulativeBurn > 0) {
                 projected = currentBalance - cumulativeBurn;
            }

            points.push({
                day: d,
                dateStr: dateStr,
                balance: currentBalance,
                projectedBalance: projected,
                isFuture: dateStr > todayStr,
                isToday: dateStr === todayStr
            });
        }
        return points;
    }, [transactions, openingBalance, currentDate, todayStr, showProjected, burnRates, monthsToShow]);

    if (data.length <= 1) return null;

    const todayPoint = data.find(d => d.isToday);

    const balances = data.map(d => d.balance);
    const projectedBalances = data.map(d => d.projectedBalance).filter(b => b !== undefined) as number[];
    const allValues = [...balances, ...projectedBalances, 0, threshold];

    const minBal = Math.min(...allValues); 
    const maxBal = Math.max(...allValues);
    const range = maxBal - minBal || 1; 
    const paddedMin = minBal - (range * 0.1);
    const paddedMax = maxBal + (range * 0.1);
    const activeRange = paddedMax - paddedMin;

    const mapX = (day: number) => {
        const maxDays = data.length; 
        return padding.left + ((day - 1) / (maxDays - 1)) * (width - padding.left - padding.right);
    };

    const mapY = (val: number) => {
        return height - padding.bottom - ((val - paddedMin) / activeRange) * (height - padding.top - padding.bottom);
    };

    const yZero = mapY(0);
    const yThreshold = mapY(threshold);

    const createPath = (points: ChartPoint[], key: 'balance' | 'projectedBalance') => {
        return points
            .filter(p => p[key] !== undefined)
            .map((p, i) => {
                const prefix = i === 0 ? 'M' : 'L';
                return `${prefix} ${mapX(p.day)} ${mapY(p[key] as number)}`;
            }).join(' ');
    };

    const futureIndex = data.findIndex(d => d.isFuture);
    let pastPoints = data;
    let futurePoints: ChartPoint[] = [];

    if (futureIndex !== -1) {
        // Solid line ends at Today (futureIndex - 1)
        // Dotted line starts at Today to connect
        if (futureIndex === 0) {
            pastPoints = [];
            futurePoints = data;
        } else {
            pastPoints = data.slice(0, futureIndex); 
            futurePoints = data.slice(futureIndex - 1); 
        }
    }

    const solidPath = createPath(pastPoints, 'balance');
    // Hide dotted path if showing projected (burn rate)
    const dottedPath = (futurePoints.length > 0 && !showProjected) ? createPath(futurePoints, 'balance') : '';
    const projectedPath = showProjected ? createPath(data, 'projectedBalance') : '';

    const handleInteraction = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const chartWidth = width - padding.left - padding.right;
        
        const maxDays = data.length;
        const rawDayIndex = ((x - padding.left) / chartWidth) * (maxDays - 1);
        const index = Math.max(0, Math.min(Math.round(rawDayIndex), maxDays - 1));
        
        setActivePoint(data[index]);
    };

    return (
        <div 
            ref={containerRef} 
            className="w-full relative touch-none" 
            style={{ height: `${height}px` }}
            onPointerMove={(e) => handleInteraction(e.clientX)}
            onPointerLeave={() => setActivePoint(null)}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => {
                e.stopPropagation();
                handleInteraction(e.touches[0].clientX);
            }}
            onTouchEnd={(e) => {
                e.stopPropagation();
                setActivePoint(null);
            }}
        >
            <svg width={width} height={height} className="overflow-visible">
                <defs>
                    <linearGradient id="chartColorGradient" gradientUnits="userSpaceOnUse" x1="0" y1={height - padding.bottom} x2="0" y2={padding.top}>
                        <stop offset="0%" stopColor="#f87171" />
                        <stop offset="50%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>

                <line x1={padding.left} y1={yZero} x2={width - padding.right} y2={yZero} stroke="#fff" strokeOpacity="0.1" strokeWidth="1" />
                <line x1={padding.left} y1={yThreshold} x2={width - padding.right} y2={yThreshold} stroke="#fbbf24" strokeOpacity="0.3" strokeDasharray="4 4" strokeWidth="1" />

                {projectedPath && (
                     <path d={projectedPath} fill="none" stroke="#FF4D00" strokeWidth="2" strokeOpacity="0.4" />
                )}

                <path d={solidPath} fill="none" stroke="#2E93FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {dottedPath && <path d={dottedPath} fill="none" stroke="#2E93FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.3" />}

                {/* Today Circle */}
                {todayPoint && (
                    <g>
                        <circle 
                            cx={mapX(todayPoint.day)} 
                            cy={mapY(todayPoint.balance)} 
                            r="8" 
                            fill="#fff"
                            opacity="0.2"
                        >
                            <animate attributeName="r" values="6;12;6" dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
                        </circle>
                        <circle 
                            cx={mapX(todayPoint.day)} 
                            cy={mapY(todayPoint.balance)} 
                            r="5" 
                            fill="#0F172A" 
                            stroke="#fff" 
                            strokeWidth="2" 
                        />
                    </g>
                )}

                {activePoint && (
                    <g>
                        <line x1={mapX(activePoint.day)} y1={padding.top} x2={mapX(activePoint.day)} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                        <circle 
                            cx={mapX(activePoint.day)} 
                            cy={mapY(showProjected && activePoint.projectedBalance !== undefined ? activePoint.projectedBalance : activePoint.balance)} 
                            r="4" 
                            fill="#34d399" 
                            stroke="#0f172a" 
                            strokeWidth="2" 
                        />
                    </g>
                )}
            </svg>
        </div>
    );
};
