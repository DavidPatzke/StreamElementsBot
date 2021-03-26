import React from 'react';
import { HashRouter as Router, Switch, Route } from 'react-router-dom';
import './App.global.css';
import TwitchOAuthLogin from './components/TwitchOAuthLogin';
import ControlScreen from './components/ControlScreen';

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/loggedIn" component={ControlScreen} />
        <Route path="/" component={TwitchOAuthLogin} />
      </Switch>
    </Router>
  );
}
