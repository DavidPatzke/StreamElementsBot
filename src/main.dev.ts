/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./src/main.prod.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import moment from 'moment';

const fetch = require('node-fetch');
const async = require('async');

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(createWindow).catch(console.log);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

const { ipcMain } = require('electron');

type BotConfig = {
  channel: string | null;
  active: boolean;
  seChannelId: string;
  sePointEndpoint: string;
  loyalityData: LoyalityData | null;
  client: tmi.client;
  userToNotify: Users[];
};

const botConfig: BotConfig = {
  channel: null,
  active: false,
  seChannelId: '',
  sePointEndpoint: `https://api.streamelements.com/kappa/v2/points/<USERID>/top/100?limit=99999`,
  loyalityData: null,
  client: null,
  userToNotify: [],
};

const opts = {
  identity: {
    username: null,
    password: null,
  },
  channels: [],
};
const logToScreen = (text: string, type: string) => {
  mainWindow?.webContents.send(
    'pong',

    {
      status: true,
      text,
      name: 'log',
      type,
      time: moment().format('LTS'),
    }
  );
};
const logInfo = (text: string) => {
  logToScreen(text, 'info');
};
const logWarn = (text: string) => {
  logToScreen(text, 'warning');
};

type Users = { points: number; username: string };

type LoyalityData = {
  _total: number;
  users: Users[];
};

const getLoyalityData = (next: () => void) => {
  if (botConfig.seChannelId === '') {
    logWarn('ChannelId is not available');
    return false;
  }
  if (!botConfig.active) {
    logWarn('Bot is not active');
    return false;
  }
  const loyalityUrl = botConfig.sePointEndpoint.replace(
    '<USERID>',
    botConfig.seChannelId
  );
  logInfo('Try to fetch loyality data');
  return fetch(loyalityUrl)
    .then((response: Response) => response.json())
    .catch(() => {})
    .then((jsonResponse: LoyalityData) => {
      logInfo('Succesfully fetched new loyality data');
      if (botConfig.loyalityData) {
        const userToNotify = botConfig.loyalityData.users.filter((element) => {
          const oldPoints =
            jsonResponse.users.find(
              (arrElement) => arrElement.username === element.username
            )?.points || Number.MIN_SAFE_INTEGER;

          return element.points < oldPoints;
        });
        userToNotify.forEach((user) => {
          const exists = botConfig.userToNotify.find(
            (element) => element.username === user.username
          );
          if (!exists) {
            botConfig.userToNotify.push(user);
          }
        });

        botConfig.loyalityData = jsonResponse;
      } else {
        botConfig.userToNotify = jsonResponse.users;
      }

      setTimeout(next, 600000);
      return true;
    })
    .catch(() => {});
};

const onMessageHandler = (target, userstate, msg, self) => {
  logInfo('New Chat message ');
  if (self) {
    return false;
  }
  if (!botConfig.client) {
    return false;
  }
  // Handle different message types..
  switch (userstate['message-type']) {
    case 'action':
      // This is an action message..
      break;
    case 'chat': {
      const { username } = userstate;
      const { points } = botConfig.userToNotify.find(
        (arrElement) => arrElement.username === username
      );
      if (points) {
        botConfig.client.say(
          botConfig.channel,
          `Hello @${username}, du hast neuer LoyalityPoints gesammelt. Neuer Punktestand ${points}`
        );
      }

      break;
    }
    case 'whisper':
      // This is a whisper..
      break;
    default:
      // Something else ?
      break;
  }
};

ipcMain.on('asynchronous-message', async (event, arg) => {
  if (arg.name) {
    switch (arg.name) {
      case 'init-client': {
        const tmi = require('tmi.js');

        opts.identity.username = arg.username;
        opts.identity.password = arg.token;
        opts.channels.push(arg.channel);

        const client = new tmi.client(opts);

        await client
          .connect()
          .catch((e: Error) => {
            event.reply('asynchronous-reply', { status: false, statusText: e });
          })
          .then(() => {
            botConfig.channel = arg.channel;
            event.reply('asynchronous-reply', {
              status: true,
              name: 'botInitSuccess',
            });

            client.action(
              botConfig.channel,
              `Hello I'm ${arg.username} and I will now inform you about your StreamElements Point gain`
            );
            client.on('message', onMessageHandler);
            botConfig.client = client;
            return true;
          });

        break;
      }

      case 'getSEConfig':
        logInfo('Trying to fetch StreamElements Meta data');

        fetch(
          `https://api.streamelements.com/kappa/v2/channels/${botConfig.channel}`
        )
          .then((response: Response) => {
            logInfo('Succesfully obtained StreamElements Metadata');
            return response.json();
          })
          .catch(() => {
            logWarn('Could not fetch StreamElements Metadata');
          })
          .then((responseJson: JSON) => {
            botConfig.seChannelId = responseJson._id;
            console.log(botConfig);
            logInfo(
              `Got channel Id ${responseJson._id} for channel ${botConfig.channel} `
            );
            event.reply('asynchronous-reply', {
              status: true,
              name: 'fetchingMetadataSuccess',
            });
            return true;
          })
          .catch(() => {});

        break;
      case 'start-bot': {
        if (botConfig.active) {
          logWarn('Bot already started');
          break;
        }
        logInfo('Bot is now active!');
        botConfig.active = true;
        async.forever(getLoyalityData);
        break;
      }
      case 'stop-bot': {
        if (!botConfig.active) {
          logWarn('Bot is not  started');
          break;
        }
        logInfo('Bot is now inactive!');
        botConfig.active = false;
        break;
      }
      default: {
        event.reply('asynchronous-reply', 'Unsupported event');
      }
    }
  }
});
