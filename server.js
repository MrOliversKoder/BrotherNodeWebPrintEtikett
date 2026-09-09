
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Config -----------------------------------------------------------
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Fant ikke config.json på ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

let config = loadConfig();

// b-PAC SDK is a 32-bit COM component, so it must be driven from the
// 32-bit PowerShell host, not the default (usually 64-bit) one.
const POWERSHELL_32 = path.join(
  process.env.WINDIR || 'C:\\Windows',
  'SysWOW64',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
);
const POWERSHELL_FALLBACK = 'powershell.exe';

function resolvePowerShell() {
  if (fs.existsSync(POWERSHELL_32)) return POWERSHELL_32;
  console.warn(
    `[ADVARSEL] Fant ikke 32-bit PowerShell på ${POWERSHELL_32}. ` +
    `Faller tilbake til systemets standard PowerShell, som kan feile ` +
    `siden b-PAC SDK er en 32-bit COM-komponent.`
  );
  return POWERSHELL_FALLBACK;
}

// --- Icon ---------------------------------------------------------------
app.get('/printer.ico', (req, res) => {
  const iconPath = path.join(__dirname, 'printer.ico');
  if (fs.existsSync(iconPath)) {
    res.sendFile(iconPath);
  } else {
    res.status(404).end();
  }
});

// --- API ------------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({ printerName: config.printerName });
});

app.post('/api/print', (req, res) => {
  const { labels, copies } = req.body || {};

  if (!Array.isArray(labels) || labels.length === 0) {
    return res.status(400).json({ success: false, error: 'Ingen etiketter å skrive ut' });
  }

  let job;
  try {
    config = loadConfig(); // re-read so printer name changes don't need a restart
    job = {
      printerName: config.printerName,
      templatePath: config.templatePath,
      objectName: config.objectName,
      labels,
      copies: Math.max(1, parseInt(copies, 10) || 1),
    };
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }

  const jobFile = path.join(os.tmpdir(), `bpac-job-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(jobFile, JSON.stringify(job), 'utf8');

  const scriptPath = path.join(__dirname, 'print.ps1');
  const psExe = resolvePowerShell();

  const ps = spawn(psExe, [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-JobFile', jobFile,
  ]);

  let stdout = '';
  let stderr = '';
  ps.stdout.on('data', (d) => { stdout += d.toString(); });
  ps.stderr.on('data', (d) => { stderr += d.toString(); });

  ps.on('error', (err) => {
    fs.unlink(jobFile, () => {});
    res.status(500).json({ success: false, error: `Kunne ikke starte PowerShell: ${err.message}` });
  });

  ps.on('close', (code) => {
    fs.unlink(jobFile, () => {});

    let result = null;
    try { result = JSON.parse(stdout); } catch (e) { /* ignore parse error, handled below */ }

    if (code === 0 && result && result.success) {
      res.json(result);
    } else {
      res.status(500).json({
        success: false,
        error: (result && result.error) || stderr.trim() || `print.ps1 avsluttet med kode ${code}`,
      });
    }
  });
});

const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`Server kjører på http://localhost:${PORT}`);
  console.log(`Aktiv skriver: ${config.printerName}`);
});
