



import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import type { Config, SimulationState, Stats, CarryingItem, MovingElement, AssemblyAnimationState } from './types';
import { M_Status, M_Tasks, STATUS_SHORT_NAMES, INITIAL_CONFIG } from './constants';

const TICK_DURATION_MS = 100;
const P_MATERIAL_MOVE_DURATION_S = 1.0;
const HISTORY_MAX_LENGTH = 500;

// UTILITY & HELPER COMPONENTS (defined outside main App to prevent re-renders)

const getPosition = (element: HTMLElement | null): { x: number; y: number } => {
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
};

const ContainerVisual: React.FC<{ type: 'A1' | 'A2'; empty?: boolean; withWKanban?: boolean; withPKanban?: boolean; isMoving?: boolean }> = ({ type, empty, withWKanban, withPKanban, isMoving = false }) => {
    const contentClass = empty
        ? 'before:content-[\'\']'
        : (type === 'A2' ? 'before:content-[\'⚙️\']' : 'before:content-[\'📦\']');

    const colorClass = empty
        ? 'bg-gradient-to-br from-gray-300 to-gray-400 border-gray-500'
        : 'bg-gradient-to-br from-gray-600 to-gray-700 border-gray-900';

    const wKanbanClass = withWKanban ? (type === 'A2' ? "after:content-['W'] after:absolute after:-top-3 after:-right-2 after:w-[22px] after:h-[18px] after:bg-gradient-to-br after:from-blue-600 after:to-blue-400 after:rounded-sm after:border after:border-blue-800 after:text-white after:text-[8px] after:font-bold after:flex after:items-center after:justify-center after:shadow-md after:z-10" : "after:content-['W'] after:absolute after:-top-3 after:-right-2 after:w-[22px] after:h-[18px] after:bg-gradient-to-br after:from-cyan-500 after:to-cyan-300 after:rounded-sm after:border after:border-cyan-700 after:text-white after:text-[8px] after:font-bold after:flex after:items-center after:justify-center after:shadow-md after:z-10") : '';

    const motionClass = isMoving ? 'animate-pulse' : 'container-stacked';

    return (
        <div className={`relative w-[50px] h-[45px] rounded-md border-2 shadow-lg flex items-center justify-center text-2xl transition-all ${contentClass} ${colorClass} ${wKanbanClass} ${motionClass}`}>
            {/* Content texture for non-empty containers */}
            {!empty && (
                <div className="absolute inset-1 rounded-sm opacity-20 bg-gradient-to-br from-white to-transparent pointer-events-none" />
            )}

            {/* Empty container pattern */}
            {empty && (
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px)'
                }} />
            )}

            {withPKanban && (
                <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 w-[35px] h-[25px] rounded-sm border-[1.5px] text-white text-[8px] font-bold flex items-center justify-center shadow-lg z-10 transition-all hover:scale-110 ${type === 'A2' ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-800' : 'bg-gradient-to-br from-pink-500 to-pink-400 border-pink-700'}`}>
                    <div>P</div>
                    <div className="absolute -bottom-0.5 text-[6px] opacity-80">{type}</div>
                </div>
            )}
        </div>
    );
};

const PieceIcon: React.FC<{ type: 'A1' | 'A2' }> = ({ type }) => {
    const icon = type === 'A1' ? '📦' : '⚙️';
    return <div className="text-2xl">{icon}</div>;
};

const StorageArea: React.FC<{ title: string; subtitle: string; count: number; maxCapacity?: number; children: React.ReactNode; headerColor: string }> = ({ title, subtitle, count, maxCapacity = 10, children, headerColor }) => {
    const fillPercentage = Math.min((count / maxCapacity) * 100, 100);
    const capacityColor = fillPercentage > 80 ? 'bg-red-500' : fillPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="bg-gray-200 p-4 rounded-lg relative">
            <div className={`${headerColor} text-white font-bold text-center py-2 rounded-md mb-2 flex items-center justify-between px-3`}>
                <span>{title}</span>
                <span className="text-xs font-normal opacity-90">{count}/{maxCapacity}</span>
            </div>
            <div className="text-center text-sm text-gray-700 mb-1">{subtitle}</div>
            {/* Capacity bar */}
            <div className="w-full h-1.5 bg-gray-300 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full ${capacityColor} transition-all duration-500`}
                    style={{ width: `${fillPercentage}%` }}
                />
            </div>
            {children}
        </div>
    );
};

const MiniKanban: React.FC<{ type: 'A1' | 'A2'; animated?: boolean }> = ({ type, animated = false }) => (
    <div className={`relative w-[35px] h-[25px] rounded-sm border-[1.5px] text-white text-[8px] font-bold flex flex-col items-center justify-center shadow-md transition-all hover:scale-110 hover:shadow-xl ${animated ? 'animate-pulse' : ''} ${type === 'A2' ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-800' : 'bg-gradient-to-br from-pink-500 to-pink-400 border-pink-700'}`}>
        <div className="text-[10px]">P</div>
        <div className="text-[6px] opacity-80 absolute bottom-0">{type}</div>
        {/* Subtle shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white opacity-20 rounded-sm pointer-events-none" />
    </div>
);

const Operator: React.FC<{ name: string; state: any; type: 'P' | 'A' | 'M'; hideStatus?: boolean }> = ({ name, state, type, hideStatus = false }) => {
    const status = STATUS_SHORT_NAMES[state.status as M_Status] || state.status;
    let baseClasses = 'rounded-full text-white font-bold flex items-center justify-center shadow-lg transition-all duration-300 relative';
    let sizeClasses = '';
    let colorClasses = '';
    let statusClasses = '';
    let content: React.ReactNode = name;
    let progressPercent = 0;

    // Calculate progress for progress ring
    if (state.timer > 0) {
        if (type === 'P' && state.status === 'Working') {
            const totalTime = state.producingType === 'A1' ? 20 : 24; // Would need config passed, using defaults
            progressPercent = ((totalTime - state.timer) / totalTime) * 100;
        } else if (type === 'A' && state.status === 'Working') {
            const totalTime = name === 'A1' ? 20 : 24; // Would need config, using defaults
            progressPercent = (state.timer > 0) ? ((totalTime - state.timer) / totalTime) * 100 : 0;
        }
    }

    switch (type) {
        case 'P':
            sizeClasses = 'w-20 h-20 text-2xl';
            colorClasses = 'bg-gradient-to-br from-blue-400 to-blue-500';
            if (state.status === 'Working') {
                statusClasses = 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl';
                // Show operator with tools and product being assembled
                const productIcon = state.producingType === 'A1' ? '📦' : '⚙️';
                content = (
                    <div className="relative">
                        <div className="text-2xl animate-bounce-subtle">👨‍🔧</div>
                        <div className="absolute inset-0 flex items-center justify-center pt-8">
                            <div className="text-2xl opacity-90">{productIcon}</div>
                        </div>
                    </div>
                );
            } else if (state.status === 'Preparing') {
                statusClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-xl';
                content = <div className="text-2xl animate-pulse">👨‍🔧</div>;
            } else {
                content = <div className="text-2xl opacity-70">👨‍🔧</div>;
            }
            break;
        case 'A':
            sizeClasses = 'w-20 h-20 text-2xl';
            colorClasses = name === 'A1' ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-orange-500 to-orange-600';
            if (state.status === 'Working') {
                statusClasses = 'shadow-xl ring-4 ring-green-300';
                const productIcon = name === 'A1' ? '📦' : '⚙️';
                content = (
                    <div className="relative">
                        <div className="text-2xl animate-bounce-subtle">👷</div>
                        <div className="absolute inset-0 flex items-center justify-center pt-8">
                            <div className="text-2xl opacity-90">{productIcon}</div>
                        </div>
                        <div className="absolute -right-1 -bottom-1 text-xs animate-pulse">🔧</div>
                    </div>
                );
            } else if (state.status === 'Starved') {
                statusClasses = 'bg-gradient-to-br from-red-200 to-red-300 ring-4 ring-red-600 animate-pulse-slow';
                content = (
                    <div className="relative">
                        <div className="text-2xl opacity-60">👷</div>
                        <div className="absolute -top-2 right-0 text-lg animate-bounce">⏰</div>
                    </div>
                );
            } else {
                content = <div className="text-2xl opacity-70">👷</div>;
            }
            break;
        case 'M':
            sizeClasses = 'w-12 h-12 text-xl';
            colorClasses = 'bg-gradient-to-br from-green-500 to-green-600';
            if (state.status !== M_Status.IDLE) {
                statusClasses = 'bg-gradient-to-br from-green-700 to-green-800 shadow-xl';
                content = <div className="text-xl">🚶</div>;
            } else {
                content = <div className="text-xl opacity-70">🚶</div>;
            }
            break;
    }

    return (
        <div className="text-center">
            <div className="relative inline-block">
                {/* Progress Ring */}
                {(type === 'P' || type === 'A') && state.status === 'Working' && (
                    <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90 pointer-events-none" style={{ zIndex: 10 }}>
                        <circle
                            cx="50%"
                            cy="50%"
                            r="45%"
                            fill="none"
                            stroke="rgba(96, 165, 250, 0.2)"
                            strokeWidth="3"
                        />
                        <circle
                            cx="50%"
                            cy="50%"
                            r="45%"
                            fill="none"
                            stroke="rgb(34, 197, 94)"
                            strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercent / 100)}`}
                            strokeLinecap="round"
                            className="transition-all duration-300"
                        />
                    </svg>
                )}

                {/* Pulse effect for Working state */}
                {state.status === 'Working' && (
                    <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${type === 'P' ? 'bg-blue-400' : type === 'A' ? (name === 'A1' ? 'bg-red-400' : 'bg-orange-400') : 'bg-green-400'}`} style={{ animationDuration: '2s' }} />
                )}

                <div className={`${baseClasses} ${sizeClasses} ${colorClasses} ${statusClasses}`}>
                    {content}
                </div>
            </div>
            {!hideStatus && (
                <>
                    <div className="mt-2 text-sm text-gray-700 font-semibold min-h-[1.2em] whitespace-nowrap">{status}</div>
                    <div className="text-xs text-gray-500 min-h-[1.1em]">
                        {state.timer > 0 && state.status !== 'Starved' && state.status !== M_Status.IDLE ? `(${state.timer.toFixed(1)}s)` : ''}
                    </div>
                </>
            )}
        </div>
    );
};

// --- MAIN APP COMPONENT ---

// Type definitions for History
type MizuMoverState = {
    x: number;
    y: number;
    isTransitioning: boolean;
};

type HistoryEntry = {
    simState: SimulationState;
    stats: Stats;
    simTime: number;
    mizuMover: MizuMoverState;
    itemMover: MovingElement;
    kanbanMover: MovingElement;
    emptyToPMover: MovingElement;
    pMover: { visible: boolean; x: number; y: number; isTransitioning: boolean };
    a1Mover: { visible: boolean; x: number; y: number; isTransitioning: boolean };
    a2Mover: { visible: boolean; x: number; y: number; isTransitioning: boolean };
    a1Animation: AssemblyAnimationState;
    a2Animation: AssemblyAnimationState;
};

