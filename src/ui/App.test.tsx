import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n';
import { AppProvider } from '../state/AppContext';
import { fileIdStore } from '../data/bootstrap';
import { fakeServices } from '../test/fakeServices';
import { App } from './App';

beforeAll(() => initI18n());
beforeEach(() => {
  fileIdStore.set(null);
  history.replaceState(null, '', '/');
});

async function signInAndCreateFamily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await screen.findByText('No family sheet found');
  await user.click(screen.getByRole('button', { name: 'Create new family' }));
  await user.type(screen.getByLabelText('Family name'), 'Nevet');
  await user.type(screen.getByLabelText('Name'), 'Noa');
  await user.selectOptions(screen.getByLabelText('Frequency'), 'none');
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await screen.findByRole('heading', { name: 'Nevet' });
}

describe('App (parent)', () => {
  it('creates a family, deposits and withdraws, and rejects hand edits', async () => {
    const user = userEvent.setup();
    const { services, sheets } = fakeServices();
    render(
      <AppProvider services={services}>
        <App />
      </AppProvider>,
    );
    await signInAndCreateFamily(user);

    // Home shows the kid with a zero balance in ILS.
    const card = screen.getByRole('link', { name: /Noa/ });
    expect(within(card).getByText('₪0.00')).toBeInTheDocument();
    expect(fileIdStore.get()).toBe('sheet-1');

    // Deposit 12.50
    await user.click(card);
    await user.click(await screen.findByRole('button', { name: 'Deposit' }));
    await user.type(screen.getByLabelText(/Amount/), '12,5');
    await user.type(screen.getByLabelText('Note'), 'birthday');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByText('₪12.50', { selector: '.money--big' })).toBeInTheDocument(),
    );
    expect(screen.getByText('birthday')).toBeInTheDocument();

    // Withdraw 2
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    await user.type(screen.getByLabelText(/Amount/), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByText('₪10.50', { selector: '.money--big' })).toBeInTheDocument(),
    );

    // A goal with progress
    await user.click(screen.getByRole('button', { name: 'Add goal' }));
    await user.type(screen.getByLabelText('What is it?'), 'Lego');
    await user.type(screen.getByLabelText(/Price/), '21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Lego');
    expect(screen.getByRole('progressbar', { name: 'Lego' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );

    // Tamper with the deposit row by hand: it is ignored and reported.
    const txRows = sheets.tabs.get('transactions')!;
    txRows[1]![3] = '999.00';
    await user.click(screen.getByRole('link', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Retry' })); // refresh
    await screen.findByText('1 row in the sheet was ignored');
    expect(
      within(screen.getByRole('link', { name: /Noa/ })).getByText('-₪2.00'),
    ).toBeInTheDocument();
  });

  it('shares with a kid viewer from settings', async () => {
    const user = userEvent.setup();
    const { services, drive } = fakeServices();
    render(
      <AppProvider services={services}>
        <App />
      </AppProvider>,
    );
    await signInAndCreateFamily(user);
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await screen.findByText('parent@example.com');
    await user.type(screen.getByLabelText('Email'), 'kid@example.com');
    await user.selectOptions(screen.getByLabelText('Role'), 'reader');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    await screen.findByText('kid@example.com');
    expect(drive.createPermission).toHaveBeenCalledWith(
      'sheet-1',
      'kid@example.com',
      'reader',
      expect.stringContaining('https://app.test/?join=sheet-1'),
    );
  });
});

describe('App (kid viewer)', () => {
  it('sees balances but no edit controls', async () => {
    const user = userEvent.setup();
    const parent = fakeServices();
    const { services: p } = parent;
    // Prepare a family as the parent first.
    const { unmount } = render(
      <AppProvider services={p}>
        <App />
      </AppProvider>,
    );
    await signInAndCreateFamily(user);
    unmount();

    // Same sheet, viewer capabilities.
    const viewer = fakeServices({ canEdit: false, email: 'kid@example.com' });
    viewer.sheets.tabs = parent.sheets.tabs;
    viewer.files.set('sheet-1', {
      id: 'sheet-1',
      name: 'Pocket Money',
      capabilities: { canEdit: false, canShare: false },
    });
    render(
      <AppProvider services={viewer.services}>
        <App />
      </AppProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    await screen.findByRole('heading', { name: 'Nevet' });
    expect(screen.queryByRole('link', { name: 'Add kid' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Noa/ }));
    await screen.findByText('Balance');
    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add goal' })).not.toBeInTheDocument();
  });
});

describe('join link', () => {
  it('offers to open the shared sheet', async () => {
    const user = userEvent.setup();
    history.replaceState(null, '', '/?join=abc123');
    const { services } = fakeServices();
    render(
      <AppProvider services={services}>
        <App />
      </AppProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    await screen.findByText('You were invited to a family');
    expect(screen.getByRole('button', { name: 'Open the shared sheet' })).toBeInTheDocument();
  });
});
