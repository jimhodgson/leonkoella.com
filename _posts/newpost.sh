#!/usr/bin/env bash
set -euo pipefail

POSTS_DIR="${POSTS_DIR:-.}"

# YAML single-quote helper: wraps in '...' and escapes internal single quotes
yaml_q() { printf "'%s'" "${1//\'/\'\'}"; }
w
ask() {
  # ask VAR "Prompt" [default]
  local __var="$1" __prompt="$2" __default="${3-}" input
  if [[ -n "$__default" ]]; then
    read -r -p "$__prompt [$__default]: " input
    [[ -z "$input" ]] && input="$__default"
  else
    read -r -p "$__prompt: " input
  fi
  printf -v "$__var" "%s" "$input"
}

# 1) Gather inputs
mkdir -p "$POSTS_DIR"

TITLE=""
while [[ -z "${TITLE}" ]]; do ask TITLE "Title (required)"; done

ask DESCRIPTION "Description"
ask FORMAT "Format (e.g., Oil on cradled hardboard.)"
ask SIZE 'Size (e.g., 30"x40")'
ask IMAGE "Featured image path (e.g., /assets/images/arromanches30x40.jpg)"
ask CATEGORIES "Categories (comma-separated or single, e.g., 30x40)"

# Sold? (y/N)
SOLD="false"
yn=""
read -r -p "Sold? [y/N]: " yn || true
case "$yn" in
  y|Y|yes|Yes|YES) SOLD="true" ;;
  *)               SOLD="false" ;;
esac

# Date (default: now)
NOW_PREFIX="$(date +%Y-%m-%d)"
NOW_DISPLAY="$(date +"%Y-%m-%d %H:%M:%S %z")"
ask DATE_STR "Date string (YYYY-MM-DD HH:MM:SS ±TZ) or leave blank for now" "$NOW_DISPLAY"
DATE_PREFIX="${DATE_STR%% *}"; [[ -z "$DATE_PREFIX" ]] && DATE_PREFIX="$NOW_PREFIX"

# 2) Build slug & filename
SLUG="$(printf '%s' "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"

FILE="$POSTS_DIR/$DATE_PREFIX-$SLUG.md"
if [[ -e "$FILE" ]]; then
  read -r -p "File exists: $FILE — overwrite? [y/N]: " ow || ow=""
  [[ "${ow,,}" =~ ^y ]] || { echo "Aborted."; exit 1; }
fi

# 3) Categories YAML (inline if single, list if commas)
CATS_YAML=""
if [[ -n "${CATEGORIES}" ]]; then
  if [[ "$CATEGORIES" == *","* ]]; then
    IFS=',' read -r -a arr <<< "$CATEGORIES"
    CATS_YAML=$'\n'"categories:"
    for item in "${arr[@]}"; do
      item_trimmed="$(echo "$item" | xargs)"
      CATS_YAML+=$'\n'"  - $(yaml_q "$item_trimmed")"
    done
  else
    CATS_YAML=$'\n'"categories: $(yaml_q "$CATEGORIES")"
  fi
fi

# 4) Write file
cat > "$FILE" <<EOF
---
layout: post
title: $(yaml_q "$TITLE")
description: $(yaml_q "$DESCRIPTION")
format: $(yaml_q "$FORMAT")
size: $(yaml_q "$SIZE")
date: $DATE_STR$(printf %s "$CATS_YAML")
sold: $SOLD
featured_image: $(yaml_q "$IMAGE")
---

{{page.title}} {{page.description}}

{{page.format}} {{page.size}}

<div class="frame-gold frame-gold--mat">
  <img class="postimage" src="{{page.featured_image}}">
</div>
EOF

echo "Created: $FILE"

