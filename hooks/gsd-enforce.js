#!/usr/bin/env node
/**
 * GSD enforcement hook.
 *
 * Phase 01-02 goal:
 * - Detect /gsd:* command in UserPromptSubmit
 * - Persist turn-scoped state across events (UserPromptSubmit -> Stop)
 * - Fail-closed for any /gsd:* command not explicitly mapped
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DIR = path.join(os.tmpdir(), 'gsd-enforce');
const DEBUG = process.env.GSD_ENFORCE_DEBUG === '1';

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
  });
}

function getHookEventName(data) {
  if (!data || typeof data !== 'object') return null;
  return (
    data.hookEventName ||
    data.hook_event_name ||
    data.hookSpecificOutput?.hookEventName ||
    data.hook_specific_output?.hookEventName ||
    null
  );
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function debugLog(msg) {
  if (!DEBUG) return;
  process.stderr.write(`[gsd-enforce][debug] ${msg}\n`);
}

function failLoud(eventName, reason) {
  // NOTE: Claude Code only processes stdout JSON when exit code is 0.
  // For unknown event types, we fall back to exit code 2 + stderr.
  const event = eventName || 'unknown';
  const msg = `GSD enforcement hook error: ${reason}`;

  // Always surface something in stderr for debuggability.
  process.stderr.write(`[gsd-enforce] ${msg}\n`);

  if (event === 'PreToolUse') {
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: msg,
      },
    });
    process.exit(0);
  }

  if (event === 'Stop' || event === 'SubagentStop' || event === 'UserPromptSubmit') {
    writeJson({
      decision: 'block',
      reason: msg,
    });
    process.exit(0);
  }

  // Unknown hook event: block via non-zero exit.
  process.exit(2);
}

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function sanitizeSessionId(sessionId) {
  // Deterministic mapping: keep [a-zA-Z0-9_.-], replace everything else with '_'.
  return String(sessionId).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function getSessionId(data) {
  if (!data || typeof data !== 'object') return null;
  const id = data.session_id || data.sessionId || data.session?.id || null;
  if (id == null) return null;
  if (typeof id === 'string' && id.trim() === '') return null;
  return String(id);
}

function getPromptText(data) {
  if (!data || typeof data !== 'object') return '';

  const directCandidates = [
    data.prompt,
    data.user_prompt,
    data.userPrompt,
    data.prompt_text,
    data.promptText,
    data.input?.prompt,
    data.input?.text,
  ];

  for (const v of directCandidates) {
    if (typeof v === 'string') return v;
  }

  // Best-effort fallback: try to find a string in a common messages layout.
  const messages = data.messages;
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const content = m?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part?.text === 'string') return part.text;
        }
      }
    }
  }

  return '';
}

function extractFirstGsdCommand(promptText) {
  if (!promptText) return null;
  const m = String(promptText).match(/\/(?:gsd):[A-Za-z0-9_-]+/);
  if (!m) return null;
  return m[0].toLowerCase();
}

function stateFilePathForSession(sessionId) {
  if (!sessionId) {
    throw new Error('missing session_id');
  }
  ensureStateDir();
  const safe = sanitizeSessionId(sessionId);
  return path.join(STATE_DIR, `turn-${safe}.json`);
}

function writeTurnState(sessionId, state) {
  const filePath = stateFilePathForSession(sessionId);
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);

  const payload = JSON.stringify(state) + '\n';
  fs.writeFileSync(tmpPath, payload, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function readTurnState(sessionId) {
  const filePath = stateFilePathForSession(sessionId);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('state file is not a JSON object');
    }
    return parsed;
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ENOENT') {
      return null;
    }
    throw e;
  }
}

function clearTurnState(sessionId) {
  const filePath = stateFilePathForSession(sessionId);
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ENOENT') return;
    throw e;
  }
}

function writeRealSample(eventName, data) {
  if (!DEBUG) return;

  const sessionId = getSessionId(data);
  const keys = data && typeof data === 'object' ? Object.keys(data).sort() : [];

  // Never persist the full prompt content.
  const sample = {
    event: eventName,
    captured_at_ms: Date.now(),
    session_id_present: Boolean(sessionId),
    top_level_keys: keys,
  };

  ensureStateDir();
  const filePath = path.join(STATE_DIR, `real-${eventName}-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

// Phase 1 explicit mapping (Phase 2 will externalize to JSON).
const COMMAND_MAP = Object.freeze({
  '/gsd:add-phase': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:add-todo': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:audit-milestone': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:check-todos': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:complete-milestone': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:debug': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:discuss-phase': { required_subagent: 'gsd-planner', expected_artifacts: [] },
  '/gsd:execute-phase': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:help': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:insert-phase': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:join-discord': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:list-phase-assumptions': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:map-codebase': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:new-milestone': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:new-project': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:pause-work': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:plan-milestone-gaps': { required_subagent: 'gsd-planner', expected_artifacts: [] },
  '/gsd:plan-phase': { required_subagent: 'gsd-planner', expected_artifacts: [] },
  '/gsd:progress': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:quick': { required_subagent: 'gsd-executor', expected_artifacts: [] },
  '/gsd:remove-phase': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:research-phase': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:resume-work': { required_subagent: 'other', expected_artifacts: [] },
  '/gsd:set-profile': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:settings': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:summarize': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:update': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:verify-work': { required_subagent: 'other', expected_artifacts: [] },
});

async function handleUserPromptSubmit(data) {
  const promptText = getPromptText(data);
  const command = extractFirstGsdCommand(promptText);

  writeRealSample('UserPromptSubmit', data);
  if (DEBUG) {
    const keys = data && typeof data === 'object' ? Object.keys(data).sort().join(',') : '';
    debugLog(`UserPromptSubmit keys=[${keys}] command=${command || 'none'}`);
  }

  if (!command) {
    const sessionId = getSessionId(data);
    if (sessionId) {
      clearTurnState(sessionId);
    }
    return;
  }

  const sessionId = getSessionId(data);
  if (!sessionId) {
    failLoud('UserPromptSubmit', `detected ${command} but session_id is missing (cannot persist turn state)`);
    return;
  }

  const state = {
    active: true,
    command,
    turn_start_ms: Date.now(),
    session_id: sessionId,
  };

  writeTurnState(sessionId, state);
}

function stopBlock(reason) {
  writeJson({ decision: 'block', reason });
  process.exit(0);
}

async function handleStop(data) {
  writeRealSample('Stop', data);

  const sessionId = getSessionId(data);
  if (!sessionId) {
    failLoud('Stop', 'missing session_id (cannot correlate turn state)');
    return;
  }

  let state;
  try {
    state = readTurnState(sessionId);
  } catch (e) {
    failLoud('Stop', `failed to read turn state: ${e && e.message ? e.message : String(e)}`);
    return;
  }

  if (!state || state.active !== true) {
    // Non-GSD turn (or already cleared). Do not block.
    return;
  }

  const command = typeof state.command === 'string' ? state.command : '';
  debugLog(`Stop loaded state: active=${String(state.active)} command=${command || 'missing'}`);

  if (!command.startsWith('/gsd:')) {
    // Defensive: clear unexpected active states.
    clearTurnState(sessionId);
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(COMMAND_MAP, command)) {
    stopBlock(
      `GSD enforcement: unmapped command '${command}'. Add an explicit entry to COMMAND_MAP in hooks/gsd-enforce.js (fail-closed).`
    );
    return;
  }

  // Phase 01-02 scope: only fail-closed for unmapped /gsd:*.
  // Enforcement of required_subagent/artifacts happens in later plans.
  clearTurnState(sessionId);
}

async function main() {
  const raw = await readStdin();

  // In normal hook execution, stdin is always valid JSON. If not, fail-loud.
  if (!raw || !raw.trim()) {
    failLoud(null, 'empty stdin (expected JSON hook payload)');
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    failLoud(null, `failed to parse JSON: ${e && e.message ? e.message : String(e)}`);
    return;
  }

  const hookEventName = getHookEventName(data);
  if (!hookEventName) {
    failLoud(null, 'missing hookEventName (cannot dispatch)');
    return;
  }

  try {
    if (hookEventName === 'UserPromptSubmit') {
      await handleUserPromptSubmit(data);
      process.exit(0);
    }

    if (hookEventName === 'Stop') {
      await handleStop(data);
      process.exit(0);
    }

    // Not in scope for 01-02: allow other configured events to pass.
    if (hookEventName === 'PreToolUse' || hookEventName === 'SubagentStop') {
      process.exit(0);
    }

    // Unknown event: follow Phase 01-01 decision (non-zero exit).
    failLoud(hookEventName, `unsupported hook event '${hookEventName}'`);
  } catch (e) {
    failLoud(hookEventName, e && e.message ? e.message : String(e));
  }
}

main().catch((e) => {
  failLoud(null, e && e.message ? e.message : String(e));
});
