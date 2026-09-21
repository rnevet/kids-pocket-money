import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useApp } from '../state/AppContext';
import { ChooseFamily, ErrorScreen, Loading, NoFamily } from './screens/Bootstrap';
import { Home } from './screens/Home';
import { KidDetail } from './screens/KidDetail';
import { KidFormScreen } from './screens/KidForm';
import { Settings } from './screens/Settings';
import { SignIn } from './screens/SignIn';

export function App() {
  const { session } = useApp();
  switch (session.status) {
    case 'booting':
    case 'resolving':
      return <Loading />;
    case 'signed_out':
      return <SignIn expired={session.reason === 'expired'} />;
    case 'no_family':
      return <NoFamily joinFileId={session.joinFileId} />;
    case 'choose':
      return <ChooseFamily files={session.files} />;
    case 'error':
      return <ErrorScreen error={session.error} />;
    case 'ready':
      return (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/kids/new" element={<KidFormScreen />} />
            <Route path="/kids/:id" element={<KidDetail />} />
            <Route path="/kids/:id/add" element={<KidDetail openAdd />} />
            <Route path="/kids/:id/edit" element={<KidFormScreen />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      );
  }
}
