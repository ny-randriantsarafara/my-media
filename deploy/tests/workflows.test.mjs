import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = name => parse(readFileSync(join(root, `.github/workflows/${name}.yml`), 'utf8'));
const production = workflow('production');
const preview = workflow('preview');
const delivery = workflow('deploy');
const repository = 'owner/my-media';
const currentSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const gitDirectory = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const oldSha = 'b'.repeat(40);
const prNumber = 42;

function fixture(pr = {}) {
  return {
    number: prNumber,
    state: 'open',
    draft: false,
    base: { repo: { full_name: repository } },
    head: { repo: { full_name: repository }, sha: currentSha },
    ...pr,
  };
}

function event(action) {
  return { event: { action, pull_request: fixture() }, repository };
}

function expression(value, github, needs = {}) {
  const code = value.replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  return Function('github', 'needs', 'always', 'cancelled', `return (${code});`)(
    github, needs, () => true, () => false,
  );
}

function sandbox(runSha = currentSha, pr = fixture(), mainSha = currentSha) {
  const directory = mkdtempSync(join(tmpdir(), 'media-workflow-'));
  const run = {
    id: 42, repository: { full_name: repository }, head_repository: { full_name: repository },
    path: '.github/workflows/ci.yml', name: 'CI', event: 'push', head_branch: 'main',
    status: 'completed', conclusion: 'success', head_sha: runSha,
  };
  const release = {
    commit: runSha,
    ...Object.fromEntries(['directus', 'site', 'provision'].map(target => [
      target, `ghcr.io/owner/my-media:${target}-${runSha}@sha256:${'c'.repeat(64)}`,
    ])),
  };
  writeFileSync(join(directory, 'api-run.json'), JSON.stringify(run));
  writeFileSync(join(directory, 'api-pr.json'), JSON.stringify(pr));
  writeFileSync(join(directory, 'main-sha'), mainSha);
  mkdirSync(join(directory, 'selected-release'));
  writeFileSync(join(directory, 'selected-release/release.json'), JSON.stringify(release));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash
set -euo pipefail
case "$2" in
  repos/owner/my-media/actions/runs/42) cat "$RUNNER_TEMP/api-run.json" ;;
  repos/owner/my-media/git/ref/heads/main) cat "$RUNNER_TEMP/main-sha" ;;
  repos/owner/my-media/pulls/42) cat "$RUNNER_TEMP/api-pr.json" ;;
  *) echo 'Unexpected API request' >&2; exit 2 ;;
esac
`, { mode: 0o755 });
  return {
    directory,
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`,
      RUNNER_TEMP: directory, GITHUB_REPOSITORY: repository,
      GITHUB_OUTPUT: join(directory, 'output'), GITHUB_STEP_SUMMARY: join(directory, 'summary'),
      REQUESTED_RUN: '42', PROMOTION_RUN: '42', REQUIRE_CURRENT_MAIN: 'true',
      PULL_REQUEST: String(prNumber), TESTED_COMMIT: currentSha, ALLOW_APPLY: 'true',
      RELEASE: JSON.stringify(release), SELECTED_COMMIT: runSha,
    },
    dispose() { rmSync(directory, { recursive: true, force: true }); },
  };
}

function shell(step, env, cwd = root) {
  return spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', step.run], {
    cwd, env, encoding: 'utf8',
  });
}

function validateRelease(runSha, automatic = true, mainSha = currentSha) {
  const box = sandbox(runSha, fixture(), mainSha);
  try {
    box.env.REQUIRE_CURRENT_MAIN = String(automatic);
    for (const id of ['run', 'release']) {
      const step = production.jobs.release.steps.find(step => step.id === id);
      assert.ok(step, `Production ${id} gate is required`);
      const result = shell(step, box.env);
      if (result.status !== 0) return false;
    }
    return true;
  } finally { box.dispose(); }
}

// Model GitHub's documented default single slot and native bounded FIFO queue.
// Queue entry time, rather than event dispatch time, controls execution order.
// The real parsed workflow determines the mode and validation/lock boundary.
class DeliveryQueue {
  delivered = [];
  pending = [];
  constructor(lock = preview.concurrency) { this.mode = lock.queue ?? 'single'; }
  enqueue(name, work) {
    if (this.mode === 'single') this.pending = [];
    if (this.mode === 'max' && this.pending.length === 100) return false;
    this.pending.push({ name, work });
    return true;
  }
  finishRunning() {
    const pending = this.pending.shift();
    if (pending?.work()) this.delivered.push(pending.name);
  }
  drain() { while (this.pending.length) this.finishRunning(); }
}

