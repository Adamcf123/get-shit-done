---
name: gsd:summarize
description: Summarize current session for handoff to a new conversation
allowed-tools:
  - Read
---

{{LANGUAGE_DIRECTIVE}}
<objective>
Generate an instant summary of the current conversation session for seamless handoff to a new Claude session.

Output directly to the current session - no file persistence needed.
</objective>

<process>

<step name="analyze">
**Review the current conversation and extract:**

1. **Core Objective** - What was the user trying to accomplish in this session?
2. **Key Decisions** - What choices were made and why?
3. **Incomplete Work** - What remains unfinished?
4. **Context for New Session** - What keywords, file paths, and concepts would a fresh Claude need to understand?
5. **Key Definitions** - Important terms, patterns, or domain concepts discussed
</step>

<step name="output">
**Output the summary directly in this format:**

```
## Session Summary

### Core Objective
[What the user was trying to accomplish]

### Key Decisions
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

### Incomplete Work
- [ ] [Task 1]
- [ ] [Task 2]

### Context for New Session

**Keywords:** [term1], [term2], [term3]

**Key Files:**
- `path/to/file1` - [purpose]
- `path/to/file2` - [purpose]

### Key Definitions & Concepts
- **[Term 1]**: [Definition]
- **[Term 2]**: [Definition]
- **[Pattern/Concept]**: [Explanation]

### Recommended First Action
[What to do first when resuming in a new session]
```

Be comprehensive with definitions and concepts - the more context preserved, the better.
</step>

</process>

<success_criteria>
- [ ] Core objective clearly stated
- [ ] All significant decisions captured with rationale
- [ ] Incomplete work itemized
- [ ] Relevant file paths listed
- [ ] Key terms and concepts defined (as many as useful)
- [ ] Output displayed directly in session (no file created)
</success_criteria>
