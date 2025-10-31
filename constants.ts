
export enum M_Tasks {
    FETCH_EMPTY = 'FetchEmpty',
    FETCH_EMPTY_BATCH = 'FetchEmptyBatch', // Collect from both A1 and A2
    PROCESS_FINISHED = 'ProcessFinished',
    DELIVER_FULL = 'DeliverFull',
}

export enum M_Status {
    IDLE = 'Idle',
    // Fetch Empty
    MOVING_TO_A1_OUT = 'Moving to A1-OUT',
    PICKING_A1_EMPTY = 'Picking A1 Empty',
    MOVING_TO_A2_OUT = 'Moving to A2-OUT',
    PICKING_A2_EMPTY = 'Picking A2 Empty',
    MOVING_TO_P_IN_WITH_EMPTY = 'Moving to P-IN (Empty)',
    DROPPING_EMPTY = 'Dropping Empty',
    // Process Finished
    MOVING_TO_P_FINISHED = 'Moving to P-Finished',
    PICKING_FINISHED = 'Picking Finished',
    MOVING_TO_P_OUT_WITH_FINISHED = 'Moving to P-OUT (Finished)',
    DROPPING_FINISHED = 'Dropping Finished (Temp)',
    ACT_DETACH_KP = 'Detaching KP',
    MOVING_TO_HEIJUNKA_WITH_KP = 'Moving to Heijunka (KP)',
    DROPPING_KP = 'Dropping KP',
    MOVING_TO_P_IN_FOR_KW = 'Moving to P-IN (for KW)',
    ACT_TAKE_KW = 'Taking KW',
    MOVING_TO_P_OUT_WITH_KW = 'Moving to P-OUT (KW)',
    ACT_ATTACH_KW = 'Attaching KW',
    // Deliver Full
    MOVING_TO_P_OUT_FOR_FULL = 'Moving to P-OUT (for Full)',
    PICKING_FULL_POUT = 'Picking Full (P-OUT)',
    MOVING_TO_A1_IN_WITH_FULL = 'Moving to A1-IN (Full)',
    DROPPING_FULL_A1 = 'Dropping Full (A1-IN)',
    MOVING_TO_A2_IN_WITH_FULL = 'Moving to A2-IN (Full)',
    DROPPING_FULL_A2 = 'Dropping Full (A2-IN)',
}

export const STATUS_SHORT_NAMES: Record<M_Status, string> = {
    [M_Status.IDLE]: 'Idle',
    [M_Status.MOVING_TO_A1_OUT]: '-> A1-OUT',
    [M_Status.PICKING_A1_EMPTY]: 'Pick A1 Empty',
    [M_Status.MOVING_TO_A2_OUT]: '-> A2-OUT',
    [M_Status.PICKING_A2_EMPTY]: 'Pick A2 Empty',
    [M_Status.MOVING_TO_P_IN_WITH_EMPTY]: '-> P-IN (Empty)',
    [M_Status.DROPPING_EMPTY]: 'Drop Empty @P-IN',
    [M_Status.MOVING_TO_P_FINISHED]: '-> P-Finished',
    [M_Status.PICKING_FINISHED]: 'Pick Finished',
    [M_Status.MOVING_TO_P_OUT_WITH_FINISHED]: '-> P-OUT (Fin)',
    [M_Status.DROPPING_FINISHED]: 'Drop Fin @P-OUT',
    [M_Status.ACT_DETACH_KP]: 'Detach KP @P-OUT',
    [M_Status.MOVING_TO_HEIJUNKA_WITH_KP]: '-> Heijunka (KP)',
    [M_Status.DROPPING_KP]: 'Drop KP @Heijunka',
    [M_Status.MOVING_TO_P_IN_FOR_KW]: '-> P-IN (for KW)',
    [M_Status.ACT_TAKE_KW]: 'Take KW @P-IN',
    [M_Status.MOVING_TO_P_OUT_WITH_KW]: '-> P-OUT (KW)',
    [M_Status.ACT_ATTACH_KW]: 'Attach KW @P-OUT',
    [M_Status.MOVING_TO_P_OUT_FOR_FULL]: '-> P-OUT (for Full)',
    [M_Status.PICKING_FULL_POUT]: 'Pick Full @P-OUT',
    [M_Status.MOVING_TO_A1_IN_WITH_FULL]: '-> A1-IN (Full)',
    [M_Status.DROPPING_FULL_A1]: 'Drop Full @A1-IN',
    [M_Status.MOVING_TO_A2_IN_WITH_FULL]: '-> A2-IN (Full)',
    [M_Status.DROPPING_FULL_A2]: 'Drop Full @A2-IN',
};

export const INITIAL_CONFIG: import('./types').Config = {
    cycleTimeA1: 20,
    cycleTimeA2: 24,
    cycleTimeP: 8,
    moveTimeM: 3,
    actionTimeM: 1,
    numKanbanPairsA1: 1,
    numKanbanPairsA2: 1,
};