function productionAdmission(queue, name, sha, automatic = true, main = () => currentSha, final = () => true) {
  const deploy = production.jobs.deploy;
  const lock = production.concurrency ?? deploy.concurrency;
  assert.ok(lock?.group, 'Full production delivery must remain serialized');
  assert.equal(lock['cancel-in-progress'], false, 'An admitted controller operation must finish');
  const needs = [deploy.needs].flat();
  const gateBeforeLock = !production.concurrency && needs.includes('release')
    && !production.jobs.release.concurrency;
  if (gateBeforeLock) {
    if (validateRelease(sha, automatic, main())) return () => queue.enqueue(name, final);
  } else {
    return () => queue.enqueue(name, () => validateRelease(sha, automatic, main()) && final());
  }
  return () => false;
}

function enqueueProduction(queue, name, sha, automatic = true) {
  return productionAdmission(queue, name, sha, automatic)();
}

function finalValidation(runSha, mainSha) {
  const box = sandbox(runSha, fixture(), mainSha);
  try {
    const steps = delivery.jobs.deliver.steps;
    const gateIndex = steps.findIndex(step => step.env?.SELECTED_COMMIT !== undefined);
    const privateIndex = steps.findIndex(step => step.env?.VPS_SSH_PRIVATE_KEY !== undefined);
    assert.ok(gateIndex >= 0 && gateIndex < privateIndex);
    mkdirSync(join(box.directory, '.delivery-policy/deploy'), { recursive: true });
    copyFileSync(join(root, 'deploy/validate-promotion.py'), join(box.directory, '.delivery-policy/deploy/validate-promotion.py'));
    // Only git rev-parse reads this metadata; the synthetic delivery directory has
    // the current selected code SHA and never modifies the assigned repository.
    box.env.GIT_DIR = gitDirectory;
    return shell(steps[gateIndex], box.env, box.directory);
  } finally { box.dispose(); }
}

test('a stale main retry cannot displace a validated current-main delivery waiting behind A', () => {
  const queue = new DeliveryQueue(production.jobs.deploy.concurrency);
  enqueueProduction(queue, 'B-current-main', currentSha);
  assert.equal(enqueueProduction(queue, 'C-stale-retry', oldSha), false);
  queue.finishRunning();
  assert.deepEqual(queue.delivered, ['B-current-main']);
});

test('explicit older-run rollback remains admitted through the same non-canceling delivery lock', () => {
  const queue = new DeliveryQueue(production.jobs.deploy.concurrency);
  enqueueProduction(queue, 'manual-rollback', oldSha, false);
  assert.deepEqual(queue.delivered, []);
  queue.finishRunning();
  assert.deepEqual(queue.delivered, ['manual-rollback']);
});

test('production rechecks main after waiting and before creating private inputs', () => {
  const result = finalValidation(currentSha, oldSha);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /stale main commit/);
});

function validEntrants(lock) {
  const queue = new DeliveryQueue(lock);
  enqueueProduction(queue, 'B-valid', currentSha);
  enqueueProduction(queue, 'C-valid', currentSha);
  queue.drain();
  return queue.delivered;
}

function delayedEntrant(lock) {
  const queue = new DeliveryQueue(lock);
  let main = oldSha;
  // B passes both real pre-queue validators, but its job has not reached the lock.
  const delayedB = productionAdmission(queue, 'B-delayed', oldSha, true, () => main, () => {
    const result = finalValidation(oldSha, main);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /stale main commit/);
    return false;
  });
  main = currentSha;
  // C is now current, validates successfully, and queues before delayed B.
  productionAdmission(queue, 'C-current', currentSha, true, () => main, () => {
    const result = finalValidation(currentSha, main);
    assert.equal(result.status, 0, result.stderr);
    return true;
  })();
  delayedB();
  queue.drain();
  return queue.delivered;
}

test('the configured production lock preserves two valid pending entrants in queue-entry order', () => {
  assert.deepEqual(validEntrants(production.jobs.deploy.concurrency), ['B-valid', 'C-valid']);
});

test('a validated-then-delayed stale B cannot evict current C and is refused by the final gate', () => {
  assert.deepEqual(delayedEntrant(production.jobs.deploy.concurrency), ['C-current']);
});

test('default-single controls reproduce replacement and delayed-stale loss with the same real gates', () => {
  const previousDefault = { ...production.jobs.deploy.concurrency };
  delete previousDefault.queue;
  assert.deepEqual(validEntrants(previousDefault), ['C-valid']);
  assert.deepEqual(delayedEntrant(previousDefault), []);
});

test('the configured production queue preserves 100 pending jobs and rejects only the next entrant', () => {
  const queue = new DeliveryQueue(production.jobs.deploy.concurrency);
  for (let index = 1; index <= 100; index++) assert.equal(queue.enqueue(`job-${index}`, () => true), true);
  assert.equal(queue.enqueue('overflow', () => true), false);
  queue.drain();
  assert.deepEqual(queue.delivered, Array.from({ length: 100 }, (_, index) => `job-${index + 1}`));
});

