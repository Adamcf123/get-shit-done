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

// Parallel claim detection patterns (Chinese and English)
// These patterns anchor on parallel keywords to avoid false positives like "Phase 4"
const PARALLEL_PATTERNS = [
  // Chinese patterns
  /(?:并行|同时)(?:启动|spawn|创建|运行)\s*(\d+)\s*个/i,
  /启动\s*(\d+)\s*个\s*(?:并行|同时)/i,

  // English patterns
  /spawn(?:ing)?\s+(\d+)\s+\w+\s+(?:in\s+)?parallel/i,
  /(\d+)\s+parallel\s+(?:agents?|researchers?|executors?|subagents?|tasks?)/i,
  /(?:run(?:ning)?|start(?:ing)?|launch(?:ing)?)\s+(\d+)\s+\w+\s+(?:in\s+)?parallel/i,
  /in\s+parallel[^.]*?(\d+)\s+(?:agents?|tasks?)/i,
];

/**
 * Extract parallel claim count from prompt text.
 *
 * @param {string} promptText - User prompt text
 * @returns {number|null} - Claimed parallel count (>= 2 and <= 100), or null if no valid claim
 */
function extractParallelClaim(promptText) {
  if (!promptText || typeof promptText !== 'string') return null;

  for (const pattern of PARALLEL_PATTERNS) {
    const match = promptText.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      // Only return if within reasonable bounds (2-100)
      if (num >= 2 && num <= 100) {
        return num;
      }
    }
  }

  return null;
}

// Configuration cache (loaded once at startup, no hot-reload)
let projectCommandMapping = null;
let configLoadAttempted = false;
let configLoadError = null;

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

function getToolName(data) {
  if (!data || typeof data !== 'object') return null;
  const name = data.tool_name || data.toolName || null;
  if (name == null) return null;
  if (typeof name === 'string' && name.trim() === '') return null;
  return String(name);
}

function getToolInput(data) {
  if (!data || typeof data !== 'object') return null;
  const input = data.tool_input || data.toolInput || null;
  if (input == null) return null;
  if (typeof input !== 'object') return null;
  return input;
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function debugLog(msg) {
  if (!DEBUG) return;
  process.stderr.write(`[gsd-enforce][debug] ${msg}\n`);
}

function failLoud(eventName, reason, faultClass) {
  // NOTE: Claude Code only processes stdout JSON when exit code is 0.
  // For unknown event types, we fall back to exit code 2 + stderr.
  const event = eventName || 'unknown';

  const cls = faultClass === 'UserFault' ? 'UserFault' : 'SystemFault';

  const errorCode = `${cls === 'SystemFault' ? 'SYSTEM_FAULT' : 'USER_FAULT'}_${String(event).toUpperCase()}`;
  const details = sanitizeForUser(String(reason));

  const msg = formatBlockMessage({
    error_code: errorCode,
    next_step: `下一步：${cls === 'SystemFault' ? 'Hook 内部异常' : '流程/输入问题'}（${event}）。请修复 hook 或重试；细节（已脱敏）：${details}`,
  });

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

function sanitizeForUser(s) {
  // Avoid leaking full local paths or stack traces into block messages.
  const home = os.homedir();
  const tmp = os.tmpdir();

  let out = String(s);
  if (home) out = out.split(home).join('~');
  if (tmp) out = out.split(tmp).join('<tmp>');

  // Keep single-line, bounded output.
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > 300) out = out.slice(0, 297) + '...';
  return out;
}

function getWorkspaceDir(data) {
  if (!data || typeof data !== 'object') return null;
  const dir = data.workspace?.current_dir || data.workspace?.cwd || null;
  if (typeof dir !== 'string') return null;
  if (!dir.trim()) return null;
  return dir;
}

function normalizePathSep(p) {
  return String(p).replace(/\\/g, '/');
}

function isWithinDir(childPath, parentDir) {
  const rel = path.relative(parentDir, childPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function listFilesRecursive(dirPath, maxFiles) {
  const out = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const cur = stack.pop();

    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        // Avoid symlink cycles.
        if (ent.isSymbolicLink && ent.isSymbolicLink()) continue;
        stack.push(full);
        continue;
      }
      if (ent.isFile()) {
        out.push(full);
        if (out.length >= maxFiles) return out;
      }
    }
  }

  return out;
}

