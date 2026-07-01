// Auto-update wiring. electron-updater checks GitHub Releases for a newer
// version (using the `publish` block in electron-builder.yml + the
// latest-mac.yml manifest uploaded alongside each release). We do NOT download
// automatically — when a newer version exists we ask first, and only fetch the
// (large) update if the user opts in. Signed + notarized builds install
// cleanly on restart.
import { app, dialog, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import log from 'electron-log'

const { autoUpdater } = electronUpdater

// Check at startup and then every few hours while the app stays open.
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4

export function initAutoUpdater(): void {
  // Auto-update only makes sense for a packaged, signed app. In dev there is
  // no app-update.yml, so skip entirely to avoid noisy errors.
  if (!app.isPackaged) return

  // Persistent updater log — packaged builds have no console, and every
  // install failure so far has been a black box. electron-log writes to
  // ~/Library/Logs/thinking-canvas/main.log, including Squirrel's own
  // messages, so a stranded install finally says why.
  log.transports.file.level = 'info'
  autoUpdater.logger = log

  // Ask before pulling the update; download only on the user's say-so. If they
  // download but don't restart, it still installs on the next quit.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Guard against stacking dialogs if a check fires again while one is open.
  let prompting = false

  autoUpdater.on('error', (err) => {
    log.error('[updater] error:', err)
  })

  // Feed download progress to the Dock icon and the renderer's in-app pill so
  // the (opt-in) download doesn't feel like a silent hang.
  autoUpdater.on('download-progress', (p) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) return
    win.setProgressBar(p.percent / 100)
    win.webContents.send('update:progress', { percent: p.percent, done: false })
  })

  // A newer version exists — offer it. One consent up front: accepting
  // downloads the update and restarts into it when the bytes are in, with no
  // second dialog. Declining just waits for the next check.
  autoUpdater.on('update-available', (info) => {
    if (prompting) return
    prompting = true
    const win = BrowserWindow.getAllWindows()[0]
    dialog
      .showMessageBox(win, {
        type: 'info',
        buttons: ['Update and Restart', 'Not now'],
        defaultId: 0,
        cancelId: 1,
        message: `Version ${info.version} is available`,
        detail: 'Downloads the update, then restarts thinking canvas to install it.'
      })
      .then(({ response }) => {
        prompting = false
        if (response === 0) void autoUpdater.downloadUpdate()
      })
      .catch(() => {
        prompting = false
      })
  })

  // Download finished — the user already consented at the "update available"
  // prompt, so restart into the new version immediately, no second dialog.
  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1) // clear the Dock bar
      win.webContents.send('update:progress', { percent: 100, done: true })
    }
    // Hand off to Squirrel. quitAndInstall submits the ShipIt helper to
    // launchd, then terminates this process; ShipIt waits for us to die,
    // swaps the bundle in /Applications, and relaunches.
    //
    // Do NOT app.exit() here as a "fallback": a hard exit races the launchd
    // handoff and strands the install (bundle staged but never swapped),
    // which is exactly what we saw — /Applications stuck on the old version
    // with no ShipIt.log. If the native terminate is ever cancelled and the
    // process lingers, autoInstallOnAppQuit (set above) still installs it on
    // the next ordinary quit, so the update is never lost.
    //
    // NOTE: this only works when the installed bundle is not quarantined.
    // A com.apple.quarantine flag makes macOS translocate the app and blocks
    // the in-place swap, so the "update" lands on a throwaway copy and
    // reverts on next launch. Signed+notarized DMG installs avoid this.
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  })

  void autoUpdater.checkForUpdates()
  setInterval(() => void autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS)
}