function previewDecision(github, current) {
  assert.ok(preview.concurrency?.group, 'State reconciliation must run inside the preview workflow lock');
  assert.equal(preview.concurrency['cancel-in-progress'], false);
  if (!preview.jobs.reconcile) {
    // Evaluate the original event-controlled paths when reproducing the regression.
    if (expression(preview.jobs.destroy.if, github)) return 'destroy';
    return expression(preview.jobs.images.if, github) ? 'apply' : 'skip';
  }
  const box = sandbox(currentSha, current);
  try {
    box.env.ALLOW_APPLY = String(github.event.action !== 'closed');
    const step = preview.jobs.reconcile.steps.find(step => step.id === 'state');
    const result = shell(step, box.env);
    assert.equal(result.status, 0, result.stderr);
    const outputs = Object.fromEntries(readFileSync(box.env.GITHUB_OUTPUT, 'utf8').trim().split('\n').map(line => line.split('=')));
    const needs = {
      reconcile: { result: 'success', outputs },
      images: { result: outputs.operation === 'apply' ? 'success' : 'skipped' },
    };
    assert.ok([preview.jobs.images.needs].flat().includes('reconcile'));
    assert.equal(Boolean(expression(preview.jobs.images.if, github, needs)), outputs.operation === 'apply');
    if (!expression(preview.jobs.deploy.if, github, needs)) return 'skip';
    assert.ok([preview.jobs.deploy.needs].flat().includes('reconcile'));
    return expression(preview.jobs.deploy.with.operation, github, needs);
  } finally { box.dispose(); }
}

function controllerRequest(operation, runId) {
  if (operation === 'skip') return undefined;
  const box = sandbox();
  try {
    const env = {
      ...box.env, OPERATION: operation, TARGET_ENVIRONMENT: 'preview',
      GITHUB_RUN_ID: String(runId), GITHUB_RUN_ATTEMPT: '1',
    };
    for (const key of ['POSTGRES_PASSWORD', 'DIRECTUS_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_TOKEN', 'EDITOR_EMAIL', 'EDITOR_PASSWORD', 'AI_EMAIL', 'AI_PASSWORD']) {
      env[key] = 'synthetic-local-test-only';
    }
    const result = spawnSync('python3', ['deploy/write-delivery-inputs.py', box.directory], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(readFileSync(join(box.directory, 'delivery.json'), 'utf8'));
  } finally { box.dispose(); }
}

test('close A, reopen CI B, close C, delayed B replaces C: current closed state leaves no preview', () => {
  const queue = new DeliveryQueue();
  let present = true;
  let generation = 0;
  const applyRequest = request => {
    assert.equal(request.pull_request_number, prNumber);
    if (request.release_generation > generation) {
      present = request.operation === 'apply';
      generation = request.release_generation;
    }
    return true;
  };
  // A is already running. B checks are not done when the later close C queues.
  applyRequest(controllerRequest('destroy', 100));
  queue.enqueue('C-close', () => applyRequest(controllerRequest('destroy', 300)));
  // B finishes checks, replacing pending C. Its snapshot says reopened, but the API now says closed.
  queue.enqueue('B-delayed', () => applyRequest(controllerRequest(previewDecision(event('reopened'), fixture({ state: 'closed' })), 200)));
  queue.finishRunning();
  assert.equal(present, false);
  assert.equal(generation, 20001);
});

test('an open non-draft current checked head still receives its preview', () => {
  assert.equal(previewDecision(event('reopened'), fixture()), 'apply');
});

test('a stale close after reopening cannot destroy the open preview or apply unchecked code', () => {
  assert.equal(previewDecision(event('closed'), fixture()), 'skip');
});

test('delayed checked events cannot apply after the PR becomes draft or changes head', () => {
  assert.equal(previewDecision(event('reopened'), fixture({ draft: true })), 'skip');
  assert.equal(previewDecision(event('synchronize'), fixture({ head: { repo: { full_name: repository }, sha: oldSha } })), 'skip');
});

test('current-state reconciliation rejects foreign repositories, wrong PRs and unknown states', () => {
  const currentStates = [
    fixture({ number: 99 }),
    fixture({ base: { repo: { full_name: 'other/my-media' } } }),
    fixture({ head: { repo: { full_name: 'fork/my-media' }, sha: currentSha } }),
    fixture({ state: 'unknown' }),
  ];
  for (const current of currentStates) {
    const box = sandbox(currentSha, current);
    try {
      const step = preview.jobs.reconcile.steps.find(step => step.id === 'state');
      const result = shell(step, box.env);
      assert.equal(result.status, 1);
      assert.equal(readFileSync(box.env.GITHUB_OUTPUT, 'utf8'), '');
    } finally { box.dispose(); }
  }
  const forkEvent = event('closed');
  forkEvent.event.pull_request.head.repo.full_name = 'fork/my-media';
  assert.equal(expression(preview.jobs.reconcile.if, forkEvent), false);
});