function globToRegExp(glob) {
  // Supports a minimal subset: '*' wildcard (not including path separators).
  // The artifact patterns used in Phase 1 are like '**/*-PLAN.md'.
  const escaped = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = escaped.replace(/\*/g, '[^/]*');
  return new RegExp(`^${re}$`);
}

function matchesGlobStar(pattern, absPath, baseDir) {
  // Minimal matcher for patterns used here:
  // - '**/<file-glob>' (recursive file match)
  // - '<relative-path>' (exact match)
  const rel = normalizePathSep(path.relative(baseDir, absPath));
  const p = normalizePathSep(pattern);

  if (p.startsWith('**/')) {
    const fileGlob = p.slice(3);
    if (fileGlob.includes('/')) {
      // Not expected for our Phase 1 patterns.
      return false;
    }
    const re = globToRegExp(fileGlob);
    const base = path.posix.basename(rel);
    return re.test(base);
  }

  return rel === p;
}

function collectArtifactMatches(scanBaseDir, patterns, turnStartMs) {
  const maxFiles = 1500;
  const allFiles = listFilesRecursive(scanBaseDir, maxFiles);
  const hits = new Set();

  for (const filePath of allFiles) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    if (!stat.isFile()) continue;
    if (stat.mtimeMs < turnStartMs) continue;

    for (const pat of patterns) {
      if (matchesGlobStar(pat, filePath, scanBaseDir)) {
        hits.add(filePath);
        break;
      }
    }
  }

  return Array.from(hits);
}

async function enforceExpectedArtifactsAtStop(data, state, mapped) {
  const specs = Array.isArray(mapped?.expected_artifacts) ? mapped.expected_artifacts : [];
  if (specs.length === 0) return;

  const turnStartMs = Number(state.turn_start_ms);
  if (!Number.isFinite(turnStartMs) || turnStartMs <= 0) {
    throw new Error('turn_start_ms missing or invalid');
  }

  const workspaceDir = getWorkspaceDir(data) || process.cwd();
  const scanRoot = path.resolve(workspaceDir);

  // Scan root is deterministic: prefer workspace.current_dir, else process.cwd().
  // Safety is ensured by constraining artifact checks to .planning/** under scanRoot.

  for (const spec of specs) {
    if (!spec || typeof spec !== 'object') continue;

    const baseDir = typeof spec.base_dir === 'string' ? spec.base_dir : '';
    if (!baseDir) continue;
    if (!baseDir.startsWith('.planning/')) {
      throw new Error(`artifact base_dir must be under .planning/: ${baseDir}`);
    }

    const scanBase = path.resolve(scanRoot, baseDir);
    if (!isWithinDir(scanBase, scanRoot)) {
      throw new Error(`artifact base_dir escapes workspace: ${baseDir}`);
    }

    if (!fs.existsSync(scanBase)) {
      stopBlock(
        formatBlockMessage({
          command: state.command,
          required_subagent: state.required_subagent,
          delegated_subagent: state.delegated_subagent || '',
          subagent_completed_at_ms: state.subagent_completed_at_ms,
          expected_artifacts: specs,
          error_code: 'USER_ARTIFACT_BASE_MISSING',
          next_step: `下一步：在仓库根目录运行命令，确保本回合能创建 ${baseDir} 以及对应产物。`,
        })
      );
      return;
    }

    const requiredAll = Array.isArray(spec.required_all) ? spec.required_all : null;
    const requiredAny = Array.isArray(spec.required_any) ? spec.required_any : null;

    if (requiredAll && requiredAll.length > 0) {
      for (const pat of requiredAll) {
        const hits = collectArtifactMatches(scanBase, [pat], turnStartMs);
        if (hits.length === 0) {
          stopBlock(
            formatBlockMessage({
              command: state.command,
              required_subagent: state.required_subagent,
              delegated_subagent: state.delegated_subagent || '',
              subagent_completed_at_ms: state.subagent_completed_at_ms,
              expected_artifacts: specs,
              next_step: `下一步：确保本回合会创建一个匹配 ${baseDir}/${pat} 的产物文件。`,
            })
          );
          return;
        }
      }
    }

    if (requiredAny && requiredAny.length > 0) {
      const hits = collectArtifactMatches(scanBase, requiredAny, turnStartMs);
      if (hits.length === 0) {
        stopBlock(
          formatBlockMessage({
            command: state.command,
            required_subagent: state.required_subagent,
            delegated_subagent: state.delegated_subagent || '',
            subagent_completed_at_ms: state.subagent_completed_at_ms,
            expected_artifacts: specs,
            next_step: `下一步：确保本回合在 ${baseDir} 下至少创建一个匹配以下任一模式的产物：${requiredAny.join(', ')}。`,
          })
        );
        return;
      }
    }
  }
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

/**
 * Load command_mapping from project-level .planning/config.json.
 *
 * @param {string} workspaceDir - Absolute path to workspace root
 * @returns {{ mapping: object|null, error: string|null }}
 *   - mapping: parsed command_mapping object, or null if not found/invalid
 *   - error: error message if parsing/validation failed, null otherwise
 */
function loadCommandMapping(workspaceDir) {
  const configPath = path.join(workspaceDir, '.planning', 'config.json');

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ENOENT') {
      // File does not exist: silent fallback to defaults
      return { mapping: null, error: null };
    }
    return { mapping: null, error: `failed to read config: ${e.message || String(e)}` };
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    return { mapping: null, error: `invalid JSON in config.json: ${e.message || String(e)}` };
  }

  if (!config || typeof config !== 'object') {
    return { mapping: null, error: 'config.json is not an object' };
  }

  const mapping = config.command_mapping;
  if (mapping === undefined || mapping === null) {
    // No command_mapping field: use defaults
    return { mapping: null, error: null };
  }

  if (typeof mapping !== 'object' || Array.isArray(mapping)) {
    return { mapping: null, error: 'command_mapping must be an object' };
  }

  // Validate each entry
  const errors = [];
  for (const key of Object.keys(mapping)) {
    if (!key.startsWith('/gsd:')) {
      errors.push(`key "${key}" must start with "/gsd:"`);
      continue;
    }

    const entry = mapping[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`entry for "${key}" must be an object`);
      continue;
    }

    if (typeof entry.required_subagent !== 'string') {
      errors.push(`"${key}".required_subagent must be a string`);
    }
  }

  if (errors.length > 0) {
    return { mapping: null, error: `command_mapping validation failed: ${errors.join('; ')}` };
  }

  return { mapping, error: null };
}

