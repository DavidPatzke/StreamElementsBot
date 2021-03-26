import React, { useEffect, useState } from 'react';
import {
  FormControl,
  InputLabel,
  Box,
  List,
  ListItemText,
  ListItemIcon,
  ListItem,
  Button,
  Grid,
  ListItemSecondaryAction,
} from '@material-ui/core';
import { withRouter } from 'react-router-dom';
import InfoIcon from '@material-ui/icons/Info';
import WarningIcon from '@material-ui/icons/Warning';

const { ipcRenderer } = require('electron');

const ControlScreen = withRouter(({ history }) => {
  const [logStack, setLogStack] = useState([]);
  const LogIcons = { info: InfoIcon, warning: WarningIcon };
  let id = 0;
  function addListRow(icon, text, time) {
    setLogStack([...logStack, { text, icon, time, id }]);
    id++;
  }
  useEffect(() => {
    ipcRenderer.on('pong', (event, message) => {
      if (
        message.status &&
        message.name === 'log' &&
        message.type &&
        message.text
      ) {
        addListRow(message.type, message.text, message.time);
      }
    });
  });

  const startBot = () => {
    ipcRenderer.send('asynchronous-message', { name: 'start-bot' });
  };
  const stopBot = () => {
    ipcRenderer.send('asynchronous-message', { name: 'stop-bot' });
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
          <Button onClick={startBot} variant="contained">
            Start Bot
          </Button>
        </Grid>
        <Grid item>
          <Button onClick={stopBot} variant="contained">
            Stop Bot
          </Button>
        </Grid>
        <Grid item>
          <Box bgcolor="text.disabled">
            <List>
              {logStack.map((item) => {
                const Icon = LogIcons[item.icon];
                return (
                  <ListItem key>
                    <ListItemIcon>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={`${item.time}  | ${item.text}`} />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Grid>
      </Grid>
    </Grid>
  );
});

export default ControlScreen;
