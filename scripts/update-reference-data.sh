#!/usr/bin/env bash
# Regenerates src/data/legal-forms.js from the Zefix reference endpoints.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=https://www.zefix.admin.ch/ZefixREST/api/v1
OUT=src/data/legal-forms.js
{
  curl -fsS "$BASE/legalForm.json" | python3 -c "
import json,sys
d=json.load(sys.stdin)
forms={x['id']:{'name':x['name'],'short':x['kurzform']} for x in d}
print('// Generated from $BASE/legalForm.json by scripts/update-reference-data.sh')
print('(function (root) {')
print('  const SBR = (root.SBR = root.SBR || {});')
print('  SBR.legalForms = ' + json.dumps(forms, ensure_ascii=False, indent=2).replace('\n','\n  ') + ';')
"
  curl -fsS "$BASE/registerOffice.json" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m={x['id']:x['canton'] for x in sorted(d,key=lambda x:x['id'])}
print('  // Register office id -> canton, from registerOffice.json.')
print('  SBR.registerOfficeCantons = ' + json.dumps(m) + ';')
print('})(globalThis);')
"
} > "$OUT"
echo "Wrote $OUT"
