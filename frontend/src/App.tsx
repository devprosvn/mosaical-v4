import { Router, Route } from '@solidjs/router';
import { Component } from 'solid-js';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import DPOTokensPage from './pages/DPOTokensPage';
import LoanPage from './pages/LoanPage';
import SettingsPage from './pages/SettingsPage';

const App: Component = () => {
  return (
    <Router>
      <Route path="/" component={MainLayout}>
        <Route path="/" component={DashboardPage} />
        <Route path="/dpo-tokens" component={DPOTokensPage} />
        <Route path="/loans" component={LoanPage} />
        <Route path="/settings" component={SettingsPage} />
      </Route>
    </Router>
  );
};

export default App; 