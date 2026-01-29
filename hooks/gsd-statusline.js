#!/usr/bin/env node
// Claude Code Statusline - GSD Edition
// Shows: model | current task | directory | token usage + percentage

const fs = require('fs');
const path = require('path');
const os = require('os');

// Model context window sizes (tokens)
const MODEL_CONTEXT_WINDOWS = [
  ['claude', 200000],
  ['kimi', 256000],
  ['gpt-', 272000],
  ['gemini', 500000],
  ['', 200000],  // Default fallback
];

/**
 * Get context window size for a model ID
 */
function getModelContextSize(modelId) {
  const id = (modelId || '').toLowerCase();
  for (const [pattern, size] of MODEL_CONTEXT_WINDOWS) {
    if (id.includes(pattern)) return size;
  }
  return 200000;
}

/**
 * Read transcript JSONL to get most recent usage data
 * For non-Claude models that don't populate current_usage
 */
function getContextFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].trim()) continue;
      try {
        const entry = JSON.parse(lines[i]);
        const usage = entry.message?.usage;
        const inputTokens = usage?.input_tokens || 0;
        if (inputTokens > 0) {
          return {
            inputTokens,
            cacheRead: usage.cache_read_input_tokens || 0,
            cacheCreation: usage.cache_creation_input_tokens || 0,
          };
        }
      } catch (e) {}
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Get context info: total tokens, percentage, display string
 *
 * Strategy:
 * - Claude models: use remaining_percentage (Claude Code's built-in)
 * - Non-Claude models: use token-based calculation with hardcoded context sizes
 */
function getContextInfo(data) {
  const ctx = data.context_window || {};
  const modelId = (data.model?.id || '').toLowerCase();
  const isClaude = modelId.includes('claude');

  // Claude models: use remaining_percentage directly
  if (isClaude) {
    const remaining = ctx.remaining_percentage;
    if (remaining != null) {
      const pct = Math.max(0, Math.min(100, 100 - Math.round(remaining)));
      return { totalTokens: 0, pct, display: '' };
    }
    return { totalTokens: 0, pct: 0, display: '?' };
  }

  // Non-Claude models: use token-based calculation
  const usage = ctx.current_usage || {};
  let inputTokens = usage.input_tokens || 0;
  let cacheRead = usage.cache_read_input_tokens || 0;
  let cacheCreation = usage.cache_creation_input_tokens || 0;

  // Fallback: read from transcript if current_usage is empty
  if (inputTokens === 0 && cacheRead === 0 && cacheCreation === 0) {
    const transcriptUsage = getContextFromTranscript(data.transcript_path);
    if (transcriptUsage) {
      inputTokens = transcriptUsage.inputTokens;
      cacheRead = transcriptUsage.cacheRead;
      cacheCreation = transcriptUsage.cacheCreation;
    }
  }

  if (inputTokens > 0 || cacheRead > 0 || cacheCreation > 0) {
    const totalTokens = inputTokens + cacheRead + cacheCreation;
    const contextSize = getModelContextSize(modelId);
    const pct = Math.min(100, Math.round(totalTokens * 100 / contextSize));
    const display = (totalTokens / 1000).toFixed(1) + 'K';
    return { totalTokens, pct, display };
  }

  return { totalTokens: 0, pct: 0, display: '?' };
}

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';

    // Get context info (token-based calculation)
    const { pct: rawUsed, display: tokenDisplay } = getContextInfo(data);

    // Scale: 80% real usage = 100% displayed (Claude Code enforces 80% limit)
    const used = Math.min(100, Math.round((rawUsed / 80) * 100));

    // Build context display with progress bar
    let ctx = '';
    if (used > 0 || (tokenDisplay && tokenDisplay !== '?')) {
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      // Token display prefix (empty if using remaining_percentage fallback)
      const tokenPrefix = tokenDisplay ? `${tokenDisplay} ` : '';

      // Color based on scaled usage (thresholds adjusted for new scale)
      if (used < 63) {        // ~50% real
        ctx = ` \x1b[32m${tokenPrefix}${bar} ${used}%\x1b[0m`;
      } else if (used < 81) { // ~65% real
        ctx = ` \x1b[33m${tokenPrefix}${bar} ${used}%\x1b[0m`;
      } else if (used < 95) { // ~76% real
        ctx = ` \x1b[38;5;208m${tokenPrefix}${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m💀 ${tokenPrefix}${bar} ${used}%\x1b[0m`;
      }
    }

    // Current task from todos
    let task = '';
    const homeDir = os.homedir();
    const todosDir = path.join(homeDir, '.claude', 'todos');
    if (session && fs.existsSync(todosDir)) {
      const files = fs.readdirSync(todosDir)
        .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        try {
          const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find(t => t.status === 'in_progress');
          if (inProgress) task = inProgress.activeForm || '';
        } catch (e) {}
      }
    }

    // GSD update available?
    let gsdUpdate = '';
    const cacheFile = path.join(homeDir, '.claude', 'cache', 'gsd-update-check.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.update_available) {
          gsdUpdate = '\x1b[33m⬆ /gsd:update\x1b[0m │ ';
        }
      } catch (e) {}
    }

    // Output
    const dirname = path.basename(dir);
    if (task) {
      process.stdout.write(`${gsdUpdate}\x1b[97m${model}\x1b[0m │ \x1b[1;97m${task}\x1b[0m │ \x1b[97m${dirname}\x1b[0m${ctx}`);
    } else {
      process.stdout.write(`${gsdUpdate}\x1b[97m${model}\x1b[0m │ \x1b[97m${dirname}\x1b[0m${ctx}`);
    }
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
