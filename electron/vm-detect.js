// VM / hypervisor detection (best-effort, cross-platform).
// Returns a report like: { isVm, confidence: 0..1, reasons: [], signals: {...} }
//
// Signals used:
//   * MAC address OUI prefixes (VMware, VirtualBox, Hyper-V, Parallels, QEMU, Xen)
//   * CPU model string containing hypervisor markers
//   * Platform-specific helpers:
//       - Linux: systemd-detect-virt (exits 0 if virt detected)
//       - macOS: system_profiler SPHardwareDataType / ioreg for VM indicators
//       - Windows: wmic computersystem get model,manufacturer
//   * Memory/CPU-count heuristics (very weak — used only as tiebreaker)

const os = require('os');
const { execSync } = require('child_process');

// Known VM MAC OUI prefixes (uppercase, colon-separated first 3 bytes).
const VM_MAC_PREFIXES = {
  '00:05:69': 'VMware',
  '00:0C:29': 'VMware',
  '00:1C:14': 'VMware',
  '00:50:56': 'VMware',
  '08:00:27': 'VirtualBox',
  '0A:00:27': 'VirtualBox',
  '00:03:FF': 'Hyper-V',
  '00:15:5D': 'Hyper-V',
  '00:1C:42': 'Parallels',
  '00:16:3E': 'Xen',
  '52:54:00': 'QEMU/KVM',
};

function macPrefix(mac) {
  return (mac || '').toUpperCase().split(':').slice(0, 3).join(':');
}

function safeExec(cmd, timeout = 3000) {
  try {
    return execSync(cmd, { timeout, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
}

function detect() {
  const reasons = [];
  const signals = {};

  // 1. MAC address check
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const i of ifaces[name] || []) {
        if (!i.mac || i.mac === '00:00:00:00:00:00') continue;
        const prefix = macPrefix(i.mac);
        if (VM_MAC_PREFIXES[prefix]) {
          reasons.push(`MAC address prefix ${prefix} matches ${VM_MAC_PREFIXES[prefix]}`);
          signals.vmMac = { prefix, vendor: VM_MAC_PREFIXES[prefix], iface: name };
        }
      }
    }
  } catch {}

  // 2. CPU model hypervisor markers
  try {
    const cpus = os.cpus() || [];
    const model = (cpus[0]?.model || '').toLowerCase();
    if (/(virtual|hypervisor|qemu|kvm|xen|parallels|vmware)/.test(model)) {
      reasons.push(`CPU model contains VM marker: "${cpus[0].model}"`);
      signals.vmCpu = cpus[0].model;
    }
  } catch {}

  // 3. Platform-specific
  try {
    if (process.platform === 'linux') {
      const r = safeExec('systemd-detect-virt').trim();
      if (r && r !== 'none') {
        reasons.push(`systemd-detect-virt reports: ${r}`);
        signals.linuxVirt = r;
      }
    } else if (process.platform === 'darwin') {
      const hw = safeExec('system_profiler SPHardwareDataType -json').toLowerCase();
      if (/(vmware|virtualbox|parallels|hypervisor|qemu)/.test(hw)) {
        reasons.push('macOS hardware profile contains VM vendor strings');
        signals.macHw = true;
      }
      const ioreg = safeExec('ioreg -l').toLowerCase();
      if (/(vmware|virtualbox|parallels|qemu|vboxguest)/.test(ioreg)) {
        reasons.push('macOS ioreg contains VM vendor strings');
        signals.macIoreg = true;
      }
    } else if (process.platform === 'win32') {
      const model = safeExec('wmic computersystem get model,manufacturer /format:list').toLowerCase();
      if (/(vmware|virtualbox|qemu|virtual|hyper-v|parallels|xen)/.test(model)) {
        reasons.push('Windows system model contains VM vendor string');
        signals.winModel = model.trim().slice(0, 200);
      }
      // Fallback using PowerShell Get-CimInstance
      if (!signals.winModel) {
        const ps = safeExec(
          'powershell -NoProfile -Command "Get-CimInstance Win32_ComputerSystem | Select-Object Model,Manufacturer | Format-List"'
        ).toLowerCase();
        if (/(vmware|virtualbox|qemu|virtual|hyper-v|parallels|xen)/.test(ps)) {
          reasons.push('Windows PowerShell reports VM vendor');
          signals.winPs = ps.trim().slice(0, 200);
        }
      }
    }
  } catch {}

  // 4. Weak heuristics
  try {
    const totalGb = os.totalmem() / (1024 ** 3);
    const cpuCount = os.cpus().length;
    signals.totalGb = Math.round(totalGb * 10) / 10;
    signals.cpuCount = cpuCount;
    if (totalGb < 1.8) reasons.push(`Low total memory (${signals.totalGb} GB) — unusual for a student laptop`);
    if (cpuCount === 1) reasons.push('Single CPU core — unusual for a modern student laptop');
  } catch {}

  const isVm = reasons.some((r) =>
    /(prefix|systemd-detect-virt|profile|ioreg|model|PowerShell|CPU model)/i.test(r)
  );

  // Confidence: MAC + platform check = very confident; heuristics alone = low.
  let confidence = 0;
  if (signals.vmMac) confidence += 0.55;
  if (signals.vmCpu) confidence += 0.45;
  if (signals.linuxVirt) confidence += 0.9;
  if (signals.macHw || signals.macIoreg) confidence += 0.9;
  if (signals.winModel || signals.winPs) confidence += 0.9;
  confidence = Math.min(1, confidence);

  return {
    isVm,
    confidence,
    reasons,
    signals,
    platform: process.platform,
    hostname: os.hostname(),
    at: new Date().toISOString(),
  };
}

module.exports = { detect };
