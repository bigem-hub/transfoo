const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ width: 1200, height: 800, show: false });
    win.webContents.on('did-fail-load', (e, ec, desc) => console.log('DID_FAIL_LOAD', ec, desc));
    await win.loadFile(path.join(__dirname, 'out', 'index.html'));
    await new Promise(r => setTimeout(r, 1500));
    const title = await win.webContents.getTitle();
    const bodyLen = await win.webContents.executeJavaScript("document.body ? document.body.innerHTML.length : -1");
    const img = await win.webContents.capturePage();
    require('fs').writeFileSync(path.join(__dirname, 'verify-shot.png'), img.toPNG());
    console.log('TITLE=' + JSON.stringify(title));
    console.log('BODY_LEN=' + bodyLen);
    console.log('PAGE_URL=' + win.webContents.getURL());
  } catch (e) { console.log('ERROR ' + e.message); }
  app.quit();
});