// Challenge presets
const CHALLENGES = [
    { id: 0, name: 'Free Simulation', description: 'Customize parameters and explore the system freely', config: INITIAL_CONFIG },
    { id: 1, name: 'Challenge 1: The Bottleneck', description: 'Find the bottleneck! Why are stations starved? Config: Fast A1/A2 (10s), Slow P (30s), 2 Kanban pairs', config: { cycleTimeA1: 10, cycleTimeA2: 10, cycleTimeP: 30, moveTimeM: 3, actionTimeM: 1, numKanbanPairsA1: 2, numKanbanPairsA2: 2 } },
    { id: 2, name: 'Challenge 2: Stressed Mizusumashi', description: 'M is always moving! Observe WIP accumulation. Config: All stations fast (5s), M slow (10s)', config: { cycleTimeA1: 5, cycleTimeA2: 5, cycleTimeP: 5, moveTimeM: 10, actionTimeM: 1, numKanbanPairsA1: 2, numKanbanPairsA2: 2 } },
    { id: 3, name: 'Challenge 3: Minimum WIP, Maximum Throughput', description: 'Find minimum Kanban pairs that keep stations working without starvation', config: { cycleTimeA1: 20, cycleTimeA2: 24, cycleTimeP: 15, moveTimeM: 3, actionTimeM: 1, numKanbanPairsA1: 1, numKanbanPairsA2: 1 } },
    { id: 4, name: 'Challenge 4: Balanced Times', description: 'Adjust cycle times to achieve >90% saturation on all stations with 2 Kanban pairs', config: { cycleTimeA1: 20, cycleTimeA2: 24, cycleTimeP: 8, moveTimeM: 3, actionTimeM: 1, numKanbanPairsA1: 2, numKanbanPairsA2: 2 } },
    { id: 5, name: 'Challenge 5: Product Mix', description: 'A2 is 3x slower than A1! How to balance Kanban pairs? Which ratio optimizes throughput?', config: { cycleTimeA1: 10, cycleTimeA2: 30, cycleTimeP: 15, moveTimeM: 3, actionTimeM: 1, numKanbanPairsA1: 2, numKanbanPairsA2: 2 } },
    { id: 6, name: 'Challenge 6: Quick Response', description: 'Minimize Lead Time. How fast can you complete an order with 1 Kanban pair?', config: { cycleTimeA1: 8, cycleTimeA2: 10, cycleTimeP: 6, moveTimeM: 2, actionTimeM: 1, numKanbanPairsA1: 1, numKanbanPairsA2: 1 } },
    { id: 7, name: 'Challenge 7: Kaizen', description: 'Start with 3 Kanban pairs. Reduce WIP progressively. When does the system collapse?', config: { cycleTimeA1: 30, cycleTimeA2: 30, cycleTimeP: 30, moveTimeM: 3, actionTimeM: 1, numKanbanPairsA1: 3, numKanbanPairsA2: 3 } },
];

