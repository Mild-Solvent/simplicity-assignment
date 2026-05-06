import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import NotificationToast from '../../components/NotificationToast';
import { useWebSocket } from '../../hooks/useWebSocket';

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}));

// Capture the onMessage callback registered by the component
let onMessage;

beforeEach(() => {
  vi.clearAllMocks();
  useWebSocket.mockImplementation((cb) => {
    onMessage = cb;
  });
});

function fireMessage(payload) {
  act(() => onMessage(payload));
}

describe('NotificationToast', () => {
  test('renders nothing when no toasts are pending', () => {
    render(<NotificationToast />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('.toast-container')).toBeNull();
  });

  test('shows a toast when NEW_ANNOUNCEMENT message arrives', () => {
    render(<NotificationToast />);

    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'Park Opens', body: 'Grand opening.' } });

    expect(screen.getByText('Park Opens')).toBeInTheDocument();
    expect(screen.getByText('Grand opening.')).toBeInTheDocument();
  });

  test('uses "Untitled" when data.title is absent', () => {
    render(<NotificationToast />);

    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: {} });

    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  test('ignores messages of unknown type', () => {
    render(<NotificationToast />);

    fireMessage({ type: 'SOME_OTHER_EVENT', data: { title: 'Ignored' } });

    expect(screen.queryByText('Ignored')).toBeNull();
    expect(document.querySelector('.toast-container')).toBeNull();
  });

  test('close button removes the toast', async () => {
    const user = userEvent.setup();
    render(<NotificationToast />);

    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'Removable Toast', body: '' } });

    expect(screen.getByText('Removable Toast')).toBeInTheDocument();

    await user.click(screen.getByTitle ? screen.getByRole('button') : document.querySelector('.toast-close'));

    expect(screen.queryByText('Removable Toast')).toBeNull();
  });

  test('auto-dismisses after 4 seconds', () => {
    vi.useFakeTimers();
    render(<NotificationToast />);

    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'Auto Dismiss', body: '' } });

    expect(screen.getByText('Auto Dismiss')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));

    expect(screen.queryByText('Auto Dismiss')).toBeNull();
    vi.useRealTimers();
  });

  test('multiple toasts can be shown at once', () => {
    render(<NotificationToast />);

    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'First', body: '' } });
    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'Second', body: '' } });

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  test('closing one toast does not affect others', async () => {
    const user = userEvent.setup();
    render(<NotificationToast />);

    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'First', body: '' } });
    fireMessage({ type: 'NEW_ANNOUNCEMENT', data: { title: 'Second', body: '' } });

    const closeButtons = document.querySelectorAll('.toast-close');
    await user.click(closeButtons[0]);

    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
