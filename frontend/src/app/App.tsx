import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { ThemeRoot } from '@/app/ThemeRoot';
import { router } from '@/app/router';

function App() {
  return (
    <AppProviders>
      <ThemeRoot />
      <RouterProvider router={router} />
    </AppProviders>
  );
}

export default App;
