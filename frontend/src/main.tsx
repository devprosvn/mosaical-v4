import { render } from 'solid-js/web';
import App from './App';
import './styles/main.scss';
import { Web3Provider } from './stores/Web3Store';

render(() => (
  <Web3Provider>
    <App />
  </Web3Provider>
), document.getElementById('root') as HTMLElement); 