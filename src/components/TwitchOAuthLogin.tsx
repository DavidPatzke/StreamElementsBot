import React, { useEffect, useRef, useState } from 'react';
import {
  FormControl,
  InputLabel,
  Input,
  FormHelperText,
  Button,
  Grid,
} from '@material-ui/core';
import { withRouter } from 'react-router-dom';

const { ipcRenderer } = require('electron');

const TwitchOAuthLogin = withRouter(({ history }) => {
  const OAuthInput = useRef(null);
  const Username = useRef(null);
  const Channel = useRef(null);

  const [usernameError, setUsernameError] = useState(false);
  const [oAuthInputError, setoAuthInputError] = useState(false);
  const [channelError, setChannelError] = useState(false);

  useEffect(() => {
    const eventHandler = (message) => {
      if (message.status && message.name === 'botInitSuccess') {
        ipcRenderer.send('asynchronous-message', { name: 'getSEConfig' });
      }
      if (message.status && message.name === 'botInitSuccess') {
        history.push('/loggedIn');
      }
    };
    ipcRenderer.on('asynchronous-reply', (event, message) => {
      eventHandler(message);
    });

    return function destroy() {
      ipcRenderer.removeListener('asynchronous-reply', eventHandler);
    };
  });

  const checkLogin = async () => {
    const username = Username.current.value;
    const token = OAuthInput.current.value;
    const channel = Channel.current.value;

    if (token && username && channel) {
      ipcRenderer.send('asynchronous-message', {
        name: 'init-client',
        username,
        token,
        channel,
      });
    } else {
      setUsernameError(!username);
      setoAuthInputError(!token);
      setChannelError(!channel);
    }
  };

  return (
    <Grid
      container
      direction="row"
      justify="center"
      alignItems="center"
      spacing={1}
    >
      <Grid container item xs={12} spacing={3}>
        <Grid item>
          <FormControl>
            <InputLabel error={usernameError} htmlFor="channel">
              Username
            </InputLabel>
            <Input
              error={usernameError}
              inputRef={Username}
              id="channel"
              aria-describedby="my-helper-text"
            />
          </FormControl>
        </Grid>
      </Grid>
      <Grid container item xs={12} spacing={3}>
        <Grid item>
          <FormControl>
            <InputLabel error={channelError} htmlFor="username">
              Channel
            </InputLabel>
            <Input
              error={channelError}
              inputRef={Channel}
              id="username"
              aria-describedby="my-helper-text"
            />
          </FormControl>
        </Grid>
      </Grid>
      <Grid container item xs={12} spacing={3}>
        <Grid item>
          <FormControl>
            <InputLabel error={oAuthInputError} htmlFor="oauth-token">
              OauthToken
            </InputLabel>
            <Input
              inputRef={OAuthInput}
              error={oAuthInputError}
              id="oauth-token"
              aria-describedby="my-helper-text"
              type="password"
            />
            <FormHelperText id="my-helper-text">
              <a
                target="_blank"
                rel="noreferrer noopener"
                href="https://twitchapps.com/tmi/"
              >
                Get your token here!
              </a>
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
      <Grid container item xs={12} spacing={3}>
        <Grid item>
          <Button variant="contained" onClick={checkLogin}>
            Login
          </Button>
        </Grid>
      </Grid>
    </Grid>
  );
});

export default TwitchOAuthLogin;
