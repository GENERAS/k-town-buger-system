import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  entities: Record<string, unknown>;
  firestore: Record<string, { schema: string; description: string }>;
};

test('firestore.rules enforces global default-deny and verified identity checks', () => {
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rulesText, /function isVerifiedSignedIn\(\) \{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;\s*\}/);
  assert.match(rulesText, /function isBootstrappedAdmin\(\) \{\s*return isVerifiedSignedIn\(\) && request\.auth\.token\.email == 'generaskagiraneza@gmail\.com';\s*\}/);
});

test('all firebase-blueprint.json collections have explicit match rules and zero blanket allow read', () => {
  assert.equal(
    /allow read:\s*if true\s*;/.test(rulesText),
    false,
    'firestore.rules must never allow unguarded read: if true;',
  );
  assert.equal(
    /allow write:\s*if true\s*;/.test(rulesText),
    false,
    'firestore.rules must never allow unguarded write: if true;',
  );

  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const [collectionName] = collectionPath.replace(/^\//, '').split('/');
    assert.match(
      rulesText,
      new RegExp(`match\\s+/${collectionName}/\\{`),
      `Missing match block for blueprint collection ${collectionName}`,
    );
  }
});

test('allow list rules avoid get() and exists() calls that break Firestore query evaluation', () => {
  const listLines = rulesText
    .split('\n')
    .filter((line) => line.includes('allow list:'));
  assert.ok(listLines.length >= 15, 'Expected allow list rules across collections');
  for (const line of listLines) {
    assert.equal(
      /\b(get|exists|isAdmin|isStaff|isStaffOrAdmin)\s*\(/.test(line),
      false,
      `allow list must not call get/exists/isAdmin/isStaff: ${line.trim()}`,
    );
  }
});

test('every collection splits create and update and locks terminal order states', () => {
  // Ensure no combined "allow create, update:" or "allow write:" bypasses existing() checks
  assert.equal(
    /allow (write|create,\s*update):/.test(rulesText),
    false,
    'Split allow create and allow update in all collection blocks',
  );

  // Dirty Dozen checks: terminal state locking, order ownership, feedback relational integrity
  assert.match(rulesText, /!\(existing\(\)\.status in \['Completed', 'Cancelled'\]\)/);
  assert.match(rulesText, /incoming\(\)\.userId == request\.auth\.uid/);
  assert.match(rulesText, /incoming\(\)\.status == 'New order received'/);
  assert.match(rulesText, /exists\(\/databases\/\$\(database\)\/documents\/orders\/\$\(incoming\(\)\.orderId\)\)/);
  assert.match(rulesText, /get\(\/databases\/\$\(database\)\/documents\/orders\/\$\(incoming\(\)\.orderId\)\)\.data\.userId == request\.auth\.uid/);
  assert.match(rulesText, /match \/admins\/\{uid\}[\s\S]*allow update: if false;/);
});
