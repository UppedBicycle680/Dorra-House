import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const REPOSITORY = 'UppedBicycle680/Dorra-House';
const SITE = new URL('https://uppedbicycle680.github.io/Dorra-House/');
const ENDPOINT = `https://api.github.com/repos/${REPOSITORY}/pages`;
const ROOT = new URL('../', import.meta.url);

// Only GitHub's normal short-lived repository token is supplied by Actions.
// This updates the already configured Pages site's HTTPS setting, never its
// domain, source, visibility or certificate. GitHub still controls issuance.
export async function ensurePagesHttps({token = process.env.DORRA_GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY, fetchImpl = fetch} = {}) {
  const report = {ok: false, repository: REPOSITORY, startedAt: new Date().toISOString(),
    outcome: 'CONFIGURATION_ERROR', requests: [], httpsEnforced: null, certificateState: null};
  const fail = outcome => { report.outcome = outcome; throw new Error(outcome); };
  const request = async (method, body) => {
    const response = await fetchImpl(ENDPOINT, {method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})});
    report.requests.push({method, status: response.status});
    if (response.status === 403) fail('PAGES_PERMISSION_DENIED');
    if (response.status === 404) fail('PAGES_NOT_AVAILABLE');
    if (response.status === 409) fail('PAGES_CONFIGURATION_CONFLICT');
    if (response.status === 422) fail('PAGES_HTTPS_NOT_READY');
    if (!response.ok) fail('GITHUB_API_FAILED');
    return response.status === 204 ? null : response.json();
  };
  const read = async () => {
    const page = await request('GET');
    const address = new URL(page.html_url);
    if (page.cname || address.hostname !== SITE.hostname || address.pathname !== SITE.pathname
        || !['http:', 'https:'].includes(address.protocol) || address.username || address.password
        || address.search || address.hash) fail('UNEXPECTED_PAGES_CONFIGURATION');
    report.httpsEnforced = page.https_enforced === true;
    const state = page.https_certificate?.state;
    report.certificateState = typeof state === 'string' && /^[a-z_]{1,64}$/.test(state) ? state : null;
    return page;
  };
  try {
    if (repository !== REPOSITORY || typeof token !== 'string' || !token) fail('CONFIGURATION_ERROR');
    await read();
    if (!report.httpsEnforced) {
      await request('PUT', {https_enforced: true});
      await read();
    }
    if (!report.httpsEnforced) fail('PAGES_HTTPS_NOT_READY');
    report.ok = true;
    report.outcome = 'HTTPS_ENFORCED';
  } catch {
    if (report.outcome === 'CONFIGURATION_ERROR' && token && repository === REPOSITORY) report.outcome = 'GITHUB_API_FAILED';
  }
  report.finishedAt = new Date().toISOString();
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await ensurePagesHttps();
  await mkdir(new URL('work/', ROOT), {recursive: true});
  await writeFile(new URL('work/pages-https-report.json', ROOT), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `Pages HTTPS: **${report.outcome}**. Certificate state: ${report.certificateState || 'not reported'}.\n`);
  }
  if (!report.ok) process.exitCode = 1;
}