export default function App() {
    const [config, setConfig] = useState<Config>(INITIAL_CONFIG);
    const [selectedChallenge, setSelectedChallenge] = useState(0);
    const [simState, setSimState] = useState<SimulationState | null>(null);
    const [stats, setStats] = useState<Stats>({ totalWIP: 0, totalThroughput: 0, starvedTimeA1: 0, starvedTimeA2: 0, workingTimeA1: 0, workingTimeA2: 0, workingTimeP: 0, throughputA1: 0, throughputA2: 0, throughputP: 0 });
    const [simTime, setSimTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [timeMultiplier, setTimeMultiplier] = useState(5);
    const [needsReset, setNeedsReset] = useState(false);
    
    const [mizuMover, setMizuMover] = useState<MizuMoverState>({ x: 0, y: 0, isTransitioning: false });
    const [itemMover, setItemMover] = useState<MovingElement>({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });
    const [kanbanMover, setKanbanMover] = useState<MovingElement>({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });
    const [emptyToPMover, setEmptyToPMover] = useState<MovingElement>({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });
    const [mizuTrail, setMizuTrail] = useState<{x: number, y: number, id: number}[]>([]);
    const [mizuActionAnim, setMizuActionAnim] = useState<'pick' | 'drop' | null>(null);
    const [pMover, setPMover] = useState<{ visible: boolean; x: number; y: number; isTransitioning: boolean }>({ visible: false, x: 0, y: 0, isTransitioning: false });
    const [a1Mover, setA1Mover] = useState<{ visible: boolean; x: number; y: number; isTransitioning: boolean }>({ visible: false, x: 0, y: 0, isTransitioning: false });
    const [a2Mover, setA2Mover] = useState<{ visible: boolean; x: number; y: number; isTransitioning: boolean }>({ visible: false, x: 0, y: 0, isTransitioning: false });
    const [finishedA1Mover, setFinishedA1Mover] = useState<MovingElement>({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });
    const [finishedA2Mover, setFinishedA2Mover] = useState<MovingElement>({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    const [a1Animation, setA1Animation] = useState<AssemblyAnimationState>({ visible: false, product: 'A1', style: {} });
    const [a2Animation, setA2Animation] = useState<AssemblyAnimationState>({ visible: false, product: 'A2', style: {} });

    const simulationIntervalRef = useRef<number | null>(null);
    const animationTimeoutRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Refs for DOM element positions
    const elementRefs = {
        operatorM: useRef<HTMLDivElement>(null),
        operatorP: useRef<HTMLDivElement>(null),
        operatorA1: useRef<HTMLDivElement>(null),
        operatorA2: useRef<HTMLDivElement>(null),
        a1InArea: useRef<HTMLDivElement>(null), a1OutArea: useRef<HTMLDivElement>(null),
        a2InArea: useRef<HTMLDivElement>(null), a2OutArea: useRef<HTMLDivElement>(null),
        pInArea: useRef<HTMLDivElement>(null), pOutArea: useRef<HTMLDivElement>(null),
        pFinishedArea: useRef<HTMLDivElement>(null), heijunkaBox: useRef<HTMLDivElement>(null),
        a1FinishedArea: useRef<HTMLDivElement>(null), a2FinishedArea: useRef<HTMLDivElement>(null),
    };
    
    const [initialPositions, setInitialPositions] = useState({ mHome: { x: 0, y: 0 } });

    useLayoutEffect(() => {
        const mHomePos = getPosition(elementRefs.operatorM.current);
        setInitialPositions({ mHome: mHomePos });
        setMizuMover(m => ({ ...m, x: mHomePos.x, y: mHomePos.y }));
    }, []);

    const resetState = useCallback((currentConfig: Config) => {
        const numA1Pairs = currentConfig.numKanbanPairsA1;
        const numA2Pairs = currentConfig.numKanbanPairsA2;

        setSimState({
            a1: { status: 'Idle', timer: 0, kanbanWaiting: 0, producingType: null },
            a2: { status: 'Idle', timer: 0, kanbanWaiting: 0, producingType: null },
            p: { status: 'Idle', timer: 0, producingType: null },
            locations: {
                a1In: { fullA1: numA1Pairs }, a1Out: { emptyA1: 0 },
                a2In: { fullA2: numA2Pairs }, a2Out: { emptyA2: 0 },
                pIn: { emptyA1WithW: 0, emptyA2WithW: 0, emptyA1Ready: 0, emptyA2Ready: 0 },
                pFinished: { finishedA1: numA1Pairs, finishedA2: numA2Pairs },
                pOut: { fullA1: 0, fullA2: 0 },
                heijunka: [], // Start with empty Heijunka box
            },
            m: { status: M_Status.IDLE, timer: 0, task: null, carrying: null },
            deliveryQueue: [] // FIFO queue for delivery requests
        });
        const totalWIP = (numA1Pairs + numA2Pairs) * 2;
        setStats({ totalWIP: totalWIP, totalThroughput: 0, starvedTimeA1: 0, starvedTimeA2: 0, workingTimeA1: 0, workingTimeA2: 0, workingTimeP: 0, throughputA1: 0, throughputA2: 0, throughputP: 0 });
        setSimTime(0);
        setIsAnimating(false);
        setNeedsReset(false);
        setHistory([]);

        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        
        setMizuMover({ x: initialPositions.mHome.x, y: initialPositions.mHome.y, isTransitioning: false });
        setItemMover(i => ({ ...i, visible: false }));
        setKanbanMover(k => ({ ...k, visible: false }));
        setEmptyToPMover(e => ({ ...e, visible: false }));
        setMizuTrail([]);
        setA1Animation({ visible: false, product: 'A1', style: {} });
        setA2Animation({ visible: false, product: 'A2', style: {} });
    }, [initialPositions.mHome]);

    useEffect(() => {
        resetState(config);
    }, [config.numKanbanPairsA1, config.numKanbanPairsA2]); // eslint-disable-line react-hooks/exhaustive-deps


    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value, type } = e.target;
        const numericValue = type === 'number' ? parseFloat(value) : value;
        setConfig(prev => ({ ...prev, [id]: numericValue }));
        if (isRunning) {
            setIsRunning(false);
            setNeedsReset(true); // Only set needsReset if was running
        }
        // If paused, allow config changes without requiring reset
    };
    
    const handleReset = () => {
        if(isRunning) setIsRunning(false);
        resetState(config);
    };

    const handleStartPause = () => {
        if (needsReset) return;
        // Allow pausing even during animations - will stop at next tick
        setIsRunning(prev => !prev);
    };

    const handleChallengeSelect = (challengeId: number) => {
        if (isRunning) setIsRunning(false);
        const challenge = CHALLENGES.find(c => c.id === challengeId);
        if (challenge) {
            setSelectedChallenge(challengeId);
            setConfig(challenge.config);
            setNeedsReset(true);
        }
    };

    const getTargetElementRef = (status: M_Status) => {
        switch (status) {
            // Moves
            case M_Status.MOVING_TO_A1_OUT: return elementRefs.a1OutArea;
            case M_Status.MOVING_TO_A2_OUT: return elementRefs.a2OutArea;
            case M_Status.MOVING_TO_P_IN_WITH_EMPTY: return elementRefs.pInArea;
            case M_Status.MOVING_TO_P_FINISHED: return elementRefs.pFinishedArea;
            case M_Status.MOVING_TO_P_OUT_WITH_FINISHED: return elementRefs.pOutArea;
            case M_Status.MOVING_TO_HEIJUNKA_WITH_KP: return elementRefs.heijunkaBox;
            case M_Status.MOVING_TO_P_IN_FOR_KW: return elementRefs.pInArea;
            case M_Status.MOVING_TO_P_OUT_WITH_KW: return elementRefs.pOutArea;
            case M_Status.MOVING_TO_P_OUT_FOR_FULL: return elementRefs.pOutArea;
            case M_Status.MOVING_TO_A1_IN_WITH_FULL: return elementRefs.a1InArea;
            case M_Status.MOVING_TO_A2_IN_WITH_FULL: return elementRefs.a2InArea;

            // Actions (location where action happens)
            case M_Status.PICKING_A1_EMPTY: return elementRefs.a1OutArea;
            case M_Status.PICKING_A2_EMPTY: return elementRefs.a2OutArea;
            case M_Status.DROPPING_EMPTY: return elementRefs.pInArea;
            
            case M_Status.PICKING_FINISHED: return elementRefs.pFinishedArea;
            case M_Status.DROPPING_FINISHED: return elementRefs.pOutArea;
            case M_Status.ACT_DETACH_KP: return elementRefs.pOutArea;
            case M_Status.DROPPING_KP: return elementRefs.heijunkaBox;
            case M_Status.ACT_TAKE_KW: return elementRefs.pInArea;
            case M_Status.ACT_ATTACH_KW: return elementRefs.pOutArea;

            case M_Status.PICKING_FULL_POUT: return elementRefs.pOutArea;
            case M_Status.DROPPING_FULL_A1: return elementRefs.a1InArea;
            case M_Status.DROPPING_FULL_A2: return elementRefs.a2InArea;

            default: return elementRefs.operatorM;
        }
    };
    
    const getItemContent = (item: CarryingItem | null | {product: 'A1' | 'A2'} , itemType?: 'container'| 'kanbanP' | 'kanbanW' ) => {
        if (!item) return null;
        // Larger kanban for animations to make them more visible
        if(itemType === 'kanbanP') return <div className={`w-[50px] h-[40px] rounded-md border-2 text-white text-lg font-bold flex items-center justify-center shadow-lg ${item.product === 'A2' ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-800' : 'bg-gradient-to-br from-pink-500 to-pink-400 border-pink-700'}`}>P</div>;
        if(itemType === 'kanbanW') return <div className={`w-[40px] h-[32px] rounded-sm border-2 text-white text-sm font-bold flex items-center justify-center shadow-lg ${item.product === 'A2' ? 'bg-gradient-to-br from-blue-600 to-blue-400 border-blue-800' : 'bg-gradient-to-br from-cyan-500 to-cyan-300 border-cyan-700'}`}>W</div>;

        const carrying = item as CarryingItem;

        // For EmptyBatch (both A1 and A2), show separate stacks
        if (carrying.type === 'EmptyBatch') {
            const totalA1 = carrying.emptyA1 || 0;
            const totalA2 = carrying.emptyA2 || 0;
            const containers = [];
            let offset = 0;

            // Add A1 containers
            for (let i = 0; i < Math.min(totalA1, 3); i++) {
                containers.push(
                    <div key={`a1-${i}`} className="absolute" style={{ transform: `translate(${offset * 8}px, ${-offset * 6}px)`, zIndex: 100 - offset }}>
                        <ContainerVisual type="A1" empty withWKanban />
                    </div>
                );
                offset++;
            }
            // Add A2 containers
            for (let i = 0; i < Math.min(totalA2, 3); i++) {
                containers.push(
                    <div key={`a2-${i}`} className="absolute" style={{ transform: `translate(${offset * 8}px, ${-offset * 6}px)`, zIndex: 100 - offset }}>
                        <ContainerVisual type="A2" empty withWKanban />
                    </div>
                );
                offset++;
            }

            const total = totalA1 + totalA2;
            return (
                <div className="relative flex items-center">
                    {containers}
                    {total > 1 && <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{transform: 'translate(60px, -10px)', zIndex: 200}}>{total}</div>}
                </div>
            );
        }

        const count = carrying.count || 1;

        // For single-product batch operations, show stacked containers
        if (count > 1) {
            const containers = [];
            for (let i = 0; i < Math.min(count, 5); i++) { // Show max 5 visually
                containers.push(
                    <div key={i} className="absolute" style={{ transform: `translate(${i * 8}px, ${-i * 6}px)`, zIndex: count - i }}>
                        {carrying.type === 'Full' ? <ContainerVisual type={carrying.product} withWKanban /> :
                         carrying.type === 'Finished' ? <ContainerVisual type={carrying.product} withPKanban={carrying.hasPKanban} /> :
                         <ContainerVisual type={carrying.product} empty withWKanban />}
                    </div>
                );
            }
            return (
                <div className="relative flex items-center">
                    {containers}
                    {count > 5 && <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{transform: 'translate(60px, -10px)', zIndex: 100}}>+{count - 5}</div>}
                    {count <= 5 && count > 1 && <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{transform: 'translate(60px, -10px)', zIndex: 100}}>{count}</div>}
                </div>
            );
        }

        // Single item
        if(carrying.type === 'Full') return <ContainerVisual type={carrying.product} withWKanban />;
        if(carrying.type === 'Finished') return <ContainerVisual type={carrying.product} withPKanban={carrying.hasPKanban} />;
        return <ContainerVisual type={carrying.product} empty={carrying.type === 'Empty'} withWKanban={carrying.type === 'Empty'} />;
    };

    const animateMove = useCallback((from: React.RefObject<HTMLElement> | {x: number, y: number}, toRef: React.RefObject<HTMLElement>, durationS: number, item: CarryingItem | {product: 'A1' | 'A2'} | null, onComplete: () => void, itemType?: 'container'| 'kanbanP' | 'kanbanW') => {
        const fromPos = 'current' in from ? getPosition(from.current) : from;
        const toPos = getPosition(toRef.current);
        const effectiveDurationMs = Math.max(durationS * 1000 / timeMultiplier, 100);

        setMizuMover({ x: fromPos.x, y: fromPos.y, isTransitioning: false });
        if (item) {
            setItemMover({ visible: true, x: fromPos.x, y: fromPos.y, isTransitioning: false, content: getItemContent(item, itemType) });
        }

        // Add trail point at starting position
        setMizuTrail(prev => [...prev, { x: fromPos.x, y: fromPos.y, id: Date.now() }].slice(-15));

        animationFrameRef.current = requestAnimationFrame(() => {
            setMizuMover({ x: toPos.x, y: toPos.y, isTransitioning: true });
            if (item) {
                setItemMover(i => ({ ...i, x: toPos.x, y: toPos.y, isTransitioning: true }));
            }

            animationTimeoutRef.current = window.setTimeout(() => {
                setMizuMover(m => ({ ...m, isTransitioning: false }));
                setItemMover(i => ({ ...i, visible: false, isTransitioning: false }));
                setIsAnimating(false);
                onComplete();
            }, effectiveDurationMs);
        });
    }, [timeMultiplier]);

    const animateMaterialsToP = useCallback((productType: 'A1' | 'A2', onComplete: () => void) => {
        const fromKanbanPos = getPosition(elementRefs.heijunkaBox.current);
        const fromEmptyPos = getPosition(elementRefs.pInArea.current);
        const toPPos = getPosition(elementRefs.operatorP.current);
        const effectiveDurationMs = Math.max(P_MATERIAL_MOVE_DURATION_S * 1000 / timeMultiplier, 100);

        // Use larger kanban for better visibility during animation
        const largeKanban = <div className={`w-[50px] h-[40px] rounded-md border-2 text-white text-lg font-bold flex items-center justify-center shadow-lg ${productType === 'A2' ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-800' : 'bg-gradient-to-br from-pink-500 to-pink-400 border-pink-700'}`}>P</div>;
        setKanbanMover({ visible: true, x: fromKanbanPos.x, y: fromKanbanPos.y, isTransitioning: false, content: largeKanban });
        setEmptyToPMover({ visible: true, x: fromEmptyPos.x, y: fromEmptyPos.y, isTransitioning: false, content: <ContainerVisual type={productType} empty /> });

        animationFrameRef.current = requestAnimationFrame(() => {
            setKanbanMover(k => ({ ...k, x: toPPos.x, y: toPPos.y, isTransitioning: true }));
            setEmptyToPMover(e => ({ ...e, x: toPPos.x, y: toPPos.y, isTransitioning: true }));

            animationTimeoutRef.current = window.setTimeout(() => {
                setKanbanMover(k => ({ ...k, visible: false, isTransitioning: false }));
                setEmptyToPMover(e => ({ ...e, visible: false, isTransitioning: false }));
                setIsAnimating(false);
                onComplete();
            }, effectiveDurationMs);
        });
    }, [timeMultiplier, elementRefs.heijunkaBox, elementRefs.pInArea, elementRefs.operatorP]);

    const animatePMovement = useCallback((productType: 'A1' | 'A2', onPickKanban: () => void, onPickContainer: () => void, onComplete: () => void) => {
        const pHomePos = getPosition(elementRefs.operatorP.current);
        const heijunkaPos = getPosition(elementRefs.heijunkaBox.current);
        const pInPos = getPosition(elementRefs.pInArea.current);
        const moveDuration = Math.max(config.moveTimeM * 1000 / timeMultiplier, 150);
        const pickDuration = Math.max(config.actionTimeM * 500 / timeMultiplier, 100);

        // Prepare item content - use same size as in Heijunka Box
        const kanbanP = <div className={`relative w-[35px] h-[25px] rounded-sm border-[1.5px] text-white text-[8px] font-bold flex flex-col items-center justify-center shadow-md transition-all hover:scale-110 hover:shadow-xl ${productType === 'A2' ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-800' : 'bg-gradient-to-br from-pink-500 to-pink-400 border-pink-700'}`}>
            <div className="text-[10px]">P</div>
            <div className="text-[6px] opacity-80 absolute bottom-0">{productType}</div>
            <div className="absolute inset-0 bg-gradient-to-br from-white opacity-20 rounded-sm pointer-events-none" />
        </div>;
        const emptyContainer = <ContainerVisual type={productType} empty />;

        // Step 0: Hide any existing items from previous animations
        setKanbanMover({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });
        setEmptyToPMover({ visible: false, x: 0, y: 0, isTransitioning: false, content: null });

        // Step 1: Show P at home position (no items yet)
        setPMover({ visible: true, x: pHomePos.x, y: pHomePos.y, isTransitioning: false });

        // Step 2: Move P to Heijunka box
        animationFrameRef.current = requestAnimationFrame(() => {
            setPMover(p => ({ ...p, x: heijunkaPos.x, y: heijunkaPos.y, isTransitioning: true }));

            // Step 3: After arriving at Heijunka, pick Kanban
            animationTimeoutRef.current = window.setTimeout(() => {
                onPickKanban(); // Remove Kanban from Heijunka display

                // Show kanban with operator at Heijunka position
                setKanbanMover({ visible: true, x: heijunkaPos.x, y: heijunkaPos.y, isTransitioning: false, content: kanbanP });

                // Small pause to show pickup action
                setTimeout(() => {
                    // Step 4: Move P + Kanban to P-IN together
                    setPMover(p => ({ ...p, x: pInPos.x, y: pInPos.y, isTransitioning: true }));
                    setKanbanMover(k => ({ ...k, x: pInPos.x, y: pInPos.y, isTransitioning: true }));

                    // Step 5: After arriving at P-IN, pick container
                    animationTimeoutRef.current = window.setTimeout(() => {
                        onPickContainer(); // Remove container from P-IN display

                        // Show container with operator and kanban at P-IN position
                        setEmptyToPMover({ visible: true, x: pInPos.x, y: pInPos.y, isTransitioning: false, content: emptyContainer });

                        // Small pause to show pickup action
                        setTimeout(() => {
                            // Step 6: Move P + Kanban + Container back home together
                            setPMover(p => ({ ...p, x: pHomePos.x, y: pHomePos.y, isTransitioning: true }));
                            setKanbanMover(k => ({ ...k, x: pHomePos.x, y: pHomePos.y, isTransitioning: true }));
                            setEmptyToPMover(e => ({ ...e, x: pHomePos.x, y: pHomePos.y, isTransitioning: true }));

                            // Step 7: After returning home, hide everything and start working
                            animationTimeoutRef.current = window.setTimeout(() => {
                                setPMover(p => ({ ...p, visible: false, isTransitioning: false }));
                                setKanbanMover(k => ({ ...k, visible: false, isTransitioning: false }));
                                setEmptyToPMover(e => ({ ...e, visible: false, isTransitioning: false }));
                                setIsAnimating(false);
                                onComplete();
                            }, moveDuration);
                        }, pickDuration);
                    }, moveDuration);
                }, pickDuration);
            }, moveDuration);
        });
    }, [timeMultiplier, config.moveTimeM, config.actionTimeM, elementRefs.operatorP, elementRefs.heijunkaBox, elementRefs.pInArea]);

    const tick = useCallback(() => {
        if (isAnimating || !simState) return;
        
        // Save current state to history BEFORE any changes
        const historyEntry: HistoryEntry = {
            simState,
            stats,
            simTime,
            mizuMover,
            itemMover,
            kanbanMover,
            emptyToPMover,
            pMover,
            a1Mover,
            a2Mover,
            a1Animation,
            a2Animation,
        };
        setHistory(prev => [...prev, historyEntry].slice(-HISTORY_MAX_LENGTH));

        const deltaTime = (TICK_DURATION_MS / 1000) * timeMultiplier;
        setSimTime(t => t + deltaTime);
        
        let newState = JSON.parse(JSON.stringify(simState)) as SimulationState;
        let newStats = { ...stats };

        // Station A1
        if (newState.a1.status === 'Working') {
            newStats.workingTimeA1 += deltaTime;
            newState.a1.timer -= deltaTime;
            if (newState.a1.timer <= 0) {
                newState.a1.status = 'Idle';
                newState.locations.a1Out.emptyA1++;
                newState.a1.kanbanWaiting++;
                newState.a1.producingType = null;
                newStats.throughputA1++;
                setA1Animation(a => ({...a, visible: false}));
                // Add to delivery queue for FIFO refill
                newState.deliveryQueue.push('A1');

                // Animate finished piece to Finished area
                const fromPos = getPosition(elementRefs.operatorA1.current);
                const toPos = getPosition(elementRefs.a1FinishedArea.current);
                const durationMs = Math.max(500 / timeMultiplier, 100);

                setFinishedA1Mover({ visible: true, x: fromPos.x, y: fromPos.y, isTransitioning: false, content: <div className="text-2xl">📦</div> });
                requestAnimationFrame(() => {
                    setFinishedA1Mover(m => ({ ...m, x: toPos.x, y: toPos.y, isTransitioning: true }));
                    setTimeout(() => {
                        setFinishedA1Mover(m => ({ ...m, visible: false, isTransitioning: false }));
                    }, durationMs);
                });
            }
        } else { // If not working (Idle or Starved), check for materials
            if (newState.locations.a1In.fullA1 > 0) {
                // Don't decrement material yet - wait until operator arrives at A1-IN
                newState.a1.status = 'Working';
                newState.a1.producingType = 'A1';
                newState.a1.timer = config.cycleTimeA1;

                // Callback to pick material when operator arrives at A1-IN
                const onPickMaterial = () => setSimState(s => {
                    if (!s) return null;
                    const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                    newS.locations.a1In.fullA1--;
                    return newS;
                });

                // Animate operator A1 going to pick material
                const a1HomePos = getPosition(elementRefs.operatorA1.current);
                const a1InPosRaw = getPosition(elementRefs.a1InArea.current);
                const a1InPos = { x: a1InPosRaw.x, y: a1InPosRaw.y + 40 }; // Offset to enter inside the storage area
                const moveDuration = Math.max(config.moveTimeM * 500 / timeMultiplier, 100); // Faster than M

                setA1Mover({ visible: true, x: a1HomePos.x, y: a1HomePos.y, isTransitioning: false });

                requestAnimationFrame(() => {
                    setA1Mover(m => ({ ...m, x: a1InPos.x, y: a1InPos.y, isTransitioning: true }));

                    setTimeout(() => {
                        // Operator has arrived at A1-IN, pick the material now
                        onPickMaterial();
                        setA1Mover(m => ({ ...m, x: a1HomePos.x, y: a1HomePos.y, isTransitioning: true }));

                        setTimeout(() => {
                            setA1Mover(m => ({ ...m, visible: false, isTransitioning: false }));

                            // Now trigger container animation towards OUT area (empty with W kanban)
                            const fromPos = getPosition(elementRefs.a1InArea.current);
                            const toPos = getPosition(elementRefs.a1OutArea.current);
                            const durationMs = Math.max(1.5 * 1000 / timeMultiplier, 100);

                            setA1Animation(a => ({
                                ...a,
                                visible: true,
                                style: {
                                    left: fromPos.x,
                                    top: fromPos.y,
                                    transform: 'translate(-50%, -50%)',
                                    transition: 'none',
                                }
                            }));

                            requestAnimationFrame(() => {
                                setA1Animation(a => ({
                                    ...a,
                                    style: {
                                        ...a.style,
                                        left: toPos.x,
                                        top: toPos.y,
                                        transition: `left ${durationMs}ms linear, top ${durationMs}ms linear`,
                                    }
                                }));
                            });
                        }, moveDuration);
                    }, moveDuration);
                });
            } else {
                 newState.a1.status = 'Starved';
            }
        }
        if(newState.a1.status === 'Starved') newStats.starvedTimeA1 += deltaTime;

        // Station A2
        if (newState.a2.status === 'Working') {
            newStats.workingTimeA2 += deltaTime;
            newState.a2.timer -= deltaTime;
            if (newState.a2.timer <= 0) {
                newState.a2.status = 'Idle';
                newState.locations.a2Out.emptyA2++;
                newState.a2.kanbanWaiting++;
                newState.a2.producingType = null;
                newStats.throughputA2++;
                setA2Animation(a => ({...a, visible: false}));
                // Add to delivery queue for FIFO refill
                newState.deliveryQueue.push('A2');

                // Animate finished piece to Finished area
                const fromPos = getPosition(elementRefs.operatorA2.current);
                const toPos = getPosition(elementRefs.a2FinishedArea.current);
                const durationMs = Math.max(500 / timeMultiplier, 100);

                setFinishedA2Mover({ visible: true, x: fromPos.x, y: fromPos.y, isTransitioning: false, content: <div className="text-2xl">⚙️</div> });
                requestAnimationFrame(() => {
                    setFinishedA2Mover(m => ({ ...m, x: toPos.x, y: toPos.y, isTransitioning: true }));
                    setTimeout(() => {
                        setFinishedA2Mover(m => ({ ...m, visible: false, isTransitioning: false }));
                    }, durationMs);
                });
            }
        } else { // If not working (Idle or Starved), check for materials
            if (newState.locations.a2In.fullA2 > 0) {
                // Don't decrement material yet - wait until operator arrives at A2-IN
                newState.a2.status = 'Working';
                newState.a2.producingType = 'A2';
                newState.a2.timer = config.cycleTimeA2;

                // Callback to pick material when operator arrives at A2-IN
                const onPickMaterial = () => setSimState(s => {
                    if (!s) return null;
                    const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                    newS.locations.a2In.fullA2--;
                    return newS;
                });

                // Animate operator A2 going to pick material
                const a2HomePos = getPosition(elementRefs.operatorA2.current);
                const a2InPosRaw = getPosition(elementRefs.a2InArea.current);
                const a2InPos = { x: a2InPosRaw.x, y: a2InPosRaw.y + 40 }; // Offset to enter inside the storage area
                const moveDuration = Math.max(config.moveTimeM * 500 / timeMultiplier, 100); // Faster than M

                setA2Mover({ visible: true, x: a2HomePos.x, y: a2HomePos.y, isTransitioning: false });

                requestAnimationFrame(() => {
                    setA2Mover(m => ({ ...m, x: a2InPos.x, y: a2InPos.y, isTransitioning: true }));

                    setTimeout(() => {
                        // Operator has arrived at A2-IN, pick the material now
                        onPickMaterial();
                        setA2Mover(m => ({ ...m, x: a2HomePos.x, y: a2HomePos.y, isTransitioning: true }));

                        setTimeout(() => {
                            setA2Mover(m => ({ ...m, visible: false, isTransitioning: false }));

                            // Now trigger container animation towards OUT area (empty with W kanban)
                            const fromPos = getPosition(elementRefs.a2InArea.current);
                            const toPos = getPosition(elementRefs.a2OutArea.current);
                            const durationMs = Math.max(1.5 * 1000 / timeMultiplier, 100);

                            setA2Animation(a => ({
                                ...a,
                                visible: true,
                                style: {
                                    left: fromPos.x,
                                    top: fromPos.y,
                                    transform: 'translate(-50%, -50%)',
                                    transition: 'none',
                                }
                            }));

                            requestAnimationFrame(() => {
                                setA2Animation(a => ({
                                    ...a,
                                    style: {
                                        ...a.style,
                                        left: toPos.x,
                                        top: toPos.y,
                                        transition: `left ${durationMs}ms linear, top ${durationMs}ms linear`,
                                    }
                                }));
                            });
                        }, moveDuration);
                    }, moveDuration);
                });
            } else {
                newState.a2.status = 'Starved';
            }
        }
        if(newState.a2.status === 'Starved') newStats.starvedTimeA2 += deltaTime;


        // Operator P
        if (newState.p.status === 'Working') {
            newStats.workingTimeP += deltaTime;
            newState.p.timer -= deltaTime;
            if (newState.p.timer <= 0) {
                // Finished working, now animate P carrying product to P-Finished
                const productType = newState.p.producingType!;
                newState.p.status = 'Delivering';

                setIsAnimating(true);
                setSimState(newState);
                setStats(newStats);

                // Animate P moving to P-Finished with the product
                const pHomePos = getPosition(elementRefs.operatorP.current);
                const pFinishedPos = getPosition(elementRefs.pFinishedArea.current);
                const moveDuration = Math.max(config.moveTimeM * 1000 / timeMultiplier, 150);

                setPMover({ visible: true, x: pHomePos.x, y: pHomePos.y, isTransitioning: false });
                setItemMover({ visible: true, x: pHomePos.x, y: pHomePos.y, isTransitioning: false, content: <ContainerVisual type={productType} withPKanban /> });

                requestAnimationFrame(() => {
                    setPMover(p => ({ ...p, x: pFinishedPos.x, y: pFinishedPos.y, isTransitioning: true }));
                    setItemMover(i => ({ ...i, x: pFinishedPos.x, y: pFinishedPos.y, isTransitioning: true }));

                    setTimeout(() => {
                        // Drop product at P-Finished
                        setSimState(s => {
                            if (!s) return null;
                            const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                            if (productType === 'A1') newS.locations.pFinished.finishedA1++;
                            else if (productType === 'A2') newS.locations.pFinished.finishedA2++;
                            return newS;
                        });

                        setItemMover(i => ({ ...i, visible: false, isTransitioning: false }));
                        setPMover(p => ({ ...p, x: pHomePos.x, y: pHomePos.y, isTransitioning: true }));

                        setTimeout(() => {
                            setPMover(p => ({ ...p, visible: false, isTransitioning: false }));
                            setIsAnimating(false);
                            setSimState(s => {
                                if (!s) return null;
                                const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                                newS.p.status = 'Idle';
                                newS.p.producingType = null;
                                return newS;
                            });
                            setStats(st => ({ ...st, throughputP: st.throughputP + 1 }));
                        }, moveDuration);
                    }, moveDuration);
                });

                return;
            }
        } else if (newState.p.status === 'Preparing' || newState.p.status === 'Delivering') {
            // Do nothing, wait for animation to finish
        } else if (newState.p.status === 'Idle') {
            const startWork = (productType: 'A1' | 'A2') => {
                // Don't remove items yet - P will pick them up during movement
                newState.p.status = 'Preparing';
                newState.p.producingType = productType;

                setIsAnimating(true);
                setSimState(newState);
                setStats(newStats);

                const onPickKanban = () => setSimState(s => {
                    if (!s) return null;
                    const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                    newS.locations.heijunka.shift(); // Remove Kanban when P arrives at Heijunka
                    return newS;
                });

                const onPickContainer = () => setSimState(s => {
                    if (!s) return null;
                    const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                    if (productType === 'A1') {
                        newS.locations.pIn.emptyA1Ready--;
                    } else {
                        newS.locations.pIn.emptyA2Ready--;
                    }
                    return newS;
                });

                const onComplete = () => setSimState(s => {
                    if (!s) return null;
                    const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                    newS.p.status = 'Working';
                    newS.p.timer = config.cycleTimeP;
                    return newS;
                });

                animatePMovement(productType, onPickKanban, onPickContainer, onComplete);
            };

            if (newState.locations.heijunka.length > 0) {
                const nextProduct = newState.locations.heijunka[0];
                if (nextProduct === 'A1' && newState.locations.pIn.emptyA1Ready > 0) {
                    startWork('A1');
                    return;
                } else if (nextProduct === 'A2' && newState.locations.pIn.emptyA2Ready > 0) {
                    startWork('A2');
                    return;
                }
            }
        }

        // Mizusumashi
        if (newState.m.timer > 0) {
            newState.m.timer -= deltaTime;
        } else {
             const m = newState.m;
             if (m.status === M_Status.IDLE) {
                 // Choose next task
                 let nextTask = null;
                 const pInHasEmptyA1WithW = newState.locations.pIn.emptyA1WithW > 0;
                 const pInHasEmptyA2WithW = newState.locations.pIn.emptyA2WithW > 0;

                 // Priority 1: Starved stations (emergency)
                 if (newState.a1.status === 'Starved' && newState.locations.pOut.fullA1 > 0) nextTask = { type: M_Tasks.DELIVER_FULL, product: 'A1' };
                 else if (newState.a2.status === 'Starved' && newState.locations.pOut.fullA2 > 0) nextTask = { type: M_Tasks.DELIVER_FULL, product: 'A2' };
                 // Priority 2: Process finished items
                 else if (newState.locations.pFinished.finishedA1 > 0 && pInHasEmptyA1WithW) nextTask = { type: M_Tasks.PROCESS_FINISHED, product: 'A1' };
                 else if (newState.locations.pFinished.finishedA2 > 0 && pInHasEmptyA2WithW) nextTask = { type: M_Tasks.PROCESS_FINISHED, product: 'A2' };
                 // Priority 3: Fetch empty containers (BATCH pickup from both A1 and A2)
                 else if (newState.a1.kanbanWaiting > 0 || newState.a2.kanbanWaiting > 0) nextTask = { type: M_Tasks.FETCH_EMPTY_BATCH, product: 'A1' }; // product unused for batch
                 // Priority 4: Deliver full containers (FIFO from deliveryQueue)
                 else if (newState.deliveryQueue.length > 0) {
                     const nextStation = newState.deliveryQueue[0];
                     const hasFullA1 = nextStation === 'A1' && newState.locations.pOut.fullA1 > 0;
                     const hasFullA2 = nextStation === 'A2' && newState.locations.pOut.fullA2 > 0;
                     if (hasFullA1 || hasFullA2) {
                         nextTask = { type: M_Tasks.DELIVER_FULL, product: nextStation };
                     }
                 }

                 if (nextTask) {
                     m.task = nextTask;
                     let firstMoveStatus: M_Status;
                     if(nextTask.type === M_Tasks.FETCH_EMPTY_BATCH) {
                         // Start batch collection: go to A1 first if available, else A2
                         if (newState.a1.kanbanWaiting > 0) firstMoveStatus = M_Status.MOVING_TO_A1_OUT;
                         else firstMoveStatus = M_Status.MOVING_TO_A2_OUT;
                         m.carrying = { type: 'EmptyBatch', product: 'A1', emptyA1: 0, emptyA2: 0 }; // Initialize batch carrier
                     }
                     else if(nextTask.type === M_Tasks.FETCH_EMPTY) firstMoveStatus = nextTask.product === 'A1' ? M_Status.MOVING_TO_A1_OUT : M_Status.MOVING_TO_A2_OUT;
                     else if (nextTask.type === M_Tasks.PROCESS_FINISHED) firstMoveStatus = M_Status.MOVING_TO_P_FINISHED;
                     else firstMoveStatus = M_Status.MOVING_TO_P_OUT_FOR_FULL;
                     
                     m.status = firstMoveStatus;
                     setIsAnimating(true);
                     
                     setSimState(newState);
                     setStats(newStats);

                     const onComplete = () => setSimState(s => {
                         if(!s) return null;
                         const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                         if (newS.m.status === M_Status.MOVING_TO_A1_OUT) newS.m.status = M_Status.PICKING_A1_EMPTY;
                         else if (newS.m.status === M_Status.MOVING_TO_A2_OUT) newS.m.status = M_Status.PICKING_A2_EMPTY;
                         else if (newS.m.status === M_Status.MOVING_TO_P_IN_WITH_EMPTY) newS.m.status = M_Status.DROPPING_EMPTY;
                         else if (newS.m.status === M_Status.MOVING_TO_P_FINISHED) newS.m.status = M_Status.PICKING_FINISHED;
                         else if (newS.m.status === M_Status.MOVING_TO_P_OUT_WITH_FINISHED) newS.m.status = M_Status.DROPPING_FINISHED;
                         else if (newS.m.status === M_Status.MOVING_TO_HEIJUNKA_WITH_KP) newS.m.status = M_Status.DROPPING_KP;
                         else if (newS.m.status === M_Status.MOVING_TO_P_IN_FOR_KW) newS.m.status = M_Status.ACT_TAKE_KW;
                         else if (newS.m.status === M_Status.MOVING_TO_P_OUT_WITH_KW) newS.m.status = M_Status.ACT_ATTACH_KW;
                         else if (newS.m.status === M_Status.MOVING_TO_P_OUT_FOR_FULL) newS.m.status = M_Status.PICKING_FULL_POUT;
                         else if (newS.m.status === M_Status.MOVING_TO_A1_IN_WITH_FULL) newS.m.status = M_Status.DROPPING_FULL_A1;
                         else if (newS.m.status === M_Status.MOVING_TO_A2_IN_WITH_FULL) newS.m.status = M_Status.DROPPING_FULL_A2;
                         newS.m.timer = config.actionTimeM;
                         return newS;
                     });

                     animateMove({ x: mizuMover.x, y: mizuMover.y }, getTargetElementRef(firstMoveStatus), config.moveTimeM, null, onComplete);
                     return;
                 }
             } else { // Acting state logic
                 let nextMoveStatus: M_Status | null = null;
                 let taskFinished = false;
                 let itemForAnimation: CarryingItem | {product: 'A1'|'A2'} | null = null;
                 let itemType: 'container' | 'kanbanP' | 'kanbanW' | undefined = 'container';
                 let fromRef = getTargetElementRef(m.status);
                 
                 switch(m.status) {
                     case M_Status.PICKING_A1_EMPTY:
                        if(newState.locations.a1Out.emptyA1 > 0) {
                            const count = newState.locations.a1Out.emptyA1;
                            newState.locations.a1Out.emptyA1 = 0;
                            newState.a1.kanbanWaiting = 0;

                            if (m.task?.type === M_Tasks.FETCH_EMPTY_BATCH) {
                                // Batch mode: collect A1, then check for A2
                                m.carrying!.emptyA1 = count;
                                if (newState.a2.kanbanWaiting > 0) {
                                    // Go to A2 next - NO animation during intermediate move
                                    nextMoveStatus = M_Status.MOVING_TO_A2_OUT;
                                    itemForAnimation = null; // Hide items during collection phase
                                } else {
                                    // No A2, go directly to P-IN - SHOW all collected
                                    nextMoveStatus = M_Status.MOVING_TO_P_IN_WITH_EMPTY;
                                    itemForAnimation = m.carrying;
                                }
                            } else {
                                // Single pickup mode (legacy)
                                m.carrying = { type: 'Empty', product: 'A1', count };
                                nextMoveStatus = M_Status.MOVING_TO_P_IN_WITH_EMPTY;
                                itemForAnimation = m.carrying;
                            }
                        } else {
                            // No A1 to pick, check if batch mode and should go to A2
                            if (m.task?.type === M_Tasks.FETCH_EMPTY_BATCH && newState.a2.kanbanWaiting > 0) {
                                nextMoveStatus = M_Status.MOVING_TO_A2_OUT;
                                itemForAnimation = null; // Hide during move
                            } else {
                                taskFinished = true;
                            }
                        }
                        break;
                     case M_Status.PICKING_A2_EMPTY:
                         if (newState.locations.a2Out.emptyA2 > 0) {
                             const count = newState.locations.a2Out.emptyA2;
                             newState.locations.a2Out.emptyA2 = 0;
                             newState.a2.kanbanWaiting = 0;

                             if (m.task?.type === M_Tasks.FETCH_EMPTY_BATCH) {
                                 // Batch mode: collect A2, then go to P-IN - SHOW all collected (A1+A2)
                                 m.carrying!.emptyA2 = count;
                                 nextMoveStatus = M_Status.MOVING_TO_P_IN_WITH_EMPTY;
                                 itemForAnimation = m.carrying; // Now show all containers
                             } else {
                                 // Single pickup mode (legacy)
                                 m.carrying = { type: 'Empty', product: 'A2', count };
                                 nextMoveStatus = M_Status.MOVING_TO_P_IN_WITH_EMPTY;
                                 itemForAnimation = m.carrying;
                             }
                         } else {
                             // No A2 to pick, go to P-IN with what we have (if batch mode)
                             if (m.task?.type === M_Tasks.FETCH_EMPTY_BATCH && (m.carrying?.emptyA1 || 0) > 0) {
                                 nextMoveStatus = M_Status.MOVING_TO_P_IN_WITH_EMPTY;
                                 itemForAnimation = m.carrying; // Show A1 containers we already have
                             } else {
                                 taskFinished = true;
                             }
                         }
                         break;
                     case M_Status.DROPPING_EMPTY:
                         // Batch drop: deposit all carried containers
                         if (m.carrying?.type === 'EmptyBatch') {
                             // Drop both A1 and A2 empties
                             newState.locations.pIn.emptyA1WithW += (m.carrying.emptyA1 || 0);
                             newState.locations.pIn.emptyA2WithW += (m.carrying.emptyA2 || 0);
                         } else {
                             // Single product drop (legacy)
                             const countToDrop = m.carrying?.count || 1;
                             if (m.carrying?.product === 'A1') newState.locations.pIn.emptyA1WithW += countToDrop;
                             else newState.locations.pIn.emptyA2WithW += countToDrop;
                         }
                         m.carrying = null;
                         taskFinished = true;
                         break;
                    case M_Status.PICKING_FINISHED:
                        const finishedType = m.task?.product === 'A1' ? 'finishedA1' : 'finishedA2';
                        if (newState.locations.pFinished[finishedType] > 0) {
                            newState.locations.pFinished[finishedType]--;
                            m.carrying = { type: 'Finished', product: m.task!.product, hasPKanban: true };
                            nextMoveStatus = M_Status.MOVING_TO_P_OUT_WITH_FINISHED;
                            itemForAnimation = m.carrying;
                        } else taskFinished = true;
                        break;
                    case M_Status.DROPPING_FINISHED:
                        m.status = M_Status.ACT_DETACH_KP; m.timer = config.actionTimeM;
                        break;
                    case M_Status.ACT_DETACH_KP:
                        m.carrying!.detachedKP = { product: m.task!.product };
                        m.carrying!.hasPKanban = false;
                        nextMoveStatus = M_Status.MOVING_TO_HEIJUNKA_WITH_KP;
                        itemForAnimation = m.carrying.detachedKP;
                        itemType = 'kanbanP';
                        break;
                    case M_Status.DROPPING_KP:
                        const productType = m.carrying!.detachedKP!.product;
                        newState.locations.heijunka.push(productType); // Add to end of FIFO queue
                        m.carrying!.detachedKP = undefined;
                        nextMoveStatus = M_Status.MOVING_TO_P_IN_FOR_KW;
                        break;
                    case M_Status.ACT_TAKE_KW:
                        const product = m.task!.product;
                        if (product === 'A1' && newState.locations.pIn.emptyA1WithW > 0) {
                            newState.locations.pIn.emptyA1WithW--;
                            newState.locations.pIn.emptyA1Ready++;
                            m.carrying!.takenKW = { product: 'A1' };
                            nextMoveStatus = M_Status.MOVING_TO_P_OUT_WITH_KW;
                            itemForAnimation = m.carrying.takenKW;
                            itemType = 'kanbanW';
                        } else if (product === 'A2' && newState.locations.pIn.emptyA2WithW > 0) {
                            newState.locations.pIn.emptyA2WithW--;
                            newState.locations.pIn.emptyA2Ready++;
                            m.carrying!.takenKW = { product: 'A2' };
                            nextMoveStatus = M_Status.MOVING_TO_P_OUT_WITH_KW;
                            itemForAnimation = m.carrying.takenKW;
                            itemType = 'kanbanW';
                        } else {
                            taskFinished = true;
                        }
                        break;
                    case M_Status.ACT_ATTACH_KW:
                        // Convert the carried item to 'Full' and chain into the delivery task.
                        m.carrying!.type = 'Full';
                        m.carrying!.takenKW = undefined;
                        m.task!.type = M_Tasks.DELIVER_FULL; // Task is now delivery
                        m.status = M_Status.PICKING_FULL_POUT;
                        m.timer = config.actionTimeM;
                        // No animation, it's an instantaneous action and state transition.
                        break;
                    case M_Status.PICKING_FULL_POUT:
                        // If M isn't carrying a full container, it must pick one up.
                        // This happens in a standalone DELIVER_FULL task.
                        if (!m.carrying || m.carrying.type !== 'Full') {
                            const fullPOutType = m.task!.product === 'A1' ? 'fullA1' : 'fullA2';
                            if (newState.locations.pOut[fullPOutType] > 0) {
                                newState.locations.pOut[fullPOutType]--;
                                m.carrying = { type: 'Full', product: m.task!.product };
                            } else {
                                // Can't pick up, so the task fails/finishes.
                                taskFinished = true;
                                m.carrying = null; // Clear any partial state
                                break; // Exit switch
                            }
                        }
                        
                        // By this point, m.carrying is guaranteed to be a 'Full' item.
                        nextMoveStatus = m.carrying!.product === 'A1' ? M_Status.MOVING_TO_A1_IN_WITH_FULL : M_Status.MOVING_TO_A2_IN_WITH_FULL;
                        itemForAnimation = m.carrying;
                        break;
                    case M_Status.DROPPING_FULL_A1:
                    case M_Status.DROPPING_FULL_A2:
                        const locInType = m.task!.product === 'A1' ? 'fullA1' : 'fullA2';
                        const targetLoc = m.task!.product === 'A1' ? newState.locations.a1In : newState.locations.a2In;
                        targetLoc[locInType]++; newStats.totalThroughput++;
                        m.carrying = null; taskFinished = true;
                        // Remove from delivery queue after successful delivery
                        if (newState.deliveryQueue.length > 0 && newState.deliveryQueue[0] === m.task!.product) {
                            newState.deliveryQueue.shift();
                        }
                        break;
                 }

                if (taskFinished) {
                    m.status = M_Status.IDLE; 
                    m.task = null; 
                    m.carrying = null;
                } else if (nextMoveStatus) {
                    m.status = nextMoveStatus;
                    setIsAnimating(true);
                    
                    setSimState(newState);
                    setStats(newStats);

                    const onComplete = () => setSimState(s => {
                        if(!s) return null;
                        const newS = JSON.parse(JSON.stringify(s)) as SimulationState;
                        // FIX: Corrected typo from MOVING_to_A1_OUT to MOVING_TO_A1_OUT
                        if (newS.m.status === M_Status.MOVING_TO_A1_OUT) newS.m.status = M_Status.PICKING_A1_EMPTY;
                         else if (newS.m.status === M_Status.MOVING_TO_A2_OUT) newS.m.status = M_Status.PICKING_A2_EMPTY;
                         else if (newS.m.status === M_Status.MOVING_TO_P_IN_WITH_EMPTY) newS.m.status = M_Status.DROPPING_EMPTY;
                         else if (newS.m.status === M_Status.MOVING_TO_P_FINISHED) newS.m.status = M_Status.PICKING_FINISHED;
                         else if (newS.m.status === M_Status.MOVING_TO_P_OUT_WITH_FINISHED) newS.m.status = M_Status.DROPPING_FINISHED;
                         else if (newS.m.status === M_Status.MOVING_TO_HEIJUNKA_WITH_KP) newS.m.status = M_Status.DROPPING_KP;
                         else if (newS.m.status === M_Status.MOVING_TO_P_IN_FOR_KW) newS.m.status = M_Status.ACT_TAKE_KW;
                         else if (newS.m.status === M_Status.MOVING_TO_P_OUT_WITH_KW) newS.m.status = M_Status.ACT_ATTACH_KW;
                         else if (newS.m.status === M_Status.MOVING_TO_P_OUT_FOR_FULL) newS.m.status = M_Status.PICKING_FULL_POUT;
                         else if (newS.m.status === M_Status.MOVING_TO_A1_IN_WITH_FULL) newS.m.status = M_Status.DROPPING_FULL_A1;
                         else if (newS.m.status === M_Status.MOVING_TO_A2_IN_WITH_FULL) newS.m.status = M_Status.DROPPING_FULL_A2;
                        newS.m.timer = config.actionTimeM;
                        return newS;
                    });
                    
                    animateMove(fromRef, getTargetElementRef(nextMoveStatus), config.moveTimeM, itemForAnimation, onComplete, itemType);
                    return;
                }
             }
        }

        // Final WIP calculation
        let wip = 0;
        const loc = newState.locations;
        wip += loc.a1In.fullA1 + loc.a1Out.emptyA1 + loc.a2In.fullA2 + loc.a2Out.emptyA2;
        wip += loc.pIn.emptyA1WithW + loc.pIn.emptyA2WithW + loc.pIn.emptyA1Ready + loc.pIn.emptyA2Ready;
        wip += loc.pFinished.finishedA1 + loc.pFinished.finishedA2 + loc.pOut.fullA1 + loc.pOut.fullA2;
        if(newState.a1.status === 'Working') wip++; if(newState.a2.status === 'Working') wip++; if(newState.p.status === 'Working') wip++;
        if(newState.m.carrying) wip++;
        newStats.totalWIP = wip;
        
        setSimState(newState);
        setStats(newStats);

    }, [
        isAnimating, simState, timeMultiplier, config, stats, animateMove, animatePMovement,
        simTime, mizuMover, itemMover, kanbanMover, emptyToPMover, a1Animation, a2Animation, pMover, a1Mover, a2Mover
    ]);


    useEffect(() => {
        if (isRunning) {
            simulationIntervalRef.current = window.setInterval(tick, TICK_DURATION_MS);
        } else {
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
            }
        }
        return () => {
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
            }
        };
    }, [isRunning, tick]);

    const handleStepForward = useCallback(() => {
        if (!isRunning && !isAnimating) {
            tick();
        }
    }, [isRunning, isAnimating, tick]);

    const handleStepBackward = useCallback(() => {
        if (!isRunning && !isAnimating && history.length > 0) {
            const lastEntry = history[history.length - 1];
            setSimState(lastEntry.simState);
            setStats(lastEntry.stats);
            setSimTime(lastEntry.simTime);
            setMizuMover(lastEntry.mizuMover);
            setItemMover(lastEntry.itemMover);
            setKanbanMover(lastEntry.kanbanMover);
            setEmptyToPMover(lastEntry.emptyToPMover);
            setPMover(lastEntry.pMover);
            setA1Mover(lastEntry.a1Mover);
            setA2Mover(lastEntry.a2Mover);
            setA1Animation(lastEntry.a1Animation);
            setA2Animation(lastEntry.a2Animation);
            setHistory(h => h.slice(0, -1));
        }
    }, [isRunning, isAnimating, history]);


    if (!simState) {
        return <div className="flex items-center justify-center h-screen bg-gray-100 text-gray-700">Loading Simulation...</div>;
    }

    const starvePercA1 = simTime > 0 ? (stats.starvedTimeA1 / simTime * 100).toFixed(1) : "0.0";
    const starvePercA2 = simTime > 0 ? (stats.starvedTimeA2 / simTime * 100).toFixed(1) : "0.0";
    const saturationPercA1 = simTime > 0 ? (stats.workingTimeA1 / simTime * 100).toFixed(1) : "0.0";
    const saturationPercA2 = simTime > 0 ? (stats.workingTimeA2 / simTime * 100).toFixed(1) : "0.0";
    const saturationPercP = simTime > 0 ? (stats.workingTimeP / simTime * 100).toFixed(1) : "0.0";

    const simTimeMinutes = simTime / 60;
    const rateA1 = simTimeMinutes > 0 ? (stats.throughputA1 / simTimeMinutes).toFixed(1) : "0.0";
    const rateA2 = simTimeMinutes > 0 ? (stats.throughputA2 / simTimeMinutes).toFixed(1) : "0.0";
    const rateP = simTimeMinutes > 0 ? (stats.throughputP / simTimeMinutes).toFixed(1) : "0.0";
    
    const idealRateA1 = (60 / config.cycleTimeA1).toFixed(1);
    const idealRateA2 = (60 / config.cycleTimeA2).toFixed(1);
    const idealRateP = (60 / config.cycleTimeP).toFixed(1);

    const mizuMoveDuration = Math.max(config.moveTimeM * 1000 / timeMultiplier, 100);
    const materialMoveDuration = Math.max(P_MATERIAL_MOVE_DURATION_S * 1000 / timeMultiplier, 100);

    const loc = simState.locations;

    return (
        <div className="flex h-screen overflow-hidden font-sans">
            {/* Mizusumashi Trail */}
            {mizuTrail.map((point, index) => (
                <div
                    key={point.id}
                    className="fixed z-30 pointer-events-none animate-trail-fade"
                    style={{
                        left: point.x,
                        top: point.y,
                        transform: 'translate(-50%, -50%)',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)',
                        opacity: 0.8 - (mizuTrail.length - index - 1) * 0.05,
                    }}
                />
            ))}

            {/* Movable elements for animation */}
            <div
                className={`fixed z-40 pointer-events-none ${mizuActionAnim === 'pick' ? 'animate-pick' : mizuActionAnim === 'drop' ? 'animate-drop' : ''}`}
                style={{
                    left: mizuMover.x, top: mizuMover.y, transform: 'translate(-50%, -50%)',
                    transition: mizuMover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out` : 'none',
                }}
                onAnimationEnd={() => setMizuActionAnim(null)}
            >
                <Operator name="M" state={simState.m} type="M" hideStatus={true} />
            </div>
            {/* P Operator Movement Animation */}
            <div
                className="fixed z-50 pointer-events-none text-3xl"
                style={{
                    left: pMover.x,
                    top: pMover.y,
                    transform: 'translate(-50%, -50%)',
                    opacity: pMover.visible ? 1 : 0,
                    transition: pMover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >
                👨‍🔧
            </div>
            {/* A1 Operator Movement Animation */}
            <div
                className="fixed z-50 pointer-events-none text-2xl"
                style={{
                    left: a1Mover.x,
                    top: a1Mover.y,
                    transform: 'translate(-50%, -50%)',
                    opacity: a1Mover.visible ? 1 : 0,
                    transition: a1Mover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >
                👷
            </div>
            {/* A2 Operator Movement Animation */}
            <div
                className="fixed z-50 pointer-events-none text-2xl"
                style={{
                    left: a2Mover.x,
                    top: a2Mover.y,
                    transform: 'translate(-50%, -50%)',
                    opacity: a2Mover.visible ? 1 : 0,
                    transition: a2Mover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >
                👷
            </div>
            <div
                className="fixed z-50 pointer-events-none"
                style={{
                    left: itemMover.x, top: itemMover.y, transform: 'translate(-50%, -50%)',
                    opacity: itemMover.visible ? 1 : 0,
                    transition: itemMover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >{itemMover.content}</div>
             <div
                className="fixed z-40 pointer-events-none"
                style={{
                    left: kanbanMover.x, top: kanbanMover.y, transform: 'translate(-50%, -50%)',
                    opacity: kanbanMover.visible ? 1 : 0,
                    transition: kanbanMover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >{kanbanMover.content}</div>
            <div
                className="fixed z-40 pointer-events-none"
                style={{
                    left: emptyToPMover.x, top: emptyToPMover.y, transform: 'translate(-50%, -50%)',
                    opacity: emptyToPMover.visible ? 1 : 0,
                    transition: emptyToPMover.isTransitioning ? `left ${mizuMoveDuration}ms ease-in-out, top ${mizuMoveDuration}ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >{emptyToPMover.content}</div>
            {/* Assembly Animation Movers */}
            <div className={`fixed z-30 pointer-events-none ${a1Animation.visible ? 'opacity-100' : 'opacity-0'}`} style={a1Animation.style}>
                <ContainerVisual type="A1" empty withWKanban />
            </div>
            <div className={`fixed z-30 pointer-events-none ${a2Animation.visible ? 'opacity-100' : 'opacity-0'}`} style={a2Animation.style}>
                <ContainerVisual type="A2" empty withWKanban />
            </div>
            {/* Finished Piece Movers */}
            <div
                className="fixed z-40 pointer-events-none"
                style={{
                    left: finishedA1Mover.x, top: finishedA1Mover.y, transform: 'translate(-50%, -50%)',
                    opacity: finishedA1Mover.visible ? 1 : 0,
                    transition: finishedA1Mover.isTransitioning ? `left 500ms ease-in-out, top 500ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >{finishedA1Mover.content}</div>
            <div
                className="fixed z-40 pointer-events-none"
                style={{
                    left: finishedA2Mover.x, top: finishedA2Mover.y, transform: 'translate(-50%, -50%)',
                    opacity: finishedA2Mover.visible ? 1 : 0,
                    transition: finishedA2Mover.isTransitioning ? `left 500ms ease-in-out, top 500ms ease-in-out, opacity 0.2s linear` : 'opacity 0.2s linear',
                }}
            >{finishedA2Mover.content}</div>

            {/* Left Sidebar - Controls */}
            <aside className="w-96 bg-gray-50 overflow-y-auto flex-shrink-0 border-r border-gray-300">
                <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h1 className="text-2xl font-bold text-gray-800">Dynamic Kanban System</h1>
                        <p className="text-gray-600 mt-1 text-sm">Observe flow and WIP by adjusting system parameters.</p>
                        <p className="text-gray-500 mt-1 text-xs">Operations management and Lean Production - Filippo De Carlo</p>
                    </div>

                    {/* Main Controls */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h3 className="font-semibold text-gray-700 mb-3">Simulation Controls</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleStepBackward} disabled={isRunning || isAnimating || history.length === 0} className="px-3 py-2 rounded-md font-semibold bg-gray-500 text-white hover:bg-gray-600 transition-transform hover:scale-105 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:scale-100 text-sm">
                                ◀ Step
                            </button>
                            <button onClick={handleStepForward} disabled={isRunning || isAnimating} className="px-3 py-2 rounded-md font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-transform hover:scale-105 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:scale-100 text-sm">
                                Step ▶
                            </button>
                            <button onClick={handleStartPause} disabled={needsReset} className={`px-3 py-2 rounded-md font-semibold text-white transition-transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100 text-sm col-span-2 ${isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                                {isRunning ? '⏸ Pause' : '▶ ' + (simTime > 0 ? 'Resume' : 'Start')}
                            </button>
                            <button onClick={handleReset} className="px-3 py-2 rounded-md font-semibold bg-gray-600 text-white hover:bg-gray-700 transition-transform hover:scale-105 text-sm col-span-2">↻ Reset</button>
                        </div>
                    </div>

                    {/* Stats & Status */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h3 className="font-semibold text-gray-700 mb-3">Statistics</h3>
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-blue-50 p-2 rounded-lg"><div className="text-xs text-blue-800">Sim. Time</div><div className="text-lg font-bold text-blue-900">{simTime.toFixed(1)}s</div></div>
                            <div className="bg-purple-50 p-2 rounded-lg"><div className="text-xs text-purple-800">Total WIP</div><div className="text-lg font-bold text-purple-900">{stats.totalWIP}</div></div>
                            <div className="bg-green-50 p-2 rounded-lg"><div className="text-xs text-green-800">Finished</div><div className="text-lg font-bold text-green-900">{stats.totalThroughput}</div></div>
                            <div className="bg-blue-50 p-2 rounded-lg"><div className="text-xs text-blue-800">Speed</div><div className="text-lg font-bold text-blue-900">x{timeMultiplier}</div></div>
                            <div className="bg-green-50 p-2 rounded-lg"><div className="text-xs text-green-800">Saturation A1</div><div className="text-lg font-bold text-green-900">{saturationPercA1}%</div></div>
                            <div className="bg-teal-50 p-2 rounded-lg"><div className="text-xs text-teal-800">Saturation A2</div><div className="text-lg font-bold text-teal-900">{saturationPercA2}%</div></div>
                        </div>
                        <div className="mt-2">
                            <div className="text-xs text-gray-600 mb-1">Speed Multiplier</div>
                            <input type="range" min="1" max="20" value={timeMultiplier} onChange={e => setTimeMultiplier(Number(e.target.value))} className="w-full" />
                        </div>
                        <div className="mt-2 bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg text-sm"><span className="font-semibold">Status:</span> {needsReset ? "Config changed. Press Reset." : (isRunning ? "Running..." : "Paused")}</div>
                    </div>

                    {/* Configuration */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h3 className="font-semibold text-gray-700 mb-3">Configuration</h3>
                        <div className="space-y-2 text-sm">
                            {[ {id: 'cycleTimeA1', label: 'Cycle Time A1 (s)'}, {id: 'cycleTimeA2', label: 'Cycle Time A2 (s)'}, {id: 'cycleTimeP', label: 'Cycle Time P (s)'}, {id: 'moveTimeM', label: 'Move Time M (s)'}, {id: 'actionTimeM', label: 'Action Time M (s)'}, {id: 'numKanbanPairsA1', label: '# Kanban Pairs A1'}, {id: 'numKanbanPairsA2', label: '# Kanban Pairs A2'} ].map(c => (
                                <div key={c.id}>
                                    <label htmlFor={c.id} className="block text-gray-600 text-xs">{c.label}</label>
                                    <input type="number" id={c.id} value={config[c.id as keyof Config]} onChange={handleConfigChange} min="1" step="1" className="w-full p-1.5 border rounded-md" disabled={isRunning} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Challenge Selector */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h3 className="font-semibold text-gray-700 mb-2">Challenges</h3>
                        <p className="text-gray-600 mb-3 text-xs">Select a challenge to load preset configurations.</p>

                        <div className="grid grid-cols-1 gap-2">
                            {CHALLENGES.map(challenge => (
                                <button
                                    key={challenge.id}
                                    onClick={() => handleChallengeSelect(challenge.id)}
                                    className={`px-3 py-2 rounded-md font-medium transition-all text-sm text-left ${
                                        selectedChallenge === challenge.id
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    {challenge.name}
                                </button>
                            ))}
                        </div>

                        {/* Challenge Description */}
                        {selectedChallenge >= 0 && (
                            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <p className="text-xs text-indigo-900">
                                    <span className="font-bold">Goal:</span> {CHALLENGES[selectedChallenge].description}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Right Main Area - Simulation */}
            <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
                {/* Production Area */}
                <div className="bg-green-50 border-4 border-green-300 rounded-lg p-6 mb-4">
                    <h2 className="text-xl font-bold text-green-800 mb-4">Production Department</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* P-OUT */}
                        <div className="bg-gray-200 p-4 rounded-lg" ref={elementRefs.pOutArea}>
                            <div className="bg-gray-600 text-white font-bold text-center py-2 rounded-md mb-2">P-OUT</div>
                            <div className="text-center text-sm text-gray-700">Full (for M)</div>
                            <div className="flex items-center justify-center flex-wrap gap-2 p-2 min-h-[140px]">
                                {[...Array(Math.max(0, loc.pOut.fullA1))].map((_,i) => <ContainerVisual key={`po1-${i}`} type="A1" withWKanban />)}
                                {[...Array(Math.max(0, loc.pOut.fullA2))].map((_,i) => <ContainerVisual key={`po2-${i}`} type="A2" withWKanban />)}
                                
                                {/* Render container being processed by M to prevent it from disappearing during the multi-step kanban swap */}
                                {(() => {
                                    const m = simState.m;
                                    if (!m.carrying) return null;

                                    // Case 1: M has dropped the finished item and is handling the P-Kanban and fetching the W-Kanban.
                                    const isProcessingFinished =
                                        m.task?.type === M_Tasks.PROCESS_FINISHED &&
                                        m.carrying?.type === 'Finished' &&
                                        m.status !== M_Status.MOVING_TO_P_OUT_WITH_FINISHED &&
                                        m.status !== M_Status.PICKING_FINISHED;

                                    // Case 2: M has just attached the W-Kanban and is about to pick up the now-"Full" container.
                                    const isPickingUpFullAfterChain =
                                        m.task?.type === M_Tasks.DELIVER_FULL &&
                                        m.carrying?.type === 'Full' &&
                                        m.status === M_Status.PICKING_FULL_POUT;

                                    if (isProcessingFinished) {
                                        return (
                                            <ContainerVisual
                                                type={m.carrying!.product}
                                                withPKanban={m.carrying!.hasPKanban}
                                            />
                                        );
                                    }
                                    if (isPickingUpFullAfterChain) {
                                        return <ContainerVisual type={m.carrying!.product} withWKanban />;
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                        {/* P-IN */}
                        <div className="bg-gray-200 p-4 rounded-lg" ref={elementRefs.pInArea}>
                            <div className="bg-gray-600 text-white font-bold text-center py-2 rounded-md mb-2">P-IN</div>
                             <div className="grid grid-cols-2 divide-x divide-gray-300">
                                <div className="px-1">
                                    <div className="text-center text-xs text-gray-600 p-1 font-semibold">With W-Kanban</div>
                                    <div className="flex items-start justify-center flex-wrap gap-2 p-2 min-h-[120px]">
                                        {[...Array(Math.max(0, loc.pIn.emptyA1WithW))].map((_, i) => <ContainerVisual key={`piw1-${i}`} type="A1" empty withWKanban />)}
                                        {[...Array(Math.max(0, loc.pIn.emptyA2WithW))].map((_, i) => <ContainerVisual key={`piw2-${i}`} type="A2" empty withWKanban />)}
                                    </div>
                                </div>
                                <div className="px-1">
                                    <div className="text-center text-xs text-gray-600 p-1 font-semibold">Ready for Prod.</div>
                                    <div className="flex items-start justify-center flex-wrap gap-2 p-2 min-h-[120px]">
                                        {[...Array(Math.max(0, loc.pIn.emptyA1Ready))].map((_, i) => <ContainerVisual key={`pir1-${i}`} type="A1" empty />)}
                                        {[...Array(Math.max(0, loc.pIn.emptyA2Ready))].map((_, i) => <ContainerVisual key={`pir2-${i}`} type="A2" empty />)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Heijunka */}
                        <div className="bg-gray-200 p-4 rounded-lg" ref={elementRefs.heijunkaBox}>
                            <div className="font-bold text-center mb-2">Heijunka Box</div>
                            <div className="text-center text-sm text-gray-700">Production Kanban</div>
                            <div className="flex items-start justify-start gap-2 p-2 min-h-[140px] bg-white border rounded mt-1 overflow-hidden relative">
                                {/* FIFO Queue visualization - left to right */}
                                {loc.heijunka.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                        Empty
                                    </div>
                                )}
                                {loc.heijunka.map((kanbanType, i) => (
                                    <div
                                        key={`h-${kanbanType}-${i}`}
                                        className="transition-all duration-500 ease-out"
                                        style={{
                                            transform: i === 0 ? 'scale(1.05)' : 'scale(1)',
                                            opacity: i === 0 ? 1 : 0.85,
                                            animation: i === loc.heijunka.length - 1 ? 'slide-in-right 0.5s ease-out' : 'none'
                                        }}
                                    >
                                        <MiniKanban type={kanbanType} animated={i === 0} />
                                        {i === 0 && (
                                            <div className="text-[8px] text-center text-green-600 font-bold mt-0.5">Next</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Operator P */}
                        <div className="flex flex-col items-center justify-center relative" ref={elementRefs.operatorP}>
                           <div style={{ opacity: pMover.visible ? 0 : 1 }}>
                               <Operator name="P" state={simState.p} type="P" />
                           </div>
                           {/* Show P-Kanban when working */}
                           {simState.p.status === 'Working' && simState.p.producingType && (
                               <div className="absolute top-1 -right-1">
                                   <MiniKanban type={simState.p.producingType} />
                               </div>
                           )}
                           <div className="mt-4 text-sm font-semibold text-gray-700">Sat: {saturationPercP}%</div>
                           <div className="mt-1 text-base text-gray-800 font-bold">{rateP} p/min</div>
                           <div className="text-xs text-gray-500">(Ideal: {idealRateP} p/min)</div>
                        </div>
                        {/* P-Finished */}
                        <div className="bg-gray-200 p-4 rounded-lg" ref={elementRefs.pFinishedArea}><div className="bg-gray-600 text-white font-bold text-center py-2 rounded-md mb-2">P-Finished</div><div className="text-center text-sm text-gray-700">Finished (for M)</div><div className="flex items-center justify-center flex-wrap gap-2 p-2 min-h-[140px]">{[...Array(Math.max(0, loc.pFinished.finishedA1))].map((_,i) => <ContainerVisual key={`pf1-${i}`} type="A1" withPKanban />)}{[...Array(Math.max(0, loc.pFinished.finishedA2))].map((_,i) => <ContainerVisual key={`pf2-${i}`} type="A2" withPKanban />)}</div></div>
                    </div>
                </div>

                {/* Assembly Area */}
                <div className="bg-blue-50 border-4 border-blue-300 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-blue-800 mb-4">Assembly Department</h2>

                    {/* A1 Line */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                         {/* A1-IN */}
                         <div ref={elementRefs.a1InArea}>
                             <StorageArea title="A1-IN" subtitle="Full (from M)" count={loc.a1In.fullA1} maxCapacity={config.numKanbanPairsA1 + 2} headerColor="bg-red-800">
                                 <div className="flex items-center justify-center flex-wrap gap-2 p-2 min-h-[100px] container-3d">
                                     {[...Array(Math.max(0, loc.a1In.fullA1))].map((_,i) => (
                                         <div key={`a1i-${i}`} className="container-stacked" style={{ transform: `translateZ(${i * 2}px)` }}>
                                             <ContainerVisual type="A1" withWKanban />
                                         </div>
                                     ))}
                                 </div>
                             </StorageArea>
                         </div>
                        {/* A1 Operator */}
                        <div className="flex flex-col items-center justify-center relative" ref={elementRefs.operatorA1}>
                            <div style={{ opacity: a1Mover.visible ? 0 : 1 }}>
                                <Operator name="A1" state={simState.a1} type="A" />
                            </div>
                            <div className="mt-4 text-sm font-semibold text-gray-700">Sat: {saturationPercA1}%</div>
                            <div className="mt-1 text-base text-gray-800 font-bold">{rateA1} p/min</div>
                            <div className="text-xs text-gray-500">(Ideal: {idealRateA1} p/min)</div>
                        </div>
                        {/* A1-OUT */}
                        <div className="bg-gray-200 p-4 rounded-lg" ref={elementRefs.a1OutArea}>
                            <div className="bg-red-800 text-white font-bold text-center py-2 rounded-md mb-2">A1-OUT</div>
                            <div className="text-center text-sm text-gray-700">Empty (for M)</div>
                            <div className="flex items-center justify-center flex-wrap gap-2 p-2 min-h-[100px]">
                                {[...Array(Math.max(0, loc.a1Out.emptyA1))].map((_,i) => <ContainerVisual key={`a1o-${i}`} type="A1" empty withWKanban />)}
                            </div>
                        </div>
                        {/* A1 Finished Pieces */}
                        <div className="bg-green-100 p-3 rounded-lg border-2 border-green-400" ref={elementRefs.a1FinishedArea}>
                            <div className="text-center font-bold text-green-800 mb-1 text-sm">A1 Finished</div>
                            <div className="flex items-center justify-center gap-1 flex-wrap min-h-[80px]">
                                {[...Array(Math.min(stats.throughputA1, 8))].map((_, i) => (
                                    <div key={`fa1-${i}`} className="text-2xl">📦</div>
                                ))}
                                {stats.throughputA1 > 8 && (
                                    <div className="text-base font-bold text-green-800">+{stats.throughputA1 - 8}</div>
                                )}
                            </div>
                            <div className="text-center text-xs font-semibold text-green-800 mt-1">Total: {stats.throughputA1}</div>
                        </div>
                    </div>

                    {/* Mizusumashi Status - Compact & Centered */}
                    <div className="flex justify-center my-4">
                        <div className="bg-green-50 px-6 py-2 rounded-full border-2 border-green-400 inline-flex items-center gap-3">
                            <div className="text-sm font-bold text-green-700">M:</div>
                            <div className="text-sm text-gray-800 font-semibold">{STATUS_SHORT_NAMES[simState.m.status as M_Status] || simState.m.status}</div>
                            {simState.m.timer > 0 && simState.m.status !== M_Status.IDLE && (
                                <div className="text-xs text-gray-600">({simState.m.timer.toFixed(1)}s)</div>
                            )}
                        </div>
                        {/* Mizusumashi Home Base - Hidden */}
                        <div ref={elementRefs.operatorM} className="opacity-0 pointer-events-none absolute">
                            <Operator name="M" state={simState.m} type="M" />
                        </div>
                    </div>

                    {/* A2 Line */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* A2-IN */}
                        <div ref={elementRefs.a2InArea}>
                            <StorageArea title="A2-IN" subtitle="Full (from M)" count={loc.a2In.fullA2} maxCapacity={config.numKanbanPairsA2 + 2} headerColor="bg-orange-800">
                                <div className="flex items-center justify-center flex-wrap gap-2 p-2 min-h-[100px] container-3d">
                                    {[...Array(Math.max(0, loc.a2In.fullA2))].map((_,i) => (
                                        <div key={`a2i-${i}`} className="container-stacked" style={{ transform: `translateZ(${i * 2}px)` }}>
                                            <ContainerVisual type="A2" withWKanban />
                                        </div>
                                    ))}
                                </div>
                            </StorageArea>
                        </div>
                        {/* A2 Operator */}
                         <div className="flex flex-col items-center justify-center relative" ref={elementRefs.operatorA2}>
                            <div style={{ opacity: a2Mover.visible ? 0 : 1 }}>
                                <Operator name="A2" state={simState.a2} type="A" />
                            </div>
                             <div className="mt-4 text-sm font-semibold text-gray-700">Sat: {saturationPercA2}%</div>
                             <div className="mt-1 text-base text-gray-800 font-bold">{rateA2} p/min</div>
                             <div className="text-xs text-gray-500">(Ideal: {idealRateA2} p/min)</div>
                        </div>
                        {/* A2-OUT */}
                        <div className="bg-gray-200 p-4 rounded-lg" ref={elementRefs.a2OutArea}>
                            <div className="bg-orange-800 text-white font-bold text-center py-2 rounded-md mb-2">A2-OUT</div>
                            <div className="text-center text-sm text-gray-700">Empty (for M)</div>
                            <div className="flex items-center justify-center flex-wrap gap-2 p-2 min-h-[100px]">
                                {[...Array(Math.max(0, loc.a2Out.emptyA2))].map((_,i) => <ContainerVisual key={`a2o-${i}`} type="A2" empty withWKanban />)}
                            </div>
                        </div>
                        {/* A2 Finished Pieces */}
                        <div className="bg-orange-100 p-3 rounded-lg border-2 border-orange-400" ref={elementRefs.a2FinishedArea}>
                            <div className="text-center font-bold text-orange-800 mb-1 text-sm">A2 Finished</div>
                            <div className="flex items-center justify-center gap-1 flex-wrap min-h-[80px]">
                                {[...Array(Math.min(stats.throughputA2, 8))].map((_, i) => (
                                    <div key={`fa2-${i}`} className="text-2xl">⚙️</div>
                                ))}
                                {stats.throughputA2 > 8 && (
                                    <div className="text-base font-bold text-orange-800">+{stats.throughputA2 - 8}</div>
                                )}
                            </div>
                            <div className="text-center text-xs font-semibold text-orange-800 mt-1">Total: {stats.throughputA2}</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}