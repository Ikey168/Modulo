import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AppRoutes from './routes/routes';
import { Provider } from 'react-redux';
import { store } from './store/store';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </Provider>
  );
}

export default App;