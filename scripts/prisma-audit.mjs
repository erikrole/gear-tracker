#!/usr/bin/env node
/**
 * prisma-audit: Cross-references prisma/schema.prisma against docs/AREA_*.md
 * and prompts/*.md to find spec/schema gaps.
 *
 * Usage: node scripts/prisma-audit.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const SCHEMA_PATH = join(ROOT, 'prisma/schema.prisma')
const DOCS_DIR = join(ROOT, 'docs')
const PROMPTS_DIR = join(ROOT, 'prompts')

// ── 1. Parse schema models and fields ────────────────────────────────────────

function parseSchema(schemaText) {
  const models = {}
  let currentModel = null

  for (const line of schemaText.split('\n')) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/)
    if (modelMatch) {
      currentModel = modelMatch[1]
      models[currentModel] = { fields: [], relations: [] }
      continue
    }
    if (line.trim() === '}') {
      currentModel = null
      continue
    }
    if (currentModel) {
      const fieldMatch = line.match(/^\s+(\w+)\s+(\w+)/)
      if (fieldMatch && !line.trim().startsWith('//') && !line.trim().startsWith('@@')) {
        const [, fieldName, fieldType] = fieldMatch
        if (fieldType[0] === fieldType[0].toUpperCase()) {
          models[currentModel].relations.push(fieldName)
        } else {
          models[currentModel].fields.push(fieldName)
        }
      }
    }
  }

  return models
}

// ── 2. Extract field/model mentions from docs ─────────────────────────────────

function extractMentions(text) {
  // Look for backtick-quoted identifiers (field names, model names)
  const backtickMatches = [...text.matchAll(/`(\w+)`/g)].map(m => m[1])
  // Look for camelCase words that look like field names
  const camelMatches = [...text.matchAll(/\b([a-z][a-zA-Z]+[A-Z][a-zA-Z]*)\b/g)].map(m => m[1])
  return [...new Set([...backtickMatches, ...camelMatches])]
}

function readAllDocs() {
  const docs = []

  for (const dir of [DOCS_DIR, PROMPTS_DIR]) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const content = readFileSync(join(dir, file), 'utf8')
      docs.push({ file, content })
    }
  }

  return docs
}

// ── 3. Run audit ──────────────────────────────────────────────────────────────

function audit() {
  if (!existsSync(SCHEMA_PATH)) {
    console.error('❌ prisma/schema.prisma not found. Run from project root.')
    process.exit(1)
  }

  const schema = readFileSync(SCHEMA_PATH, 'utf8')
  const models = parseSchema(schema)
  const docs = readAllDocs()

  const modelNames = new Set(Object.keys(models))
  const allFieldNames = new Set(
    Object.values(models).flatMap(m => [...m.fields, ...m.relations])
  )

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  PRISMA AUDIT — Schema vs Spec Cross-Reference')
  console.log('═══════════════════════════════════════════════════\n')

  // ── Models in schema ────────────────────────────────────────────────────────
  console.log(`📦 Models in schema (${modelNames.size}):`)
  for (const [model, { fields }] of Object.entries(models)) {
    console.log(`   ${model} (${fields.length} fields)`)
  }

  // ── Docs mentioning models not in schema ────────────────────────────────────
  console.log('\n🔍 Potential missing models (mentioned in docs but not in schema):')
  const suspectModels = new Set()
  const knownNonModels = new Set(['Boolean', 'String', 'Int', 'Float', 'DateTime', 'Json', 'Bytes'])

  for (const { file, content } of docs) {
    // Look for PascalCase words that could be model names
    const pascalMatches = [...content.matchAll(/\b([A-Z][a-zA-Z]{3,})\b/g)].map(m => m[1])
    for (const word of pascalMatches) {
      if (!modelNames.has(word) && !knownNonModels.has(word)) {
        suspectModels.add(word)
      }
    }
  }

  // Filter to only things that appear multiple times across docs (reduces noise)
  const multiMention = {}
  for (const { content } of docs) {
    for (const word of suspectModels) {
      if (content.includes(word)) {
        multiMention[word] = (multiMention[word] || 0) + 1
      }
    }
  }

  const candidates = Object.entries(multiMention)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])

  if (candidates.length === 0) {
    console.log('   ✅ No obvious missing models detected')
  } else {
    for (const [word, count] of candidates) {
      console.log(`   ⚠️  ${word} — mentioned in ${count} doc(s), not in schema`)
    }
  }

  // ── Fields mentioned in docs not in any model ───────────────────────────────
  console.log('\n🔍 Potential missing fields (backtick-referenced in docs but not in schema):')
  const missingFields = []

  for (const { file, content } of docs) {
    const mentions = [...content.matchAll(/`([a-z][a-zA-Z]+)`/g)].map(m => m[1])
    for (const field of mentions) {
      if (!allFieldNames.has(field) && field.length > 3) {
        missingFields.push({ field, file })
      }
    }
  }

  // Dedupe and count
  const fieldCounts = {}
  const fieldFiles = {}
  for (const { field, file } of missingFields) {
    fieldCounts[field] = (fieldCounts[field] || 0) + 1
    fieldFiles[field] = fieldFiles[field] || file
  }

  const topMissing = Object.entries(fieldCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  if (topMissing.length === 0) {
    console.log('   ✅ No obvious missing fields detected')
  } else {
    for (const [field, count] of topMissing) {
      console.log(`   ⚠️  \`${field}\` — mentioned ${count}x, first in ${fieldFiles[field]}`)
    }
  }

  // ── Models with no corresponding service file ───────────────────────────────
  console.log('\n🔍 Models without a service file in src/lib/services/:')
  const servicesDir = join(ROOT, 'src/lib/services')
  const serviceFiles = existsSync(servicesDir)
    ? readdirSync(servicesDir).map(f => f.replace('.ts', '').toLowerCase())
    : []

  for (const model of modelNames) {
    const modelLower = model.toLowerCase()
    const hasService = serviceFiles.some(f => f.includes(modelLower))
    if (!hasService) {
      console.log(`   ⚠️  ${model} — no service file found`)
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  Done. Review ⚠️  items above before implementing.')
  console.log('═══════════════════════════════════════════════════\n')
}

audit()