/**
 * Get effective command map by merging project config over defaults.
 *
 * @param {object|null} projectMapping - Project-level command_mapping or null
 * @returns {object} Merged command map (project overrides defaults)
 */
function getEffectiveCommandMap(projectMapping) {
  if (!projectMapping) {
    return DEFAULT_COMMAND_MAP;
  }
  return { ...DEFAULT_COMMAND_MAP, ...projectMapping };
}


// Phase 1 explicit mapping (Phase 2 externalizes to .planning/config.json).
//
// Semantics:
// - required_subagent:
//   - "none": no delegation enforcement
//   - "other": explicitly mapped, but not enforced in Phase 1 (e.g. multi-subagent commands)
//   - "gsd-*": enforced to match the first Task() subagent_type captured in PreToolUse
// - expected_artifacts: optional deterministic same-turn artifact checks
const DEFAULT_COMMAND_MAP = Object.freeze({
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
  '/gsd:plan-phase': {
    required_subagent: 'gsd-planner',
    expected_artifacts: [
      {
        base_dir: '.planning/phases',
        required_any: ['**/*-PLAN.md'],
      },
    ],
    allowed_pre_tools: ['Task'],
  },
  '/gsd:progress': { required_subagent: 'none', expected_artifacts: [] },
  '/gsd:quick': {
    required_subagent: 'gsd-executor',
    expected_artifacts: [
      {
        base_dir: '.planning/quick',
        required_all: ['**/*-PLAN.md', '**/*-SUMMARY.md'],
      },
    ],
    allowed_pre_tools: ['AskUserQuestion', 'Task'],
  },
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
  // Load project config once at first GSD command detection
  if (!configLoadAttempted) {
    configLoadAttempted = true;
    const workspaceDir = getWorkspaceDir(data) || process.cwd();
    const result = loadCommandMapping(workspaceDir);
    projectCommandMapping = result.mapping;
    configLoadError = result.error;
    if (configLoadError) {
      debugLog(`config load error: ${configLoadError}`);
    } else if (projectCommandMapping) {
      debugLog(`loaded project command_mapping with ${Object.keys(projectCommandMapping).length} entries`);
    }
  }

  const effectiveMap = getEffectiveCommandMap(projectCommandMapping);
  const promptText = getPromptText(data);
  const command = extractFirstGsdCommand(promptText);

  if (DEBUG) {
    const keys = data && typeof data === 'object' ? Object.keys(data).sort().join(',') : '';
    debugLog(`UserPromptSubmit keys=[${keys}] command=${command || 'none'}`);
  }

  const sessionId = getSessionId(data);

  if (!command) {
    if (sessionId) {
      clearTurnState(sessionId);
    }
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(effectiveMap, command)) {
    // Unmapped /gsd:* command: warn but still track for fail-closed at Stop
    debugLog(`unmapped command ${command} - will block at Stop`);
    if (!sessionId) {
      failLoud('UserPromptSubmit', `detected ${command} but session_id is missing (cannot persist turn state)`, 'SystemFault');
      return;
    }

    // Extract parallel claim for fake-parallel detection
    const parallelClaim = extractParallelClaim(promptText);

    const state = {
      active: true,
      command,
      required_subagent: null,
      turn_start_ms: Date.now(),
      session_id: sessionId,
      expected_parallel_count: parallelClaim,
      task_call_count: 0,
    };

    writeTurnState(sessionId, state);
    return;
  }

  if (!sessionId) {
    failLoud('UserPromptSubmit', `detected ${command} but session_id is missing (cannot persist turn state)`, 'SystemFault');
    return;
  }

  const mapped = effectiveMap[command];
  const requiredSubagent = mapped && typeof mapped === 'object' ? mapped.required_subagent : null;

  // Extract parallel claim for fake-parallel detection
  const parallelClaim = extractParallelClaim(promptText);

  const state = {
    active: true,
    command,
    required_subagent: requiredSubagent,
    turn_start_ms: Date.now(),
    session_id: sessionId,
    expected_parallel_count: parallelClaim,
    task_call_count: 0,
  };

  writeTurnState(sessionId, state);
}

function stopBlock(reason) {
  writeJson({ decision: 'block', reason });
  process.exit(0);
}

function formatBlockMessage(fields) {
  const lines = ['GSD 强制规则已阻止'];

  if (fields.command) lines.push(`- command: ${fields.command}`);
  if (fields.required_subagent) lines.push(`- required_subagent: ${fields.required_subagent}`);
  if (fields.delegated_subagent !== undefined) {
    lines.push(`- delegated_subagent: ${fields.delegated_subagent || '(none)'}`);
  }
  if (fields.expected_artifacts && fields.expected_artifacts.length > 0) {
    lines.push('- expected_artifacts:');
    for (const spec of fields.expected_artifacts) {
      if (!spec || typeof spec !== 'object') continue;
      const base = typeof spec.base_dir === 'string' ? spec.base_dir : '(unknown)';
      const any = Array.isArray(spec.required_any) ? spec.required_any.join(', ') : '';
      const all = Array.isArray(spec.required_all) ? spec.required_all.join(', ') : '';
      const part = all ? `all=[${all}]` : any ? `any=[${any}]` : '';
      lines.push(`  - ${base} ${part}`.trimEnd());
    }
  }

  if (fields.subagent_completed_at_ms) {
    lines.push(`- subagent_completed_at_ms: ${fields.subagent_completed_at_ms}`);
  }

  if (fields.error_code) {
    lines.push(`- error: ${fields.error_code}`);
  }

  if (fields.next_step) {
    lines.push('');
    lines.push(fields.next_step);
  }

  return lines.join('\n');
}

function preToolDeny(reason) {
  preToolDenyWithMessage({
    error_code: 'USER_PRETOOL_DENY',
    next_step: `下一步：${sanitizeForUser(String(reason))}`,
  });
}

function preToolDenyWithMessage(fields) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formatBlockMessage(fields),
    },
  });
  process.exit(0);
}

