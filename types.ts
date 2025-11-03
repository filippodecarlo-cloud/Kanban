// FIX: Import ReactNode to make the type available in this file.
// FIX: Import CSSProperties to resolve the 'React' namespace error.
import type { ReactNode, CSSProperties } from 'react';
import { M_Status } from './constants';

export interface Config {
  cycleTimeA1: number;
  cycleTimeA2: number;
  cycleTimeP: number;
  moveTimeM: number;
  actionTimeM: number;
  numKanbanPairsA1: number;
  numKanbanPairsA2: number;
}

export interface StationState {
  status: 'Idle' | 'Working' | 'Starved';
  timer: number;
  kanbanWaiting: number;
  producingType: 'A1' | 'A2' | null;
}

export interface OperatorPState {
    status: 'Idle' | 'Working' | 'Preparing' | 'Delivering';
    timer: number;
    producingType: 'A1' | 'A2' | null;
}

export interface CarryingItem {
    type: 'Empty' | 'Finished' | 'Full' | 'EmptyBatch';
    product: 'A1' | 'A2';
    count?: number; // Number of items carried (for batch operations)
    emptyA1?: number; // For EmptyBatch: count of A1 empties
    emptyA2?: number; // For EmptyBatch: count of A2 empties
    hasPKanban?: boolean; // Tracks if the finished item still has its P-Kanban
    detachedKP?: { product: 'A1' | 'A2' };
    takenKW?: { product: 'A1' | 'A2' };
}

export interface MizuTask {
    type: string;
    product: 'A1' | 'A2';
}

export interface MizuState {
    status: M_Status;
    timer: number;
    task: MizuTask | null;
    carrying: CarryingItem | null;
}

export interface LocationsState {
    a1In: { fullA1: number };
    a1Out: { emptyA1: number };
    a2In: { fullA2: number };
    a2Out: { emptyA2: number };
    pIn: {
        emptyA1WithW: number;
        emptyA2WithW: number;
        emptyA1Ready: number;
        emptyA2Ready: number;
    };
    pFinished: { finishedA1: number; finishedA2: number };
    pOut: { fullA1: number; fullA2: number };
    heijunka: ('A1' | 'A2')[];
}

export interface SimulationState {
    a1: StationState;
    a2: StationState;
    p: OperatorPState;
    locations: LocationsState;
    m: MizuState;
    deliveryQueue: ('A1' | 'A2')[]; // FIFO queue for delivery requests
}

export interface Stats {
    totalWIP: number;
    totalThroughput: number;
    starvedTimeA1: number;
    starvedTimeA2: number;
    workingTimeA1: number;
    workingTimeA2: number;
    workingTimeP: number;
    throughputA1: number;
    throughputA2: number;
    throughputP: number;
}

export interface MovingElement {
    visible: boolean;
    x: number;
    y: number;
    isTransitioning: boolean;
    // FIX: Use the imported ReactNode type directly instead of React.ReactNode to resolve the namespace error.
    content: ReactNode;
}

export interface AssemblyAnimationState {
    visible: boolean;
    product: 'A1' | 'A2';
    animationType: 'piece' | 'container'; // 'piece' = show product icon, 'container' = show empty container
    // FIX: Use the imported CSSProperties type directly to resolve the 'React' namespace error.
    style: CSSProperties;
}