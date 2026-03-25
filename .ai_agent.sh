#!/bin/bash

# =========================================
# LEVEL 10 AGENT CORE
# Author: William + ChatGPT (2026)
# Multi-agent + learning + validation loop
# =========================================

echo "🧬 Initialising AI Agent..."

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in the environment or .env before running .ai_agent.sh}"
: "${OPENAI_API_BASE:?Set OPENAI_API_BASE in the environment or .env before running .ai_agent.sh}"

MEMORY_FILE=".ai_memory.log"
TASK_FILE=".ai_tasks.txt"

touch "$MEMORY_FILE"
touch "$TASK_FILE"

echo "📁 Working dir: $(pwd)"

get_mtime() {
  if stat --version >/dev/null 2>&1; then
    stat -c "%Y" "$1"
  else
    stat -f "%m" "$1"
  fi
}

# ✅ ensure git exists
if [ ! -d ".git" ]; then
  echo "⚠️ Initialising git repo..."
  git init
fi

# =========================
# 🧠 STEP 1 — SMART FILE DETECTION
# =========================

TARGET_FILE=""
LATEST_MTIME=""

while IFS= read -r -d '' file; do
  mtime=$(get_mtime "$file") || continue
  if [[ -z "$LATEST_MTIME" || "$mtime" -gt "$LATEST_MTIME" ]]; then
    LATEST_MTIME="$mtime"
    TARGET_FILE="$file"
  fi
done < <(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0)

FILES=()

if [[ -n "$TARGET_FILE" ]]; then
  echo "🎯 Target file: $TARGET_FILE"
  FILES+=("$TARGET_FILE")
else
  echo "⚠️ No target file found"
fi

# =========================
# 🧠 STEP 2 — CREATE TASKS (PLANNER)
# =========================

echo "🧠 Generating tasks..."

TASKS=$(aider \
  --model openai/qwen/qwen2.5-coder-14b \
  --yes-always \
  --no-auto-commits \
  --message "
Analyse the repo and list real issues in the editor system only.

Output plain bullet list.
" \
"${FILES[@]}")

echo "$TASKS" > "$TASK_FILE"

cat "$TASK_FILE"

# =========================
# 🔁 MAIN LOOP
# =========================

for i in 1 2 3 4 5; do

  echo ""
  echo "🔁 ITERATION $i"
  echo "---------------------"

  TASK=$(head -n 1 "$TASK_FILE")

  if [[ -z "$TASK" ]]; then
    echo "✅ No tasks left"
    break
  fi

  echo "🎯 Task: $TASK"

  # =========================
  # 🧠 CODER (14B)
  # =========================

  aider \
    --model openai/qwen/qwen2.5-coder-14b \
    --map-tokens 2048 \
    --map-refresh always \
    --subtree-only \
    --yes-always \
    --no-auto-commits \
    --message "
Fix this issue:

$TASK

Rules:
- do not hallucinate
- only edit real files
- minimal changes
" \
    "${FILES[@]}"

  # =========================
  # 🧪 TEST
  # =========================

  if [ -f "package.json" ]; then
    echo "🧪 Running tests..."
    TEST_OUTPUT=$(npm test --silent 2>&1)
  else
    TEST_OUTPUT="NO TESTS"
  fi

  echo "$TEST_OUTPUT"

  # =========================
  # 🧑‍⚖️ JUDGE (7B)
  # =========================

  RESULT=$(aider \
    --model openai/qwen2.5-coder-7b-instruct \
    --yes-always \
    --no-auto-commits \
    --message "
Evaluate result:

TASK:
$TASK

TEST OUTPUT:
$TEST_OUTPUT

Answer ONLY:
PASS or FAIL
")

  echo "📊 Verdict: $RESULT"

  # =========================
  # 🧬 LEARNING
  # =========================

  if echo "$RESULT" | grep -q "PASS"; then

    echo "✅ Accepted"

    tail -n +2 "$TASK_FILE" > tmp && mv tmp "$TASK_FILE"

    echo "SUCCESS: $TASK" >> "$MEMORY_FILE"

  else

    echo "❌ Rejected"

    echo "FAIL: $TASK" >> "$MEMORY_FILE"

  fi

done

echo ""
echo "🏁 Agent finished"