async function handleStop(data) {
  // Load project config if not already loaded
  if (!configLoadAttempted) {
    configLoadAttempted = true;
    const workspaceDir = getWorkspaceDir(data) || process.cwd();
    const result = loadCommandMapping(workspaceDir);
    projectCommandMapping = result.mapping;
    configLoadError = result.error;
    if (configLoadError) {
      debugLog(`config load error: ${configLoadError}`);
    } else if (projectCommandMapping) {
      debugLog(`loaded project command_mapping with ${Object.keys(projectCommandMapping).length} entries`);
    }
  }

  const effectiveMap = getEffectiveCommandMap(projectCommandMapping);

  const sessionId = getSessionId(data);
  if (!sessionId) {
    failLoud('Stop', 'missing session_id (cannot correlate turn state)', 'SystemFault');
    return;
  }

  let state;
  try {
    state = readTurnState(sessionId);
  } catch (e) {
    failLoud('Stop', `failed to read turn state: ${e && e.message ? e.message : String(e)}`, 'SystemFault');
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

  if (!Object.prototype.hasOwnProperty.call(effectiveMap, command)) {
    stopBlock(
      formatBlockMessage({
        command,
        error_code: 'USER_UNMAPPED_COMMAND',
        next_step:
          '下一步：在 .planning/config.json 的 command_mapping 或 DEFAULT_COMMAND_MAP（hooks/gsd-enforce.js）里为这个 /gsd:* 命令新增显式映射。',
      })
    );
    return;
  }

  const mapped = effectiveMap[command];
  const requiredSubagent = typeof mapped?.required_subagent === 'string' ? mapped.required_subagent : 'unknown';
  const delegatedSubagent =
    typeof state.delegated_subagent === 'string' && state.delegated_subagent.trim() !== ''
      ? state.delegated_subagent
      : '';

  // 1) required_subagent enforcement (Phase 01-04)
  if (requiredSubagent !== 'none' && requiredSubagent !== 'other') {
    const expectedArtifacts = Array.isArray(mapped?.expected_artifacts) ? mapped.expected_artifacts : [];

    if (!delegatedSubagent) {
      stopBlock(
        formatBlockMessage({
          command,
          required_subagent: requiredSubagent,
          delegated_subagent: delegatedSubagent,
          subagent_completed_at_ms: state.subagent_completed_at_ms,
          expected_artifacts: expectedArtifacts,
          next_step: `下一步：先用 Task 工具委托 subagent_type="${requiredSubagent}"（再执行后续工具调用）。`,
        })
      );
      return;
    }

    if (delegatedSubagent !== requiredSubagent) {
      stopBlock(
        formatBlockMessage({
          command,
          required_subagent: requiredSubagent,
          delegated_subagent: delegatedSubagent,
          subagent_completed_at_ms: state.subagent_completed_at_ms,
          expected_artifacts: expectedArtifacts,
          next_step: `下一步：用 Task(subagent_type="${requiredSubagent}") 重新按映射委托正确的子代理。`,
        })
      );
      return;
    }
  }

  // 2) expected_artifacts enforcement (Phase 01-04)
  try {
    await enforceExpectedArtifactsAtStop(data, state, mapped);
  } catch (e) {
    failLoud('Stop', `artifact verification failed: ${e && e.message ? e.message : String(e)}`, 'SystemFault');
    return;
  }

  // Success path: clear turn state.
  clearTurnState(sessionId);
}

async function handleSubagentStop(data) {
  const sessionId = getSessionId(data);
  if (!sessionId) {
    return;
  }

  let state;
  try {
    state = readTurnState(sessionId);
  } catch (e) {
    failLoud('SubagentStop', `failed to read turn state: ${e && e.message ? e.message : String(e)}`, 'SystemFault');
    return;
  }

  if (!state || state.active !== true) {
    return;
  }

  state.subagent_completed = true;
  state.subagent_completed_at_ms = Date.now();

  try {
    writeTurnState(sessionId, state);
  } catch (e) {
    failLoud('SubagentStop', `failed to write turn state: ${e && e.message ? e.message : String(e)}`, 'SystemFault');
    return;
  }
}

async function handlePreToolUse(data) {
  // Load project config if not already loaded
  if (!configLoadAttempted) {
    configLoadAttempted = true;
    const workspaceDir = getWorkspaceDir(data) || process.cwd();
    const result = loadCommandMapping(workspaceDir);
    projectCommandMapping = result.mapping;
    configLoadError = result.error;
    if (configLoadError) {
      debugLog(`config load error: ${configLoadError}`);
    } else if (projectCommandMapping) {
      debugLog(`loaded project command_mapping with ${Object.keys(projectCommandMapping).length} entries`);
    }
  }

  const sessionId = getSessionId(data);
  if (!sessionId) {
    // Cannot correlate to a turn state; do not attempt enforcement.
    return;
  }

  let state;
  try {
    state = readTurnState(sessionId);
  } catch (e) {
    failLoud('PreToolUse', `failed to read turn state: ${e && e.message ? e.message : String(e)}`, 'SystemFault');
    return;
  }

  if (!state || state.active !== true) {
    // Non-GSD turn (or already cleared). Do not deny.
    return;
  }

  const command = typeof state.command === 'string' ? state.command : '';
  if (!command.startsWith('/gsd:')) {
    return;
  }

  const toolName = getToolName(data);
  if (!toolName) {
    failLoud('PreToolUse', 'missing tool_name (cannot enforce tool gate)', 'SystemFault');
    return;
  }

  const delegated = typeof state.delegated_subagent === 'string' && state.delegated_subagent.trim() !== '';
  if (delegated) {
    // Delegation already happened; Phase 01-03 does not enforce anything else here.
    return;
  }

  const effectiveMap = getEffectiveCommandMap(projectCommandMapping);
  const mapped = Object.prototype.hasOwnProperty.call(effectiveMap, command) ? effectiveMap[command] : null;
  const allowedPreTools = Array.isArray(mapped?.allowed_pre_tools) ? mapped.allowed_pre_tools : ['Task'];
  const requiredSubagent = typeof state.required_subagent === 'string' ? state.required_subagent : 'unknown';

  if (!allowedPreTools.includes(toolName)) {
    const expectedArtifacts = Array.isArray(mapped?.expected_artifacts) ? mapped.expected_artifacts : [];

    preToolDenyWithMessage({
      command,
      required_subagent: requiredSubagent,
      delegated_subagent: '',
      expected_artifacts: expectedArtifacts,
      error_code: 'USER_TOOL_BEFORE_DELEGATION',
      next_step: `下一步：先用 Task 委托 subagent_type="${requiredSubagent}"，再使用工具 "${toolName}"。`,
    });
    return;
  }

  if (toolName === 'Task') {
    const input = getToolInput(data);
    if (!input) {
      failLoud('PreToolUse', 'Task tool_input missing or not an object (cannot extract subagent_type)', 'SystemFault');
      return;
    }

    const subagentType = input.subagent_type;
    if (typeof subagentType !== 'string' || subagentType.trim() === '') {
      failLoud('PreToolUse', 'Task tool_input.subagent_type missing or empty (fail-loud)', 'SystemFault');
      return;
    }

    state.delegated_subagent = subagentType;
    state.delegated_at_ms = Date.now();

    writeTurnState(sessionId, state);

    if (DEBUG) {
      const keys = Object.keys(input).sort().join(',');
      debugLog(`PreToolUse Task captured subagent_type=${subagentType} tool_input.keys=[${keys}]`);
    }

    return;
  }

  // Allowed pre-tool but not Task: do nothing.
}

async function main() {
  const raw = await readStdin();

  // In normal hook execution, stdin is always valid JSON. If not, fail-loud.
  if (!raw || !raw.trim()) {
    failLoud(null, 'empty stdin (expected JSON hook payload)', 'SystemFault');
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    failLoud(null, `failed to parse JSON: ${e && e.message ? e.message : String(e)}`, 'SystemFault');
    return;
  }

  const hookEventName = getHookEventName(data);
  if (!hookEventName) {
    failLoud(null, 'missing hookEventName (cannot dispatch)', 'SystemFault');
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

    if (hookEventName === 'PreToolUse') {
      await handlePreToolUse(data);
      process.exit(0);
    }

    if (hookEventName === 'SubagentStop') {
      await handleSubagentStop(data);
      process.exit(0);
    }

    // Unknown event: follow Phase 01-01 decision (non-zero exit).
    failLoud(hookEventName, `unsupported hook event '${hookEventName}'`, 'SystemFault');
  } catch (e) {
    failLoud(hookEventName, e && e.message ? e.message : String(e), 'SystemFault');
  }
}

main().catch((e) => {
  failLoud(null, e && e.message ? e.message : String(e), 'SystemFault');
});
