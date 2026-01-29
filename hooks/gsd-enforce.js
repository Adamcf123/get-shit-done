#!/usr/bin/env node
/**
 * GSD enforcement hook (skeleton).
 *
 * Phase 01-01 goal: provide an installable hook entrypoint that is safe to run.
 * Later plans will implement actual enforcement logic.
 */

'use strict';

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

  try {
    // Minimal skeleton: default allow (no-op) for all events.
    // TODO(phase-01): implement turn-scoped enforcement for /gsd:* commands.
    void hookEventName;
    process.exit(0);
  } catch (e) {
    failLoud(hookEventName, e && e.message ? e.message : String(e));
  }
}

main().catch((e) => {
  failLoud(null, e && e.message ? e.message : String(e));
});
