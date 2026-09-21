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
  await screen.findByRole('heading', { name: 'Bank of Nevet' });
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
    const card = screen.getByRole('link', { name: /^Noa/ });
    expect(within(card).getByText('₪0.00')).toBeInTheDocument();
    expect(fileIdStore.get()).toBe('sheet-1');

    // Deposit 12.50
    await user.click(card);
    await user.click(await screen.findByRole('button', { name: 'Got money' }));
    await user.type(screen.getByLabelText('How much'), '12,5');
    await user.type(screen.getByLabelText('What for'), 'birthday');
    await user.click(screen.getByRole('button', { name: 'Add ₪12.50 to Noa' }));
    await waitFor(() =>
      expect(screen.getByText('₪12.50', { selector: '.money--big' })).toBeInTheDocument(),
    );
    expect(screen.getByText('birthday')).toBeInTheDocument();

    // Withdraw 2
    await user.click(screen.getByRole('button', { name: 'Spent money' }));
    await user.type(screen.getByLabelText('How much'), '2');
    await user.click(screen.getByRole('button', { name: 'Take ₪2.00 from Noa' }));
    await waitFor(() =>
      expect(screen.getByText('₪10.50', { selector: '.money--big' })).toBeInTheDocument(),
    );

    // A goal with progress
    await user.click(screen.getByRole('button', { name: 'Add goal' }));
    await user.type(screen.getByLabelText('What is it?'), 'Lego');
    await user.type(screen.getByLabelText(/Price/), '21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // The goal shows on the hero card and in the goals list.
    expect(await screen.findAllByText('Lego')).toHaveLength(2);
    for (const bar of screen.getAllByRole('progressbar', { name: 'Lego' }))
      expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('₪10.50 saved · of ₪21.00')).toBeInTheDocument();

    // Tamper with the deposit row by hand: it is ignored and reported.
    const txRows = sheets.tabs.get('transactions')!;
    txRows[1]![3] = '999.00';
    await user.click(screen.getByRole('link', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Refresh' }));
    await screen.findByText('1 row in the sheet was ignored');
    expect(
      within(screen.getByRole('link', { name: /^Noa/ })).getByText('-₪2.00'),
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
    await screen.findByRole('heading', { name: 'Bank of Nevet' });
    expect(screen.queryByRole('link', { name: /Open an account/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Money for Noa' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^Noa/ }));
    await screen.findByText('You have');
    expect(screen.queryByRole('button', { name: 'Got money' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add goal' })).not.toBeInTheDocument();
  });
});

describe('returning user', () => {
  it('skips the sign-in screen when a token is stored', async () => {
    const { services, files } = fakeServices({ signedIn: true });
    files.set('sheet-1', {
      id: 'sheet-1',
      name: 'Pocket Money',
      capabilities: { canEdit: true, canShare: true },
    });
    fileIdStore.set('sheet-1');
    // Prepare a valid sheet.
    const { createFamilySheet } = await import('../data/bootstrap');
    await createFamilySheet(services.sheets, services.drive, {
      familyName: 'Auto',
      defaultCurrency: 'EUR',
    });
    render(
      <AppProvider services={services}>
        <App />
      </AppProvider>,
    );
    await screen.findByRole('heading', { name: 'Bank of Auto' });
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument();
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
