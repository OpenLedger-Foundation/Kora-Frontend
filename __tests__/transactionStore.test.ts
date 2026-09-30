import { useTransactionStore, MAX_HISTORY } from '../store/transactionStore';

const resetStore = () => {
  useTransactionStore.setState({
    transactions: [],
    history: [],
    escrowStep: 'idle',
  });
};

describe('transactionStore escrow step transitions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts in the idle escrow step', () => {
    expect(useTransactionStore.getState().escrowStep).toBe('idle');
  });

  it('advances through escrow steps in order', () => {
    const { setEscrowStep } = useTransactionStore.getState();

    setEscrowStep('funding');
    expect(useTransactionStore.getState().escrowStep).toBe('funding');

    setEscrowStep('funded');
    expect(useTransactionStore.getState().escrowStep).toBe('funded');

    setEscrowStep('releasing');
    expect(useTransactionStore.getState().escrowStep).toBe('releasing');

    setEscrowStep('released');
    expect(useTransactionStore.getState().escrowStep).toBe('released');
  });

  it('can reset the escrow step back to idle', () => {
    const { setEscrowStep } = useTransactionStore.getState();

    setEscrowStep('funded');
    setEscrowStep('idle');

    expect(useTransactionStore.getState().escrowStep).toBe('idle');
  });
});

describe('transactionStore history cap', () => {
  beforeEach(() => {
    resetStore();
  });

  it('appends history entries', () => {
    const { addToHistory } = useTransactionStore.getState();

    addToHistory({ id: 'tx-1', status: 'pending' });
    addToHistory({ id: 'tx-2', status: 'success' });

    const { history } = useTransactionStore.getState();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ id: 'tx-1' });
    expect(history[1]).toMatchObject({ id: 'tx-2' });
  });

  it('trims history to MAX_HISTORY entries', () => {
    const { addToHistory } = useTransactionStore.getState();

    for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
      addToHistory({ id: `tx-${i}`, status: 'success' });
    }

    const { history } = useTransactionStore.getState();
    expect(history).toHaveLength(MAX_HISTORY);
  });

  it('keeps the most recent entries when trimming', () => {
    const { addToHistory } = useTransactionStore.getState();

    for (let i = 0; i < MAX_HISTORY + 3; i += 1) {
      addToHistory({ id: `tx-${i}`, status: 'success' });
    }

    const { history } = useTransactionStore.getState();
    const newest = history[history.length - 1];
    const oldest = history[0];

    expect(newest).toMatchObject({ id: `tx-${MAX_HISTORY + 2}` });
    expect(oldest).toMatchObject({ id: 'tx-3' });
  });

  it('clears history on reset', () => {
    const { addToHistory, clearHistory } = useTransactionStore.getState();

    addToHistory({ id: 'tx-1', status: 'success' });
    clearHistory();

    expect(useTransactionStore.getState().history).toHaveLength(0);
  });
});
