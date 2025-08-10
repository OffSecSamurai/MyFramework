import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import path from 'node:path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { PrismaClient } from '@prisma/client';
import { io as clientIo } from 'socket.io-client';
const prisma = new PrismaClient();
const redisConnection = { url: process.env.REDIS_URL };
const runsQueue = new Queue('runs', { connection: redisConnection });
const apiUrl = process.env.VITE_API_URL || `http://api:${process.env.API_PORT || 4000}`;
const socket = clientIo(apiUrl, { path: process.env.SOCKET_PATH || '/socket.io' });
function emitProgress(executionId, payload) {
    socket.emit('progress', { executionId, ...payload });
}
function clampThreads(threads) {
    const max = Number(process.env.MAX_THREADS || 50);
    const t = Number(threads || max);
    return Math.min(t, max);
}
async function ensureDir(dir) {
    await fs.mkdirp(dir);
}
async function updateProgress(executionId, total, completed, currentStep) {
    await prisma.execution.update({ where: { id: executionId }, data: { stageTotalSteps: total, stageCompletedSteps: completed, currentStep } });
    emitProgress(executionId, { total, completed, currentStep });
}
async function runCmd(cmd, args, cwd, logFile) {
    const proc = execa(cmd, args, { cwd, all: true, shell: false });
    const outStream = fs.createWriteStream(logFile, { flags: 'a' });
    proc.all?.pipe(outStream);
    await proc;
}
async function writeFile(filePath, content) {
    await fs.outputFile(filePath, content);
}
async function stagePassiveRecon(executionId) {
    const exec = await prisma.execution.findUnique({ where: { id: executionId }, include: { target: true } });
    if (!exec)
        throw new Error('execution not found');
    const baseDir = exec.storagePath;
    await ensureDir(baseDir);
    const totalSteps = 8;
    let done = 0;
    // Create roots.txt
    const rootsPath = path.join(baseDir, 'roots.txt');
    await writeFile(rootsPath, `${exec.target.name}\n`);
    const threads = clampThreads(exec.threads);
    // Files
    const subfinderOut = path.join(baseDir, 'subdomains_subfinder.txt');
    const assetfinderOut = path.join(baseDir, 'subdomains_assetfinder.txt');
    const chaosOut = path.join(baseDir, 'subdomains_chaos.txt');
    const amassJson = path.join(baseDir, 'amass_raw_output.json');
    const amassOut = path.join(baseDir, 'subdomains_amass.txt');
    const allRaw = path.join(baseDir, 'all_subdomains_raw.txt');
    const resolvers = path.join(baseDir, 'resolvers.txt');
    const unresolved = path.join(baseDir, 'unresolved_hosts.txt');
    const resolved = path.join(baseDir, 'resolved_hosts.txt');
    const s3Takeover = path.join(baseDir, 'potential_s3_takeovers.txt');
    const logFile = path.join(baseDir, 'stage1_passive_recon.log');
    await updateProgress(executionId, totalSteps, done, 'subfinder');
    // subfinder
    try {
        await runCmd('sh', ['-lc', `subfinder -dL ${path.basename(rootsPath)} -silent -o ${path.basename(subfinderOut)}`], baseDir, logFile);
        await prisma.artifact.create({ data: { executionId, name: 'subdomains_subfinder.txt', path: subfinderOut } });
    }
    catch { }
    done++;
    await updateProgress(executionId, totalSteps, done, 'assetfinder');
    // assetfinder
    try {
        await runCmd('sh', ['-lc', `cat ${path.basename(rootsPath)} | assetfinder --subs-only | sort -u > ${path.basename(assetfinderOut)}`], baseDir, logFile);
        await prisma.artifact.create({ data: { executionId, name: 'subdomains_assetfinder.txt', path: assetfinderOut } });
    }
    catch { }
    done++;
    await updateProgress(executionId, totalSteps, done, 'chaos');
    // chaos
    try {
        await runCmd('sh', ['-lc', `if command -v chaos >/dev/null 2>&1; then chaos -dL ${path.basename(rootsPath)} -o ${path.basename(chaosOut)} -silent || true; fi`], baseDir, logFile);
        if (await fs.pathExists(chaosOut)) {
            await prisma.artifact.create({ data: { executionId, name: 'subdomains_chaos.txt', path: chaosOut } });
        }
    }
    catch { }
    done++;
    await updateProgress(executionId, totalSteps, done, 'amass');
    // amass
    try {
        await runCmd('sh', ['-lc', `if command -v amass >/dev/null 2>&1; then amass enum -passive -df ${path.basename(rootsPath)} -json ${path.basename(amassJson)} || true; fi`], baseDir, logFile);
        await runCmd('sh', ['-lc', `if [ -f ${path.basename(amassJson)} ]; then cat ${path.basename(amassJson)} | jq -r '.name' | sort -u > ${path.basename(amassOut)}; fi`], baseDir, logFile);
        if (await fs.pathExists(amassOut)) {
            await prisma.artifact.create({ data: { executionId, name: 'subdomains_amass.txt', path: amassOut } });
        }
    }
    catch { }
    done++;
    await updateProgress(executionId, totalSteps, done, 'combine-dedupe');
    // Combine and dedupe clean
    await runCmd('sh', ['-lc', `cat subdomains_*.txt *.com.txt 2>/dev/null | cut -d ' ' -f 1 | sed 's/:\([0-9]\+\)//g' | sed 's#https\?://##' | tr '[:upper:]' '[:lower:]' | sed 's/\.$//' | sort -u > ${path.basename(allRaw)} || true`], baseDir, logFile);
    await prisma.artifact.create({ data: { executionId, name: 'all_subdomains_raw.txt', path: allRaw } });
    done++;
    await updateProgress(executionId, totalSteps, done, 'resolvers');
    // resolvers
    await runCmd('sh', ['-lc', `wget -q -O ${path.basename(resolvers)} https://raw.githubusercontent.com/trickest/resolvers/main/resolvers.txt`], baseDir, logFile);
    done++;
    await updateProgress(executionId, totalSteps, done, 'dnsx');
    // dnsx resolution + clean outputs
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(allRaw)} ]; then dnsx -l ${path.basename(allRaw)} -r ${path.basename(resolvers)} -a -cname -resp -o ${path.basename(unresolved)} -silent; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(unresolved)} ]; then cat ${path.basename(unresolved)} | grep 'CNAME' | grep 's3.amazonaws.com' | awk '{print $1}' | tr '[:upper:]' '[:lower:]' | sort -u > ${path.basename(s3Takeover)} || true; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(unresolved)} ]; then awk '{print $1}' ${path.basename(unresolved)} | tr '[:upper:]' '[:lower:]' | sort -u > ${path.basename(resolved)}; fi`], baseDir, logFile);
    if (await fs.pathExists(resolved)) {
        await prisma.artifact.create({ data: { executionId, name: 'resolved_hosts.txt', path: resolved } });
    }
    if (await fs.pathExists(s3Takeover)) {
        await prisma.artifact.create({ data: { executionId, name: 'potential_s3_takeovers.txt', path: s3Takeover } });
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'finalize');
    await prisma.execution.update({ where: { id: executionId }, data: { currentStage: 'PASSIVE_RECON' } });
    await prisma.artifact.create({ data: { executionId, name: 'stage1_passive_recon.log', path: logFile, mimeType: 'text/plain' } });
    emitProgress(executionId, { stage: 'PASSIVE_RECON', status: 'COMPLETED' });
}
async function stageActiveRecon(executionId) {
    const exec = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!exec)
        throw new Error('execution not found');
    const baseDir = exec.storagePath;
    const logFile = path.join(baseDir, 'stage2_active_recon.log');
    const resolved = path.join(baseDir, 'resolved_hosts.txt');
    const liveWithTech = path.join(baseDir, 'live_hosts_with_tech.txt');
    const liveUrls = path.join(baseDir, 'live_urls.txt');
    const wafReport = path.join(baseDir, 'waf_report.txt');
    const totalSteps = 3;
    let done = 0;
    await updateProgress(executionId, totalSteps, done, 'httpx');
    // httpx to detect tech and status on common ports
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(resolved)} ]; then httpx -l ${path.basename(resolved)} -ports 80,443,8080,8443 -threads 50 -status-code -tech-detect -o ${path.basename(liveWithTech)} -silent; fi`], baseDir, logFile);
    // Clean and unique live URLs
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(liveWithTech)} ]; then awk '{print $1}' ${path.basename(liveWithTech)} | sed 's#/$##' | sort -u > ${path.basename(liveUrls)}; fi`], baseDir, logFile);
    if (await fs.pathExists(liveUrls)) {
        await prisma.artifact.create({ data: { executionId, name: 'live_hosts_with_tech.txt', path: liveWithTech } });
        await prisma.artifact.create({ data: { executionId, name: 'live_urls.txt', path: liveUrls } });
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'wafw00f');
    // wafw00f on live urls
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(liveUrls)} ]; then wafw00f -i ${path.basename(liveUrls)} -o ${path.basename(wafReport)} || true; fi`], baseDir, logFile);
    if (await fs.pathExists(wafReport)) {
        await prisma.artifact.create({ data: { executionId, name: 'waf_report.txt', path: wafReport } });
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'finalize');
    await prisma.artifact.create({ data: { executionId, name: 'stage2_active_recon.log', path: logFile, mimeType: 'text/plain' } });
    emitProgress(executionId, { stage: 'ACTIVE_RECON', status: 'COMPLETED' });
}
async function stageSpidering(executionId) {
    const exec = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!exec)
        throw new Error('execution not found');
    const baseDir = exec.storagePath;
    const logFile = path.join(baseDir, 'stage3_spidering.log');
    const liveUrls = path.join(baseDir, 'live_urls.txt');
    const gauOut = path.join(baseDir, 'gau_urls.txt');
    const waybackOut = path.join(baseDir, 'wayback_urls.txt');
    const katanaOut = path.join(baseDir, 'katana_urls.txt');
    const allDiscovered = path.join(baseDir, 'all_discovered_urls.txt');
    const allLive = path.join(baseDir, 'all_live_urls.txt');
    const nonLive = path.join(baseDir, 'non_live_urls.txt');
    const allJs = path.join(baseDir, 'all_js_files.txt');
    const allHosts = path.join(baseDir, 'all_hosts.txt');
    const urlsWithParams = path.join(baseDir, 'urls_with_params.txt');
    const interestingParams = path.join(baseDir, 'urls_interesting_params.txt');
    const totalSteps = 7;
    let done = 0;
    await updateProgress(executionId, totalSteps, done, 'gau');
    // gau and wayback
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(liveUrls)} ]; then cat ${path.basename(liveUrls)} | gau --subs --threads 10 --o ${path.basename(gauOut)} || true; fi`], baseDir, logFile);
    done++;
    await updateProgress(executionId, totalSteps, done, 'waybackurls');
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(liveUrls)} ]; then cat ${path.basename(liveUrls)} | waybackurls > ${path.basename(waybackOut)} || true; fi`], baseDir, logFile);
    // katana crawl depth 3
    done++;
    await updateProgress(executionId, totalSteps, done, 'katana');
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(liveUrls)} ]; then katana -list ${path.basename(liveUrls)} -d 3 -silent -o ${path.basename(katanaOut)} || true; fi`], baseDir, logFile);
    // combine and dedupe discovered URLs
    done++;
    await updateProgress(executionId, totalSteps, done, 'combine-dedupe');
    await runCmd('sh', ['-lc', `cat ${path.basename(gauOut)} ${path.basename(waybackOut)} ${path.basename(katanaOut)} 2>/dev/null | sed 's#^//#http://#' | sed 's#^/#http://#' | sed 's#:\([0-9]\+\)/#/#' | sort -u > ${path.basename(allDiscovered)} || true`], baseDir, logFile);
    await prisma.artifact.create({ data: { executionId, name: 'all_discovered_urls.txt', path: allDiscovered } });
    // hosts from discovered URLs; httpx check to filter live
    done++;
    await updateProgress(executionId, totalSteps, done, 'hosts-live');
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allDiscovered)} ]; then cat ${path.basename(allDiscovered)} | unfurl -u domains | sort -u > ${path.basename(allHosts)}; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allHosts)} ]; then httpx -l ${path.basename(allHosts)} -silent -threads 100 -timeout 10 -status-code | awk '{print $1}' | sort -u > ${path.basename(allLive)}; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allDiscovered)} ] && [ -f ${path.basename(allLive)} ]; then grep -Ff ${path.basename(allLive)} ${path.basename(allDiscovered)} > ${path.basename(allLive)}tmp && mv ${path.basename(allLive)}tmp ${path.basename(allLive)}; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allDiscovered)} ] && [ -f ${path.basename(allLive)} ]; then comm -23 <(sort ${path.basename(allDiscovered)}) <(sort ${path.basename(allLive)}) > ${path.basename(nonLive)}; fi`], baseDir, logFile);
    // JS files list and parameterized URLs
    done++;
    await updateProgress(executionId, totalSteps, done, 'js-params');
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allDiscovered)} ]; then grep -E '\\.js(\\?|$)' ${path.basename(allDiscovered)} | sort -u > ${path.basename(allJs)}; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allDiscovered)} ]; then grep '\\?' ${path.basename(allDiscovered)} | sort -u > ${path.basename(urlsWithParams)}; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(allDiscovered)} ]; then grep -iE 'id=|user=|file=|path=|redirect=|url=|page=|view=|document=' ${path.basename(allDiscovered)} | sort -u > ${path.basename(interestingParams)}; fi`], baseDir, logFile);
    await prisma.artifact.create({ data: { executionId, name: 'all_js_files.txt', path: allJs } });
    await prisma.artifact.create({ data: { executionId, name: 'urls_with_params.txt', path: urlsWithParams } });
    await prisma.artifact.create({ data: { executionId, name: 'urls_interesting_params.txt', path: interestingParams } });
    done++;
    await updateProgress(executionId, totalSteps, done, 'finalize');
    await prisma.artifact.create({ data: { executionId, name: 'stage3_spidering.log', path: logFile, mimeType: 'text/plain' } });
}
async function stageFuzzing(executionId) {
    const exec = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!exec)
        throw new Error('execution not found');
    const baseDir = exec.storagePath;
    const logFile = path.join(baseDir, 'stage4_fuzzing.log');
    const liveUrls = path.join(baseDir, 'live_urls.txt');
    const gobusterReport = path.join(baseDir, 'gobuster_report.txt');
    const ffufReportJson = path.join(baseDir, 'ffuf_dir_fuzz.json');
    const ffufAccessible = path.join(baseDir, 'ffuf_accessible_paths.txt');
    const totalSteps = 3;
    let done = 0;
    await updateProgress(executionId, totalSteps, done, 'gobuster');
    // Use a moderate wordlist to fit hardware constraints
    const wordlist = '/usr/share/seclists/Discovery/Web-Content/common.txt';
    // Gobuster against each live URL (light concurrency)
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(liveUrls)} ]; then while read u; do gobuster dir -q -t 30 -u "$u" -w ${wordlist} || true; done < ${path.basename(liveUrls)} | tee ${path.basename(gobusterReport)}; fi`], baseDir, logFile);
    if (await fs.pathExists(gobusterReport)) {
        await prisma.artifact.create({ data: { executionId, name: 'gobuster_report.txt', path: gobusterReport } });
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'ffuf');
    // ffuf: single pass across base URLs
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(liveUrls)} ]; then while read u; do ffuf -mc all -t 30 -u "$u"/FUZZ -w ${wordlist} -of json -o ${path.basename(ffufReportJson)}tmp || true; cat ${path.basename(ffufReportJson)}tmp; done < ${path.basename(liveUrls)} > ${path.basename(ffufReportJson)}; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(ffufReportJson)} ]; then cat ${path.basename(ffufReportJson)} | jq -r '.. | .results? // empty | .[] | select(.status != 403) | .url' | sort -u > ${path.basename(ffufAccessible)}; fi`], baseDir, logFile);
    if (await fs.pathExists(ffufReportJson)) {
        await prisma.artifact.create({ data: { executionId, name: 'ffuf_dir_fuzz.json', path: ffufReportJson } });
    }
    if (await fs.pathExists(ffufAccessible)) {
        await prisma.artifact.create({ data: { executionId, name: 'ffuf_accessible_paths.txt', path: ffufAccessible } });
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'finalize');
    await prisma.artifact.create({ data: { executionId, name: 'stage4_fuzzing.log', path: logFile, mimeType: 'text/plain' } });
}
async function stageVulnScanning(executionId) {
    const exec = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!exec)
        throw new Error('execution not found');
    const baseDir = exec.storagePath;
    const logFile = path.join(baseDir, 'stage5_vuln_scanning.log');
    const liveUrls = path.join(baseDir, 'all_live_urls.txt');
    const resolved = path.join(baseDir, 'resolved_hosts.txt');
    const nucleiGeneral = path.join(baseDir, 'nuclei_general_scan.txt');
    const nucleiTakeover = path.join(baseDir, 'nuclei_takeover_scan.txt');
    const nucleiJsonl = path.join(baseDir, 'nuclei_general_scan.jsonl');
    const totalSteps = 3;
    let done = 0;
    await updateProgress(executionId, totalSteps, done, 'nuclei-general');
    // General Nuclei scan on live URLs (if present) else fallback to live_urls.txt
    await runCmd('sh', ['-lc', `targets_file=${path.basename(liveUrls)}; [ ! -s \"$targets_file\" ] && targets_file=live_urls.txt; if [ -s \"$targets_file\" ]; then nuclei -l \"$targets_file\" -o ${path.basename(nucleiGeneral)} -jsonl -irr -silent > ${path.basename(nucleiJsonl)} || true; fi`], baseDir, logFile);
    if (await fs.pathExists(nucleiGeneral)) {
        await prisma.artifact.create({ data: { executionId, name: 'nuclei_general_scan.txt', path: nucleiGeneral } });
    }
    if (await fs.pathExists(nucleiJsonl)) {
        await prisma.artifact.create({ data: { executionId, name: 'nuclei_general_scan.jsonl', path: nucleiJsonl, mimeType: 'application/x-ndjson' } });
        try {
            const content = await fs.readFile(nucleiJsonl, 'utf-8');
            for (const line of content.split('\n')) {
                if (!line.trim())
                    continue;
                try {
                    const obj = JSON.parse(line);
                    const title = obj.info?.name || obj.templateID || 'nuclei finding';
                    const severity = String(obj.info?.severity || 'INFO').toUpperCase();
                    const details = JSON.stringify(obj);
                    await prisma.vulnerability.create({ data: { executionId, title, severity, source: 'nuclei', details } });
                }
                catch { }
            }
        }
        catch { }
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'nuclei-takeover');
    // Subdomain takeover scan against resolved hosts
    await runCmd('sh', ['-lc', `if [ -s ${path.basename(resolved)} ]; then nuclei -l ${path.basename(resolved)} -tags takeover -o ${path.basename(nucleiTakeover)} || true; fi`], baseDir, logFile);
    if (await fs.pathExists(nucleiTakeover)) {
        await prisma.artifact.create({ data: { executionId, name: 'nuclei_takeover_scan.txt', path: nucleiTakeover } });
    }
    done++;
    await updateProgress(executionId, totalSteps, done, 'finalize');
    await prisma.artifact.create({ data: { executionId, name: 'stage5_vuln_scanning.log', path: logFile, mimeType: 'text/plain' } });
}
new Worker('runs', async (job) => {
    const name = job.name;
    if (name === 'stage2-active-recon') {
        await stageActiveRecon(job.data.executionId);
        return;
    }
    if (name === 'stage3-spidering') {
        await stageSpidering(job.data.executionId);
        return;
    }
    if (name === 'stage4-fuzzing') {
        await stageFuzzing(job.data.executionId);
        return;
    }
    if (name === 'stage5-vuln-scanning') {
        await stageVulnScanning(job.data.executionId);
        return;
    }
    const { executionId } = job.data;
    const execution = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!execution)
        return;
    if (execution.status === 'ABORTED')
        return;
    await prisma.execution.update({ where: { id: executionId }, data: { status: 'RUNNING' } });
    await ensureDir(execution.storagePath);
    await stagePassiveRecon(executionId);
}, { connection: redisConnection, concurrency: 1 });
console.log('[Worker] Ready');
